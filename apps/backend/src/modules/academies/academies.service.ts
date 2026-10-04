import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, asc, count, eq, ilike, inArray, isNull, sql } from 'drizzle-orm';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { DrizzleService } from '../../database/drizzle.service';
import { academies } from '../../database/schema/academies';
import { courses, series } from '../../database/schema/courses';
import { tenants } from '../../database/schema/tenants';
import { isReservedAcademySlug } from '@titan/shared';
import { CreateAcademyDto, UpdateAcademyDto } from './dto/academies.dto';
import { SearchService } from '../search/search.service';
import type { LessonLocaleMetadata } from '@titan/shared';
import {
  localizeAcademyFields,
  localizeCourseFields,
  resolveContentLocale,
} from '../courses/lesson-content';

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,198}[a-z0-9])?$/;

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'image/avif',
]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB per image (hero, logo, seo)
type AcademyImageKind = 'hero' | 'logo' | 'seo';
const KIND_TO_COLUMN: Record<AcademyImageKind, 'heroImageUrl' | 'logoUrl' | 'seoImageUrl'> = {
  hero: 'heroImageUrl',
  logo: 'logoUrl',
  seo: 'seoImageUrl',
};

@Injectable()
export class AcademiesService {
  private readonly logger = new Logger(AcademiesService.name);

  constructor(
    private drizzle: DrizzleService,
    private search?: SearchService,
  ) {}

  private syncSearch(tenantId: string, id: string) {
    void this.search?.indexEntity(tenantId, 'academy', id);
  }

  private validateSlugFormat(slug: string) {
    if (!SLUG_RE.test(slug)) {
      throw new BadRequestException('Slug must be lowercase letters, numbers and hyphens (2-200 chars)');
    }
    if (isReservedAcademySlug(slug)) {
      throw new BadRequestException(`"${slug}" is a reserved slug and cannot be used for an academy`);
    }
  }

  /** Append -2, -3… until the slug is free within the tenant (same loop style as series/lesson slugs). */
  private async uniqueSlug(tenantId: string, base: string): Promise<string> {
    let slug = base;
    for (let i = 2; ; i++) {
      const existing = await this.drizzle.db
        .select({ id: academies.id })
        .from(academies)
        .where(and(eq(academies.tenantId, tenantId), eq(academies.slug, slug)))
        .limit(1);
      if (!existing.length) return slug;
      slug = `${base}-${i}`;
    }
  }

  private async getBySlug(tenantId: string, slug: string) {
    const [academy] = await this.drizzle.db
      .select()
      .from(academies)
      .where(and(eq(academies.tenantId, tenantId), eq(academies.slug, slug)))
      .limit(1);
    if (!academy) throw new NotFoundException('Academy not found');
    return academy;
  }

  private async courseCount(tenantId: string, academyId: string, publishedOnly: boolean): Promise<number> {
    const conditions = [
      eq(courses.tenantId, tenantId),
      eq(courses.academyId, academyId),
      eq(courses.isArchived, false),
    ];
    if (publishedOnly) conditions.push(eq(courses.isPublished, true));
    const [row] = await this.drizzle.db
      .select({ n: count() })
      .from(courses)
      .where(and(...conditions));
    return Number(row?.n ?? 0);
  }

  // --- Admin listing ---

