import { pgTable, uuid, varchar, boolean, integer, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users';
import { courses } from './courses';
import { lessons } from './courses';
import { tenants } from './tenants';

export const enrollments = pgTable('enrollments', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  courseId: uuid('course_id').references(() => courses.id).notNull(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  status: varchar('status', { length: 50 }).default('active'),
  startedAt: timestamp('started_at').defaultNow(),
  completedAt: timestamp('completed_at'),
  certificateId: uuid('certificate_id'),
}, (table) => ({
  userCourseIdx: uniqueIndex('user_course_idx').on(table.userId, table.courseId),
}));

export const lessonProgress = pgTable('lesson_progress', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  lessonId: uuid('lesson_id').references(() => lessons.id).notNull(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  completed: boolean('completed').default(false),
  watchTimeSeconds: integer('watch_time_seconds').default(0),
  quizScore: integer('quiz_score'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userLessonIdx: uniqueIndex('user_lesson_idx').on(table.userId, table.lessonId),
}));
