import { pgTable, uuid, varchar, boolean, integer, timestamp, jsonb, uniqueIndex, index } from 'drizzle-orm/pg-core';
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

export const lessonQuizAttempts = pgTable('lesson_quiz_attempts', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  lessonId: uuid('lesson_id').references(() => lessons.id, { onDelete: 'cascade' }).notNull(),
  quizId: varchar('quiz_id', { length: 100 }).notNull(),
  answers: jsonb('answers').$type<Record<string, string | string[]>>().notNull(),
  score: integer('score').notNull(),
  passed: boolean('passed').notNull(),
  attemptNumber: integer('attempt_number').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  tenantUserLessonQuizAttemptIdx: uniqueIndex('lesson_quiz_attempts_tenant_user_lesson_quiz_attempt_idx').on(table.tenantId, table.userId, table.lessonId, table.quizId, table.attemptNumber),
  tenantUserLessonIdx: index('lesson_quiz_attempts_tenant_user_lesson_idx').on(table.tenantId, table.userId, table.lessonId),
  tenantLessonQuizIdx: index('lesson_quiz_attempts_tenant_lesson_quiz_idx').on(table.tenantId, table.lessonId, table.quizId),
  createdAtIdx: index('lesson_quiz_attempts_created_at_idx').on(table.createdAt),
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