  async findForAdmin(
    tenantId: string,
    opts: { status?: string; search?: string; page?: number; limit?: number },
  ) {
    // Status-agnostic filters are shared with the facet counts, so each filter
    // tab can report how many academies it would actually return.
    const baseConditions: any[] = [eq(academies.tenantId, tenantId)];
    if (opts.search) baseConditions.push(ilike(academies.title, `%${opts.search}%`));

    const statusConditions = (status?: string): any[] => {
      if (status === 'draft') {
        return [eq(academies.isPublished, false), eq(academies.isArchived, false)];
      }
      if (status === 'published') {
        return [eq(academies.isPublished, true), eq(academies.isArchived, false)];
      }
      if (status === 'archived') return [eq(academies.isArchived, true)];
      return [];
    };

    const conditions = [...baseConditions, ...statusConditions(opts.status)];
    const where = and(...conditions);
    const page = Math.max(1, Number(opts.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(opts.limit) || 20));

    const rows = await this.drizzle.db
      .select()
      .from(academies)
      .where(where)
      .orderBy(asc(academies.sortOrder), asc(academies.title))
      .limit(limit)
      .offset((page - 1) * limit);

    const [totalRows, facetRows] = await Promise.all([
      this.drizzle.db.select({ n: count() }).from(academies).where(where),
      Promise.all(
        (['published', 'draft', 'archived'] as const).map((st) =>
          this.drizzle.db
            .select({ n: count() })
            .from(academies)
            .where(and(...baseConditions, ...statusConditions(st)))
            .then((r) => [st, Number(r[0]?.n ?? 0)] as const),
        ),
      ),
    ]);

    const facets: Record<string, number> = { published: 0, draft: 0, archived: 0 };
    let facetTotal = 0;
    for (const [key, n] of facetRows) {
      facets[key] = n;
      facetTotal += n;
    }

    // One grouped count query for course rosters (non-archived courses).
    const ids = rows.map((r) => r.id);
    const countMap = new Map<string, number>();
    if (ids.length) {
      const counts = await this.drizzle.db
        .select({ academyId: courses.academyId, n: count() })
        .from(courses)
        .where(
          and(
            eq(courses.tenantId, tenantId),
            eq(courses.isArchived, false),
            inArray(courses.academyId, ids),
          ),
        )
        .groupBy(courses.academyId);
      for (const c of counts) countMap.set(c.academyId!, Number(c.n));
    }

    return {
      items: rows.map((r) => ({ ...r, courseCount: countMap.get(r.id) ?? 0 })),
      total: Number(totalRows[0]?.n ?? 0),
      facets,
      facetTotal,
      page,
      limit,
    };
  }

  async getAdminDetail(tenantId: string, slug: string) {
    const academy = await this.getBySlug(tenantId, slug);
    const roster = await this.drizzle.db
      .select({
        id: courses.id,
        slug: courses.slug,
        title: courses.title,
        subtitle: courses.subtitle,
        thumbnailUrl: courses.thumbnailUrl,
        difficulty: courses.difficulty,
        estimatedHours: courses.estimatedHours,
        isPublished: courses.isPublished,
        isArchived: courses.isArchived,
        sortOrder: courses.sortOrder,
        updatedAt: courses.updatedAt,
      })
      .from(courses)
      .where(and(eq(courses.tenantId, tenantId), eq(courses.academyId, academy.id)))
      .orderBy(asc(courses.sortOrder), asc(courses.title));
    return { ...academy, courseCount: roster.length, courses: roster };
  }

  async create(tenantId: string, dto: CreateAcademyDto) {
    const base = dto.slug.trim().toLowerCase();
    this.validateSlugFormat(base);
    const slug = await this.uniqueSlug(tenantId, base);
    // Images are upload-only: never accept heroImageUrl / logoUrl / seoImageUrl via JSON.
    // Defensive guard in case a client still sends them (whitelist + forbidNonWhitelisted should already reject,
    // but we also check the raw dto shape for callers that bypass class-validator).
    const raw: any = dto as any;
    if (raw.heroImageUrl != null || raw.logoUrl != null || raw.seoImageUrl != null) {
      throw new BadRequestException('Images must be uploaded via POST /admin/academies/:slug/images — direct URL entry is disabled');
    }
    const [academy] = await this.drizzle.db
      .insert(academies)
      .values({
        tenantId,
        slug,
        title: dto.title,
        subtitle: dto.subtitle ?? null,
        description: dto.description ?? null,
        accentColor: dto.accentColor ?? null,
        seoTitle: dto.seoTitle ?? null,
        seoDescription: dto.seoDescription ?? null,
        sortOrder: dto.sortOrder ?? 0,
      })
      .returning();
    if (academy) this.syncSearch(tenantId, academy.id);
    return { ...academy, courseCount: 0 };
  }

