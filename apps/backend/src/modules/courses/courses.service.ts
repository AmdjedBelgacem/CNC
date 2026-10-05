import { BadRequestException, Injectable, NotFoundException, ForbiddenException, UnauthorizedException, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DrizzleService } from '../../database/drizzle.service';
import { courses, series, lessons } from '../../database/schema/courses';
import { academies } from '../../database/schema/academies';
import { enrollments, lessonProgress, lessonQuizAttempts } from '../../database/schema/progress';
import { certifications } from '../../database/schema/certifications';
import { StorageService, type VideoMeta } from '../storage/storage.service';
import { UploadService } from '../auth/services/upload.service';
import { CertificationService } from '../certification/certification.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SearchService } from '../search/search.service';
import { eq, and, asc, desc, like, ilike, count, sql, inArray, isNull, ne, lt, or } from 'drizzle-orm';
import { CreateCourseDto, UpdateCourseDto, CreateSeriesDto, UpdateSeriesDto, CreateLessonDto, UpdateLessonDto, CourseFilterDto, LessonUploadUrlDto, CreateLessonBlockDto, UpdateLessonBlockDto, ReorderLessonBlocksDto } from './dto/courses.dto';
import {
  getQuizBlocks,
  getRequiredQuizIds,
  gradeQuizBlock,
  localizeCourseFields,
  localizeLessonDocument,
  localizeLessonFields,
  localizeSeriesFields,
  parseContentDocumentOrLegacy,
  parseCourseTranslations,
  parseLessonBlock,
  parseLessonContentDocument,
  parseLessonTranslations,
  parseSeriesTranslations,
  redactPublicLessonBlocks,
  resolveContentLocale,
  synthesizeLegacyLessonDocument,
} from './lesson-content';
import { isCurrencyCode } from '@titan/shared';
import type { ContentLocale, LessonBlock, LessonContentDocument, LessonLocaleMetadata, QuizQuestion } from '@titan/shared';
import { PublicCacheService } from '../../common/cache/public-cache.service';

type LessonViewer = { id: string; role: string; tenantId: string } | null | undefined;

function isUploadedVideoRef(value: string | null | undefined): value is string {
  return StorageService.isKey(value) || (typeof value === 'string' && /^\/uploads\/[A-Za-z0-9._/-]+$/.test(value));
}

type LessonContentRow = {
  id: string;
  videoUrl?: string | null;
  content?: string | null;
  thumbnailUrl?: string | null;
  contentBlocks?: LessonContentDocument | null;
  translations?: unknown;
  [key: string]: unknown;
};

@Injectable()
export class CoursesService {
  constructor(
    private drizzle: DrizzleService,
    private storage: StorageService,
    private upload: UploadService,
    private certification: CertificationService,
    @Optional() private notifications?: NotificationsService,
    @Optional() private search?: SearchService,
    // Appended last, and optional, so existing positional construction in tests keeps
    // working. Injecting it first shifted every argument and broke them.
    @Optional() private readonly publicCache?: PublicCacheService,
  ) {
    this.syncSearch = (tenantId: string, type: 'course' | 'series' | 'lesson', id: string) => {
      void this.search?.indexEntity(tenantId, type, id);
    };
  }

  private syncSearch: (tenantId: string, type: 'course' | 'series' | 'lesson', id: string) => void;

  private localeFrom(input?: unknown): ContentLocale {
    return resolveContentLocale(input);
  }

  private viewerAndLocale(viewer?: LessonViewer | string, localeInput?: unknown): { viewer?: LessonViewer; localeInput?: unknown } {
    return typeof viewer === 'string' ? { viewer: undefined, localeInput: viewer } : { viewer, localeInput };
  }

  private withoutLifecycle<T extends Record<string, unknown>>(value: T): Omit<T, 'isPublished' | 'isArchived'> {
    const fields = { ...value } as Record<string, unknown>;
    delete fields.isPublished;
    delete fields.isArchived;
    return fields as Omit<T, 'isPublished' | 'isArchived'>;
  }

  private localeFields<T extends Record<string, any>>(value: T, localized: { value: T; metadata: LessonLocaleMetadata }) {
    return {
      ...value,
      ...localized.value,
      locale: localized.metadata.locale,
      resolvedLocale: localized.metadata.resolvedLocale,
      availableLocales: localized.metadata.availableLocales,
      fallbackFields: localized.metadata.fallbackFields,
      localeMetadata: localized.metadata,
    };
  }

  private lessonDocument(lesson: {
    contentBlocks?: LessonContentDocument | null;
    videoUrl?: string | null;
    content?: string | null;
    thumbnailUrl?: string | null;
  }): LessonContentDocument {
    return parseContentDocumentOrLegacy(lesson.contentBlocks, lesson);
  }

  private publicLesson<T extends LessonContentRow & Record<string, any>>(
    lesson: T,
    locale: ContentLocale,
    canAccess: boolean,
  ) {
    const localized = localizeLessonFields(lesson, locale);
    const document = this.lessonDocument(lesson);
    const publicDocument = redactPublicLessonBlocks(document, locale, canAccess && !lesson.freePreview);
    const videoUrl = StorageService.isKey(lesson.videoUrl) ? null : isUploadedVideoRef(lesson.videoUrl) ? lesson.videoUrl : null;
    const base = this.localeFields(lesson, localized);
    if (!canAccess) {
      return {
        ...base,
        videoUrl: null,
        content: null,
        attachments: [],
        videoMeta: null,
        contentBlocks: [],
      };
    }
    return {
      ...base,
      videoUrl,
      contentBlocks: publicDocument,
    };
  }

  private async assertLessonInTenant(tenantId: string, lessonId: string) {
    const lesson = await this.drizzle.db.query.lessons.findFirst({
      where: and(eq(lessons.id, lessonId), eq(lessons.tenantId, tenantId)),
    });
    if (!lesson) throw new NotFoundException('Lesson not found');
    return lesson;
  }

  private normalizeBlockInput(input: CreateLessonBlockDto | UpdateLessonBlockDto): Record<string, unknown> {
    const body = input && typeof input === 'object' && 'block' in input && input.block && typeof input.block === 'object'
      ? input.block
      : input;
    return { ...(body as Record<string, unknown>) };
  }

  private changedQuizIds(before: LessonContentDocument | null, after: LessonContentDocument): string[] {
    const previous = new Map((before?.blocks ?? []).filter((block) => block.type === 'quiz').map((block) => [block.id, JSON.stringify(block.content)]));
    const next = new Map(after.blocks.filter((block) => block.type === 'quiz').map((block) => [block.id, JSON.stringify(block.content)]));
    return Array.from(previous.entries()).filter(([id, content]) => !next.has(id) || next.get(id) !== content).map(([id]) => id);
  }

  private async saveLessonDocument(tenantId: string, lessonId: string, document: LessonContentDocument) {
    const parsed = parseLessonContentDocument(document);
    parsed.blocks.sort((left, right) => left.sortOrder - right.sortOrder);
    const [lesson] = await this.drizzle.db
      .update(lessons)
      .set({ contentBlocks: parsed, updatedAt: new Date() })
      .where(and(eq(lessons.id, lessonId), eq(lessons.tenantId, tenantId)))
      .returning();
    if (!lesson) throw new NotFoundException('Lesson not found');
    this.syncSearch(tenantId, 'lesson', lesson.id);
    return lesson;
  }


  // Admin-facing management list: includes drafts/archived + per-course metrics.
  async findForAdmin(
    tenantId: string,
    opts: { status?: string; search?: string; academy?: string; zeroEnrollments?: boolean; page?: number; limit?: number },
  ) {
    // Filters that do not involve status, reused by the facet counts so each
    // status tab can report how many courses it would actually return.
    const baseConditions: any[] = [eq(courses.tenantId, tenantId)];
    if (opts.search) baseConditions.push(or(ilike(courses.title, `%${opts.search}%`), sql`${courses.translations}::text ILIKE ${`%${opts.search}%`}`)!);

    const statusConditions = (status?: string): any[] => {
      if (status === 'draft') return [eq(courses.isPublished, false), eq(courses.isArchived, false)];
      if (status === 'published') return [eq(courses.isPublished, true), eq(courses.isArchived, false)];
      if (status === 'archived') return [eq(courses.isArchived, true)];
      return [];
    };

    const conditions: any[] = [...baseConditions, ...statusConditions(opts.status)];
    if (opts.academy === 'none') {
      conditions.push(isNull(courses.academyId));
    } else if (opts.academy) {
      const [academy] = await this.drizzle.db
        .select({ id: academies.id })
        .from(academies)
        .where(and(eq(academies.tenantId, tenantId), eq(academies.slug, opts.academy)))
        .limit(1);
      if (!academy) return { items: [], total: 0, facets: { published: 0, draft: 0, archived: 0 }, facetTotal: 0, page: Math.max(1, Number(opts.page) || 1), limit: Math.min(100, Math.max(1, Number(opts.limit) || 20)) };
      conditions.push(eq(courses.academyId, academy.id));
    }
    if (opts.zeroEnrollments) {
      conditions.push(
        sql`NOT EXISTS (SELECT 1 FROM enrollments e WHERE e.course_id = ${courses.id} AND e.tenant_id = ${tenantId})`,
      );
    }

    const where = and(...conditions);
    const page = Math.max(1, Number(opts.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(opts.limit) || 20));

    const rows = await this.drizzle.db
      .select({
        id: courses.id,
        slug: courses.slug,
        title: courses.title,
        subtitle: courses.subtitle,
        description: courses.description,
        thumbnailUrl: courses.thumbnailUrl,
        isPublished: courses.isPublished,
        isArchived: courses.isArchived,
        publishedAt: courses.publishedAt,
        archivedAt: courses.archivedAt,
        updatedAt: courses.updatedAt,
        difficulty: courses.difficulty,
        academyId: courses.academyId,
        academySlug: academies.slug,
         academyTitle: academies.title,
         translations: courses.translations,
       })
      .from(courses)
      .leftJoin(academies, and(eq(academies.id, courses.academyId), eq(academies.tenantId, courses.tenantId)))
      .where(where)
      .orderBy(desc(courses.updatedAt))
      .limit(limit)
      .offset((page - 1) * limit);

    const totalArr = await this.drizzle.db.select({ count: count() }).from(courses).where(where);

    const items = rows.map((r) => ({ ...r, enrollments: 0, lessonsCount: 0 }));
    if (items.length > 0) {
      const ids = items.map((i) => i.id);
      const [enrollmentCounts, lessonCounts] = await Promise.all([
        this.drizzle.db
          .select({ courseId: enrollments.courseId, n: count() })
          .from(enrollments)
          .where(and(eq(enrollments.tenantId, tenantId), inArray(enrollments.courseId, ids)))
          .groupBy(enrollments.courseId),
        this.drizzle.db
          .select({ courseId: series.courseId, n: count(lessons.id) })
          .from(series)
          .innerJoin(lessons, and(eq(lessons.seriesId, series.id), eq(lessons.tenantId, series.tenantId)))
          .where(and(eq(series.tenantId, tenantId), inArray(series.courseId, ids)))
          .groupBy(series.courseId),
      ]);
      const enrollmentMap = new Map(enrollmentCounts.map((r) => [r.courseId, Number(r.n)]));
      const lessonMap = new Map(lessonCounts.map((r) => [r.courseId, Number(r.n)]));
      for (const item of items) {
        item.enrollments = enrollmentMap.get(item.id) ?? 0;
        item.lessonsCount = lessonMap.get(item.id) ?? 0;
      }
    }

    // Status facets over the whole filtered set, not just this page.
    const facetBase = [...baseConditions];
    if (opts.academy === 'none') {
      facetBase.push(isNull(courses.academyId));
    } else if (opts.academy) {
      const [academy] = await this.drizzle.db
        .select({ id: academies.id })
        .from(academies)
        .where(and(eq(academies.tenantId, tenantId), eq(academies.slug, opts.academy)))
        .limit(1);
      if (academy) facetBase.push(eq(courses.academyId, academy.id));
    }
    const facetEntries = await Promise.all(
      (['published', 'draft', 'archived'] as const).map((st) =>
        this.drizzle.db
          .select({ n: count() })
          .from(courses)
          .where(and(...facetBase, ...statusConditions(st)))
          .then((r) => [st, Number(r[0]?.n ?? 0)] as const),
      ),
    );
    const facets: Record<string, number> = { published: 0, draft: 0, archived: 0 };
    let facetTotal = 0;
    for (const [key, n] of facetEntries) {
      facets[key] = n;
      facetTotal += n;
    }

    return { items, total: Number(totalArr[0]?.count ?? 0), facets, facetTotal, page, limit };
  }

