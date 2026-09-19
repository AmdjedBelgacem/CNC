import { pgTable, uuid, varchar, text, boolean, integer } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

export const sponsors = pgTable('sponsors', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  logoUrl: varchar('logo_url', { length: 500 }),
  websiteUrl: varchar('website_url', { length: 500 }),
  tier: varchar('tier', { length: 50 }).default('bronze'),
  sortOrder: integer('sort_order').default(0),
  isActive: boolean('is_active').default(true),
});