  async update(tenantId: string, slug: string, dto: UpdateAcademyDto) {
    const academy = await this.getBySlug(tenantId, slug);
    const raw: any = dto as any;
    if (raw.heroImageUrl != null || raw.logoUrl != null || raw.seoImageUrl != null || raw.hero_image_url != null || raw.logo_url != null || raw.seo_image_url != null) {
      throw new BadRequestException('Images must be uploaded via POST /admin/academies/:slug/images — direct URL entry is disabled');
    }
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (dto.slug !== undefined && dto.slug !== slug) {
      const base = dto.slug.trim().toLowerCase();
      this.validateSlugFormat(base);
      const next = await this.uniqueSlug(tenantId, base);
      if (next !== dto.slug) throw new ConflictException(`Slug already taken — try "${next}"`);
      patch.slug = dto.slug;
    }
    for (const key of [
      'title', 'subtitle', 'description',
      'accentColor', 'seoTitle', 'seoDescription', 'sortOrder',
    ] as const) {
      if (dto[key] !== undefined) patch[key] = dto[key];
    }
    const [updated] = await this.drizzle.db
      .update(academies)
      .set(patch)
      .where(and(eq(academies.tenantId, tenantId), eq(academies.id, academy.id)))
      .returning();
    if (updated) this.syncSearch(tenantId, updated.id);
    return { ...updated, courseCount: await this.courseCount(tenantId, academy.id, false) };
  }

  // ---------------------------------------------------------------------------
  // Image upload — branding (hero, logo) + SEO (og:image). Upload-only: no URL entry.
  // ---------------------------------------------------------------------------

  private getUploadDir(): string {
    return process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');
  }

  private getBaseUrl(): string {
    const apiUrl = process.env.API_URL || 'http://localhost:4000';
    return (process.env.UPLOAD_BASE_URL || `${apiUrl}/uploads`).replace(/\/$/, '');
  }

  private isS3Configured(): boolean {
    return Boolean(
      process.env.S3_BUCKET &&
      process.env.S3_ENDPOINT &&
      process.env.S3_ACCESS_KEY &&
      process.env.S3_SECRET_KEY,
    );
  }

