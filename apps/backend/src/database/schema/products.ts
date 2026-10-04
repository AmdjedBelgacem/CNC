import type { ContentLocale } from '@titan/shared';
import { pgTable, uuid, varchar, text, integer, boolean, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { academies } from './academies';
import { courses } from './courses';


/** Per-locale copy. Only human-readable text belongs here; never a price, a
 * capacity, a date or a slug, because those are data and translating them
 * would corrupt the row. Missing keys fall back to the English column. */
export type AcademyContentTranslation = {
  title?: string;
  description?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
};
export type ProductContentTranslation = {
  title?: string;
  tagline?: string | null;
  description?: string | null;
  /** Bullet points shown on the product page. */
  features?: string[] | null;
};

export const productsBundle = pgTable('products', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  medusaId: varchar('medusa_id', { length: 255 }),
  title: varchar('title', { length: 300 }).notNull(),
  slug: varchar('slug', { length: 200 }).notNull(),
  tagline: varchar('tagline', { length: 500 }),
  description: text('description'),
  features: jsonb('features').$type<string[]>(),
  thumbnailUrl: varchar('thumbnail_url', { length: 500 }),
  mediaUrls: jsonb('media_urls').$type<string[]>(),
  price: integer('price').notNull(),
  compareAtPrice: integer('compare_at_price'),
  currency: varchar('currency', { length: 3 }).default('USD'),
  trackInventory: boolean('track_inventory').default(true),
  inventory: integer('inventory').default(0),
  allowBackorder: boolean('allow_backorder').default(false),
  backorderLeadDays: integer('backorder_lead_days'),
  isDigital: boolean('is_digital').default(false),
  isPublished: boolean('is_published').default(false),
  translations: jsonb('translations').$type<Partial<Record<ContentLocale, ProductContentTranslation>>>(),
  isArchived: boolean('is_archived').default(false),
  status: varchar('status', { length: 20 }).default('draft'),
  category: varchar('category', { length: 100 }),
  tags: varchar('tags').array(),
  featured: boolean('featured').default(false),
  sortOrder: integer('sort_order').default(0),
  academyId: uuid('academy_id').references(() => academies.id, { onDelete: 'set null' }),
  courseId: uuid('course_id').references(() => courses.id, { onDelete: 'set null' }),
  seoTitle: varchar('seo_title', { length: 200 }),
  seoDescription: varchar('seo_description', { length: 500 }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  tenantPublishedIdx: index('prod_tenant_pub_idx').on(table.tenantId, table.isPublished),
  categoryIdx: index('prod_category_idx').on(table.tenantId, table.category),
  academyIdx: index('prod_academy_idx').on(table.academyId),
  courseIdx: index('prod_course_idx').on(table.courseId),
}));

export const productVariants = pgTable('product_variants', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: uuid('product_id').references(() => productsBundle.id).notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  sku: varchar('sku', { length: 100 }),
  price: integer('price'),
  inventory: integer('inventory').default(0),
  allowBackorder: boolean('allow_backorder').default(false),
  options: jsonb('options').$type<Record<string, string>>(),
  sortOrder: integer('sort_order').default(0),
});
