import 'dotenv/config';
import postgres from 'postgres';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { and, count, eq, inArray, isNull, sql } from 'drizzle-orm';
import * as schema from './schema';
import { seedVideos } from './seed/seed-videos';
import { seedStudyGroups } from './seed/seed-study-groups';
import { seedSponsors } from './seed/seed-sponsors';
import { seedEvents } from './seed/seed-events';
import { seedPosts } from './seed/seed-posts';
import {
  PERMISSION_CATALOG,
  SYSTEM_ROLE_KEYS,
  SYSTEM_ROLE_PERMISSIONS,
} from '../modules/rbac/rbac.constants';
import type {
  CourseContentTranslation,
  LessonContentDocument,
  LessonContentTranslation,
  SeriesContentTranslation,
} from '@titan/shared';

/**
 * Demo seed — idempotent, safe to rerun.
 *
 * Why no top-level `import * as argon2`: the native module has no darwin-arm64
 * prebuild in this repo (only glibc), so importing it crashes tsx/node with
 * SIGSEGV (exit 139) on dev Macs. Password hashing is resolved lazily inside
 * seed(): real argon2 when the native binding loads, otherwise a clearly
 * labeled `fallback-hash:` dev-only value that PasswordService accepts in dev.
 * Production must have working argon2 prebuilds (see package README + CI).
 */
async function hashPasswordDev(password: string): Promise<{ hash: string; devFallback: boolean }> {
  // Never require('argon2') here: the native binding SIGSEGVs this process on
  // dev Macs without a darwin-arm64 prebuild (exit 139, uncatchable). The dev
  // PasswordService fallback accepts `fallback-hash:<password>`; production
  // uses real argon2 via password.service.ts (which has proper prebuilds).
  return { hash: `fallback-hash:${password}`, devFallback: true };
}

const bilingualDemoCourseSlug = 'cnc-bilingual-content-blocks-demo';
const bilingualDemoSeriesSlug = 'cnc-bilingual-content-blocks-demo-series';
const bilingualDemoLessonSlug = 'cnc-bilingual-content-blocks-demo-lesson';
const bilingualDemoImageUrl = '/images/placeholder-course.svg';
const bilingualDemoVideoUrl = '/uploads/lessons/529291be-1c0c-4592-ad61-0ce6f82adcb4.mp4';
const bilingualDemoLegacyContent =
  '<p>Machine safety starts with a verified setup: secure the workpiece, confirm offsets, and clear the chip area before the first command.</p><p>Use the guided image and knowledge check to reinforce the same habits in English and Arabic.</p>';

const bilingualDemoCourseTranslations: Record<'en' | 'ar', CourseContentTranslation> = {
  en: {
    title: 'CNC Bilingual Content Blocks Demo',
    subtitle: 'A guided machine-safety walkthrough in English and Arabic',
    description: 'A focused demo course showing localized course, series, lesson, and interactive learning blocks for a CNC fundamentals tenant.',
    seoTitle: 'CNC Bilingual Content Blocks Demo | English and Arabic',
    seoDescription: 'Explore a bilingual CNC learning experience with video, rich text, an interactive image, and a graded quiz.',
    seoKeywords: 'CNC, bilingual course, Arabic, English, machine safety, interactive learning',
  },
  ar: {
    title: 'دورة تجريبية لمكعبات التعلم ثنائية اللغة في CNC',
    subtitle: 'جولة إرشادية في سلامة الماكينة باللغة الإنجليزية والعربية',
    description: 'دورة تجريبية مركزة تعرض ترجمة المسار والدرس ومكعبات التعلم التفاعلية لدرس سلامة ماكينة CNC.',
    seoTitle: 'دورة مكعبات التعلم ثنائية اللغة في CNC | الإنجليزية والعربية',
    seoDescription: 'استكشف تجربة تعلم ثنائية اللغة تشمل الفيديو والنص الغني والصورة التفاعلية والاختبار القصير.',
    seoKeywords: 'CNC, دورة ثنائية اللغة, عربية, إنجليزية, سلامة الماكينة, تعلم تفاعلي',
  },
};

const bilingualDemoSeriesTranslations: Record<'en' | 'ar', SeriesContentTranslation> = {
  en: {
    title: 'Machine Safety & Workholding',
    description: 'Build a repeatable pre-cut safety and workholding routine.',
  },
  ar: {
    title: 'سلامة الماكينة وتثبيت قطعة العمل',
    description: 'ابنِ روتيناً متكرراً للسلامة قبل القطع وتثبيت قطعة العمل.',
  },
};

const bilingualDemoLessonTranslations: Record<'en' | 'ar', LessonContentTranslation> = {
  en: {
    title: 'Machine Safety and Workholding',
    description: 'Identify the setup checks and machine details that make a first cut safer.',
  },
  ar: {
    title: 'سلامة الماكينة وتثبيت قطعة العمل',
    description: 'تعرّف على فحوص الإعداد وتفاصيل الماكينة التي تجعل القطع الأول أكثر أماناً.',
  },
};

