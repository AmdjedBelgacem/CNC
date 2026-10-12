import type { ContentLocale, InteractiveHotspot, ProductContentTranslation } from '@titan/shared';
import { pgTable, uuid, varchar, text, integer, boolean, jsonb, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
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
// Re-exported from `@titan/shared`; it lived only here, so the frontend re-declared it by hand
// and the two drifted. `hotspots` is new: image hotspot copy had no locale support at all, so an
// Arabic visitor saw English labels pinned onto translated product text.
export type { ProductContentTranslation } from '@titan/shared';

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
  price: integer('price'),
  compareAtPrice: integer('compare_at_price'),
  currency: varchar('currency', { length: 3 }).default('USD'),
  /**
   * How this product is priced.
   *
   *  'fixed'   show `price` exactly.
   *  'from'    show "from <lowest price>", where the figure varies by variant.
   *  'request' show no figure at all; the buyer sends a quote request instead.
   *
   * NOT NULL with a default so no existing row changes meaning when the migration runs,
   * and so the read path never has to infer a mode from a null price — a genuinely free
   * product and a quote-only machine look identical otherwise.
   */
  pricingMode: varchar('pricing_mode', { length: 20 }).default('fixed').notNull(),
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
  pinpoints: jsonb('pinpoints').$type<InteractiveHotspot[]>(),
  documents: jsonb('documents').$type<Array<{ title: string; url: string; name?: string; size?: number }>>(),
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

/**
 * Ordered gallery for a product.
 *
 * A table rather than a `jsonb` array on `products`, because admin reorder and delete
 * need per-row identity, and because the storefront must be able to ask for "the other
 * images" without parsing a blob. `thumbnail_url` on `products` stays the denormalised
 * primary so cards and lists keep reading one column; `is_primary` here is the source
 * of truth and both are written in the same transaction by ProductsService.
 *
 * `sort_order` is intentionally NOT uniquely constrained: a unique (productId, sortOrder)
 * makes a reorder a sequence of updates that transiently collide. Reordering instead
 * renumbers the whole set inside one transaction (see ProductsService.reorderImages),
 * so gaps are impossible without transient unique-violation failures.
 */
export const productImages = pgTable(
  'product_images',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id)
      .notNull(),
    productId: uuid('product_id')
      .references(() => productsBundle.id, { onDelete: 'cascade' })
      .notNull(),
    url: varchar('url', { length: 500 }).notNull(),
    alt: varchar('alt', { length: 300 }),
    /**
     * Hotspots belong to ONE image. They used to live in a single `products.pinpoints`
     * array shared by the whole product, which made them meaningless the moment a second
     * image existed: a marker at 40%/30% means a different part of the part depending on
     * which picture is showing.
     *
     * Reuses the course `InteractiveHotspot` shape ({ id, x, y, label, tooltip, detail })
     * so the same renderer and the same mental model apply in lessons and in products.
     */
    hotspots: jsonb('hotspots').$type<InteractiveHotspot[]>(),
    sortOrder: integer('sort_order').notNull().default(0),
    isPrimary: boolean('is_primary').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    productOrderIdx: index('product_images_product_order_idx').on(table.productId, table.sortOrder),
    tenantIdx: index('product_images_tenant_idx').on(table.tenantId),
    // At most one primary per product. A partial unique index is the only way to say
    // this in SQL; the service keeps it correct in the same transaction as the write.
    onePrimaryIdx: uniqueIndex('product_images_one_primary_idx')
      .on(table.productId)
      .where(sql`${table.isPrimary} = true`),
  }),
);
