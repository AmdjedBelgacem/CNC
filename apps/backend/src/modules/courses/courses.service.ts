import { BadRequestException, Injectable, NotFoundException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { DrizzleService } from '../../database/drizzle.service';
import { courses, series, lessons } from '../../database/schema/courses';
import { academies } from '../../database/schema/academies';
import { enrollments, lessonProgress } from '../../database/schema/progress';
import { certifications } from '../../database/schema/certifications';
import { StorageService, type VideoMeta } from '../storage/storage.service';
import { UploadService } from '../auth/services/upload.service';
import { CertificationService } from '../certification/certification.service';
import { eq, and, asc, desc, like, ilike, count, sql, inArray, isNull } from 'drizzle-orm';
import { CreateCourseDto, CreateSeriesDto, CreateLessonDto, CourseFilterDto, LessonUploadUrlDto } from './dto/courses.dto';

@Injectable()
export class CoursesService {
  constructor(
    private drizzle: DrizzleService,
    private storage: StorageService,
    private upload: UploadService,
    private certification: CertificationService,
  ) {}

  // Admin-facing management list: includes drafts/archived + per-course metrics.
  async findForAdmin(
    tenantId: string,
    opts: { status?: string; search?: string; academy?: string; zeroEnrollments?: boolean; page?: number; limit?: number },
  ) {
    const conditions: any[] = [eq(courses.tenantId, tenantId)];
    if (opts.status === 'draft') {
      conditions.push(eq(courses.isPublished, false), eq(courses.isArchived, false));
    } else if (opts.status === 'published') {
      conditions.push(eq(courses.isPublished, true), eq(courses.isArchived, false));
    } else if (opts.status === 'archived') {
      conditions.push(eq(courses.isArchived, true));
    }
    if (opts.search) conditions.push(ilike(courses.title, `%${opts.search}%`));
    if (opts.academy === 'none') {
      conditions.push(isNull(courses.academyId));
    } else if (opts.academy) {
      const [academy] = await this.drizzle.db
        .select({ id: academies.id })
        .from(academies)
        .where(and(eq(academies.tenantId, tenantId), eq(academies.slug, opts.academy)))
        .limit(1);
      if (!academy) return { items: [], total: 0, page: Math.max(1, Number(opts.page) || 1), limit: Math.min(100, Math.max(1, Number(opts.limit) || 20)) };
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

    return { items, total: Number(totalArr[0]?.count ?? 0), page, limit };
  }

  async findByTenant(tenantId: string, filters?: CourseFilterDto) {
    const conditions: ReturnType<typeof eq>[] = [eq(courses.tenantId, tenantId)];
    if (filters?.published !== false) conditions.push(eq(courses.isPublished, true));
    if (filters?.difficulty) conditions.push(eq(courses.difficulty, filters.difficulty));
    if (filters?.search) conditions.push(like(courses.title, `%${filters.search}%`));

    // Academy filter: resolves the tenant's academy slug to an id, or yields
    // an empty page when the slug is unknown (never leaks cross-tenant rows).
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
          columns: { id: true, title: true, slug: true, sortOrder: true },
          where: filters?.published !== false ? eq(series.isPublished, true) : undefined,
          orderBy: asc(series.sortOrder),
        },
      },
    });

    const totalArr = await this.drizzle.db
      .select({ count: count() })
      .from(courses)
      .where(and(...conditions));

    return { data, total: totalArr[0]?.count || 0, page, limit };
  }

  async findBySlug(tenantId: string, slug: string) {
    const course = await this.drizzle.db.query.courses.findFirst({
      where: and(eq(courses.tenantId, tenantId), eq(courses.slug, slug)),
      with: {
        academy: {
          columns: { id: true, slug: true, title: true, accentColor: true },
        },
        series: {
          orderBy: asc(series.sortOrder),
          with: {
            lessons: {
              orderBy: asc(lessons.sortOrder),
              columns: {
                id: true, slug: true, title: true, description: true,
                thumbnailUrl: true,
                videoDuration: true, difficulty: true, freePreview: true,
                sortOrder: true, isPublished: true,
              },
            },
          },
        },
      },
    });
    if (!course) throw new NotFoundException('Course not found');
    return course;
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
    const { academyId, ...rest } = data;
    const resolvedAcademyId = academyId ? await this.assertAcademyInTenant(tenantId, academyId) : null;
    const [course] = await this.drizzle.db
      .insert(courses)
      .values({ ...rest, tenantId, academyId: resolvedAcademyId, difficulty: data.difficulty || 1 })
      .returning();
    return course;
  }

  async updateCourse(tenantId: string, slug: string, data: Partial<CreateCourseDto>) {
    const { academyId, ...rest } = data;
    const patch: Record<string, unknown> = { ...rest, updatedAt: new Date() };
    // academyId: undefined = leave unchanged, null = unassign, uuid = assign (tenant-checked).
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
    return course;
  }

  async publishCourse(tenantId: string, slug: string) {
    // Hard validation gate: a course that is not ready can never be published.
    const { ok, reasons } = await this.validateForPublish(tenantId, slug);
    if (!ok) throw new BadRequestException({ message: 'Course is not ready to publish', reasons });

    const [course] = await this.drizzle.db
      .update(courses)
      .set({ isPublished: true, isArchived: false, publishedAt: new Date(), archivedAt: null, updatedAt: new Date() })
      .where(and(eq(courses.tenantId, tenantId), eq(courses.slug, slug)))
      .returning();
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  async unpublishCourse(tenantId: string, slug: string) {
    const [course] = await this.drizzle.db
      .update(courses)
      .set({ isPublished: false, updatedAt: new Date() })
      .where(and(eq(courses.tenantId, tenantId), eq(courses.slug, slug)))
      .returning();
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  async archiveCourse(tenantId: string, slug: string) {
    const [course] = await this.drizzle.db
      .update(courses)
      .set({ isArchived: true, isPublished: false, archivedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(courses.tenantId, tenantId), eq(courses.slug, slug)))
      .returning();
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  async restoreCourse(tenantId: string, slug: string) {
    const [course] = await this.drizzle.db
      .update(courses)
      .set({ isArchived: false, archivedAt: null, updatedAt: new Date() })
      .where(and(eq(courses.tenantId, tenantId), eq(courses.slug, slug)))
      .returning();
    if (!course) throw new NotFoundException('Course not found');
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

    return { success: true };
  }

  // Full course shape for the Course Studio (course + sections + nested lessons + commerce/SEO).
  async getStudio(tenantId: string, slug: string) {
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
    return course;
  }

  // Pre-publish validation — returns why a course cannot be published yet.
  async validateForPublish(tenantId: string, slug: string) {
    const course = await this.getStudio(tenantId, slug);
    const reasons: string[] = [];
    if (!course.title?.trim()) reasons.push('Add a compelling course title');
    if (!course.slug?.trim()) reasons.push('Set a course slug');
    const seriesList = (course.series ?? []) as Array<{ lessons?: unknown[] }>;
    const lessonCount = seriesList.reduce((n, s) => n + (s.lessons?.length ?? 0), 0);
    if (seriesList.length === 0) reasons.push('Add at least one section that contains a lesson');
    else if (lessonCount === 0) reasons.push('Add at least one lesson to your section');
    if (!course.thumbnailUrl?.trim()) reasons.push('Upload a thumbnail image (16:9 recommended)');
    const mode = (course.accessMode ?? 'open') as string;
    if (mode === 'paid' && (!course.priceCents || course.priceCents <= 0))
      reasons.push('Paid courses need a price greater than $0');
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
    const slug = await this.uniqueSeriesSlug(tenantId, course.id, data.slug);
    const [s] = await this.drizzle.db.insert(series).values({ ...data, slug, tenantId }).returning();
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
    const slug = await this.uniqueLessonSlug(tenantId, s.id, data.slug);
    const [l] = await this.drizzle.db
      .insert(lessons)
      .values({ ...data, slug, tenantId, difficulty: data.difficulty ?? 1 })
      .returning();
    return l;
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
    const orphanLessons = await this.drizzle.db
      .select({ videoUrl: lessons.videoUrl })
      .from(lessons)
      .where(and(eq(lessons.seriesId, id), eq(lessons.tenantId, tenantId)));
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
    }
    return { id: deleted.id, deleted: true };
  }

  async deleteLesson(tenantId: string, id: string) {
    const [deleted] = await this.drizzle.db
      .delete(lessons)
      .where(and(eq(lessons.id, id), eq(lessons.tenantId, tenantId)))
      .returning();
    if (!deleted) throw new NotFoundException('Lesson not found');
    await this.maybeDeleteVideo(tenantId, deleted.videoUrl);
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
        attachments: src.attachments,
        difficulty: src.difficulty,
        isPublished: false,
        isArchived: false,
        sortOrder: nextOrder,
        freePreview: false,
      })
      .returning();
    return l;
  }

  async deleteCourse(tenantId: string, slug: string) {
    const course = await this.drizzle.db.query.courses.findFirst({
      where: and(eq(courses.tenantId, tenantId), eq(courses.slug, slug)),
      columns: { id: true },
    });
    if (!course) throw new NotFoundException('Course not found');

    // Courses cascade to series -> lessons, but enrollments, lesson progress,
    // and certifications reference the course/lessons directly, so clear them first.
    await this.drizzle.db.transaction(async (tx) => {
      await tx.delete(enrollments).where(eq(enrollments.courseId, course.id));
      await tx.delete(certifications).where(eq(certifications.courseId, course.id));

      const courseSeries = await tx
        .select({ id: series.id })
        .from(series)
        .where(eq(series.courseId, course.id));
      if (courseSeries.length) {
        const seriesIds = courseSeries.map((s) => s.id);
        const lessonRows = await tx
          .select({ id: lessons.id })
          .from(lessons)
          .where(inArray(lessons.seriesId, seriesIds));
        if (lessonRows.length) {
          await tx.delete(lessonProgress).where(inArray(lessonProgress.lessonId, lessonRows.map((l) => l.id)));
          await tx.delete(lessons).where(inArray(lessons.seriesId, seriesIds));
        }
      }
      await tx.delete(series).where(eq(series.courseId, course.id));
      await tx.delete(courses).where(eq(courses.id, course.id));
    });

    return course;
  }

  // --- Series ---
  async createSeries(tenantId: string, data: CreateSeriesDto) {
    const [s] = await this.drizzle.db.insert(series).values({ ...data, tenantId }).returning();
    return { ...s, lessons: [] };
  }

  async findSeries(tenantId: string, courseSlug: string, seriesSlug: string) {
    const course = await this.findBySlug(tenantId, courseSlug);
    const s = course.series?.find((x) => x.slug === seriesSlug);
    if (!s) throw new NotFoundException('Series not found');
    return s;
  }

  async updateSeries(tenantId: string, seriesId: string, data: Partial<CreateSeriesDto>) {
    const [s] = await this.drizzle.db
      .update(series).set(data).where(and(eq(series.id, seriesId), eq(series.tenantId, tenantId)))
      .returning();
    if (!s) throw new NotFoundException('Series not found');
    return s;
  }

  // --- Lessons ---
  async createLesson(tenantId: string, data: CreateLessonDto) {
    const [l] = await this.drizzle.db
      .insert(lessons).values({ ...data, tenantId, difficulty: data.difficulty || 1 }).returning();
    return l;
  }

  // Public lesson fetch – NEVER resolves private video URLs. Use getLessonPlaybackUrl for authorized playback.
  async findLesson(tenantId: string, lessonSlug: string) {
    const l = await this.drizzle.db.query.lessons.findFirst({
      where: and(eq(lessons.tenantId, tenantId), eq(lessons.slug, lessonSlug)),
    });
    if (!l) throw new NotFoundException('Lesson not found');
    // Redact private video URL for public response – only freePreview may be hinted, never signed.
    if (StorageService.isKey((l as any).videoUrl)) {
      (l as any).videoUrl = null;
    }
    return l;
  }

  async findLessonFull(tenantId: string, lessonSlug: string) {
    const l = await this.drizzle.db.query.lessons.findFirst({
      where: and(eq(lessons.tenantId, tenantId), eq(lessons.slug, lessonSlug)),
      with: {
        series: {
          with: {
            course: true,
          },
        },
      },
    });
    if (!l) throw new NotFoundException('Lesson not found');
    if (StorageService.isKey((l as any).videoUrl)) {
      (l as any).videoUrl = null;
    }
    return l;
  }

  async findLessonInCourse(tenantId: string, courseSlug: string, lessonSlug: string) {
    const course = await this.drizzle.db.query.courses.findFirst({
      where: and(eq(courses.tenantId, tenantId), eq(courses.slug, courseSlug)),
      columns: { id: true },
    });
    if (!course) throw new NotFoundException('Course not found');
    const lesson = await this.drizzle.db.query.lessons.findFirst({
      where: and(eq(lessons.tenantId, tenantId), eq(lessons.slug, lessonSlug)),
      with: {
        series: {
          with: {
            course: true,
          },
        },
      },
    });
    if (!lesson || (lesson as any).series?.courseId !== course.id) throw new NotFoundException('Lesson not found');
    if (StorageService.isKey((lesson as any).videoUrl)) {
      (lesson as any).videoUrl = null;
    }
    return lesson;
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
    const where = and(eq(lessons.tenantId, tenantId), eq(lessons.slug, lessonSlug));
    const lesson: any = await this.drizzle.db.query.lessons.findFirst({
      where,
      with: { series: { columns: { courseId: true } } },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');
    if (courseSlug) {
      const course = await this.drizzle.db.query.courses.findFirst({
        where: and(eq(courses.tenantId, tenantId), eq(courses.slug, courseSlug)),
        columns: { id: true },
      });
      if (!course || lesson.series?.courseId !== course.id) throw new NotFoundException('Lesson not found');
    }
    if (!lesson.videoUrl || !StorageService.isKey(lesson.videoUrl)) {
      throw new NotFoundException('Video not available');
    }
    if (lesson.freePreview) {
      const url = await this.storage.resolvePlaybackUrl(lesson.videoUrl);
      return { url, lessonId: lesson.id };
    }
    if (!viewer) {
      throw new UnauthorizedException('Please sign in to watch this lesson');
    }
    if (viewer.role === 'admin' || viewer.role === 'super_admin') {
      // TenantScopeGuard already validated viewer tenant matches requested tenant
      const url = await this.storage.resolvePlaybackUrl(lesson.videoUrl);
      return { url, lessonId: lesson.id };
    }
    const courseId = lesson.series?.courseId;
    if (!courseId) throw new ForbiddenException('Access denied');
    const enrolled = await this.drizzle.db.query.enrollments.findFirst({
      where: and(eq(enrollments.userId, viewer.id), eq(enrollments.courseId, courseId), eq(enrollments.tenantId, tenantId)),
    });
    if (!enrolled) throw new ForbiddenException('Enroll in the course to view this lesson');
    const url = await this.storage.resolvePlaybackUrl(lesson.videoUrl);
    return { url, lessonId: lesson.id };
  }

  async updateLesson(tenantId: string, lessonId: string, data: Partial<CreateLessonDto>) {
    const [existing] = await this.drizzle.db
      .select({ videoUrl: lessons.videoUrl })
      .from(lessons)
      .where(and(eq(lessons.id, lessonId), eq(lessons.tenantId, tenantId)));
    if (!existing) throw new NotFoundException('Lesson not found');
    const [l] = await this.drizzle.db
      .update(lessons).set({ ...data, updatedAt: new Date() })
      .where(and(eq(lessons.id, lessonId), eq(lessons.tenantId, tenantId)))
      .returning();
    if (!l) throw new NotFoundException('Lesson not found');
    if (data.videoUrl !== undefined && StorageService.isKey(existing.videoUrl) && existing.videoUrl !== data.videoUrl) {
      await this.maybeDeleteVideo(tenantId, existing.videoUrl);
    }
    return l;
  }

  // --- Enrollments ---
  async enrollUser(tenantId: string, userId: string, courseId: string) {
    // The course must belong to the caller's resolved tenant. Without this check a
    // learner could enrol into another tenant's course (and the insert would stamp the
    // wrong tenantId on the enrollment row).
    const course = await this.drizzle.db.query.courses.findFirst({
      where: eq(courses.id, courseId),
      columns: { id: true, tenantId: true, isPublished: true },
    });
    if (!course || String(course.tenantId) !== String(tenantId)) {
      throw new NotFoundException('Course not found');
    }
    if (!course.isPublished) {
      throw new BadRequestException('Course is not available for enrollment');
    }

    const existing = await this.drizzle.db.query.enrollments.findFirst({
      where: and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)),
    });
    if (existing) return existing;
    const [e] = await this.drizzle.db
      .insert(enrollments).values({ userId, courseId, tenantId }).returning();
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

  async getLessonProgress(userId: string, lessonId: string) {
    return this.drizzle.db.query.lessonProgress.findFirst({
      where: and(eq(lessonProgress.userId, userId), eq(lessonProgress.lessonId, lessonId)),
    });
  }

  async upsertProgress(
    userId: string, lessonId: string, tenantId: string,
    data: { watchTimeSeconds?: number; completed?: boolean; quizScore?: number },
  ) {
    const existing = await this.getLessonProgress(userId, lessonId);
    let result: typeof lessonProgress.$inferSelect;
    if (existing) {
      const [p] = await this.drizzle.db
        .update(lessonProgress)
        .set({ ...data, updatedAt: new Date(), completedAt: data.completed ? new Date() : existing.completedAt })
        .where(eq(lessonProgress.id, existing.id))
        .returning();
      if (!p) throw new Error('Failed to update progress');
      result = p;
    } else {
      const [p] = await this.drizzle.db
        .insert(lessonProgress)
        .values({ userId, lessonId, tenantId, ...data })
        .returning();
      if (!p) throw new Error('Failed to create progress');
      result = p;
    }

    // Auto-issue on lesson completion
    if (data.completed) {
      try {
        const { courseId } = await this.resolveLessonContext(tenantId, lessonId);
        const progress = await this.getCourseProgress(userId, courseId);
        if (progress.percent === 100 && progress.total > 0) {
          await this.certification.tryAutoIssue(userId, courseId, tenantId).catch((e) => {
            this.certification['logger']?.warn?.(`Auto-issue failed for user=${userId} course=${courseId}: ${e?.message}`);
          });
        }
      } catch {
        // Non-blocking: ignore completion check errors
      }
    }

    return result;
  }

  async getCourseProgress(userId: string, courseId: string) {
    const course = await this.drizzle.db.query.courses.findFirst({
      where: eq(courses.id, courseId),
      with: {
        series: {
          with: {
            lessons: { columns: { id: true } },
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
        and(eq(lessonProgress.userId, userId), eq(lessonProgress.completed, true)),
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