  /**
   * Read-through cache for the public course list.
   *
   * This is the highest-volume unauthenticated endpoint in the product and its result
   * depends only on (tenant, locale, filters) — nothing about the caller. A short-TTL cache
   * removes it from the database pool entirely under load; on miss the original query runs
   * unchanged, so behaviour is identical whether or not Redis is available.
   */
  async findByTenant(tenantId: string, filters?: CourseFilterDto, localeInput?: unknown) {
    const locale = this.localeFrom(localeInput);
    // buildKey returns a string; the optional chain makes cacheKey `string | undefined`,
    // so normalise it once rather than threading a non-null assertion through.
    const cacheKey = this.publicCache?.buildKey('courses:list', tenantId, locale, {
      page: filters?.page,
      limit: filters?.limit,
      difficulty: filters?.difficulty,
      search: filters?.search,
      academy: (filters as { academy?: string } | undefined)?.academy,
      sort: (filters as { sort?: string } | undefined)?.sort,
    });
    // Typed against the uncached implementation so the cached branch cannot drift from it.
    const cached = cacheKey
      ? await this.publicCache!.get<Awaited<ReturnType<typeof this.findByTenantUncached>>>(cacheKey)
      : null;
    if (cached !== null && cached !== undefined) return cached;
    const fresh = await this.findByTenantUncached(tenantId, filters, locale);
    if (cacheKey) await this.publicCache!.set(cacheKey, fresh);
    return fresh;
  }

  private async findByTenantUncached(tenantId: string, filters: CourseFilterDto | undefined, locale: ContentLocale) {
    const conditions: ReturnType<typeof eq>[] = [eq(courses.tenantId, tenantId)];
    conditions.push(eq(courses.isPublished, true), eq(courses.isArchived, false));
    if (filters?.difficulty) conditions.push(eq(courses.difficulty, filters.difficulty));
    if (filters?.search) conditions.push(or(like(courses.title, `%${filters.search}%`), sql`${courses.translations}::text ILIKE ${`%${filters.search}%`}`)!);

    if (filters?.academy) {
      const [academy] = await this.drizzle.db
        .select({ id: academies.id })
        .from(academies)
        .where(and(eq(academies.tenantId, tenantId), eq(academies.slug, filters.academy)))
        .limit(1);
      if (!academy) return { data: [], total: 0, page: filters?.page || 1, limit: filters?.limit || 20 };
      conditions.push(eq(courses.academyId, academy.id));
    }

    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const data = await this.drizzle.db.query.courses.findMany({
      where: and(...conditions),
      orderBy: [asc(courses.sortOrder)],
      limit,
      offset: (page - 1) * limit,
      with: {
        academy: {
          columns: { id: true, slug: true, title: true, accentColor: true },
        },
        series: {
          where: and(eq(series.tenantId, tenantId), eq(series.isPublished, true), eq(series.isArchived, false)),
          orderBy: asc(series.sortOrder),
        },
      },
    });

    const totalArr = await this.drizzle.db
      .select({ count: count() })
      .from(courses)
      .where(and(...conditions));

    const localizedData = data.map((course) => {
      const localizedCourse = this.localeFields(course as Record<string, any>, localizeCourseFields(course as Record<string, any>, locale));
      return {
        ...localizedCourse,
        series: (course.series ?? []).map((item) => this.localeFields(item as Record<string, any>, localizeSeriesFields(item as Record<string, any>, locale))),
      };
    });
    return { data: localizedData, total: Number(totalArr[0]?.count || 0), page, limit };
  }

  /**
   * Read-through cache for course detail.
   *
   * Same reasoning as the listing: the payload is a pure function of (tenant, locale, slug).
   * The detail query is the heaviest read in the product — course, series and every lesson
   * — and `series`/`lessons` had no index on the lookup columns at all.
   */
  async findBySlug(tenantId: string, slug: string, localeInput?: unknown) {
    const locale = this.localeFrom(localeInput);
    const cacheKey = this.publicCache?.buildKey('courses:detail', tenantId, locale, { slug });
    const cached = cacheKey
      ? await this.publicCache!.get<Awaited<ReturnType<typeof this.findBySlugUncached>>>(cacheKey)
      : null;
    if (cached !== null && cached !== undefined) return cached;
    const fresh = await this.findBySlugUncached(tenantId, slug, locale);
    if (cacheKey) await this.publicCache!.set(cacheKey, fresh);
    return fresh;
  }

  private async findBySlugUncached(tenantId: string, slug: string, locale: ContentLocale) {
    const course = await this.drizzle.db.query.courses.findFirst({
      where: and(
        eq(courses.tenantId, tenantId),
        eq(courses.slug, slug),
        eq(courses.isPublished, true),
        eq(courses.isArchived, false),
      ),
      with: {
        academy: {
          columns: { id: true, slug: true, title: true, accentColor: true },
        },
        series: {
          where: and(eq(series.tenantId, tenantId), eq(series.isPublished, true), eq(series.isArchived, false)),
          orderBy: asc(series.sortOrder),
          with: {
            lessons: {
              where: and(eq(lessons.tenantId, tenantId), eq(lessons.isPublished, true), eq(lessons.isArchived, false)),
              orderBy: asc(lessons.sortOrder),
            },
          },
        },
      },
    });
    if (!course) throw new NotFoundException('Course not found');
    const localizedCourse = this.localeFields(course as Record<string, any>, localizeCourseFields(course as Record<string, any>, locale));
    const localizedSeries = [];
    for (const item of course.series ?? []) {
      const localizedItem = this.localeFields(item as Record<string, any>, localizeSeriesFields(item as Record<string, any>, locale));
      const localizedLessons = [];
      for (const lesson of item.lessons ?? []) {
        const canAccess = await this.canAccessLesson(tenantId, course.id, lesson.freePreview, undefined);
        localizedLessons.push(this.publicLesson(lesson as LessonContentRow & Record<string, any>, locale, canAccess));
      }
      localizedSeries.push({ ...localizedItem, lessons: localizedLessons });
    }
    return { ...localizedCourse, series: localizedSeries };
  }

  /** Validates that an academy belongs to the tenant; rejects cross-tenant academy ids. */
  private async assertAcademyInTenant(tenantId: string, academyId: string) {
    const [academy] = await this.drizzle.db
      .select({ id: academies.id })
      .from(academies)
      .where(and(eq(academies.tenantId, tenantId), eq(academies.id, academyId)))
      .limit(1);
    if (!academy) throw new BadRequestException('Academy not found in this tenant');
    return academy.id;
  }

  async createCourse(tenantId: string, data: CreateCourseDto) {
    const input = this.withoutLifecycle(data as unknown as Record<string, unknown>);
    const { academyId, translations: rawTranslations, ...rest } = input as unknown as CreateCourseDto;
    const resolvedAcademyId = academyId ? await this.assertAcademyInTenant(tenantId, academyId) : null;
    const translations = parseCourseTranslations(rawTranslations);
    const [course] = await this.drizzle.db
      .insert(courses)
      .values({ ...rest, tenantId, academyId: resolvedAcademyId, difficulty: data.difficulty || 1, isPublished: false, isArchived: false, ...(translations !== undefined ? { translations } : {}) } as any)
      .returning();
    if (course) this.syncSearch(tenantId, 'course', course.id);
    return course;
  }