const bilingualDemoLessonContentBlocks = {
  schemaVersion: 1 as const,
  blocks: [
    {
      id: 'bilingual-demo-video',
      type: 'video' as const,
      sortOrder: 0,
      content: {
        source: bilingualDemoVideoUrl,
        posterUrl: bilingualDemoImageUrl,
        transcript: 'Before starting a CNC program, verify the workholding, check the tool length, and clear the chip area.',
      },
      translations: {
        en: {
          transcript: 'Before starting a CNC program, verify the workholding, check the tool length, and clear the chip area.',
        },
        ar: {
          transcript: 'قبل تشغيل برنامج CNC، تحقق من تثبيت قطعة العمل، وتحقق من طول الأداة، ونظف منطقة البَرادة.',
        },
      },
    },
    {
      id: 'bilingual-demo-rich-text',
      type: 'rich_text' as const,
      sortOrder: 1,
      content: {
        text: 'A safe setup is a system: secure the workpiece, verify the work offset, confirm the tool length, and leave a clear path for chips before starting the spindle.',
        images: [
          {
            src: bilingualDemoImageUrl,
            alt: 'CNC machine illustration used for the safety walkthrough',
            caption: 'Use the image as a visual reminder of the machine zones discussed in this lesson.',
          },
        ],
      },
      translations: {
        en: {
          text: 'A safe setup is a system: secure the workpiece, verify the work offset, confirm the tool length, and clear the chip area before starting the spindle.',
          images: [
            {
              src: bilingualDemoImageUrl,
              alt: 'CNC machine illustration used for the safety walkthrough',
              caption: 'Use the image as a visual reminder of the machine zones discussed in this lesson.',
            },
          ],
        },
        ar: {
          text: 'الإعداد الآمن نظام متكامل: ثبّت قطعة العمل، وتحقق من إزاحة العمل، وتأكد من طول الأداة، واترك مساراً واضحاً للبرادة قبل تشغيل المغزل.',
          images: [
            {
              src: bilingualDemoImageUrl,
              alt: 'رسم توضيحي لماكينة CNC يستخدم في جولة السلامة',
              caption: 'استخدم الصورة كتذكير بصري بمناطق الماكينة التي تمت مناقشتها في هذا الدرس.',
            },
          ],
        },
      },
    },
    {
      id: 'bilingual-demo-interactive-image',
      type: 'interactive_image' as const,
      sortOrder: 2,
      content: {
        src: bilingualDemoImageUrl,
        alt: 'CNC machine with labeled safety zones',
        caption: 'Select a numbered marker to explore a setup detail.',
        hotspots: [
          {
            id: 'workholding-zone',
            x: 28,
            y: 58,
            width: 24,
            height: 20,
            label: 'Workholding zone',
            tooltip: 'Keep the workpiece secure here.',
            detail: 'Confirm the vise or fixture is tight, square, and clear of the tool before the first cut.',
          },
          {
            id: 'emergency-stop',
            x: 74,
            y: 48,
            width: 16,
            height: 16,
            label: 'Emergency stop',
            tooltip: 'Know this control before you start.',
            detail: 'Locate the emergency stop and make sure everyone nearby knows how to reach it.',
          },
        ],
      },
      translations: {
        en: {
          alt: 'CNC machine with labeled safety zones',
          caption: 'Select a numbered marker to explore a setup detail.',
          hotspots: [
            {
              id: 'workholding-zone',
              x: 28,
              y: 58,
              width: 24,
              height: 20,
              label: 'Workholding zone',
              tooltip: 'Keep the workpiece secure here.',
              detail: 'Confirm the vise or fixture is tight, square, and clear of the tool before the first cut.',
            },
            {
              id: 'emergency-stop',
              x: 74,
              y: 48,
              width: 16,
              height: 16,
              label: 'Emergency stop',
              tooltip: 'Know this control before you start.',
              detail: 'Locate the emergency stop and make sure everyone nearby knows how to reach it.',
            },
          ],
        },
        ar: {
          alt: 'ماكينة CNC مع مناطق سلامة موسومة',
          caption: 'اختر علامة مرقمة لاستكشاف تفصيل من الإعداد.',
          hotspots: [
            {
              id: 'workholding-zone',
              x: 28,
              y: 58,
              width: 24,
              height: 20,
              label: 'منطقة تثبيت قطعة العمل',
              tooltip: 'أبقِ قطعة العمل مثبتة هنا.',
              detail: 'تأكد من إحكام الملزمة أو أداة التثبيت ومن محاذاتها وخلوها من الأداة قبل القطع الأول.',
            },
            {
              id: 'emergency-stop',
              x: 74,
              y: 48,
              width: 16,
              height: 16,
              label: 'زر الإيقاف الطارئ',
              tooltip: 'اعرف هذا التحكم قبل البدء.',
              detail: 'حدد زر الإيقاف الطارئ وتأكد من أن كل شخص قريب يعرف كيفية الوصول إليه.',
            },
          ],
        },
      },
    },
    {
      id: 'bilingual-demo-quiz',
      type: 'quiz' as const,
      sortOrder: 3,
      content: {
        passingScore: 70,
        requiredToContinue: true,
        maxAttempts: 3,
        questions: [
          {
            id: 'demo-q-single',
            type: 'single' as const,
            prompt: 'Which action should happen before starting a CNC program?',
            options: [
              { id: 'single-secure', label: 'Check the workholding and tool length' },
              { id: 'single-guards', label: 'Remove the machine guards' },
              { id: 'single-speed', label: 'Increase the spindle speed to maximum' },
            ],
            correctOptionIds: ['single-secure'],
            explanation: 'A secure workpiece and verified tool length are part of a safe pre-cut check.',
            points: 1,
          },
          {
            id: 'demo-q-multiple',
            type: 'multiple' as const,
            prompt: 'Which checks belong in a pre-cut safety walkthrough?',
            options: [
              { id: 'multiple-secure', label: 'The workpiece is secure' },
              { id: 'multiple-offsets', label: 'The work offsets are verified' },
              { id: 'multiple-chips', label: 'The chip area is clear' },
              { id: 'multiple-door', label: 'The door is open during cutting' },
            ],
            correctOptionIds: ['multiple-secure', 'multiple-offsets', 'multiple-chips'],
            explanation: 'Secure the workpiece, verify offsets, and clear chips; the machine door should remain closed during cutting.',
            points: 2,
          },
          {
            id: 'demo-q-true-false',
            type: 'true_false' as const,
            prompt: 'A CNC machine can be left running unattended while you step away.',
            options: [
              { id: 'true-false-true', label: 'True' },
              { id: 'true-false-false', label: 'False' },
            ],
            correctOptionIds: ['true-false-false'],
            explanation: 'Never leave a running CNC machine unattended; follow the shop safety procedure.',
            points: 1,
          },
        ],
      },
      translations: {
        en: {
          questions: [
            {
              id: 'demo-q-single',
              type: 'single' as const,
              prompt: 'Which action should happen before starting a CNC program?',
              options: [
                { id: 'single-secure', label: 'Check the workholding and tool length' },
                { id: 'single-guards', label: 'Remove the machine guards' },
                { id: 'single-speed', label: 'Increase the spindle speed to maximum' },
              ],
              explanation: 'A secure workpiece and verified tool length are part of a safe pre-cut check.',
            },
            {
              id: 'demo-q-multiple',
              type: 'multiple' as const,
              prompt: 'Which checks belong in a pre-cut safety walkthrough?',
              options: [
                { id: 'multiple-secure', label: 'The workpiece is secure' },
                { id: 'multiple-offsets', label: 'The work offsets are verified' },
                { id: 'multiple-chips', label: 'The chip area is clear' },
                { id: 'multiple-door', label: 'The door is open during cutting' },
              ],
              explanation: 'Secure the workpiece, verify offsets, and clear chips; the machine door should remain closed during cutting.',
            },
            {
              id: 'demo-q-true-false',
              type: 'true_false' as const,
              prompt: 'A CNC machine can be left running unattended while you step away.',
              options: [
                { id: 'true-false-true', label: 'True' },
                { id: 'true-false-false', label: 'False' },
              ],
              explanation: 'Never leave a running CNC machine unattended; follow the shop safety procedure.',
            },
          ],
        },
        ar: {
          questions: [
            {
              id: 'demo-q-single',
              type: 'single' as const,
              prompt: 'ما الإجراء الذي يجب выполняه قبل تشغيل برنامج CNC؟',
              options: [
                { id: 'single-secure', label: 'التحقق من تثبيت قطعة العمل وطول الأداة' },
                { id: 'single-guards', label: 'إزالة حراس الماكينة' },
                { id: 'single-speed', label: 'رفع سرعة المغزل إلى الحد الأقصى' },
              ],
              explanation: 'تثبيت قطعة العمل والتحقق من طول الأداة جزء من فحص السلامة قبل القطع.',
            },
            {
              id: 'demo-q-multiple',
              type: 'multiple' as const,
              prompt: 'أي فحوص تندرج ضمن جولة السلامة قبل القطع؟',
              options: [
                { id: 'multiple-secure', label: 'قطعة العمل مثبتة' },
                { id: 'multiple-offsets', label: 'تم التحقق من إزاحات العمل' },
                { id: 'multiple-chips', label: 'منطقة البرادة خالية' },
                { id: 'multiple-door', label: 'الباب مفتوح أثناء القطع' },
              ],
              explanation: 'ثبّت قطعة العمل وتحقق من الإزاحات ونظف البرادة؛ ويبقى باب الماكينة مغلقاً أثناء القطع.',
            },
            {
              id: 'demo-q-true-false',
              type: 'true_false' as const,
              prompt: 'يمكن ترك ماكينة CNC تعمل دون مراقبة عند مغادرة المكان.',
              options: [
                { id: 'true-false-true', label: 'صح' },
                { id: 'true-false-false', label: 'خطأ' },
              ],
              explanation: 'لا تترك ماكينة CNC تعمل دون مراقبة؛ اتبع إجراء السلامة في الورشة.',
            },
          ],
        },
      },
    },
  ],
} satisfies LessonContentDocument;

