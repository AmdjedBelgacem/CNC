import { pgTable, uuid, varchar, text, boolean, integer, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { users } from './users';

export const events = pgTable('events', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  title: varchar('title', { length: 300 }).notNull(),
  slug: varchar('slug', { length: 200 }).notNull(),
  description: text('description'),
  eventType: varchar('event_type', { length: 50 }).default('workshop'),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date'),
  location: jsonb('location'),
  isVirtual: boolean('is_virtual').default(false),
  maxAttendees: integer('max_attendees'),
  price: integer('price'),
  thumbnailUrl: varchar('thumbnail_url', { length: 500 }),
  isPublished: boolean('is_published').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const eventAttendees = pgTable('event_attendees', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').references(() => events.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  status: varchar('status', { length: 50 }).default('registered'),
  registeredAt: timestamp('registered_at').defaultNow().notNull(),
});
