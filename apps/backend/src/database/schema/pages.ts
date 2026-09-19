import { pgTable, uuid, varchar, jsonb, integer, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { users } from './users';
import type { PageLayout, PageStatus } from '@titan/shared';

export const pages = pgTable('pages', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  layout: jsonb('layout').$type<PageLayout>().notNull(),
  status: varchar('status', { length: 20 }).$type<PageStatus>().default('draft').notNull(),
  version: integer('version').default(0).notNull(),
  publishedAt: timestamp('published_at'),
  publishedById: uuid('published_by_id').references(() => users.id),
  updatedById: uuid('updated_by_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  tenantSlugIdx: uniqueIndex('pages_tenant_slug_idx').on(table.tenantId, table.slug),
  tenantIdx: index('pages_tenant_idx').on(table.tenantId),
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