  async updateCourse(tenantId: string, slug: string, data: UpdateCourseDto | Partial<CreateCourseDto>) {
    const input = this.withoutLifecycle(data as unknown as Record<string, unknown>);
    const { academyId, translations: rawTranslations, ...rest } = input as unknown as UpdateCourseDto;
    const patch: Record<string, unknown> = { ...rest, updatedAt: new Date() };
    const translations = parseCourseTranslations(rawTranslations);
    if (translations !== undefined) patch.translations = translations;
    if (academyId === null) {
      patch.academyId = null;
    } else if (academyId) {
      patch.academyId = await this.assertAcademyInTenant(tenantId, academyId);
    }
    const [course] = await this.drizzle.db
      .update(courses)
      .set(patch)
      .where(and(eq(courses.tenantId, tenantId), eq(courses.slug, slug)))
      .returning();
    if (!course) throw new NotFoundException('Course not found');
    this.syncSearch(tenantId, 'course', course.id);
    return course;
  }

  async publishCourse(tenantId: string, slug: string) {
    const { ok, reasons } = await this.validateForPublish(tenantId, slug);
    if (!ok) throw new BadRequestException({ message: 'Course is not ready to publish', reasons });
    const course = await this.drizzle.db.query.courses.findFirst({
      where: and(eq(courses.tenantId, tenantId), eq(courses.slug, slug)),
      columns: { id: true },
    });
    if (!course) throw new NotFoundException('Course not found');
    const publishedAt = new Date();
    await this.drizzle.db.transaction(async (tx) => {
      const seriesRows = await tx.select({ id: series.id }).from(series).where(and(eq(series.tenantId, tenantId), eq(series.courseId, course.id), eq(series.isArchived, false)));
      const seriesIds = seriesRows.map((row) => row.id);
      if (seriesIds.length) {
        await tx.update(series).set({ isPublished: true, isArchived: false, archivedAt: null, updatedAt: publishedAt }).where(and(eq(series.tenantId, tenantId), inArray(series.id, seriesIds)));
        await tx.update(lessons).set({ isPublished: true, isArchived: false, archivedAt: null, updatedAt: publishedAt }).where(and(eq(lessons.tenantId, tenantId), inArray(lessons.seriesId, seriesIds), eq(lessons.isArchived, false)));
      }
      await tx.update(courses).set({ isPublished: true, isArchived: false, publishedAt, archivedAt: null, updatedAt: publishedAt }).where(and(eq(courses.tenantId, tenantId), eq(courses.id, course.id)));
    });
    const [updated] = await this.drizzle.db.select().from(courses).where(and(eq(courses.tenantId, tenantId), eq(courses.id, course.id))).limit(1);
    if (!updated) throw new NotFoundException('Course not found');
    this.syncSearch(tenantId, 'course', updated.id);
    return updated;
  }

  async unpublishCourse(tenantId: string, slug: string) {
    const course = await this.drizzle.db.query.courses.findFirst({
      where: and(eq(courses.tenantId, tenantId), eq(courses.slug, slug)),
      columns: { id: true },
    });
    if (!course) throw new NotFoundException('Course not found');
    const updatedAt = new Date();
    await this.drizzle.db.transaction(async (tx) => {
      const seriesRows = await tx.select({ id: series.id }).from(series).where(and(eq(series.tenantId, tenantId), eq(series.courseId, course.id)));
      const seriesIds = seriesRows.map((row) => row.id);
      if (seriesIds.length) {
        await tx.update(lessons).set({ isPublished: false, updatedAt }).where(and(eq(lessons.tenantId, tenantId), inArray(lessons.seriesId, seriesIds)));
        await tx.update(series).set({ isPublished: false, updatedAt }).where(and(eq(series.tenantId, tenantId), inArray(series.id, seriesIds)));
      }
      await tx.update(courses).set({ isPublished: false, updatedAt }).where(and(eq(courses.tenantId, tenantId), eq(courses.id, course.id)));
    });
    const [updated] = await this.drizzle.db.select().from(courses).where(and(eq(courses.tenantId, tenantId), eq(courses.id, course.id))).limit(1);
    if (!updated) throw new NotFoundException('Course not found');
    this.syncSearch(tenantId, 'course', updated.id);
    return updated;
  }

  async archiveCourse(tenantId: string, slug: string) {
    const course = await this.drizzle.db.query.courses.findFirst({
      where: and(eq(courses.tenantId, tenantId), eq(courses.slug, slug)),
      columns: { id: true },
    });
    if (!course) throw new NotFoundException('Course not found');
    const archivedAt = new Date();
    await this.drizzle.db.transaction(async (tx) => {
      const seriesRows = await tx.select({ id: series.id }).from(series).where(and(eq(series.tenantId, tenantId), eq(series.courseId, course.id)));
      const seriesIds = seriesRows.map((row) => row.id);
      if (seriesIds.length) {
        await tx.update(lessons).set({ isPublished: false, updatedAt: archivedAt }).where(and(eq(lessons.tenantId, tenantId), inArray(lessons.seriesId, seriesIds)));
        await tx.update(series).set({ isPublished: false, updatedAt: archivedAt }).where(and(eq(series.tenantId, tenantId), inArray(series.id, seriesIds)));
      }
      await tx.update(courses).set({ isArchived: true, isPublished: false, archivedAt, updatedAt: archivedAt }).where(and(eq(courses.tenantId, tenantId), eq(courses.id, course.id)));
    });
    const [updated] = await this.drizzle.db.select().from(courses).where(and(eq(courses.tenantId, tenantId), eq(courses.id, course.id))).limit(1);
    if (!updated) throw new NotFoundException('Course not found');
    this.syncSearch(tenantId, 'course', updated.id);
    return updated;
  }

  async restoreCourse(tenantId: string, slug: string) {
    const [course] = await this.drizzle.db
      .update(courses)
      .set({ isArchived: false, archivedAt: null, updatedAt: new Date() })
      .where(and(eq(courses.tenantId, tenantId), eq(courses.slug, slug)))
      .returning();
    if (!course) throw new NotFoundException('Course not found');
    this.syncSearch(tenantId, 'course', course.id);
    return course;
  }

  async reorderCurriculum(tenantId: string, slug: string, dto: { series: { id: string; sortOrder: number }[]; lessons: { id: string; seriesId: string; sortOrder: number }[] }) {
    const course = await this.drizzle.db.query.courses.findFirst({
      where: and(eq(courses.tenantId, tenantId), eq(courses.slug, slug)),
      with: { series: { columns: { id: true } } },
    });
    if (!course) throw new NotFoundException('Course not found');
    const courseSeriesIds = new Set((course.series as any[]).map((s) => s.id));

    // Validate all series belong to this course
    for (const s of dto.series) {
      if (!courseSeriesIds.has(s.id)) throw new BadRequestException(`Series ${s.id} does not belong to course ${slug}`);
      if (typeof s.sortOrder !== 'number' || s.sortOrder < 0 || s.sortOrder > 1000) throw new BadRequestException('Invalid sortOrder for series');
    }
    // Validate lessons: new seriesId must be within same course
    for (const l of dto.lessons) {
      if (!courseSeriesIds.has(l.seriesId)) throw new BadRequestException(`Lesson ${l.id} target series ${l.seriesId} not in course`);
      if (typeof l.sortOrder !== 'number' || l.sortOrder < 0 || l.sortOrder > 1000) throw new BadRequestException('Invalid sortOrder for lesson');
    }

    // Verify lessons exist and belong to tenant before moving
    const lessonIds = dto.lessons.map((l) => l.id);
    if (lessonIds.length) {
      const existing = await this.drizzle.db.query.lessons.findMany({
        where: and(eq(lessons.tenantId, tenantId), inArray(lessons.id, lessonIds)),
        columns: { id: true, seriesId: true },
      });
      const existingIds = new Set(existing.map((e) => e.id));
      for (const l of dto.lessons) if (!existingIds.has(l.id)) throw new BadRequestException(`Lesson ${l.id} not found`);
    }

    // Update series sort order
    for (const s of dto.series) {
      await this.drizzle.db
        .update(series)
        .set({ sortOrder: s.sortOrder, updatedAt: new Date() })
        .where(and(eq(series.id, s.id), eq(series.tenantId, tenantId), eq(series.courseId, course.id)));
    }

    // Update lessons sort order and seriesId
    for (const l of dto.lessons) {
      await this.drizzle.db
        .update(lessons)
        .set({ sortOrder: l.sortOrder, seriesId: l.seriesId, updatedAt: new Date() })
        .where(and(eq(lessons.id, l.id), eq(lessons.tenantId, tenantId)));
    }
    this.syncSearch(tenantId, 'course', course.id);
    for (const item of dto.series) this.syncSearch(tenantId, 'series', item.id);
    for (const item of dto.lessons) this.syncSearch(tenantId, 'lesson', item.id);

    return { success: true };
  }

  // Full course shape for the Course Studio (course + sections + nested lessons + commerce/SEO).
  async getStudio(tenantId: string, slug: string, localeInput?: unknown) {
    const locale = this.localeFrom(localeInput);
    const course = await this.drizzle.db.query.courses.findFirst({
      where: and(eq(courses.tenantId, tenantId), eq(courses.slug, slug)),
      with: {
        academy: {
          columns: { id: true, slug: true, title: true, accentColor: true },
        },
        series: {
          orderBy: [asc(series.sortOrder)],
          with: {
            lessons: {
              orderBy: [asc(lessons.sortOrder)],
            },
          },
        },
      },
    });
    if (!course) throw new NotFoundException('Course not found');
    if (this.storage.isConfigured) {
      const studioLessons = (course.series ?? []).flatMap((s) => s.lessons ?? []);
      await Promise.all(
        studioLessons.map(async (l) => {
          if (StorageService.isKey(l.videoUrl)) {
            l.videoUrl = await this.storage.resolvePlaybackUrl(l.videoUrl);
          }
        }),
      );
    }
    const courseRecord = course as Record<string, any>;
    const localizedCourse = localizeCourseFields(courseRecord, locale);
    courseRecord.locale = localizedCourse.metadata.locale;
    courseRecord.resolvedLocale = localizedCourse.metadata.resolvedLocale;
    courseRecord.availableLocales = localizedCourse.metadata.availableLocales;
    courseRecord.fallbackFields = localizedCourse.metadata.fallbackFields;
    courseRecord.localeMetadata = localizedCourse.metadata;
    courseRecord.localizedTitle = localizedCourse.value.title;
    courseRecord.localizedDescription = localizedCourse.value.description;
    courseRecord.localized = localizedCourse.value;
    for (const item of course.series ?? []) {
      const itemRecord = item as Record<string, any>;
      const localizedSeries = localizeSeriesFields(itemRecord, locale);
      itemRecord.localizedTitle = localizedSeries.value.title;
      itemRecord.localizedDescription = localizedSeries.value.description;
      itemRecord.localeMetadata = localizedSeries.metadata;
      for (const lesson of item.lessons ?? []) {
        const lessonRecord = lesson as Record<string, any>;
        if (!lesson.contentBlocks) lesson.contentBlocks = synthesizeLegacyLessonDocument(lesson);
        const localizedLesson = localizeLessonFields(lessonRecord, locale);
        lessonRecord.localizedTitle = localizedLesson.value.title;
        lessonRecord.localizedDescription = localizedLesson.value.description;
        lessonRecord.localeMetadata = localizedLesson.metadata;
        lessonRecord.localizedContentBlocks = localizeLessonDocument(this.lessonDocument(lesson), locale);
      }
    }
    return courseRecord;
  }