async function seedBilingualDemoCourse(
  db: PostgresJsDatabase<typeof schema>,
  tenantId: string,
  academyId: string | null,
) {
  const now = new Date();
  const courseData = {
    tenantId,
    academyId,
    slug: bilingualDemoCourseSlug,
    title: 'CNC Bilingual Content Blocks Demo',
    subtitle: 'A guided machine-safety walkthrough in English and Arabic',
    description: 'A focused demo course showing localized course, series, lesson, and interactive learning blocks for a CNC fundamentals tenant.',
    thumbnailUrl: bilingualDemoImageUrl,
    difficulty: 1,
    estimatedHours: 1,
    priceCents: 0,
    currency: 'SAR',
    accessMode: 'open',
    seoTitle: 'CNC Bilingual Content Blocks Demo | English and Arabic',
    seoDescription: 'Explore a bilingual CNC learning experience with video, rich text, an interactive image, and a graded quiz.',
    seoKeywords: 'CNC, bilingual course, Arabic, English, machine safety, interactive learning',
    ogImageUrl: bilingualDemoImageUrl,
    isPublished: true,
    isArchived: false,
    archivedAt: null,
    sortOrder: 99,
    autoIssueCertificate: false,
    metadata: { isDemo: true, contentLocales: ['en', 'ar'] },
    translations: bilingualDemoCourseTranslations,
  };

  const existingCourse = await db.query.courses.findFirst({
    where: and(eq(schema.courses.tenantId, tenantId), eq(schema.courses.slug, bilingualDemoCourseSlug)),
  });
  if (existingCourse) {
    await db.update(schema.courses).set({
      ...courseData,
      publishedAt: existingCourse.publishedAt ?? now,
      updatedAt: now,
    }).where(eq(schema.courses.id, existingCourse.id));
    console.log(`Course exists: ${bilingualDemoCourseSlug}`);
  } else {
    await db.insert(schema.courses).values({ ...courseData, publishedAt: now });
    console.log(`Created course: ${bilingualDemoCourseSlug}`);
  }

  const course = await db.query.courses.findFirst({
    where: and(eq(schema.courses.tenantId, tenantId), eq(schema.courses.slug, bilingualDemoCourseSlug)),
  }) as typeof schema.courses.$inferSelect | undefined;
  if (!course) throw new Error(`Failed to ensure course: ${bilingualDemoCourseSlug}`);

  const seriesData = {
    courseId: course.id,
    tenantId,
    slug: bilingualDemoSeriesSlug,
    title: 'Machine Safety & Workholding',
    description: 'Build a repeatable pre-cut safety and workholding routine.',
    thumbnailUrl: bilingualDemoImageUrl,
    sortOrder: 1,
    isPublished: true,
    isArchived: false,
    archivedAt: null,
    translations: bilingualDemoSeriesTranslations,
  };
  const existingSeries = await db.query.series.findFirst({
    where: and(
      eq(schema.series.tenantId, tenantId),
      eq(schema.series.courseId, course.id),
      eq(schema.series.slug, bilingualDemoSeriesSlug),
    ),
  });
  if (existingSeries) {
    await db.update(schema.series).set({ ...seriesData, updatedAt: now }).where(eq(schema.series.id, existingSeries.id));
    console.log(`Series exists: ${bilingualDemoSeriesSlug}`);
  } else {
    await db.insert(schema.series).values(seriesData);
    console.log(`Created series: ${bilingualDemoSeriesSlug}`);
  }

  const series = await db.query.series.findFirst({
    where: and(
      eq(schema.series.tenantId, tenantId),
      eq(schema.series.courseId, course.id),
      eq(schema.series.slug, bilingualDemoSeriesSlug),
    ),
  }) as typeof schema.series.$inferSelect | undefined;
  if (!series) throw new Error(`Failed to ensure series: ${bilingualDemoSeriesSlug}`);

  const lessonData = {
    seriesId: series.id,
    tenantId,
    slug: bilingualDemoLessonSlug,
    title: 'Machine Safety and Workholding',
    description: 'Identify the setup checks and machine details that make a first cut safer.',
    videoUrl: bilingualDemoVideoUrl,
    thumbnailUrl: bilingualDemoImageUrl,
    videoDuration: 5,
    content: bilingualDemoLegacyContent,
    attachments: [],
    translations: bilingualDemoLessonTranslations,
    contentBlocks: bilingualDemoLessonContentBlocks,
    difficulty: 1,
    videoMeta: null,
    isPublished: true,
    isArchived: false,
    archivedAt: null,
    sortOrder: 1,
    freePreview: true,
  };
  const existingLesson = await db.query.lessons.findFirst({
    where: and(eq(schema.lessons.tenantId, tenantId), eq(schema.lessons.slug, bilingualDemoLessonSlug)),
  });
  if (existingLesson) {
    await db.update(schema.lessons).set({ ...lessonData, updatedAt: now }).where(eq(schema.lessons.id, existingLesson.id));
    console.log(`Lesson exists: ${bilingualDemoLessonSlug}`);
  } else {
    await db.insert(schema.lessons).values(lessonData);
    console.log(`Created lesson: ${bilingualDemoLessonSlug}`);
  }
}

