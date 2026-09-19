import { pgTable, uuid, varchar, text, integer, boolean, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { academies } from './academies';

export interface LessonVideoMeta {
  key: string;
  size: number;
  contentType: string;
  filename: string;
}

export const courses = pgTable('courses', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  academyId: uuid('academy_id').references(() => academies.id, { onDelete: 'set null' }),
  slug: varchar('slug', { length: 200 }).notNull(),
  title: varchar('title', { length: 300 }).notNull(),
  subtitle: varchar('subtitle', { length: 500 }),
  description: text('description'),
  thumbnailUrl: varchar('thumbnail_url', { length: 500 }),
  difficulty: integer('difficulty').default(1),
  estimatedHours: integer('estimated_hours'),
  priceCents: integer('price_cents'),
  currency: varchar('currency', { length: 8 }).default('USD'),
  accessMode: varchar('access_mode', { length: 20 }).default('open'),
  trailerUrl: varchar('trailer_url', { length: 500 }),
  seoTitle: varchar('seo_title', { length: 300 }),
  seoDescription: text('seo_description'),
  seoKeywords: varchar('seo_keywords', { length: 300 }),
  ogImageUrl: varchar('og_image_url', { length: 500 }),
  isPublished: boolean('is_published').default(false),
  isArchived: boolean('is_archived').default(false),
  publishedAt: timestamp('published_at'),
  archivedAt: timestamp('archived_at'),
  sortOrder: integer('sort_order').default(0),
  autoIssueCertificate: boolean('auto_issue_certificate').default(true).notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  tenantSlugIdx: index('tenant_slug_idx').on(table.tenantId, table.slug),
  publishedIdx: index('published_idx').on(table.tenantId, table.isPublished, table.sortOrder),
  archivedIdx: index('archived_idx').on(table.tenantId, table.isArchived, table.sortOrder),
  academyIdx: index('courses_academy_idx').on(table.tenantId, table.academyId, table.isPublished, table.sortOrder),
}));

export const series = pgTable('series', {
  id: uuid('id').defaultRandom().primaryKey(),
  courseId: uuid('course_id').references(() => courses.id).notNull(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  slug: varchar('slug', { length: 200 }).notNull(),
  title: varchar('title', { length: 300 }).notNull(),
  description: text('description'),
  thumbnailUrl: varchar('thumbnail_url', { length: 500 }),
  sortOrder: integer('sort_order').default(0),
  isPublished: boolean('is_published').default(false),
  isArchived: boolean('is_archived').default(false),
  archivedAt: timestamp('archived_at'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const lessons = pgTable('lessons', {
  id: uuid('id').defaultRandom().primaryKey(),
  seriesId: uuid('series_id').references(() => series.id).notNull(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  slug: varchar('slug', { length: 200 }).notNull(),
  title: varchar('title', { length: 300 }).notNull(),
  description: text('description'),
  videoUrl: varchar('video_url', { length: 500 }),
  thumbnailUrl: varchar('thumbnail_url', { length: 500 }),
  videoDuration: integer('video_duration'),
  content: text('content'),
  attachments: jsonb('attachments').$type<{ id: string; name: string; type: string; url: string; size: number }[]>(),
  difficulty: integer('difficulty').default(1),
  videoMeta: jsonb('video_meta').$type<LessonVideoMeta | null>(),
  isPublished: boolean('is_published').default(false),
  isArchived: boolean('is_archived').default(false),
  archivedAt: timestamp('archived_at'),
  sortOrder: integer('sort_order').default(0),
  freePreview: boolean('free_preview').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});