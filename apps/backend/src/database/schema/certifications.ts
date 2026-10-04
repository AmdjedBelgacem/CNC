import { pgTable, uuid, varchar, text, timestamp, jsonb, boolean, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { users } from './users';
import { courses } from './courses';
import { academies } from './academies';

export const certifications = pgTable('certifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  /**
   * The completed course that triggered the award. Kept NOT NULL because every
   * award in this product is earned by finishing a course; `academyId` records
   * the awarding academy for academy-scoped templates, it does not replace the
   * course link.
   */
  courseId: uuid('course_id').references(() => courses.id).notNull(),
  /** Awarding academy, when the template that produced this cert is academy-scoped. */
  academyId: uuid('academy_id').references(() => academies.id),
  templateId: uuid('template_id'),
  certificateNumber: varchar('certificate_number', { length: 50 }).unique().notNull(),
  issuedAt: timestamp('issued_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  /**
   * Immutable snapshot of the variable values that were rendered onto the PDF.
   * Written once at issue time so a later template edit cannot rewrite history.
   */
  payload: jsonb('payload').$type<{
    templateId: string | null;
    variables: Record<string, string>;
    fields: { key: string; label: string; value: string; x: number; y: number; fontSize: number; fontWeight: string; color: string }[];
    layout: string;
    primaryColor: string;
    secondaryColor: string;
    fontFamily: string;
    usedDefaultLayout: boolean;
    renderedAt: string;
  }>(),
  /** Storage object key. `pdfUrl` remains for backwards compatibility. */
  pdfStorageKey: varchar('pdf_storage_key', { length: 500 }),
  pdfUrl: varchar('pdf_url', { length: 500 }),
  digitalSignature: text('digital_signature'),
  /** 'automatic' (course completion) or 'manual' (admin override). */
  source: varchar('source', { length: 20 }).default('automatic').notNull(),
  revokedAt: timestamp('revoked_at'),
  revokedReason: varchar('revoked_reason', { length: 500 }),
}, (t) => ({
  tenantUserCourseIdx: index('certifications_tenant_user_course_idx').on(t.tenantId, t.userId, t.courseId),
}));

export const certTemplates = pgTable('cert_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  /**
   * Which level a template applies to. `course` and `academy` templates are
   * bound to exactly one entity; `tenant` templates are the fallback default.
   */
  scopeType: varchar('scope_type', { length: 20 }).default('tenant').notNull(),
  // onDelete matches 0007_cert_templates_course_id.sql. Omitting it left the schema
  // and the migration disagreeing, so `push` and `migrate` produced different FKs.
  courseId: uuid('course_id').references(() => courses.id, { onDelete: 'set null' }),
  academyId: uuid('academy_id').references(() => academies.id),
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
  tenantAcademyIdx: index('cert_templates_tenant_academy_idx').on(t.tenantId, t.academyId),
}));
