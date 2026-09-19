import { pgTable, uuid, varchar, text, integer, boolean, jsonb, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

export const academies = pgTable('academies', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  slug: varchar('slug', { length: 200 }).notNull(),
  title: varchar('title', { length: 300 }).notNull(),
  subtitle: varchar('subtitle', { length: 500 }),
  description: text('description'),
  heroImageUrl: varchar('hero_image_url', { length: 500 }),
  logoUrl: varchar('logo_url', { length: 500 }),
  seoImageUrl: varchar('seo_image_url', { length: 500 }),
  accentColor: varchar('accent_color', { length: 7 }),
  seoTitle: varchar('seo_title', { length: 300 }),
  seoDescription: varchar('seo_description', { length: 500 }),
  isPublished: boolean('is_published').default(false),
  isArchived: boolean('is_archived').default(false),
  publishedAt: timestamp('published_at'),
  archivedAt: timestamp('archived_at'),
  sortOrder: integer('sort_order').default(0),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  tenantSlugUnique: uniqueIndex('academies_tenant_slug_unique').on(table.tenantId, table.slug),
  publishedIdx: index('academies_tenant_published_idx').on(table.tenantId, table.isPublished, table.sortOrder),
}));
