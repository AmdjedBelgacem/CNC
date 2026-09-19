import { pgTable, uuid, varchar, jsonb, integer, boolean, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { users } from './users';
import { DEFAULT_THEME_TOKENS } from '@titan/shared';
import type { ThemeTokens, ThemeStatus } from '@titan/shared';

export const themes = pgTable('themes', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).unique().notNull(),
  name: varchar('name', { length: 255 }).default('Default Theme').notNull(),
  tokens: jsonb('tokens').$type<ThemeTokens>().default(DEFAULT_THEME_TOKENS).notNull(),
  status: varchar('status', { length: 20 }).$type<ThemeStatus>().default('draft').notNull(),
  version: integer('version').default(0).notNull(),
  isDefault: boolean('is_default').default(false).notNull(),
  publishedAt: timestamp('published_at'),
  publishedById: uuid('published_by_id').references(() => users.id),
  updatedById: uuid('updated_by_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const themeVersions = pgTable('theme_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  themeId: uuid('theme_id').references(() => themes.id, { onDelete: 'cascade' }).notNull(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  version: integer('version').notNull(),
  tokens: jsonb('tokens').$type<ThemeTokens>().notNull(),
  status: varchar('status', { length: 20 }).$type<'snapshot' | 'published'>().default('published').notNull(),
  changedById: uuid('changed_by_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  themeVersionIdx: uniqueIndex('theme_versions_theme_version_idx').on(table.themeId, table.version),
  themeTenantIdx: index('theme_versions_tenant_idx').on(table.tenantId),
}));