async function seed() {
  if ((process.env.NODE_ENV || 'development') === 'production' && process.env.ALLOW_PROD_SEED !== 'true') {
    throw new Error(
      'Refusing to run demo seed against NODE_ENV=production without ALLOW_PROD_SEED=true. Demo seed mints dev-only fallback password hashes.',
    );
  }
  const client = postgres(process.env.DATABASE_URL!, { prepare: false });
  const db = drizzle(client, { schema });

  console.log('Seeding database (idempotent demo seed)...');

  // --- Tenants (reuse if present) ---
  let tenant = await db.query.tenants.findFirst({
    where: eq(schema.tenants.slug, 'cnc-fundamentals'),
  });
  if (!tenant) {
    const [created] = await db
      .insert(schema.tenants)
      .values({
        slug: 'cnc-fundamentals',
        name: 'CNC Fundamentals',
        description: 'Master the basics of CNC machining',
        primaryColor: '#C2410C',
        secondaryColor: '#333F4C',
        accentColor: '#0F766E',
        isActive: true,
        settings: {
          allowRegistration: true,
          socialEnabled: true,
          storeEnabled: true,
          eventsEnabled: true,
          certificationEnabled: true,
        },
      })
      .returning();
    if (!created) throw new Error('Failed to create tenant');
    tenant = created;
    console.log(`Created tenant: ${tenant.name} (${tenant.slug})`);
  } else {
    console.log(`Tenant exists: ${tenant.name} (${tenant.slug})`);
  }

  let tenant2: typeof schema.tenants.$inferSelect | null | undefined = await db.query.tenants.findFirst({
    where: eq(schema.tenants.slug, 'advanced-manufacturing'),
  });
  if (!tenant2) {
    const [created] = await db
      .insert(schema.tenants)
      .values({
        slug: 'advanced-manufacturing',
        name: 'Advanced Manufacturing Institute',
        description: 'Cutting-edge manufacturing education',
        primaryColor: '#C2410C',
        secondaryColor: '#333F4C',
        accentColor: '#0F766E',
        isActive: true,
        settings: {
          allowRegistration: true,
          socialEnabled: true,
          storeEnabled: true,
          eventsEnabled: true,
          certificationEnabled: true,
        },
      })
      .returning();
    tenant2 = created ?? null;
    if (tenant2) console.log(`Created tenant: ${tenant2.name} (${tenant2.slug})`);
  } else {
    console.log(`Tenant exists: ${tenant2.name} (${tenant2.slug})`);
  }

  const { hash: testPassword, devFallback } = await hashPasswordDev('Test1234!');
  if (devFallback) {
    console.warn('[seed] dev fallback password hashes in use — dev DB only, never production');
  }

  const usersData = [
    { email: 'superadmin@titansofmanufacturing.com', name: 'Super Admin', username: 'superadmin', role: 'super_admin', tenantId: tenant.id, accountStatus: 'active', emailVerifiedAt: new Date() },
    { email: 'admin@titansofmanufacturing.com', name: 'Admin User', username: 'admin', role: 'admin', tenantId: tenant.id, accountStatus: 'active', emailVerifiedAt: new Date() },
    { email: 'instructor@titansofmanufacturing.com', name: 'Jane Instructor', username: 'jane-instructor', role: 'instructor', tenantId: tenant.id, accountStatus: 'active', emailVerifiedAt: new Date() },
    { email: 'learner@titansofmanufacturing.com', name: 'Bob Learner', username: 'bob-learner', role: 'learner', tenantId: tenant.id, accountStatus: 'active', emailVerifiedAt: new Date() },
    { email: 'sponsor@titansofmanufacturing.com', name: 'Acme Corp', username: 'acme-corp', role: 'sponsor', tenantId: tenant.id, accountStatus: 'active', emailVerifiedAt: new Date() },
    { email: 'moderator@titansofmanufacturing.com', name: 'Moderator User', username: 'moderator', role: 'moderator', tenantId: tenant.id, accountStatus: 'active', emailVerifiedAt: new Date() },
    { email: 'pending@titansofmanufacturing.com', name: 'Pending User', username: 'pending-user', role: 'learner', tenantId: tenant.id, accountStatus: 'pending_verification' },
    { email: 'suspended@titansofmanufacturing.com', name: 'Suspended User', username: 'suspended-user', role: 'learner', tenantId: tenant.id, accountStatus: 'suspended' },
    { email: 'cross-tenant@titansofmanufacturing.com', name: 'Cross Tenant User', username: 'cross-tenant', role: 'learner', tenantId: tenant.id, accountStatus: 'active', emailVerifiedAt: new Date() },
    { email: 'learner2@advancedmanufacturing.com', name: 'Advanced Learner', username: 'advanced-learner', role: 'learner', tenantId: tenant2?.id || tenant.id, accountStatus: 'active', emailVerifiedAt: new Date() },
  ];

  const createdUsers: typeof schema.users.$inferSelect[] = [];
  for (const u of usersData) {
    const existing = await db.query.users.findFirst({
      where: and(eq(schema.users.email, u.email), eq(schema.users.tenantId, u.tenantId)),
    });
    if (existing) {
      // Backfill a handle so /profile/:username resolves for pre-existing rows too.
      if (!existing.username) {
        await db.update(schema.users)
          .set({ username: u.username, updatedAt: new Date() })
          .where(eq(schema.users.id, existing.id));
        existing.username = u.username;
      }
      createdUsers.push(existing);
      continue;
    }
    const result = await db.insert(schema.users).values({
      tenantId: u.tenantId,
      email: u.email,
      name: u.name,
      username: u.username,
      role: u.role,
      passwordHash: testPassword,
      accountStatus: u.accountStatus,
      emailVerifiedAt: u.emailVerifiedAt || null,
      isActive: u.accountStatus !== 'deleted',
    }).returning();
    if (result?.[0]) {
      createdUsers.push(result[0]);
      console.log(`Created user: ${u.email} (${u.role}) - ${u.accountStatus}`);
    }
  }

  const crossTenantUser = createdUsers.find(u => u.email === 'cross-tenant@titansofmanufacturing.com');
  if (crossTenantUser && tenant2) {
    await db.insert(schema.userTenantRoles).values({
      userId: crossTenantUser.id,
      tenantId: tenant2.id,
      role: 'instructor',
    }).onConflictDoNothing();
  }

  const adminUser = createdUsers.find(u => u.email === 'admin@titansofmanufacturing.com');
  if (adminUser && tenant2) {
    await db.insert(schema.userTenantRoles).values({
      userId: adminUser.id,
      tenantId: tenant2.id,
      role: 'admin',
    }).onConflictDoNothing();
  }

  // --- Academies ---
  const academiesData = [
    { slug: 'general', title: 'CNC Machining Academy', subtitle: 'From first cut to production-ready parts', description: 'A structured path through machine setup, tooling, workholding, feeds and speeds, and G-code — built for working machinists.', accentColor: '#C2410C' },
    { slug: 'aerospace', title: 'Aerospace Manufacturing Academy', subtitle: 'Precision for the sky and beyond', description: 'AS9100-compliant machining, tight-tolerance finishing, and documentation for aerospace components.', accentColor: '#1E40AF' },
    { slug: 'metalworking', title: 'Metalworking Fundamentals', subtitle: 'Master the craft of metal', description: 'From manual lathes to CNC — learn the core metalworking skills every machinist needs.', accentColor: '#047857' },
    { slug: 'automation', title: 'Automation & Robotics Academy', subtitle: 'The future of manufacturing', description: 'Industrial robotics, pallet changers, bar feeders, and lights-out manufacturing.', accentColor: '#7C3AED' },
  ];
  const academies: typeof schema.academies.$inferSelect[] = [];
  for (const a of academiesData) {
    let found = await db.query.academies.findFirst({
      where: and(eq(schema.academies.tenantId, tenant.id), eq(schema.academies.slug, a.slug)),
    });
    if (!found) {
      const [created] = await db.insert(schema.academies).values({
        tenantId: tenant.id, ...a, isPublished: true, publishedAt: new Date(),
      }).returning();
      found = created;
      console.log(`Created academy: ${a.title}`);
    } else {
      console.log(`Academy exists: ${found.slug}`);
    }
    academies.push(found!);
  }
  const academy = academies[0]; // primary academy for course linking

  // --- Courses ---
  const coursesData = [
    { slug: 'cnc-milling-fundamentals', title: 'CNC Milling Fundamentals', subtitle: 'From zero to your first machined part', description: 'Learn the fundamentals of CNC milling including setup, tooling, and programming.', difficulty: 1, estimatedHours: 20, academyIdx: 0, sortOrder: 1 },
    { slug: 'cnc-turning-essentials', title: 'CNC Turning Essentials', subtitle: 'Master the lathe', description: 'Everything you need to know about CNC turning — from basic ops to live tooling.', difficulty: 1, estimatedHours: 16, academyIdx: 0, sortOrder: 2 },
    { slug: 'advanced-5-axis-machining', title: 'Advanced 5-Axis Machining', subtitle: 'Multi-axis precision', description: 'Tackle complex 5-axis toolpaths, fixture design, and simultaneous machining strategies.', difficulty: 3, estimatedHours: 40, academyIdx: 0, sortOrder: 3 },
    { slug: 'feeds-and-speeds-masterclass', title: 'Feeds & Speeds Masterclass', subtitle: 'Optimize every cut', description: 'Deep dive into chipload, SFM, MRR, and tool life optimization for all materials.', difficulty: 2, estimatedHours: 12, academyIdx: 0, sortOrder: 4 },
    { slug: 'aerospace machining-101', title: 'Aerospace Machining 101', subtitle: 'AS9100 compliance from day one', description: 'Aerospace material specs, toolpath strategies, and documentation requirements.', difficulty: 2, estimatedHours: 25, academyIdx: 1, sortOrder: 1 },
    { slug: 'titanium-machining', title: 'Machining Titanium & Superalloys', subtitle: 'Conquer hard materials', description: 'Tool selection, coolant strategies, and work hardening prevention for aerospace alloys.', difficulty: 3, estimatedHours: 30, academyIdx: 1, sortOrder: 2 },
    { slug: 'sheet-metal-fabrication', title: 'Sheet Metal Fabrication', subtitle: 'Bend, cut, and form', description: 'CNC punching, laser cutting, press brake forming, and finishing techniques.', difficulty: 1, estimatedHours: 14, academyIdx: 2, sortOrder: 1 },
    { slug: 'manual-lathe-fundamentals', title: 'Manual Lathe Fundamentals', subtitle: 'Old-school skills for modern machinists', description: 'Learn to operate a manual engine lathe — the foundation of all turning work.', difficulty: 1, estimatedHours: 18, academyIdx: 2, sortOrder: 2 },
    { slug: 'welding-for-machinists', title: 'Welding for Machinists', subtitle: 'TIG, MIG, and stick fundamentals', description: 'Essential welding skills every machinist needs for repair and fabrication work.', difficulty: 1, estimatedHours: 15, academyIdx: 2, sortOrder: 3 },
    { slug: 'industrial-robotics-intro', title: 'Industrial Robotics Intro', subtitle: 'Program your first robot', description: 'Introduction to FANUC, ABB, and KUKA robot programming for manufacturing cells.', difficulty: 2, estimatedHours: 22, academyIdx: 3, sortOrder: 1 },
    { slug: 'lights-out-manufacturing', title: 'Lights-Out Manufacturing', subtitle: 'Run unattended 24/7', description: 'Cell design, pallet systems, probing, and monitoring for unattended production.', difficulty: 3, estimatedHours: 28, academyIdx: 3, sortOrder: 2 },
  ];
  const courses: typeof schema.courses.$inferSelect[] = [];
  for (const c of coursesData) {
    let found = await db.query.courses.findFirst({
      where: and(eq(schema.courses.tenantId, tenant.id), eq(schema.courses.slug, c.slug)),
    });
    if (!found) {
      const [created] = await db.insert(schema.courses).values({
        tenantId: tenant.id,
        academyId: academies[c.academyIdx]?.id ?? academy?.id ?? null,
        slug: c.slug, title: c.title, subtitle: c.subtitle, description: c.description,
        difficulty: c.difficulty, estimatedHours: c.estimatedHours,
        isPublished: true, sortOrder: c.sortOrder,
      }).returning();
      found = created;
      console.log(`Created course: ${c.title}`);
    } else {
      await db.update(schema.courses).set({ isPublished: true, updatedAt: new Date() }).where(eq(schema.courses.id, found.id));
      console.log(`Course exists: ${found.title}`);
    }
    courses.push(found!);
  }

  // --- Series + Lessons per course ---
  const seriesLessonsMap: Record<string, { slug: string; title: string; description: string; content: string; sortOrder: number; freePreview: boolean }[]> = {
    'cnc-milling-fundamentals': [
      { slug: 'what-is-cnc', title: 'What is CNC Machining?', description: 'An overview of computer numerical control machining', content: 'CNC (Computer Numerical Control) machining is a manufacturing process...', sortOrder: 1, freePreview: true },
      { slug: 'machine-anatomy', title: 'CNC Machine Anatomy', description: 'Understanding the parts of a CNC mill', content: 'A CNC mill consists of several key components...', sortOrder: 2, freePreview: false },
      { slug: 'coordinate-systems', title: 'Coordinate Systems & Work Offsets', description: 'G54-G59 work offsets and machine home', content: 'Understanding machine coordinates vs work coordinates...', sortOrder: 3, freePreview: true },
      { slug: 'tool-change-setup', title: 'Tool Changing & ATC Setup', description: 'Automatic tool changer operation and offsets', content: 'The ATC is one of the most critical subsystems...', sortOrder: 4, freePreview: false },
      { slug: 'your-first-part', title: 'Your First Machined Part', description: 'Step-by-step walkthrough of machining a simple part', content: 'Lets machine a simple aluminum test piece...', sortOrder: 5, freePreview: true },
    ],
    'cnc-turning-essentials': [
      { slug: 'lathe-anatomy', title: 'Lathe Anatomy & Controls', description: 'Understanding the CNC lathe', content: 'A CNC lathe rotates the workpiece against a stationary tool...', sortOrder: 1, freePreview: true },
      { slug: 'turning-operations', title: 'OD/ID Turning Operations', description: 'Facing, turning, boring, and grooving', content: 'The fundamental turning operations...', sortOrder: 2, freePreview: false },
      { slug: 'threading', title: 'Threading & Thread Cutting', description: 'Single-point and die threading', content: 'Threading on a CNC lathe...', sortOrder: 3, freePreview: true },
      { slug: 'live-tooling', title: 'Live Tooling & Milling', description: 'C-axis operations on a turning center', content: 'Live tooling blurs the line...', sortOrder: 4, freePreview: false },
    ],
    'advanced-5-axis-machining': [
      { slug: '5-axis-intro', title: 'Introduction to 5-Axis', description: 'Why 5-axis and when to use it', content: 'Five-axis machining adds two rotational axes...', sortOrder: 1, freePreview: true },
      { slug: 'tool-vectoring', title: 'Tool Vectoring & Tilting', description: 'Lead/lag and tilt angles', content: 'In 5-axis machining the tool orientation...', sortOrder: 2, freePreview: false },
      { slug: 'fixture-design', title: '5-Axis Fixture Design', description: 'Workholding for complex parts', content: 'Fixture design for 5-axis is critical...', sortOrder: 3, freePreview: false },
      { slug: 'impeller-case-study', title: 'Impeller Case Study', description: 'Complete 5-axis impeller machining', content: 'This case study walks through...', sortOrder: 4, freePreview: true },
    ],
    'feeds-and-speeds-masterclass': [
      { slug: 'sfm-fundamentals', title: 'SFM & Chipload Fundamentals', description: 'Surface footage and chip thickness basics', content: 'Surface feet per minute...', sortOrder: 1, freePreview: true },
      { slug: 'mrr-optimization', title: 'Material Removal Rate Optimization', description: 'Maximizing MRR without breaking tools', content: 'MRR is the volume of material...', sortOrder: 2, freePreview: false },
      { slug: 'tool-life', title: 'Tool Life & Wear Patterns', description: 'Reading wear and extending tool life', content: 'Understanding tool wear...', sortOrder: 3, freePreview: true },
    ],
    'aerospace machining-101': [
      { slug: 'aerospace-materials', title: 'Aerospace Materials Overview', description: '7075, Ti-6Al-4V, Inconel, and more', content: 'Aerospace uses a range of materials...', sortOrder: 1, freePreview: true },
      { slug: 'as9100-docs', title: 'AS9100 Documentation', description: 'Traceability and first article inspection', content: 'AS9100 requires rigorous documentation...', sortOrder: 2, freePreview: false },
      { slug: 'thin-wall-machining', title: 'Thin-Wall Machining', description: 'Strategies for thin-wall aerospace parts', content: 'Thin-wall parts are common in aerospace...', sortOrder: 3, freePreview: true },
    ],
    'titanium-machining': [
      { slug: 'titanium-tooling', title: 'Tool Selection for Titanium', description: 'Geometry and coating for Ti alloys', content: 'Machining titanium requires specific tooling...', sortOrder: 1, freePreview: true },
      { slug: 'titanium-coolant', title: 'Coolant Strategies for Superalloys', description: 'Flood, through-spindle, and cryogenic', content: 'Heat management is critical when machining titanium...', sortOrder: 2, freePreview: false },
      { slug: 'titanium-workhardening', title: 'Preventing Work Hardening', description: 'Keep cutting to avoid hardened layers', content: 'Titanium work hardens rapidly...', sortOrder: 3, freePreview: true },
    ],
    'sheet-metal-fabrication': [
      { slug: 'laser-cutting-basics', title: 'Laser Cutting Basics', description: 'Fiber vs CO2 and parameter setup', content: 'Laser cutting is the primary method...', sortOrder: 1, freePreview: true },
      { slug: 'press-brake', title: 'Press Brake Forming', description: 'Bend calculations and die selection', content: 'Press brake forming requires...', sortOrder: 2, freePreview: false },
    ],
    'manual-lathe-fundamentals': [
      { slug: 'lathe-safety', title: 'Lathe Safety & Setup', description: 'Before you turn the first chip', content: 'Manual lathe safety starts with...', sortOrder: 1, freePreview: true },
      { slug: 'facing-turning', title: 'Facing & Straight Turning', description: 'The two most basic operations', content: 'Facing produces a flat surface...', sortOrder: 2, freePreview: false },
      { slug: 'chucking', title: 'Workholding & Chucking', description: '3-jaw, 4-jaw, and collet chucks', content: 'Selecting the right workholding...', sortOrder: 3, freePreview: true },
    ],
    'welding-for-machinists': [
      { slug: 'tig-fundamentals', title: 'TIG Welding Fundamentals', description: 'GTAW for precision work', content: 'TIG welding gives the most control...', sortOrder: 1, freePreview: true },
      { slug: 'mig-basics', title: 'MIG Welding Basics', description: 'GMAW for productivity', content: 'MIG welding is faster than TIG...', sortOrder: 2, freePreview: false },
    ],
    'industrial-robotics-intro': [
      { slug: 'robot-safety', title: 'Robot Safety & Workspace', description: 'Cell design and safety standards', content: 'Industrial robots require careful safety planning...', sortOrder: 1, freePreview: true },
      { slug: 'basic-programming', title: 'Basic Robot Programming', description: 'Teach pendant and offline programming', content: 'Robot programming starts with...', sortOrder: 2, freePreview: false },
      { slug: 'pick-and-place', title: 'Pick & Place Applications', description: 'The most common robot application', content: 'Pick and place is the foundation...', sortOrder: 3, freePreview: true },
    ],
    'lights-out-manufacturing': [
      { slug: 'cell-design', title: 'Unattended Cell Design', description: 'Layout and flow for lights-out', content: 'Designing a lights-out cell...', sortOrder: 1, freePreview: true },
      { slug: 'pallet-systems', title: 'Pallet & Changer Systems', description: 'Automated part loading', content: 'Pallet systems enable continuous production...', sortOrder: 2, freePreview: false },
      { slug: 'monitoring', title: 'Remote Monitoring & Probing', description: 'In-process gauging and alerts', content: 'Monitoring is essential for unattended operation...', sortOrder: 3, freePreview: true },
    ],
  };

  for (const c of courses) {
    const lessons = seriesLessonsMap[c.slug];
    if (!lessons?.length) continue;
    let series = await db.query.series.findFirst({
      where: and(eq(schema.series.tenantId, tenant.id), eq(schema.series.courseId, c.id)),
    });
    if (!series) {
      const [created] = await db.insert(schema.series).values({
        courseId: c.id, tenantId: tenant.id, slug: `${c.slug}-series`,
        title: `${c.title} Series`, description: `Core lessons for ${c.title}`,
        sortOrder: 1, isPublished: true,
      }).returning();
      series = created;
    }
    for (const l of lessons) {
      const existing = await db.query.lessons.findFirst({
        where: and(eq(schema.lessons.tenantId, tenant.id), eq(schema.lessons.slug, l.slug)),
      });
      if (!existing) {
        await db.insert(schema.lessons).values({
          seriesId: series!.id, tenantId: tenant.id, ...l, difficulty: c.difficulty, isPublished: true,
        });
        console.log(`Created lesson: ${l.slug}`);
      }
    }
  }

  await seedBilingualDemoCourse(db, tenant.id, academy?.id ?? null);

  // --- Lesson thumbnail backfill: lessons without thumbs inherit the course thumbnail ---
  const courseThumb = (
    await db.query.courses.findFirst({
      where: eq(schema.courses.id, courses[0]!.id),
      columns: { thumbnailUrl: true },
    })
  )?.thumbnailUrl;
  if (courseThumb) {
    const updated = await db.update(schema.lessons)
      .set({ thumbnailUrl: courseThumb, updatedAt: new Date() })
      .where(and(eq(schema.lessons.tenantId, tenant.id), isNull(schema.lessons.thumbnailUrl)))
      .returning({ id: schema.lessons.id });
    if (updated.length) console.log(`Backfilled ${updated.length} lesson thumbnail(s) from course art`);
  }

  // --- Products ---
  const productsData = [
    { slug: 'beginner-end-mill-kit', title: 'Beginner End Mill Kit', tagline: 'Six essential end mills for your first parts', description: 'A starter set of 2- and 4-flute end mills covering aluminum and steel basics.', price: 8995, category: 'Tool Kits', featured: true, sortOrder: 1, courseId: courses[0]?.id, tags: ['milling', 'endmill', 'starter'], features: ['2-flute and 4-flute carbide', 'TiN coating', 'Center-cutting', '5/8" shank', 'Canvas roll case'] },
    { slug: 'precision-edge-finder', title: 'Precision Edge Finder', tagline: 'Dial in work offsets fast', description: '0.0005" precision edge finder for quick work offset setup.', price: 3495, category: 'Workholding', featured: false, sortOrder: 2, courseId: courses[0]?.id, tags: ['workholding', 'setup', 'edge-finder'], features: ['0.0005" accuracy', 'Spring-loaded tip', 'Hardened steel body'] },
    { slug: 'digital-caliper-6in', title: '6" Digital Caliper', tagline: 'Measure twice, cut once', description: 'Professional-grade 6" digital caliper with 0.0005" resolution.', price: 2995, category: 'Measurement', featured: true, sortOrder: 3, tags: ['measurement', 'caliper'], features: ['0.0005" resolution', 'IP54 rated', 'Large LCD', 'SAE/metric'] },
    { slug: 'cnc-workholding-vise', title: 'Precision CNC Machine Vise', tagline: 'Rock-solid clamping for every job', description: '6" precision CNC machine vise with parallel jaws.', price: 18995, category: 'Workholding', featured: true, sortOrder: 4, academyId: academy?.id, tags: ['workholding', 'vise'], features: ['6" jaw width', '0.001" parallelism', 'Swivel base'] },
    { slug: 'g-code-quick-reference', title: 'G-Code Quick Reference Poster', tagline: 'Every code at a glance', description: 'Laminated 24x36" G-code reference poster.', price: 1995, category: 'Reference', isDigital: true, featured: false, sortOrder: 5, tags: ['reference', 'gcode', 'digital'], features: ['Laminated 24x36"', 'Covers G00-G99', 'M-code table'] },
    { slug: 'er32-collet-set', title: 'ER32 Collet Set (18pc)', tagline: 'Every size you need', description: 'Complete ER32 collet set from 1/16" to 3/4" in 1/32" increments.', price: 6495, category: 'Tooling', featured: true, sortOrder: 6, courseId: courses[0]?.id, tags: ['collet', 'er32', 'tooling'], features: ['18 collets', '1/16" to 3/4"', 'Ground to ±0.0002"', 'Storage case'] },
    { slug: 'face-mill-3in', title: '3" Indexable Face Mill', tagline: 'Surface finish like glass', description: '3" face mill with 5 insert pockets. APKT1604 inserts for steel and aluminum.', price: 7995, category: 'Cutting Tools', featured: true, sortOrder: 7, courseId: courses[0]?.id, tags: ['face-mill', 'indexable', 'cutting'], features: ['5 insert pockets', 'APKT1604 inserts', '45° lead angle', 'Taper shank'] },
    { slug: 'dial-test-indicator', title: 'Dial Test Indicator', tagline: 'Tram and indicate with confidence', description: '0.0001" resolution dial test indicator with dovetail mount.', price: 4495, category: 'Measurement', featured: false, sortOrder: 8, tags: ['measurement', 'indicator', 'tramming'], features: ['0.0001" resolution', 'Dovetail mount', 'Ruby tip', 'Swivel arm'] },
    { slug: 'coolant-mist-unit', title: 'Coolant Mist Delivery System', tagline: 'MQL for better cuts', description: 'Minimum quantity lubrication system for dry machining environments.', price: 12995, category: 'Coolant', featured: false, sortOrder: 9, tags: ['coolant', 'mql', 'lubrication'], features: ['Adjustable flow', 'Air-powered', 'Compact design', 'Filtration'] },
    { slug: 'tormach-1100m', title: 'Tormach 1100M CNC Mill', tagline: 'Personal CNC for every shop', description: 'Compact CNC mill with 3-axis, 10k RPM spindle, and 48x15x16" travels.', price: 899900, category: 'Machines', featured: true, sortOrder: 10, academyId: academy?.id, tags: ['machine', 'tormach', 'mill'], features: ['3-axis', '10k RPM spindle', '48x15x16" travels', 'PathPilot control'] },
    { slug: 'haas-vf2', title: 'Haas VF-2 CNC Mill', tagline: 'Industry-standard VMC', description: 'Vertical machining center with 30+1 tool changer and 30" X-travel.', price: 5299900, category: 'Machines', featured: true, sortOrder: 11, academyId: academy?.id, tags: ['machine', 'haas', 'vmc'], features: ['30+1 ATC', '30" X-travel', '12k RPM', 'Haas control'] },
    { slug: 'machinist-toolbox', title: 'Machinist Tool Kit (52pc)', tagline: 'Everything in one box', description: 'Complete precision measurement kit: micrometers, calipers, indicators, gage blocks.', price: 24995, category: 'Measurement', featured: true, sortOrder: 12, tags: ['measurement', 'kit', 'precision'], features: ['52 pieces', 'Micrometer set', 'Gage blocks', 'Indicators', 'Carrying case'] },
    { slug: 'saw-blade-7in', title: '7" Bi-Metal Bandsaw Blade (10pk)', tagline: 'Cut clean, cut fast', description: '10-pack of 7" bi-metal bandsaw blades for metal cutting. 14 TPI.', price: 3495, category: 'Cutting Tools', featured: false, sortOrder: 13, tags: ['saw', 'blade', 'bandsaw'], features: ['Bi-metal construction', '14 TPI', '10-pack', '1/2" width'] },
    { slug: 'deburring-tool', title: 'Deburring Tool Set', tagline: 'Finish every edge', description: 'Professional deburring tool with 10 HSS blades for aluminum and steel.', price: 1895, category: 'Hand Tools', featured: false, sortOrder: 14, tags: ['deburring', 'hand-tool', 'finishing'], features: ['Ergonomic handle', '10 HSS blades', 'Quick-change', 'Aluminum & steel'] },
    { slug: 'tap-die-set', title: 'Metric Tap & Die Set (40pc)', tagline: 'Thread cutting made easy', description: 'Complete metric tap and die set from M3 to M12 in common pitches.', price: 5995, category: 'Hand Tools', featured: true, sortOrder: 15, tags: ['tapping', 'threading', 'hand-tool'], features: ['40 pieces', 'M3-M12', 'HSS', 'Storage case'] },
    { slug: 'machinist-hat', title: 'TITANS Machinist Cap', tagline: 'Rep the shop', description: 'Embroidered structured cap. Black with orange TITANS logo.', price: 2495, category: 'Merch', isDigital: false, featured: false, sortOrder: 16, tags: ['merch', 'hat', 'apparel'], features: ['Structured fit', 'Embroidered logo', 'Adjustable strap', '100% cotton'] },
    { slug: 'shop-safety-poster', title: 'Shop Safety Poster Set', tagline: 'Safety first, always', description: 'Set of 6 OSHA-compliant shop safety posters. 12x18" laminated.', price: 2995, category: 'Reference', isDigital: false, featured: false, sortOrder: 17, tags: ['safety', 'poster', 'reference'], features: ['6 posters', 'OSHA compliant', '12x18" laminated', 'Mounting hardware'] },
    { slug: 'cnc-starter-course', title: 'CNC Starter Course (Digital)', tagline: 'Learn online, at your pace', description: 'Digital access to the CNC Milling Fundamentals video course. 20+ hours.', price: 9900, category: 'Digital', isDigital: true, featured: true, sortOrder: 18, courseId: courses[0]?.id, tags: ['digital', 'course', 'online'], features: ['20+ hours video', 'Lifetime access', 'Certificate included', 'Forum access'] },
    { slug: 'precision-vice-jaw-set', title: 'Soft Jaw Set (6pc)', tagline: 'Customize your vise', description: 'Aluminum soft jaws for parallel, angle, and round workholding.', price: 4495, category: 'Workholding', featured: false, sortOrder: 19, tags: ['workholding', 'jaws', 'vise'], features: ['6 jaw pairs', '6061 aluminum', 'Pre-drilled', 'Universal fit'] },
    { slug: 'tool-organizer', title: 'Tool Holder Organizer Rack', tagline: 'Keep your shop organized', description: 'Wall-mounted BT40/ISO40 tool holder rack with 10 positions.', price: 3995, category: 'Shop Organization', featured: false, sortOrder: 20, tags: ['organization', 'tool-holder', 'shop'], features: ['10 positions', 'Wall-mount', 'BT40/ISO40', 'Powder coated'] },
  ];
  for (const p of productsData) {
    const existing = await db.query.products.findFirst({
      where: and(eq(schema.products.tenantId, tenant.id), eq(schema.products.slug, p.slug)),
    });
    if (!existing) {
      await db.insert(schema.products).values({
        ...p,
        tenantId: tenant.id, currency: 'USD', inventory: 25, isPublished: true,
        tags: p.tags || ['demo'], features: p.features || null,
        academyId: p.academyId || null, courseId: p.courseId || null,
      });
      console.log(`Created product: ${p.slug}`);
    }
  }

  // --- Certificate templates ---
  //
  // Seeded with real field definitions. The previous template had an empty
  // `fields` array, which the renderer now treats as "use the default layout" —
  // functional, but it meant the demo workspace could not show what the field
  // designer actually does. One template per scope also exercises the whole
  // course -> academy -> tenant resolution chain.
  const certFields = [
    { key: 'learnerName', label: 'Learner', x: 50, y: 42, fontSize: 30, fontWeight: '700', color: '#191B1F' },
    { key: 'courseTitle', label: 'Course', x: 50, y: 56, fontSize: 14, fontWeight: 'normal', color: '#475569' },
    { key: 'academyName', label: 'Academy', x: 50, y: 65, fontSize: 11, fontWeight: '600', color: '#64748b' },
    { key: 'issueDate', label: 'Issue date', x: 50, y: 78, fontSize: 9, fontWeight: 'normal', color: '#94A3B8' },
    { key: 'certificateNumber', label: 'Certificate no.', x: 50, y: 88, fontSize: 8, fontWeight: 'normal', color: '#94A3B8' },
  ];
  // Each scope is ensured independently. The previous version created all three
  // templates only when the tenant had none at all, so a workspace that already
  // had a single course template never gained an academy or tenant default —
  // leaving the course -> academy -> tenant chain with nothing to fall back to.
  const ensureTemplate = async (
    scope: 'course' | 'academy' | 'tenant',
    values: Partial<typeof schema.certTemplates.$inferInsert>,
  ) => {
    const existing = await db.query.certTemplates.findFirst({
      where: and(
        eq(schema.certTemplates.tenantId, tenant.id),
        eq(schema.certTemplates.scopeType, scope),
        scope === 'course'
          ? eq(schema.certTemplates.courseId, values.courseId!)
          : scope === 'academy'
            ? eq(schema.certTemplates.academyId, values.academyId!)
            : isNull(schema.certTemplates.courseId),
      ),
    });
    if (existing) return false;
    await db.insert(schema.certTemplates).values({
      tenantId: tenant.id,
      fields: certFields,
      isActive: true,
      ...values,
    } as typeof schema.certTemplates.$inferInsert);
    return true;
  };

  const firstAcademy = await db.query.academies.findFirst({
    where: eq(schema.academies.tenantId, tenant.id),
  });

  const created: string[] = [];
  if (await ensureTemplate('course', {
    scopeType: 'course',
    courseId: courses[0]!.id,
    name: 'CNC Fundamentals Certificate',
    layout: 'modern',
    primaryColor: '#C2410C',
    secondaryColor: '#191B1F',
    fontFamily: 'Inter',
  })) created.push('course');

  if (firstAcademy && await ensureTemplate('academy', {
    scopeType: 'academy',
    academyId: firstAcademy.id,
    name: `${firstAcademy.title} — Completion`,
    layout: 'classic',
    primaryColor: '#B42318',
    secondaryColor: '#1c1917',
    fontFamily: 'Playfair Display',
  })) created.push('academy');

  if (await ensureTemplate('tenant', {
    scopeType: 'tenant',
    name: 'TITANS Default Certificate',
    layout: 'minimal',
    primaryColor: '#0F766E',
    secondaryColor: '#334155',
    fontFamily: 'DM Sans',
  })) created.push('tenant');

  if (created.length) console.log(`Created demo cert templates: ${created.join(', ')}`);

  // The demo workspace shipped a course-linked template with zero fields and an
  // inactive tenant default left over from an e2e run. Backfill the fields so
  // the renderer has something to draw, and re-activate the default so the
  // resolution chain has a working fallback.
  await db
    .update(schema.certTemplates)
    .set({ fields: certFields })
    .where(
      and(
        eq(schema.certTemplates.tenantId, tenant.id),
        sql`(${schema.certTemplates.fields} IS NULL OR jsonb_array_length(${schema.certTemplates.fields}) = 0)`,
      ),
    );
  await db
    .update(schema.certTemplates)
    .set({ isActive: true })
    .where(
      and(
        eq(schema.certTemplates.tenantId, tenant.id),
        eq(schema.certTemplates.scopeType, 'tenant'),
        isNull(schema.certTemplates.courseId),
        isNull(schema.certTemplates.academyId),
        eq(schema.certTemplates.isActive, false),
      ),
    );

  // --- Ancillary demo data: only when tables are empty (keeps reruns safe) ---
  try {
    const [v] = await db.select({ n: count() }).from(schema.videoSeries);
    if (Number(v?.n ?? 0) === 0) await seedVideos(db, tenant.id);
  } catch (e) { console.warn('[seed] seedVideos skipped:', (e as Error)?.message); }
  try {
    const [s] = await db.select({ n: count() }).from(schema.sponsors);
    if (Number(s?.n ?? 0) === 0) await seedSponsors(db, tenant.id);
  } catch (e) { console.warn('[seed] seedSponsors skipped:', (e as Error)?.message); }
  try {
    const [ev] = await db.select({ n: count() }).from(schema.events);
    if (Number(ev?.n ?? 0) === 0) await seedEvents(db, tenant.id);
  } catch (e) { console.warn('[seed] seedEvents skipped:', (e as Error)?.message); }
  try {
    const [p] = await db.select({ n: count() }).from(schema.posts);
    if (Number(p?.n ?? 0) === 0 && createdUsers[0]) await seedPosts(db, createdUsers[0].id, tenant.id);
  } catch (e) { console.warn('[seed] seedPosts skipped:', (e as Error)?.message); }
  try {
    const [g] = await db.select({ n: count() }).from(schema.studyGroups);
    if (Number(g?.n ?? 0) === 0 && createdUsers[0]) await seedStudyGroups(db, createdUsers[0].id);
  } catch (e) { console.warn('[seed] seedStudyGroups skipped:', (e as Error)?.message); }

  await seedRbac(db, [tenant.id, tenant2?.id].filter(Boolean) as string[], createdUsers);

  console.log('\n--- Test Accounts ---');
  console.log('Password for all users: Test1234!');
  console.log('------------------------');
  console.log('super_admin:  superadmin@titansofmanufacturing.com');
  console.log('admin:        admin@titansofmanufacturing.com');
  console.log('instructor:   instructor@titansofmanufacturing.com');
  console.log('learner:      learner@titansofmanufacturing.com');
  console.log('cross-tenant: cross-tenant@titansofmanufacturing.com  (learner in tenant1, instructor in tenant2)');
  console.log('------------------------');
  console.log('Seed complete!');
  await client.end();
}

