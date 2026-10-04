import { pgTable, uuid, varchar, boolean, jsonb, integer, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { users } from './users';
import type { PageLayout, PageStatus } from '@titan/shared';

export const pages = pgTable('pages', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  layout: jsonb('layout').$type<PageLayout>().notNull(),
  /**
   * A per-locale copy of the page: `{"ar":{"title":…,"layout":…}}`.
   *
   * The document format has no per-field translation slot, and changing it would
   * break the editor and every block renderer, so a locale gets a whole layout of
   * its own. Serving falls back to `layout` (English) when a locale is absent.
   */
  translations: jsonb('translations').$type<Record<string, { title?: string; layout?: PageLayout }>>(),
  /**
   * `disabled` is the third state: the page and its version history stay, but
   * the public read path refuses to serve it and the nav stops offering it.
   */
  status: varchar('status', { length: 20 }).$type<PageStatus>().default('draft').notNull(),
  /** Seeded page (home, about, …). Cannot be deleted, only disabled. */
  isSystem: boolean('is_system').default(false).notNull(),
  /** Offer this page as a navigation target when building a nav tree. */
  showInNav: boolean('show_in_nav').default(false).notNull(),
  seoTitle: varchar('seo_title', { length: 255 }),
  seoDescription: varchar('seo_description', { length: 500 }),
  /** Layout template this page was created from: blank | landing | content. */
  template: varchar('template', { length: 50 }),
  version: integer('version').default(0).notNull(),
  publishedAt: timestamp('published_at'),
  publishedById: uuid('published_by_id').references(() => users.id),
  updatedById: uuid('updated_by_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  tenantSlugIdx: uniqueIndex('pages_tenant_slug_idx').on(table.tenantId, table.slug),
  tenantIdx: index('pages_tenant_idx').on(table.tenantId),
  tenantStatusIdx: index('pages_tenant_status_idx').on(table.tenantId, table.status),
}));

export const pageVersions = pgTable('page_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  pageId: uuid('page_id').references(() => pages.id, { onDelete: 'cascade' }).notNull(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  version: integer('version').notNull(),
  layout: jsonb('layout').$type<PageLayout>().notNull(),
  status: varchar('status', { length: 20 }).$type<'snapshot' | 'published'>().default('published').notNull(),
  note: varchar('note', { length: 500 }),
  changedById: uuid('changed_by_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  pageVersionIdx: uniqueIndex('page_versions_page_version_idx').on(table.pageId, table.version),
  pageTenantIdx: index('page_versions_tenant_idx').on(table.tenantId),
}));
