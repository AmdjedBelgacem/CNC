import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DrizzleService } from '../src/database/drizzle.service';
import { StorageService } from '../src/modules/storage/storage.service';
import { CoursesService } from '../src/modules/courses/courses.service';
import { courses, series, lessons, tenants } from '../src/database/schema';
import { eq } from 'drizzle-orm';

// Integration test for the S3 lesson-video flow. It exercises the real
// Drizzle/Postgres layer plus the offline (no-network) presign math of the
// StorageService. MinIO does NOT need to be running: presigned URLs and
// signed GET URLs are computed locally by the AWS SDK.
describe('lesson video storage (integration)', () => {
  let drizzle: DrizzleService;
  let storage: StorageService;
  let svc: CoursesService;

  let tenantId: string;
  let courseId: string;
  let courseSlug: string;
  let seriesId: string;
  let lessonId: string;

  beforeAll(async () => {
    drizzle = new DrizzleService({ get: (k: string) => process.env[k] } as any);
    await drizzle.onModuleInit();
    storage = new StorageService();
    svc = new CoursesService(drizzle, storage);

    const [tenant] = await drizzle.db.select().from(tenants).limit(1);
    if (!tenant) throw new Error('No tenant found in database');
    tenantId = tenant.id;

    courseSlug = `itest-${Date.now()}`;
    const [course] = await drizzle.db
      .insert(courses)
      .values({ tenantId, slug: courseSlug, title: 'ITest Course', difficulty: 1, sortOrder: 0 })
      .returning();
    courseId = course.id;
    const [section] = await drizzle.db
      .insert(series)
      .values({ tenantId, courseId, slug: `${courseSlug}-s1`, title: 'Section', sortOrder: 0 })
      .returning();
    seriesId = section.id;
    const [lesson] = await drizzle.db
      .insert(lessons)
      .values({
        tenantId,
        seriesId,
        slug: `${courseSlug}-l1`,
        title: 'Lesson',
        difficulty: 1,
        sortOrder: 0,
      })
      .returning();
    lessonId = lesson.id;
  });

  afterAll(async () => {
    await drizzle.db.delete(lessons).where(eq(lessons.id, lessonId));
    await drizzle.db.delete(series).where(eq(series.id, seriesId));
    await drizzle.db.delete(courses).where(eq(courses.slug, courseSlug));
    await drizzle.onModuleDestroy();
  });

  it('issues a tenant-scoped presigned PUT URL without touching storage', async () => {
    const { key, uploadUrl } = await svc.resolveLessonUploadTarget(tenantId, lessonId, {
      filename: 'lecture-1.mp4',
      contentType: 'video/mp4',
      size: 2048,
    });

    expect(key.startsWith(`tenants/${tenantId}/`)).toBe(true);
    expect(key).toContain(`lessons/${lessonId}/video/`);
    expect(uploadUrl).toContain('X-Amz-Signature');
    // Path-style URL embeds the (literal-slash) key beneath the bucket. Video lives in
    // S3_MEDIA_BUCKET (private), deliberately separate from the public S3_BUCKET used
    // for avatars and course images.
    const bucket = process.env.S3_MEDIA_BUCKET || process.env.S3_BUCKET;
    expect(uploadUrl).toContain(`/${bucket}/${key}`);
  });

  it('persists the object key and resolves a signed playback URL via getStudio', async () => {
    const key = storage.buildKey(tenantId, courseId, lessonId, 'playback.mp4');
    await svc.updateLesson(tenantId, lessonId, { videoUrl: key });

    const studio = await svc.getStudio(tenantId, courseSlug);
    const found = studio.series
      .flatMap((s) => s.lessons ?? [])
      .find((l) => l.id === lessonId);

    expect(found).toBeDefined();
    // Key is resolved to a signed, playable URL (not the raw storage key).
    expect(found!.videoUrl).toContain('X-Amz-Signature');
    expect(found!.videoUrl).not.toEqual(key);
  });

  it('rejects unsupported content types when presigning', async () => {
    await expect(
      svc.resolveLessonUploadTarget(tenantId, lessonId, {
        filename: 'notes.pdf',
        contentType: 'application/pdf',
        size: 2048,
      }),
    ).rejects.toThrow(/Unsupported video type/);
  });
});
