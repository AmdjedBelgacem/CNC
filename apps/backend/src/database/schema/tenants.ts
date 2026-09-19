import { pgTable, uuid, varchar, boolean, jsonb, timestamp, text } from 'drizzle-orm/pg-core';

export const tenants = pgTable('tenants', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: varchar('slug', { length: 100 }).unique().notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  logoUrl: varchar('logo_url', { length: 500 }),
  faviconUrl: varchar('favicon_url', { length: 500 }),
  primaryColor: varchar('primary_color', { length: 7 }).default('#7c3aed').notNull(),
  secondaryColor: varchar('secondary_color', { length: 7 }).default('#0a1628').notNull(),
  accentColor: varchar('accent_color', { length: 7 }).default('#ff6b35').notNull(),
  fontFamily: varchar('font_family', { length: 255 }),
  isActive: boolean('is_active').default(true).notNull(),
  domain: varchar('domain', { length: 255 }),
  settings: jsonb('settings').$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