  private buildS3Client(): S3Client {
    return new S3Client({
      region: process.env.S3_REGION || 'us-east-1',
      endpoint: process.env.S3_ENDPOINT,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY!,
        secretAccessKey: process.env.S3_SECRET_KEY!,
      },
      forcePathStyle: (process.env.S3_FORCE_PATH_STYLE || 'true') === 'true',
    });
  }

  private async deleteFileForUrl(url: string): Promise<void> {
    if (!url) return;
    const baseUrl = this.getBaseUrl();
    const s3Public = (process.env.S3_PUBLIC_URL || '').replace(/\/$/, '');
    const s3Endpoint = (process.env.S3_ENDPOINT || '').replace(/\/$/, '');
    const bucket = process.env.S3_BUCKET || '';
    try {
      if (url.startsWith(baseUrl + '/')) {
        const rel = url.slice(baseUrl.length + 1); // e.g. academies/<id>/hero/<file>
        const filePath = join(this.getUploadDir(), rel);
        if (existsSync(filePath)) await unlink(filePath);
        this.logger.log(`Deleted academy image local file ${rel}`);
        return;
      }
      if (s3Public && url.startsWith(s3Public + '/')) {
        const key = url.slice(s3Public.length + 1);
        const client = this.buildS3Client();
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
        this.logger.log(`Deleted academy image S3 ${bucket}/${key}`);
        return;
      }
      if (s3Endpoint && bucket && url.startsWith(`${s3Endpoint}/${bucket}/`)) {
        const key = url.slice(`${s3Endpoint}/${bucket}/`.length);
        const client = this.buildS3Client();
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
        this.logger.log(`Deleted academy image S3 ${bucket}/${key} (via endpoint)`);
        return;
      }
      // Tenant-scoped S3 key without public base (tenants/...) — delete by key
      if (url.startsWith('tenants/') && this.isS3Configured()) {
        const client = this.buildS3Client();
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: url }));
        this.logger.log(`Deleted academy image S3 key ${url}`);
      }
    } catch (err) {
      this.logger.warn(`Failed to delete old academy image ${url}`, err as any);
    }
  }

  private sanitizeExt(mime: string, originalName?: string): string {
    if (mime === 'image/svg+xml') return 'svg';
    if (mime === 'image/jpeg') return 'jpg';
    const fromMime = mime.split('/')[1]?.split('+')[0]?.replace(/[^a-z0-9]/g, '') || 'bin';
    if (originalName && originalName.includes('.')) {
      const extFromName = originalName.split('.').pop()!.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
      if (extFromName) return extFromName;
    }
    return fromMime.slice(0, 8) || 'bin';
  }

  async uploadImage(
    tenantId: string,
    slug: string,
    kind: AcademyImageKind,
    dataUrl: string,
    originalName?: string,
  ) {
    if (!['hero', 'logo', 'seo'].includes(kind)) {
      throw new BadRequestException('kind must be one of hero, logo, seo');
    }
    const academy = await this.getBySlug(tenantId, slug);
    const column = KIND_TO_COLUMN[kind];

    const m = /^data:(image\/[a-zA-Z0-9+.\-]+)(?:;charset=[^;]+)?;base64,(.+)$/.exec(dataUrl);
    if (!m || !m[1] || !m[2]) {
      throw new BadRequestException('Invalid image data. Expected a base64 data URL like data:image/png;base64,... — external URLs are not accepted.');
    }
    let mime = m[1].toLowerCase().trim();
    if (mime.includes(';')) mime = mime.split(';')[0]!.trim();
    if (!ALLOWED_IMAGE_TYPES.has(mime)) {
      throw new BadRequestException(`Unsupported image type: ${mime}. Allowed: ${[...ALLOWED_IMAGE_TYPES].join(', ')}`);
    }
    const base64 = m[2];
    let buffer: Buffer;
    try {
      buffer = Buffer.from(base64, 'base64');
    } catch {
      throw new BadRequestException('Invalid base64 image data');
    }
    if (!buffer.length) throw new BadRequestException('Empty image data');
    if (buffer.length > MAX_IMAGE_BYTES) {
      throw new BadRequestException(`Image too large: ${Math.round(buffer.length / 1024)}KB > ${MAX_IMAGE_BYTES / 1024}KB`);
    }
    // Basic magic-byte sanity (optional): ensure buffer is not HTML/text masquerading
    if (mime !== 'image/svg+xml' && buffer.length < 10) {
      throw new BadRequestException('Image data too small');
    }

    const ext = this.sanitizeExt(mime, originalName);
    const filename = `${randomUUID()}.${ext}`;

    let newUrl: string | undefined;
    if (this.isS3Configured()) {
      const bucket = process.env.S3_BUCKET!;
      const key = `tenants/${tenantId}/academies/${academy.id}/${kind}/${filename}`;
      const client = this.buildS3Client();
      try {
        await client.send(
          new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: mime }),
        );
        const publicBase = (process.env.S3_PUBLIC_URL || '').replace(/\/$/, '');
        if (publicBase) {
          newUrl = `${publicBase}/${key}`;
        } else {
          const endpoint = (process.env.S3_ENDPOINT || '').replace(/\/$/, '');
          newUrl = endpoint ? `${endpoint}/${bucket}/${key}` : key;
        }
        this.logger.log(`Stored academy ${kind} image to S3 ${bucket}/${key} (${buffer.length} bytes)`);
      } catch (error) {
        if ((process.env.NODE_ENV || 'development') === 'production') throw error;
        this.logger.warn(`S3 academy image upload failed; using local storage for ${kind}`, error as any);
      }
    }
    if (!newUrl) {
      const dir = join(this.getUploadDir(), 'academies', academy.id, kind);
      if (!existsSync(dir)) await mkdir(dir, { recursive: true });
      const filePath = join(dir, filename);
      await writeFile(filePath, buffer);
      newUrl = `${this.getBaseUrl()}/academies/${academy.id}/${kind}/${filename}`;
      this.logger.log(`Stored academy ${kind} image to local ${newUrl} (${buffer.length} bytes)`);
    }

    const oldUrl = (academy as any)[column] as string | null;
    const [updated] = await this.drizzle.db
      .update(academies)
      .set({ [column]: newUrl, updatedAt: new Date() })
      .where(and(eq(academies.tenantId, tenantId), eq(academies.id, academy.id)))
      .returning();

    if (oldUrl && oldUrl !== newUrl) {
      void this.deleteFileForUrl(oldUrl);
    }

    return {
      kind,
      url: newUrl,
      academy: { ...updated, courseCount: await this.courseCount(tenantId, academy.id, false) },
    };
  }

  async deleteImage(tenantId: string, slug: string, kind: AcademyImageKind) {
    if (!['hero', 'logo', 'seo'].includes(kind)) {
      throw new BadRequestException('kind must be one of hero, logo, seo');
    }
    const academy = await this.getBySlug(tenantId, slug);
    const column = KIND_TO_COLUMN[kind];
    const oldUrl = (academy as any)[column] as string | null;
    if (!oldUrl) throw new NotFoundException(`No ${kind} image to delete`);
    const [updated] = await this.drizzle.db
      .update(academies)
      .set({ [column]: null, updatedAt: new Date() })
      .where(and(eq(academies.tenantId, tenantId), eq(academies.id, academy.id)))
      .returning();
    void this.deleteFileForUrl(oldUrl);
    return { success: true, kind, academy: { ...updated, courseCount: await this.courseCount(tenantId, academy.id, false) } };
  }

  async validateForPublish(tenantId: string, slug: string) {
    const academy = await this.getBySlug(tenantId, slug);
    const reasons: string[] = [];
    const warnings: string[] = [];
    if (!academy.title?.trim()) reasons.push('Add an academy title');
    if (!academy.slug?.trim()) reasons.push('Set an academy slug');
    const n = await this.courseCount(tenantId, academy.id, true);
    if (n === 0) warnings.push('This academy has no published courses yet — it will appear empty until you assign/publish courses');
    return { ok: reasons.length === 0, reasons, warnings, publishedCourseCount: n };
  }

  async publish(tenantId: string, slug: string) {
    const { ok, reasons, warnings } = await this.validateForPublish(tenantId, slug);
    if (!ok) throw new BadRequestException({ message: 'Academy is not ready to publish', reasons, warnings });
    const [updated] = await this.drizzle.db
      .update(academies)
      .set({ isPublished: true, isArchived: false, publishedAt: new Date(), archivedAt: null, updatedAt: new Date() })
      .where(and(eq(academies.tenantId, tenantId), eq(academies.slug, slug)))
      .returning();
    if (!updated) throw new NotFoundException('Academy not found');
    this.syncSearch(tenantId, updated.id);
    return updated;
  }

  async unpublish(tenantId: string, slug: string) {
    const [updated] = await this.drizzle.db
      .update(academies)
      .set({ isPublished: false, updatedAt: new Date() })
      .where(and(eq(academies.tenantId, tenantId), eq(academies.slug, slug)))
      .returning();
    if (!updated) throw new NotFoundException('Academy not found');
    this.syncSearch(tenantId, updated.id);
    return updated;
  }

  async archive(tenantId: string, slug: string) {
    // Archiving hides the academy destination only; courses are untouched.
    const [updated] = await this.drizzle.db
      .update(academies)
      .set({ isArchived: true, isPublished: false, archivedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(academies.tenantId, tenantId), eq(academies.slug, slug)))
      .returning();
    if (!updated) throw new NotFoundException('Academy not found');
    this.syncSearch(tenantId, updated.id);
    return updated;
  }

  async restore(tenantId: string, slug: string) {
    const [updated] = await this.drizzle.db
      .update(academies)
      .set({ isArchived: false, archivedAt: null, updatedAt: new Date() })
      .where(and(eq(academies.tenantId, tenantId), eq(academies.slug, slug)))
      .returning();
    if (!updated) throw new NotFoundException('Academy not found');
    this.syncSearch(tenantId, updated.id);
    return updated;
  }

  async remove(tenantId: string, slug: string) {
    const academy = await this.getBySlug(tenantId, slug);
    const n = await this.courseCount(tenantId, academy.id, false);
    if (n > 0) {
      throw new ConflictException({
        message: `Academy still has ${n} course(s). Move or unassign them first.`,
      });
    }
    await this.drizzle.db.delete(academies).where(and(eq(academies.tenantId, tenantId), eq(academies.id, academy.id)));
    void this.search?.removeEntity(tenantId, 'academy', academy.id);
    return { success: true };
  }

  // --- Course assignment ---

  /** Assign (or move) courses to an academy. Metadata-only: never touches enrollments/progress/certificates. */
  async assignCourses(tenantId: string, slug: string, courseSlugs: string[]) {
    const academy = await this.getBySlug(tenantId, slug);
    if (!courseSlugs.length) throw new BadRequestException('Provide at least one course slug');

    const rows = await this.drizzle.db
      .select({ id: courses.id, slug: courses.slug })
      .from(courses)
      .where(and(eq(courses.tenantId, tenantId), inArray(courses.slug, courseSlugs)));
    const found = new Map(rows.map((r) => [r.slug, r.id]));
    const missing = courseSlugs.filter((s) => !found.has(s));
    if (missing.length) {
      throw new BadRequestException(`Courses not found in this tenant: ${missing.join(', ')}`);
    }

    await this.drizzle.db
      .update(courses)
      .set({ academyId: academy.id, updatedAt: new Date() })
      .where(and(eq(courses.tenantId, tenantId), inArray(courses.slug, courseSlugs)));
    for (const row of rows) void this.search?.indexEntity(tenantId, 'course', row.id);

    return { success: true, assigned: courseSlugs.length, academyId: academy.id };
  }

  /** Unassign courses from any academy (set academy_id = null). */
  async unassignCourses(tenantId: string, courseSlugs: string[]) {
    if (!courseSlugs.length) throw new BadRequestException('Provide at least one course slug');
    const result = await this.drizzle.db
      .update(courses)
      .set({ academyId: null, updatedAt: new Date() })
      .where(and(eq(courses.tenantId, tenantId), inArray(courses.slug, courseSlugs)))
      .returning({ id: courses.id, slug: courses.slug, academyId: courses.academyId });
    const unassigned = result.filter((r) => r.academyId === null).length;
    return { success: true, unassigned };
  }

  // --- Default-academy backfill (explicit admin action, real tenant data only) ---

  /**
   * Pre-flight report for the backfill: duplicate course slugs in the tenant
   * (which would make slug-keyed operations ambiguous) and unassigned course count.
   */
  async backfillReport(tenantId: string) {
    const [tenant] = await this.drizzle.db
      .select({ id: tenants.id, slug: tenants.slug, name: tenants.name, description: tenants.description })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    if (!tenant) throw new NotFoundException('Tenant not found');

    const dupRows = await this.drizzle.db
      .select({ slug: courses.slug, n: count() })
      .from(courses)
      .where(eq(courses.tenantId, tenantId))
      .groupBy(courses.slug)
      .having(sql`count(*) > 1`);
    const duplicates = dupRows.map((r) => ({ slug: r.slug, count: Number(r.n) }));

    const [unassignedRow] = await this.drizzle.db
      .select({ n: count() })
      .from(courses)
      .where(and(eq(courses.tenantId, tenantId), isNull(courses.academyId)));
    const unassigned = Number(unassignedRow?.n ?? 0);

    const existingGeneral = await this.drizzle.db
      .select({ id: academies.id, slug: academies.slug })
      .from(academies)
      .where(and(eq(academies.tenantId, tenantId), eq(academies.slug, 'general')))
      .limit(1);

    return {
      tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name, description: tenant.description },
      unassignedCourses: unassigned,
      duplicateCourseSlugs: duplicates,
      defaultAcademyExists: existingGeneral.length > 0,
      proposed: {
        slug: 'general',
        title: `${tenant.name} Academy`,
        description: tenant.description,
      },
    };
  }

  /**
   * Create (if needed) the tenant-derived default academy and assign every
   * unassigned course to it. Idempotent: safe to re-run. No invented data —
   * name/description come from the tenant record.
   */
  async runBackfill(tenantId: string) {
    const report = await this.backfillReport(tenantId);
    if (report.duplicateCourseSlugs.length) {
      throw new ConflictException({
        message: 'Duplicate course slugs found in this tenant — resolve them before backfill',
        duplicates: report.duplicateCourseSlugs,
      });
    }

    let academyId: string;
    if (report.defaultAcademyExists) {
      const [existing] = await this.drizzle.db
        .select({ id: academies.id })
        .from(academies)
        .where(and(eq(academies.tenantId, tenantId), eq(academies.slug, 'general')))
        .limit(1);
      if (!existing) throw new NotFoundException('Default academy disappeared during backfill');
      academyId = existing.id;
    } else {
      const created = await this.create(tenantId, {
        slug: 'general',
        title: report.proposed.title,
        description: report.proposed.description ?? undefined,
      });
      if (!created?.id) throw new Error('Failed to create default academy during backfill');
      academyId = created.id;
      this.logger.log(`Backfill created default academy "${created.slug}" for tenant ${tenantId}`);
    }

    const updated = await this.drizzle.db
      .update(courses)
      .set({ academyId, updatedAt: new Date() })
      .where(and(eq(courses.tenantId, tenantId), isNull(courses.academyId)))
      .returning({ id: courses.id });

    return {
      success: true,
      academyId,
      assigned: updated.length,
      created: !report.defaultAcademyExists,
    };
  }

  // --- Public endpoints ---

  /**
   * Public academy list, localized.
   *
   * The locale comes from the request (cookie, `?locale=`, or Accept-Language),
   * so the same endpoint serves both languages without a second route.
   */
  /**
   * Attach the resolved locale alongside the copy, exactly as CoursesService
   * does, so the client has one shape to read for every content type.
   */
  private localeFields<T extends Record<string, any>>(
    value: T,
    localized: { value: T; metadata: LessonLocaleMetadata },
  ) {
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

  async findPublished(tenantId: string, localeInput?: unknown) {
    const rows = await this.drizzle.db
      .select()
      .from(academies)
      .where(
        and(
          eq(academies.tenantId, tenantId),
          eq(academies.isPublished, true),
          eq(academies.isArchived, false),
        ),
      )
      .orderBy(asc(academies.sortOrder), asc(academies.title));

    const ids = rows.map((r) => r.id);
    const countMap = new Map<string, number>();
    if (ids.length) {
      const counts = await this.drizzle.db
        .select({ academyId: courses.academyId, n: count() })
        .from(courses)
        .where(
          and(
            eq(courses.tenantId, tenantId),
            eq(courses.isArchived, false),
            eq(courses.isPublished, true),
            inArray(courses.academyId, ids),
          ),
        )
        .groupBy(courses.academyId);
      for (const c of counts) countMap.set(c.academyId!, Number(c.n));
    }

    const locale = resolveContentLocale(localeInput);
    return rows.map((r) => ({
      ...this.localeFields(r, localizeAcademyFields(r as Record<string, any>, locale)),
      courseCount: countMap.get(r.id) ?? 0,
    }));
  }

  async findPublishedBySlug(tenantId: string, slug: string, localeInput?: unknown) {
    const [academy] = await this.drizzle.db
      .select()
      .from(academies)
      .where(
        and(
          eq(academies.tenantId, tenantId),
          eq(academies.slug, slug),
          eq(academies.isPublished, true),
          eq(academies.isArchived, false),
        ),
      )
      .limit(1);
    if (!academy) throw new NotFoundException('Academy not found');

    const academyCourses = await this.drizzle.db.query.courses.findMany({
      where: and(
        eq(courses.tenantId, tenantId),
        eq(courses.academyId, academy.id),
        eq(courses.isPublished, true),
        eq(courses.isArchived, false),
      ),
      orderBy: [asc(courses.sortOrder), asc(courses.title)],
      columns: {
        id: true, slug: true, title: true, subtitle: true, description: true,
        thumbnailUrl: true, difficulty: true, estimatedHours: true, sortOrder: true,
        priceCents: true, currency: true, accessMode: true, trailerUrl: true,
      },
      with: {
        series: {
          columns: { id: true, title: true, slug: true, sortOrder: true },
          where: eq(series.isPublished, true),
          orderBy: asc(series.sortOrder),
        },
      },
    });

    // The academy and its course list are localized together, so a card and the
    // course it links to cannot be shown in two different languages.
    const locale = resolveContentLocale(localeInput);
    const localizedCourses = academyCourses.map((course) =>
      localizeCourseFields(course as Record<string, any>, locale).value,
    );
    return {
      ...this.localeFields(academy, localizeAcademyFields(academy as Record<string, any>, locale)),
      courseCount: localizedCourses.length,
      courses: localizedCourses,
    };
  }
}
