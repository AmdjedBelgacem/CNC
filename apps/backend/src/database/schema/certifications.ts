import { pgTable, uuid, varchar, text, timestamp, jsonb, boolean, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { users } from './users';
import { courses } from './courses';

export const certifications = pgTable('certifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  courseId: uuid('course_id').references(() => courses.id).notNull(),
  templateId: uuid('template_id'),
  certificateNumber: varchar('certificate_number', { length: 50 }).unique().notNull(),
  issuedAt: timestamp('issued_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  pdfUrl: varchar('pdf_url', { length: 500 }),
  digitalSignature: text('digital_signature'),
  revokedAt: timestamp('revoked_at'),
  revokedReason: varchar('revoked_reason', { length: 500 }),
});

export const certTemplates = pgTable('cert_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  courseId: uuid('course_id').references(() => courses.id),
  name: varchar('name', { length: 255 }).notNull(),
  layout: varchar('layout', { length: 50 }).default('modern'),
  primaryColor: varchar('primary_color', { length: 7 }).default('#7c3aed'),
  secondaryColor: varchar('secondary_color', { length: 7 }).default('#0a1628'),
  logoUrl: varchar('logo_url', { length: 500 }),
  backgroundUrl: varchar('background_url', { length: 500 }),
  fontFamily: varchar('font_family', { length: 255 }).default('Inter'),
  fields: jsonb('fields').$type<{ key: string; label: string; x: number; y: number; fontSize: number; fontWeight: string; color: string }[]>().default([]),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  tenantActiveIdx: index('cert_templates_tenant_active_idx').on(t.tenantId, t.isActive),
  tenantCourseIdx: index('cert_templates_tenant_course_idx').on(t.tenantId, t.courseId),
}));