  // Pre-publish validation — returns why a course cannot be published yet.
  async validateForPublish(tenantId: string, slug: string) {
    const course = await this.getStudio(tenantId, slug);
    const reasons: string[] = [];
    if (!course.title?.trim()) reasons.push('Add a compelling course title');
    if (!course.slug?.trim()) reasons.push('Set a course slug');
    const seriesList = (course.series ?? []) as Array<{ lessons?: Array<Record<string, any>> }>;
    const lessonCount = seriesList.reduce((n, s) => n + (s.lessons?.length ?? 0), 0);
    for (const item of seriesList) {
      for (const lesson of item.lessons ?? []) {
        try {
          const document = parseLessonContentDocument(lesson.contentBlocks ?? synthesizeLegacyLessonDocument(lesson));
          for (const block of getQuizBlocks(document)) {
            const questions = Array.isArray((block.content as Record<string, any>).questions) ? (block.content as Record<string, any>).questions as Array<Record<string, any>> : [];
            if (questions.some((question) => !Array.isArray(question.correctOptionIds) || question.correctOptionIds.length === 0)) {
              reasons.push(`Quiz ${block.id} needs at least one correct answer`);
            }
          }
        } catch {
          reasons.push(`Lesson ${lesson.title ?? lesson.id} has invalid content blocks`);
        }
      }
    }
    if (seriesList.length === 0) reasons.push('Add at least one section that contains a lesson');
    else if (lessonCount === 0) reasons.push('Add at least one lesson to your section');
    if (!course.thumbnailUrl?.trim()) reasons.push('Upload a thumbnail image (16:9 recommended)');
    const resources = Array.isArray(course.metadata?.resources) ? course.metadata.resources : [];
    if (resources.some((resource: any) => !resource || typeof resource.url !== 'string' || !/^(?:tenants\/|uploads\/|\/uploads\/|\/images\/)[A-Za-z0-9._/-]+$/.test(resource.url))) {
      reasons.push('Upload every course resource before publishing');
    }
    if (!isCurrencyCode(course.currency)) reasons.push('Choose a supported currency');
    const mode = (course.accessMode ?? 'open') as string;
    if (mode === 'paid' && (!course.priceCents || course.priceCents <= 0))
      reasons.push('Paid courses need a price greater than 0');
    if (!(course.seoTitle?.trim() && course.seoDescription?.trim()))
      reasons.push('Add an SEO title and meta description');
    return { ok: reasons.length === 0, reasons };
  }

  // --- Series (section) ---
  async createSeriesSafe(tenantId: string, data: CreateSeriesDto) {
    const course = await this.drizzle.db.query.courses.findFirst({
      where: and(eq(courses.id, data.courseId), eq(courses.tenantId, tenantId)),
    });
    if (!course) throw new NotFoundException('Course not found');
    const translations = parseSeriesTranslations(data.translations);
    const slug = await this.uniqueSeriesSlug(tenantId, course.id, data.slug);
    const rest = this.withoutLifecycle(data as unknown as Record<string, unknown>) as Record<string, unknown>;
    delete rest.courseId;
    delete rest.translations;
    const [s] = await this.drizzle.db.insert(series).values({ ...rest, courseId: course.id, slug, tenantId, isPublished: false, isArchived: false, ...(translations !== undefined ? { translations } : {}) } as any).returning();
    if (s) this.syncSearch(tenantId, 'series', s.id);
    return { ...s, lessons: [] };
  }

