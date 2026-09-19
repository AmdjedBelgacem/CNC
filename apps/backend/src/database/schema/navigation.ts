import { pgTable, uuid, varchar, boolean, integer } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

export const navigationItems = pgTable('navigation_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  parentId: uuid('parent_id'),
  label: varchar('label', { length: 100 }).notNull(),
  href: varchar('href', { length: 500 }).notNull(),
  icon: varchar('icon', { length: 50 }),
  sortOrder: integer('sort_order').default(0),
  isVisible: boolean('is_visible').default(true),
  requiresAuth: boolean('requires_auth').default(false),
  opensInNewTab: boolean('opens_in_new_tab').default(false),
});