async function seedRbac(
  db: any,
  tenantIds: string[],
  createdUsers: typeof schema.users.$inferSelect[],
) {
  console.log('Seeding RBAC permissions + system roles...');

  for (const p of PERMISSION_CATALOG) {
    await db
      .insert(schema.permissions)
      .values({
        key: p.key,
        group: p.group,
        label: p.label,
        description: p.description ?? null,
      })
      .onConflictDoNothing({ target: [schema.permissions.key] });
  }
  console.log('Upserted permission catalog');

  for (const tenantId of tenantIds) {
    const roleKeyToId = new Map<string, string>();
    for (const key of SYSTEM_ROLE_KEYS) {
      const [role] = await db
        .insert(schema.roles)
        .values({
          tenantId,
          key,
          name: key.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
          description: `${key} system role`,
          isSystem: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoNothing({ target: [schema.roles.tenantId, schema.roles.key] })
        .returning({ id: schema.roles.id });

      const roleId =
        role?.id ||
        (
          await db
            .select({ id: schema.roles.id })
            .from(schema.roles)
            .where(eq(schema.roles.key, key))
            .limit(1)
        )[0]?.id;
      if (roleId) roleKeyToId.set(key, roleId);

      const permKeys = SYSTEM_ROLE_PERMISSIONS[key] ?? [];
      if (roleId && permKeys.length) {
        const permRows = await db
          .select({ id: schema.permissions.id })
          .from(schema.permissions)
          .where(inArray(schema.permissions.key, permKeys));
        await db
          .delete(schema.rolePermissions)
          .where(eq(schema.rolePermissions.roleId, roleId));
        if (permRows.length) {
          await db.insert(schema.rolePermissions).values(
            permRows.map((p: { id: string }) => ({ roleId, permissionId: p.id })),
          );
        }
      }
    }

    for (const u of createdUsers) {
      if (!u.tenantId || u.tenantId !== tenantId) continue;
      const roleId = roleKeyToId.get(u.role);
      if (roleId) {
        await db
          .insert(schema.userRoles)
          .values({ userId: u.id, tenantId, roleId, assignedBy: null })
          .onConflictDoNothing({
            target: [schema.userRoles.userId, schema.userRoles.tenantId, schema.userRoles.roleId],
          });
      }
    }
    console.log(`Seeded RBAC for tenant ${tenantId}`);
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