  private async uniqueSeriesSlug(tenantId: string, courseId: string, base: string) {
    let slug = base;
    let i = 2;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const existing = await this.drizzle.db.query.series.findFirst({
        where: and(eq(series.tenantId, tenantId), eq(series.courseId, courseId), eq(series.slug, slug)),
      });
      if (!existing) return slug;
      slug = `${base}-${i++}`;
    }
  }

  // --- Lessons ---
  async createLessonSafe(tenantId: string, data: CreateLessonDto) {
    const s = await this.drizzle.db.query.series.findFirst({
      where: and(eq(series.id, data.seriesId), eq(series.tenantId, tenantId)),
    });
    if (!s) throw new NotFoundException('Series not found');
    const translations = parseLessonTranslations(data.translations);
    const contentBlocks = data.contentBlocks === null
      ? null
      : data.contentBlocks === undefined
        ? undefined
        : parseLessonContentDocument(data.contentBlocks);
    const slug = await this.uniqueLessonSlug(tenantId, s.id, data.slug);
    const rest = this.withoutLifecycle(data as unknown as Record<string, unknown>) as Record<string, unknown>;
    delete rest.seriesId;
    delete rest.translations;
    delete rest.contentBlocks;
    const [l] = await this.drizzle.db
      .insert(lessons)
      .values({ ...rest, seriesId: s.id, slug, tenantId, difficulty: data.difficulty ?? 1, isPublished: false, isArchived: false, ...(translations !== undefined ? { translations } : {}), ...(contentBlocks !== undefined ? { contentBlocks } : {}) } as any)
      .returning();
    if (l) this.syncSearch(tenantId, 'lesson', l.id);
    return l;
  }

  async getLessonContentBlocks(tenantId: string, lessonId: string) {
    const lesson = await this.assertLessonInTenant(tenantId, lessonId);
    return lesson.contentBlocks === null || lesson.contentBlocks === undefined
      ? synthesizeLegacyLessonDocument(lesson)
      : parseLessonContentDocument(lesson.contentBlocks);
  }

  async replaceLessonContentBlocks(tenantId: string, lessonId: string, document: unknown) {
    const existingLesson = await this.assertLessonInTenant(tenantId, lessonId);
    const existingDocument = this.lessonDocument(existingLesson);
    const parsed = parseLessonContentDocument(document);
    const changedQuizIds = this.changedQuizIds(existingDocument, parsed);
    const lesson = await this.saveLessonDocument(tenantId, lessonId, parsed);
    if (changedQuizIds.length) {
      await this.drizzle.db.delete(lessonQuizAttempts).where(and(
        eq(lessonQuizAttempts.tenantId, tenantId),
        eq(lessonQuizAttempts.lessonId, lessonId),
        inArray(lessonQuizAttempts.quizId, changedQuizIds),
      ));
    }
    return { contentBlocks: parsed, lesson };
  }

  async createLessonBlock(tenantId: string, lessonId: string, dto: CreateLessonBlockDto) {
    const lesson = await this.assertLessonInTenant(tenantId, lessonId);
    const input = this.normalizeBlockInput(dto);
    const current = this.lessonDocument(lesson);
    const id = typeof input.id === 'string' && input.id.trim() ? input.id.trim() : randomUUID();
    if (current.blocks.some((block) => block.id === id)) throw new BadRequestException('A lesson block with this id already exists');
    const maxOrder = current.blocks.reduce((maximum, block) => Math.max(maximum, block.sortOrder), -1);
    const block = parseLessonBlock({
      id,
      type: input.type,
      sortOrder: typeof input.sortOrder === 'number' ? input.sortOrder : maxOrder + 1,
      content: input.content,
      ...(input.translations !== undefined ? { translations: input.translations } : {}),
    });
    const contentBlocks = parseLessonContentDocument({ schemaVersion: 1, blocks: [...current.blocks, block] });
    await this.saveLessonDocument(tenantId, lessonId, contentBlocks);
    return { block, contentBlocks };
  }

  async updateLessonBlock(tenantId: string, lessonId: string, blockId: string, dto: UpdateLessonBlockDto) {
    await this.assertLessonInTenant(tenantId, lessonId);
    const current = this.lessonDocument(await this.assertLessonInTenant(tenantId, lessonId));
    const index = current.blocks.findIndex((block) => block.id === blockId);
    if (index < 0) throw new NotFoundException('Lesson block not found');
    const input = this.normalizeBlockInput(dto);
    const existing = current.blocks[index]!;
    const block = parseLessonBlock({
      id: blockId,
      type: input.type ?? existing.type,
      sortOrder: typeof input.sortOrder === 'number' ? input.sortOrder : existing.sortOrder,
      content: input.content ?? existing.content,
      translations: input.translations !== undefined ? input.translations : existing.translations,
    });
    const blocks = [...current.blocks];
    blocks[index] = block;
    const contentBlocks = parseLessonContentDocument({ schemaVersion: 1, blocks });
    await this.saveLessonDocument(tenantId, lessonId, contentBlocks);
    if (existing.type === 'quiz' || block.type === 'quiz') {
      await this.drizzle.db.delete(lessonQuizAttempts).where(and(
        eq(lessonQuizAttempts.tenantId, tenantId),
        eq(lessonQuizAttempts.lessonId, lessonId),
        eq(lessonQuizAttempts.quizId, blockId),
      ));
    }
    return { block, contentBlocks };
  }

  async deleteLessonBlock(tenantId: string, lessonId: string, blockId: string) {
    await this.assertLessonInTenant(tenantId, lessonId);
    const current = this.lessonDocument(await this.assertLessonInTenant(tenantId, lessonId));
    const blocks = current.blocks.filter((block) => block.id !== blockId);
    if (blocks.length === current.blocks.length) throw new NotFoundException('Lesson block not found');
    const contentBlocks = parseLessonContentDocument({ schemaVersion: 1, blocks });
    await this.saveLessonDocument(tenantId, lessonId, contentBlocks);
    await this.drizzle.db.delete(lessonQuizAttempts).where(and(
      eq(lessonQuizAttempts.tenantId, tenantId),
      eq(lessonQuizAttempts.lessonId, lessonId),
      eq(lessonQuizAttempts.quizId, blockId),
    ));
    return { blockId, contentBlocks };
  }

  async reorderLessonBlocks(tenantId: string, lessonId: string, dto: ReorderLessonBlocksDto) {
    await this.assertLessonInTenant(tenantId, lessonId);
    const current = this.lessonDocument(await this.assertLessonInTenant(tenantId, lessonId));
    const items = dto.blocks ?? dto.items ?? [];
    if (!items.length) throw new BadRequestException('At least one block order is required');
    const byId = new Map(current.blocks.map((block) => [block.id, block]));
    const seen = new Set<string>();
    const orders = new Set<number>();
    for (const item of items) {
      if (!byId.has(item.id)) throw new NotFoundException('Lesson block not found');
      if (seen.has(item.id)) throw new BadRequestException('Block order contains duplicate ids');
      if (!Number.isInteger(item.sortOrder) || item.sortOrder < 0 || item.sortOrder > 1000) throw new BadRequestException('Invalid block sortOrder');
      if (orders.has(item.sortOrder)) throw new BadRequestException('Block sortOrder values must be unique');
      orders.add(item.sortOrder);
      seen.add(item.id);
    }
    const blocks = current.blocks.map((block) => {
      const item = items.find((candidate) => candidate.id === block.id);
      return item ? { ...block, sortOrder: item.sortOrder } : block;
    });
    const contentBlocks = parseLessonContentDocument({ schemaVersion: 1, blocks });
    await this.saveLessonDocument(tenantId, lessonId, contentBlocks);
    return { success: true, contentBlocks };
  }

  async updateLessonContentBlocks(tenantId: string, lessonId: string, document: unknown) {
    return this.replaceLessonContentBlocks(tenantId, lessonId, document);
  }

  private async uniqueLessonSlug(tenantId: string, seriesId: string, base: string) {
    let slug = base;
    let i = 2;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const existing = await this.drizzle.db.query.lessons.findFirst({
        where: and(eq(lessons.tenantId, tenantId), eq(lessons.seriesId, seriesId), eq(lessons.slug, slug)),
      });
      if (!existing) return slug;
      slug = `${base}-${i++}`;
    }
  }

  async deleteSeries(tenantId: string, id: string) {
    const [ownedSeries] = await this.drizzle.db
      .select({ id: series.id })
      .from(series)
      .where(and(eq(series.id, id), eq(series.tenantId, tenantId)))
      .limit(1);
    if (!ownedSeries) throw new NotFoundException('Series not found');
    const orphanLessons = await this.drizzle.db
      .select({ id: lessons.id, videoUrl: lessons.videoUrl })
      .from(lessons)
      .where(and(eq(lessons.seriesId, id), eq(lessons.tenantId, tenantId)));
    const orphanLessonIds = orphanLessons.map((lesson) => lesson.id);
    if (orphanLessonIds.length) {
      await this.drizzle.db.delete(lessonQuizAttempts).where(and(eq(lessonQuizAttempts.tenantId, tenantId), inArray(lessonQuizAttempts.lessonId, orphanLessonIds)));
    }
    await this.drizzle.db
      .delete(lessons)
      .where(and(eq(lessons.seriesId, id), eq(lessons.tenantId, tenantId)));
    const [deleted] = await this.drizzle.db
      .delete(series)
      .where(and(eq(series.id, id), eq(series.tenantId, tenantId)))
      .returning();
    if (!deleted) throw new NotFoundException('Series not found');
    for (const l of orphanLessons) {
      await this.maybeDeleteVideo(tenantId, l.videoUrl);
      void this.search?.removeEntity(tenantId, 'lesson', l.id);
    }
    this.syncSearch(tenantId, 'series', deleted.id);
    return { id: deleted.id, deleted: true };
  }

  async deleteLesson(tenantId: string, id: string) {
    await this.drizzle.db.delete(lessonQuizAttempts).where(and(eq(lessonQuizAttempts.tenantId, tenantId), eq(lessonQuizAttempts.lessonId, id)));
    const [deleted] = await this.drizzle.db
      .delete(lessons)
      .where(and(eq(lessons.id, id), eq(lessons.tenantId, tenantId)))
      .returning();
    if (!deleted) throw new NotFoundException('Lesson not found');
    await this.maybeDeleteVideo(tenantId, deleted.videoUrl);
    void this.search?.removeEntity(tenantId, 'lesson', deleted.id);
    return { id: deleted.id, deleted: true };
  }

  /** Delete an S3 object only if no other lesson (in the tenant) still references the key (guards duplicate-shared keys). */
  private async maybeDeleteVideo(tenantId: string, key: string | null | undefined): Promise<void> {
    if (!StorageService.isKey(key)) return;
    const stillUsed = await this.drizzle.db
      .select({ id: lessons.id })
      .from(lessons)
      .where(and(eq(lessons.tenantId, tenantId), eq(lessons.videoUrl, key!)))
      .limit(1);
    if (stillUsed.length === 0) await this.storage.deleteObject(key);
  }

  /** Resolve (tenantId, courseId) for a lesson, scoped to the actor's tenant. */
  async resolveLessonContext(tenantId: string, lessonId: string): Promise<{ lessonId: string; courseId: string }> {
    const lesson = await this.drizzle.db.query.lessons.findFirst({
        where: and(eq(lessons.id, lessonId), eq(lessons.tenantId, tenantId)),
        with: { series: { columns: { courseId: true } } },
    });
    if (!lesson || !lesson.series) throw new NotFoundException('Lesson not found');
    return { lessonId, courseId: lesson.series.courseId };
  }

  /** Server-mediated video upload fallback (decodes base64, stores to S3, records key + meta). Falls back to local disk if S3 is unreachable. */
  async uploadLessonVideoServer(
    tenantId: string,
    lessonId: string,
    fileDataUrl: string,
    filename?: string,
  ): Promise<{ key: string; playbackUrl: string; meta: VideoMeta }> {
    const { courseId } = await this.resolveLessonContext(tenantId, lessonId);
    const match = /^data:([\w/.+-]+);base64,(.+)$/.exec(fileDataUrl);
    if (!match || !match[1] || !match[2]) throw new BadRequestException('Invalid file data. Expected a base64 data URL.');
    const contentType = match[1];
    const buffer = Buffer.from(match[2], 'base64');
    this.storage.validateVideo(contentType, buffer.length);
    const name = filename?.trim() || 'video';
    try {
      const key = this.storage.buildKey(tenantId, courseId, lessonId, name);
      await this.storage.putObject(key, buffer, contentType);
      const meta: VideoMeta = { key, size: buffer.length, contentType, filename: name };
      await this.updateLesson(tenantId, lessonId, { videoUrl: key, videoMeta: meta });
      const playbackUrl = await this.storage.resolvePlaybackUrl(key);
      return { key, playbackUrl, meta };
    } catch (e: any) {
      // Validation errors should bubble; infra errors (S3 down) fall back to local disk.
      if (e instanceof BadRequestException) throw e;
      try {
        const res = await this.upload.uploadGeneric(fileDataUrl, 'lessons', name);
        const meta: VideoMeta = { key: res.url, size: res.size, contentType: res.type, filename: res.name };
        await this.updateLesson(tenantId, lessonId, { videoUrl: res.url, videoMeta: null });
        return { key: res.url, playbackUrl: res.url, meta };
      } catch {
        throw e;
      }
    }
  }

  /** Issue a presigned PUT URL + object key for direct browser upload. */
  async resolveLessonUploadTarget(tenantId: string, lessonId: string, dto: LessonUploadUrlDto): Promise<{ key: string; uploadUrl: string }> {
    const { courseId } = await this.resolveLessonContext(tenantId, lessonId);
    this.storage.validateVideo(dto.contentType, dto.size);
    const key = this.storage.buildKey(tenantId, courseId, lessonId, dto.filename);
    const uploadUrl = await this.storage.createPresignedPutUrl(key, dto.contentType, dto.size);
    return { key, uploadUrl };
  }

  async duplicateLesson(tenantId: string, id: string) {
    const src = await this.drizzle.db.query.lessons.findFirst({
      where: and(eq(lessons.id, id), eq(lessons.tenantId, tenantId)),
    });
    if (!src) throw new NotFoundException('Lesson not found');
    const slug = await this.uniqueLessonSlug(tenantId, src.seriesId, `${src.slug}-copy`);
    const maxRow = await this.drizzle.db
      .select({ m: sql`max(${lessons.sortOrder})` })
      .from(lessons)
      .where(and(eq(lessons.seriesId, src.seriesId), eq(lessons.tenantId, tenantId)));
    const nextOrder = Number(maxRow[0]?.m ?? 0) + 1;
    const [l] = await this.drizzle.db
      .insert(lessons)
      .values({
        seriesId: src.seriesId,
        tenantId,
        slug,
        title: `${src.title} (copy)`,
        description: src.description,
        videoUrl: src.videoUrl,
        videoDuration: src.videoDuration,
         content: src.content,
         translations: src.translations,
         contentBlocks: src.contentBlocks,
         attachments: src.attachments,
        difficulty: src.difficulty,
        isPublished: false,
        isArchived: false,
        sortOrder: nextOrder,
        freePreview: false,
      })
      .returning();
    if (l) this.syncSearch(tenantId, 'lesson', l.id);
    return l;
  }

  async deleteCourse(tenantId: string, slug: string) {
    const course = await this.drizzle.db.query.courses.findFirst({
      where: and(eq(courses.tenantId, tenantId), eq(courses.slug, slug)),
      columns: { id: true },
    });
    if (!course) throw new NotFoundException('Course not found');

    const removedCourseId = course.id;
    let removedSeriesIds: string[] = [];
    let removedLessonIds: string[] = [];
    await this.drizzle.db.transaction(async (tx) => {
      await tx.delete(enrollments).where(eq(enrollments.courseId, course.id));
      await tx.delete(certifications).where(eq(certifications.courseId, course.id));

      const courseSeries = await tx
        .select({ id: series.id })
        .from(series)
        .where(eq(series.courseId, course.id));
      if (courseSeries.length) {
        const seriesIds = courseSeries.map((s) => s.id);
        removedSeriesIds = seriesIds;
        const lessonRows = await tx
          .select({ id: lessons.id })
          .from(lessons)
          .where(inArray(lessons.seriesId, seriesIds));
        if (lessonRows.length) {
          removedLessonIds = lessonRows.map((l) => l.id);
          await tx.delete(lessonQuizAttempts).where(and(eq(lessonQuizAttempts.tenantId, tenantId), inArray(lessonQuizAttempts.lessonId, lessonRows.map((l) => l.id))));
          await tx.delete(lessonProgress).where(inArray(lessonProgress.lessonId, lessonRows.map((l) => l.id)));
          await tx.delete(lessons).where(inArray(lessons.seriesId, seriesIds));
        }
      }
      await tx.delete(series).where(eq(series.courseId, course.id));
      await tx.delete(courses).where(eq(courses.id, course.id));
    });
    void this.search?.removeEntity(tenantId, 'course', removedCourseId);
    for (const id of removedSeriesIds) void this.search?.removeEntity(tenantId, 'series', id);
    for (const id of removedLessonIds) void this.search?.removeEntity(tenantId, 'lesson', id);

    return course;
  }

  // --- Series ---
  async createSeries(tenantId: string, data: CreateSeriesDto) {
    const course = await this.drizzle.db.query.courses.findFirst({
      where: and(eq(courses.id, data.courseId), eq(courses.tenantId, tenantId)),
      columns: { id: true },
    });
    if (!course) throw new NotFoundException('Course not found');
    return this.createSeriesSafe(tenantId, data);
  }

  async findSeries(tenantId: string, courseSlug: string, seriesSlug: string, localeInput?: unknown) {
    const course = this.findBySlug(tenantId, courseSlug, localeInput);
    const resolvedCourse = await course;
    const item = (resolvedCourse.series as Array<Record<string, any>> | undefined)?.find((entry) => entry.slug === seriesSlug);
    if (!item) throw new NotFoundException('Series not found');
    return item;
  }

  async updateSeries(tenantId: string, seriesId: string, data: UpdateSeriesDto | Partial<CreateSeriesDto>) {
    const rest = this.withoutLifecycle(data as unknown as Record<string, unknown>) as Record<string, unknown>;
    const rawTranslations = rest.translations;
    delete rest.translations;
    delete rest.courseId;
    const translations = parseSeriesTranslations(rawTranslations);
    const [s] = await this.drizzle.db
      .update(series)
      .set({ ...rest, ...(translations !== undefined ? { translations } : {}) } as any)
      .where(and(eq(series.id, seriesId), eq(series.tenantId, tenantId)))
      .returning();
    if (!s) throw new NotFoundException('Series not found');
    this.syncSearch(tenantId, 'series', s.id);
    return s;
  }

  // --- Lessons ---
  async createLesson(tenantId: string, data: CreateLessonDto) {
    return this.createLessonSafe(tenantId, data);
  }

  async findLesson(tenantId: string, lessonSlug: string, viewer?: LessonViewer | string, localeInput?: unknown) {
    const resolved = this.viewerAndLocale(viewer, localeInput);
    const locale = this.localeFrom(resolved.localeInput);
    const lesson = await this.drizzle.db.query.lessons.findFirst({
      where: and(
        eq(lessons.tenantId, tenantId),
        eq(lessons.slug, lessonSlug),
        eq(lessons.isPublished, true),
        eq(lessons.isArchived, false),
      ),
      with: { series: { columns: { courseId: true, tenantId: true, isPublished: true, isArchived: true, translations: true } } },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');
    const course = lesson.series?.courseId
      ? await this.drizzle.db.query.courses.findFirst({
          where: and(eq(courses.id, lesson.series.courseId), eq(courses.tenantId, tenantId), eq(courses.isPublished, true), eq(courses.isArchived, false)),
        })
      : null;
    if (!course || !lesson.series?.isPublished || lesson.series.isArchived || String(lesson.series.tenantId) !== String(tenantId)) throw new NotFoundException('Lesson not found');
    const canAccess = await this.canAccessLesson(tenantId, lesson.series?.courseId, lesson.freePreview, resolved.viewer);
    const result = this.redactLesson(lesson, canAccess, locale) as Record<string, any>;
    if (result.series) result.series = this.localeFields(result.series, localizeSeriesFields(result.series, locale));
    return result;
  }

  async findLessonFull(tenantId: string, lessonSlug: string, viewer?: LessonViewer | string, localeInput?: unknown) {
    const resolved = this.viewerAndLocale(viewer, localeInput);
    const locale = this.localeFrom(resolved.localeInput);
    const lesson = await this.drizzle.db.query.lessons.findFirst({
      where: and(
        eq(lessons.tenantId, tenantId),
        eq(lessons.slug, lessonSlug),
        eq(lessons.isPublished, true),
        eq(lessons.isArchived, false),
      ),
      with: {
        series: {
          with: {
            course: true,
          },
        },
      },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');
    if (!lesson.series?.isPublished || lesson.series.isArchived || String(lesson.series.tenantId) !== String(tenantId) || !lesson.series.course?.isPublished || lesson.series.course.isArchived || String(lesson.series.course.tenantId) !== String(tenantId)) throw new NotFoundException('Lesson not found');
    const canAccess = await this.canAccessLesson(tenantId, lesson.series?.courseId, lesson.freePreview, resolved.viewer);
    const result = this.redactLesson(lesson, canAccess, locale) as Record<string, any>;
    if (result.series) result.series = this.localeFields(result.series, localizeSeriesFields(result.series, locale));
    if (result.series?.course) result.series.course = this.localeFields(result.series.course, localizeCourseFields(result.series.course, locale));
    return result;
  }

  async findLessonInCourse(tenantId: string, courseSlug: string, lessonSlug: string, viewer?: LessonViewer | string, localeInput?: unknown) {
    const resolved = this.viewerAndLocale(viewer, localeInput);
    const locale = this.localeFrom(resolved.localeInput);
    const course = await this.drizzle.db.query.courses.findFirst({
      where: and(eq(courses.tenantId, tenantId), eq(courses.slug, courseSlug), eq(courses.isPublished, true), eq(courses.isArchived, false)),
      columns: { id: true },
    });
    if (!course) throw new NotFoundException('Course not found');
    const lesson = await this.drizzle.db.query.lessons.findFirst({
      where: and(
        eq(lessons.tenantId, tenantId),
        eq(lessons.slug, lessonSlug),
        eq(lessons.isPublished, true),
        eq(lessons.isArchived, false),
      ),
      with: {
        series: {
          with: {
            course: true,
          },
        },
      },
    });
    if (!lesson || lesson.series?.courseId !== course.id || String(lesson.series.tenantId) !== String(tenantId) || !lesson.series.isPublished || lesson.series.isArchived || !lesson.series.course?.isPublished || lesson.series.course.isArchived || String(lesson.series.course.tenantId) !== String(tenantId)) {
      throw new NotFoundException('Lesson not found');
    }
    const canAccess = await this.canAccessLesson(tenantId, course.id, lesson.freePreview, resolved.viewer);
    const result = this.redactLesson(lesson, canAccess, locale) as Record<string, any>;
    if (result.series) result.series = this.localeFields(result.series, localizeSeriesFields(result.series, locale));
    if (result.series?.course) result.series.course = this.localeFields(result.series.course, localizeCourseFields(result.series.course, locale));
    return result;
  }

  private async canAccessLesson(
    tenantId: string,
    courseId: string | null | undefined,
    freePreview: boolean | null | undefined,
    viewer: LessonViewer,
  ): Promise<boolean> {
    if (viewer?.id && viewer.tenantId && String(viewer.tenantId) !== String(tenantId)) return false;
    if (freePreview) return true;
    if (!viewer?.id) return false;
    if (viewer.role === 'admin' || viewer.role === 'super_admin') return true;
    if (!courseId) return false;
    const enrollment = await this.drizzle.db.query.enrollments.findFirst({
      where: and(
        eq(enrollments.tenantId, tenantId),
        eq(enrollments.userId, viewer.id),
        eq(enrollments.courseId, courseId),
        ne(enrollments.status, 'cancelled'),
      ),
      columns: { id: true },
    });
    return !!enrollment;
  }

  private redactLesson<T extends LessonContentRow & Record<string, any>>(lesson: T, canAccess: boolean, locale: ContentLocale = 'en') {
    return this.publicLesson(lesson, locale, canAccess);
  }

  /**
   * Authorized playback URL – enforces paywall:
   * - freePreview true → allow (even anonymous; endpoints are @Public with optional auth)
   * - admin/super_admin of tenant → allow
   * - enrolled user → allow
   * otherwise 401 (anonymous) / 403 (logged in but not enrolled)
   */
  async getLessonPlaybackUrl(
    tenantId: string,
    lessonSlug: string,
    viewer: { id: string; role: string; tenantId: string } | null | undefined,
    courseSlug?: string,
  ): Promise<{ url: string; lessonId: string }> {
    const where = and(
      eq(lessons.tenantId, tenantId),
      eq(lessons.slug, lessonSlug),
      eq(lessons.isPublished, true),
      eq(lessons.isArchived, false),
    );
     const lesson: any = await this.drizzle.db.query.lessons.findFirst({
       where,
       with: { series: { columns: { courseId: true, tenantId: true, isPublished: true, isArchived: true }, with: { course: { columns: { id: true, tenantId: true, isPublished: true, isArchived: true } } } } },
     });
     if (!lesson || !lesson.series?.isPublished || lesson.series.isArchived || String(lesson.series.tenantId) !== String(tenantId) || !lesson.series.course?.isPublished || lesson.series.course.isArchived || String(lesson.series.course.tenantId) !== String(tenantId)) throw new NotFoundException('Lesson not found');
    if (courseSlug) {
      const course = await this.drizzle.db.query.courses.findFirst({
        where: and(eq(courses.tenantId, tenantId), eq(courses.slug, courseSlug), eq(courses.isPublished, true), eq(courses.isArchived, false)),
        columns: { id: true },
      });
      if (!course || lesson.series?.courseId !== course.id) throw new NotFoundException('Lesson not found');
    }
    const document = this.lessonDocument(lesson);
    const videoBlock = document.blocks.find((block) => block.type === 'video');
    const blockContent = videoBlock && typeof videoBlock.content === 'object' && !Array.isArray(videoBlock.content) ? videoBlock.content as Record<string, any> : undefined;
    const videoUrl = lesson.videoUrl ?? (typeof blockContent?.source === 'string' ? blockContent.source : typeof blockContent?.storageKey === 'string' ? blockContent.storageKey : null);
    if (!videoUrl) throw new NotFoundException('Video not available');
     if (!isUploadedVideoRef(videoUrl)) throw new NotFoundException('Video not available');
     if (lesson.freePreview) {
       if (!StorageService.isKey(videoUrl)) return { url: videoUrl, lessonId: lesson.id };
       const url = StorageService.isKey(videoUrl) ? await this.storage.resolvePlaybackUrl(videoUrl) : videoUrl;
       return { url, lessonId: lesson.id };
     }
    if (!viewer) {
      throw new UnauthorizedException('Please sign in to watch this lesson');
    }
    if (viewer.tenantId && String(viewer.tenantId) !== String(tenantId)) {
      throw new ForbiddenException('Tenant access denied');
    }
    if (viewer.role === 'admin' || viewer.role === 'super_admin') {
      // TenantScopeGuard already validated viewer tenant matches requested tenant
       const url = StorageService.isKey(videoUrl) ? await this.storage.resolvePlaybackUrl(videoUrl) : videoUrl;
       return { url, lessonId: lesson.id };
    }
    const courseId = lesson.series?.courseId;
    if (!courseId) throw new ForbiddenException('Access denied');
    const enrolled = await this.drizzle.db.query.enrollments.findFirst({
      where: and(eq(enrollments.userId, viewer.id), eq(enrollments.courseId, courseId), eq(enrollments.tenantId, tenantId), ne(enrollments.status, 'cancelled')),
    });
    if (!enrolled) throw new ForbiddenException('Enroll in the course to view this lesson');
     const url = StorageService.isKey(videoUrl) ? await this.storage.resolvePlaybackUrl(videoUrl) : videoUrl;
     return { url, lessonId: lesson.id };
  }

  async updateLesson(tenantId: string, lessonId: string, data: UpdateLessonDto | Partial<CreateLessonDto>) {
    const [existing] = await this.drizzle.db
      .select({ videoUrl: lessons.videoUrl, contentBlocks: lessons.contentBlocks })
      .from(lessons)
      .where(and(eq(lessons.id, lessonId), eq(lessons.tenantId, tenantId)));
    if (!existing) throw new NotFoundException('Lesson not found');
    const input = this.withoutLifecycle(data as unknown as Record<string, unknown>);
    const { translations: rawTranslations, contentBlocks: rawContentBlocks, ...rest } = input as unknown as UpdateLessonDto;
    const patch: Record<string, unknown> = { ...rest, updatedAt: new Date() };
    const translations = parseLessonTranslations(rawTranslations);
    const contentBlocks = rawContentBlocks === null
      ? null
      : rawContentBlocks === undefined
        ? undefined
        : parseLessonContentDocument(rawContentBlocks);
    if (translations !== undefined) patch.translations = translations;
    if (contentBlocks !== undefined) patch.contentBlocks = contentBlocks;
    const [lesson] = await this.drizzle.db
      .update(lessons).set(patch)
      .where(and(eq(lessons.id, lessonId), eq(lessons.tenantId, tenantId)))
      .returning();
    if (!lesson) throw new NotFoundException('Lesson not found');
    if (contentBlocks !== undefined) {
      const oldDocument = this.lessonDocument(existing as LessonContentRow);
      const nextDocument = contentBlocks ?? { schemaVersion: 1 as const, blocks: [] };
      const changedQuizIds = this.changedQuizIds(oldDocument, nextDocument);
      if (changedQuizIds.length) {
        await this.drizzle.db.delete(lessonQuizAttempts).where(and(
          eq(lessonQuizAttempts.tenantId, tenantId),
          eq(lessonQuizAttempts.lessonId, lessonId),
          inArray(lessonQuizAttempts.quizId, changedQuizIds),
        ));
      }
    }
    this.syncSearch(tenantId, 'lesson', lesson.id);
    if (data.videoUrl !== undefined && StorageService.isKey(existing.videoUrl) && existing.videoUrl !== data.videoUrl) {
      await this.maybeDeleteVideo(tenantId, existing.videoUrl);
    }
    return lesson;
  }

  private async resolveQuizContext(tenantId: string, courseSlug: string, lessonSlug: string) {
    const course = await this.drizzle.db.query.courses.findFirst({
      where: and(
        eq(courses.tenantId, tenantId),
        eq(courses.slug, courseSlug),
        eq(courses.isPublished, true),
        eq(courses.isArchived, false),
      ),
      columns: { id: true, tenantId: true },
    });
    if (!course) throw new NotFoundException('Course not found');
    const lesson = await this.drizzle.db.query.lessons.findFirst({
      where: and(
        eq(lessons.tenantId, tenantId),
        eq(lessons.slug, lessonSlug),
        eq(lessons.isPublished, true),
        eq(lessons.isArchived, false),
      ),
      with: { series: { columns: { courseId: true, tenantId: true, isPublished: true, isArchived: true } } },
    });
    if (!lesson || lesson.series?.courseId !== course.id || String(lesson.series.tenantId) !== String(tenantId) || !lesson.series.isPublished || lesson.series.isArchived) {
      throw new NotFoundException('Lesson not found');
    }
    return { course, lesson };
  }

  private validateQuizAnswers(block: LessonBlock, answers: Record<string, string | string[]>) {
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) throw new BadRequestException('Quiz answers must be an object');
    if (Object.keys(answers).length > 100) throw new BadRequestException('Too many quiz answers');
    const content = block.content as Record<string, any>;
    const questions = Array.isArray(content.questions) ? content.questions as QuizQuestion[] : [];
    if (!questions.length) throw new BadRequestException('Quiz has no questions');
    const questionMap = new Map(questions.map((question) => [question.id, question]));
    for (const [questionId, answer] of Object.entries(answers)) {
      const question = questionMap.get(questionId);
      if (!question) throw new BadRequestException(`Unknown quiz question: ${questionId}`);
      const optionIds = new Set(question.options.map((option) => option.id));
      if (question.type === 'multiple') {
        if (!Array.isArray(answer) || answer.some((value) => typeof value !== 'string')) {
          throw new BadRequestException(`Answer for ${questionId} must be an array`);
        }
        if (new Set(answer).size !== answer.length) throw new BadRequestException(`Answer for ${questionId} contains duplicates`);
        if (answer.some((value) => !optionIds.has(value))) throw new BadRequestException(`Answer for ${questionId} contains an unknown option`);
      } else {
        if (typeof answer !== 'string') throw new BadRequestException(`Answer for ${questionId} must be a string`);
        if (!optionIds.has(answer)) throw new BadRequestException(`Answer for ${questionId} contains an unknown option`);
      }
    }
    return questions;
  }

  private async cleanupQuizAttempts(tenantId: string, userId: string, lessonId: string, quizId: string, attemptNumber: number) {
    try {
      await this.drizzle.db.delete(lessonQuizAttempts).where(and(
        eq(lessonQuizAttempts.tenantId, tenantId),
        eq(lessonQuizAttempts.userId, userId),
        eq(lessonQuizAttempts.lessonId, lessonId),
        eq(lessonQuizAttempts.quizId, quizId),
        lt(lessonQuizAttempts.attemptNumber, Math.max(1, attemptNumber - 100)),
      ));
      await this.drizzle.db.delete(lessonQuizAttempts).where(and(
        eq(lessonQuizAttempts.tenantId, tenantId),
        lt(lessonQuizAttempts.createdAt, new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)),
      ));
    } catch {
      return;
    }
  }

  async cleanupOldQuizAttempts(tenantId: string, olderThanDays = 180) {
    const cutoff = new Date(Date.now() - Math.max(1, olderThanDays) * 24 * 60 * 60 * 1000);
    await this.drizzle.db.delete(lessonQuizAttempts).where(and(
      eq(lessonQuizAttempts.tenantId, tenantId),
      lt(lessonQuizAttempts.createdAt, cutoff),
    ));
  }

  async gradeQuizAttempt(
    tenantId: string,
    viewer: { id: string; role: string; tenantId: string },
    courseSlug: string,
    lessonSlug: string,
    quizId: string,
    answers: Record<string, string | string[]>,
    localeInput?: unknown,
  ) {
    if (!viewer?.id) throw new UnauthorizedException('Authentication required');
    if (viewer.tenantId && String(viewer.tenantId) !== String(tenantId) && viewer.role !== 'super_admin') {
      throw new ForbiddenException('Tenant access denied');
    }
    const { course, lesson } = await this.resolveQuizContext(tenantId, courseSlug, lessonSlug);
    const canAccess = await this.canAccessLesson(tenantId, course.id, lesson.freePreview, viewer);
    if (!canAccess) throw new ForbiddenException('Enroll in the course to submit this quiz');
    const locale = this.localeFrom(localeInput);
    const document = localizeLessonDocument(this.lessonDocument(lesson), locale);
    const block = getQuizBlocks(document).find((candidate) => candidate.id === quizId);
    if (!block) throw new NotFoundException('Quiz not found');
    this.validateQuizAnswers(block, answers);
    const content = block.content as Record<string, any>;
    const { score, passed, results } = gradeQuizBlock(block, answers);
    const previous = await this.drizzle.db
      .select({ attemptNumber: lessonQuizAttempts.attemptNumber })
      .from(lessonQuizAttempts)
      .where(and(
        eq(lessonQuizAttempts.tenantId, tenantId),
        eq(lessonQuizAttempts.userId, viewer.id),
        eq(lessonQuizAttempts.lessonId, lesson.id),
        eq(lessonQuizAttempts.quizId, quizId),
      ))
      .orderBy(desc(lessonQuizAttempts.attemptNumber));
    const attemptNumber = (previous[0]?.attemptNumber ?? 0) + 1;
    const maxAttempts = content.maxAttempts === null || content.maxAttempts === undefined ? null : Number(content.maxAttempts);
    if (maxAttempts !== null && attemptNumber > maxAttempts) throw new BadRequestException('Maximum quiz attempts reached');
    const attemptId = randomUUID();
    const [attempt] = await this.drizzle.db
      .insert(lessonQuizAttempts)
      .values({
        id: attemptId,
        tenantId,
        userId: viewer.id,
        lessonId: lesson.id,
        quizId,
        answers,
        score,
        passed,
        attemptNumber,
      })
      .returning();
    await this.cleanupQuizAttempts(tenantId, viewer.id, lesson.id, quizId, attemptNumber);
    await this.upsertProgress(viewer.id, lesson.id, tenantId, {});
    return {
      attemptId: attempt?.id ?? attemptId,
      lessonId: lesson.id,
      quizId,
      score,
      passed,
      attemptNumber,
      results,
    };
  }

  async getLessonQuizAttempts(tenantId: string, userId: string, lessonId: string, quizId: string) {
    await this.assertLessonInTenant(tenantId, lessonId);
    return this.drizzle.db
      .select()
      .from(lessonQuizAttempts)
      .where(and(
        eq(lessonQuizAttempts.tenantId, tenantId),
        eq(lessonQuizAttempts.userId, userId),
        eq(lessonQuizAttempts.lessonId, lessonId),
        eq(lessonQuizAttempts.quizId, quizId),
      ))
      .orderBy(desc(lessonQuizAttempts.attemptNumber));
  }

  // --- Enrollments ---
  async enrollUser(tenantId: string, userId: string, courseId: string) {
    // The course must belong to the caller's resolved tenant. Without this check a
    // learner could enrol into another tenant's course (and the insert would stamp the
    // wrong tenantId on the enrollment row).
    const course = await this.drizzle.db.query.courses.findFirst({
      where: eq(courses.id, courseId),
      columns: { id: true, tenantId: true, isPublished: true, isArchived: true, slug: true, title: true },
    });
    if (!course || String(course.tenantId) !== String(tenantId)) {
      throw new NotFoundException('Course not found');
    }
    if (!course.isPublished || course.isArchived) {
      throw new BadRequestException('Course is not available for enrollment');
    }

    const existing = await this.drizzle.db.query.enrollments.findFirst({
      where: and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)),
    });
    if (existing) return existing;
    const [e] = await this.drizzle.db
      .insert(enrollments).values({ userId, courseId, tenantId }).returning();
    void this.notifications?.notifyUser({
      tenantId,
      userId,
      type: 'enrollment',
      category: 'learning',
      title: 'You enrolled in a course',
      body: `Your enrollment in ${course.title} is active.`,
      href: `/courses/${course.slug}`,
      entityType: 'enrollment',
      entityId: e?.id ?? courseId,
      idempotencyKey: `enrollment:${tenantId}:${userId}:${courseId}`,
    }).catch(() => {});
    return e;
  }

  async getUserEnrollments(userId: string) {
    return this.drizzle.db.query.enrollments.findMany({
      where: eq(enrollments.userId, userId),
      with: {
        course: {
          with: {
            series: {
              where: eq(series.isPublished, true),
            },
          },
        },
      },
    });
  }

  async getEnrollment(userId: string, courseId: string) {
    return this.drizzle.db.query.enrollments.findFirst({
      where: and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)),
    });
  }

  async getLessonProgress(userId: string, lessonId: string, tenantId?: string) {
    return this.drizzle.db.query.lessonProgress.findFirst({
      where: tenantId
        ? and(eq(lessonProgress.userId, userId), eq(lessonProgress.lessonId, lessonId), eq(lessonProgress.tenantId, tenantId))
        : and(eq(lessonProgress.userId, userId), eq(lessonProgress.lessonId, lessonId)),
    });
  }

  private async progressQuizState(userId: string, lessonId: string, tenantId: string) {
    const lesson = await this.assertLessonInTenant(tenantId, lessonId);
    const document = this.lessonDocument(lesson);
    const requiredQuizIds = getRequiredQuizIds(document);
    const attempts = await this.drizzle.db
      .select({ quizId: lessonQuizAttempts.quizId, score: lessonQuizAttempts.score, passed: lessonQuizAttempts.passed })
      .from(lessonQuizAttempts)
      .where(and(
        eq(lessonQuizAttempts.tenantId, tenantId),
        eq(lessonQuizAttempts.userId, userId),
        eq(lessonQuizAttempts.lessonId, lessonId),
      ));
    const passedQuizIds = new Set(attempts.filter((attempt) => attempt.passed).map((attempt) => attempt.quizId));
    const quizScore = attempts.reduce((maximum, attempt) => Math.max(maximum, Number(attempt.score) || 0), 0);
    return {
      requiredQuizIds,
      allRequiredPassed: requiredQuizIds.length === 0 || requiredQuizIds.every((quizId) => passedQuizIds.has(quizId)),
      quizScore,
    };
  }

  async upsertProgress(
    userId: string, lessonId: string, tenantId: string,
    data: { watchTimeSeconds?: number; completed?: boolean; quizScore?: number },
  ) {
    const existing = await this.getLessonProgress(userId, lessonId, tenantId);
    const quizState = await this.progressQuizState(userId, lessonId, tenantId);
    const requestedCompleted = data.completed;
    const completed = quizState.requiredQuizIds.length > 0
      ? quizState.allRequiredPassed
      : requestedCompleted === undefined
        ? (existing?.completed ?? false)
        : requestedCompleted;
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (data.watchTimeSeconds !== undefined) patch.watchTimeSeconds = data.watchTimeSeconds;
    patch.completed = completed;
    patch.quizScore = Math.max(Number(existing?.quizScore ?? 0), quizState.quizScore);
    if (completed) patch.completedAt = existing?.completedAt ?? new Date();
    let result: typeof lessonProgress.$inferSelect;
    if (existing) {
      const [updated] = await this.drizzle.db
        .update(lessonProgress)
        .set({ ...patch, completedAt: completed ? (existing.completedAt ?? new Date()) : existing.completedAt })
        .where(eq(lessonProgress.id, existing.id))
        .returning();
      if (!updated) throw new Error('Failed to update progress');
      result = updated;
    } else {
      const [created] = await this.drizzle.db
        .insert(lessonProgress)
        .values({ userId, lessonId, tenantId, ...patch } as any)
        .returning();
      if (!created) throw new Error('Failed to create progress');
      result = created;
    }

    if (completed) {
      try {
        const { courseId } = await this.resolveLessonContext(tenantId, lessonId);
        const progress = await this.getCourseProgress(userId, courseId, tenantId);
        if (progress.percent === 100 && progress.total > 0) {
          void this.notifications?.notifyUser({
            tenantId,
            userId,
            type: 'course_completed',
            category: 'learning',
            title: 'Course completed',
            body: 'You completed all lessons in this course.',
            entityType: 'course',
            entityId: courseId,
            idempotencyKey: `course-completed:${tenantId}:${userId}:${courseId}`,
          }).catch(() => {});
          await this.certification.tryAutoIssue(userId, courseId, tenantId).catch((e) => {
            this.certification['logger']?.warn?.(`Auto-issue failed for user=${userId} course=${courseId}: ${e?.message}`);
          });
        }
      } catch {
        return result;
      }
    }

    return result;
  }

  async getCourseProgress(userId: string, courseId: string, tenantId?: string) {
    const courseBase = await this.drizzle.db.query.courses.findFirst({
      where: tenantId ? and(eq(courses.id, courseId), eq(courses.tenantId, tenantId)) : eq(courses.id, courseId),
      columns: { id: true, tenantId: true },
    });
    if (!courseBase) throw new NotFoundException('Course not found');
    const courseTenantId = courseBase.tenantId;
    const course = await this.drizzle.db.query.courses.findFirst({
      where: and(eq(courses.id, courseId), eq(courses.tenantId, courseTenantId)),
      with: {
        series: {
          where: and(eq(series.tenantId, courseTenantId), eq(series.isPublished, true), eq(series.isArchived, false)),
          with: {
            lessons: {
              where: and(eq(lessons.tenantId, courseTenantId), eq(lessons.isPublished, true), eq(lessons.isArchived, false)),
              columns: { id: true },
            },
          },
        },
      },
    });
    if (!course) throw new NotFoundException('Course not found');

    const allLessonIds: string[] = [];
    for (const s of course.series || []) {
      for (const l of s.lessons || []) {
        allLessonIds.push(l.id);
      }
    }
    if (allLessonIds.length === 0) return { total: 0, completed: 0, percent: 0, completedLessonIds: [] };

    const allProgress = await this.drizzle.db
      .select({ lessonId: lessonProgress.lessonId })
      .from(lessonProgress)
      .where(
        and(eq(lessonProgress.userId, userId), eq(lessonProgress.tenantId, courseTenantId), eq(lessonProgress.completed, true)),
      );
    const completedLessonIds: string[] = [];
    for (const p of allProgress) {
      if (allLessonIds.includes(p.lessonId)) {
        completedLessonIds.push(p.lessonId);
      }
    }

    const completed = completedLessonIds.length;
    return {
      total: allLessonIds.length,
      completed,
      percent: Math.round((completed / allLessonIds.length) * 100),
      completedLessonIds,
    };
  }
}