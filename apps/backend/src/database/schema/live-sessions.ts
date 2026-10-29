import { pgTable, uuid, varchar, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { courses } from './courses';
import { series } from './courses';

export const LIVE_SESSION_STATUSES = ['draft', 'scheduled', 'live', 'completed', 'cancelled'] as const;
export type LiveSessionStatus = (typeof LIVE_SESSION_STATUSES)[number];

export const liveSessions = pgTable('live_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  courseId: uuid('course_id').references(() => courses.id).notNull(),
  seriesId: uuid('series_id').references(() => series.id),
  title: varchar('title', { length: 300 }).notNull(),
  description: text('description'),
  startsAt: timestamp('starts_at').notNull(),
  endsAt: timestamp('ends_at').notNull(),
  timezone: varchar('timezone', { length: 64 }).default('UTC').notNull(),
  meetUrl: varchar('meet_url', { length: 500 }),
  meetProvider: varchar('meet_provider', { length: 30 }).default('google_meet').notNull(),
  calendarEventId: varchar('calendar_event_id', { length: 200 }),
  status: varchar('status', { length: 20 }).default('draft').notNull(),
  capacity: integer('capacity'),
  createdById: uuid('created_by_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  courseStartIdx: index('live_sessions_course_start_idx').on(table.tenantId, table.courseId, table.startsAt),
  statusStartIdx: index('live_sessions_status_start_idx').on(table.tenantId, table.status, table.startsAt),
}));

export type LiveSession = typeof liveSessions.$inferSelect;
export type NewLiveSession = typeof liveSessions.$inferInsert;
