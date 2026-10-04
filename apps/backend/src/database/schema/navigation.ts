import { pgTable, uuid, varchar, boolean, integer, timestamp, index } from 'drizzle-orm/pg-core';
import type { NavItemType } from '@titan/shared';
import { tenants } from './tenants';

/**
 * Tenant-scoped navigation tree.
 *
 * This table predates the nav feature (migration 0000) and was extended in
 * migration 025 rather than replaced, so the name and the relations that
 * already point at it still hold.
 *
 * `parentId` is self-referencing and ON DELETE CASCADE, so removing a group
 * removes its children and the tree cannot accumulate orphans. Depth is capped
 * at two levels by the navigation service rather than by a constraint: a
 * constraint cannot express "a child may not have children" without a trigger,
 * and the service flattens a third level anyway.
 */
export const navigationItems = pgTable(
  'navigation_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    label: varchar('label', { length: 100 }).notNull(),
    /** Arabic label. Falls back to the English one when absent. */
    labelAr: varchar('label_ar', { length: 120 }),
    type: varchar('type', { length: 20 }).$type<NavItemType>().default('url').notNull(),
    /** Set for `type = 'url'`. Null for a group, which only holds other links. */
    href: varchar('href', { length: 500 }),
    /** Set for `type = 'page'`. Resolved to `/slug` at render time. */
    pageSlug: varchar('page_slug', { length: 100 }),
    parentId: uuid('parent_id').references((): any => navigationItems.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').default(0).notNull(),
    isVisible: boolean('is_visible').default(true).notNull(),
    icon: varchar('icon', { length: 50 }),
    requiresAuth: boolean('requires_auth').default(false).notNull(),
    opensInNewTab: boolean('opens_in_new_tab').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantParentIdx: index('navigation_items_tenant_parent_idx').on(
      table.tenantId,
      table.parentId,
      table.sortOrder,
    ),
  }),
);

export type NavigationItemRow = typeof navigationItems.$inferSelect;
