-- 027_cert_academy_scope.sql
--
-- Certificate system: academy scope + real rendered artifacts.
--
-- Additive and backfill-safe. Every statement is either ADD COLUMN with a
-- default, a backfill UPDATE, or a new constraint/index, so this runs against a
-- live database without a table rewrite and without invalidating existing
-- certificate rows.
--
-- Why `certifications.course_id` stays NOT NULL: every award in this product is
-- earned by completing a course. `academy_id` records which academy the award
-- belongs to (for academy-scoped templates); it does not replace the course
-- link. Making course_id nullable would require dropping a NOT NULL on a table
-- that already holds audit data, for a case the product does not have.

-- ---------------------------------------------------------------------------
-- 1. Template scope
-- ---------------------------------------------------------------------------

ALTER TABLE "cert_templates" ADD COLUMN IF NOT EXISTS "scope_type" varchar(20) DEFAULT 'tenant' NOT NULL;
ALTER TABLE "cert_templates" ADD COLUMN IF NOT EXISTS "academy_id" uuid;

-- Backfill: a template that already points at a course is a course-scoped
-- template; everything else is the tenant default. Runs before the CHECK so the
-- constraint sees consistent data.
UPDATE "cert_templates"
SET "scope_type" = CASE
  WHEN "course_id" IS NOT NULL THEN 'course'
  ELSE 'tenant'
END
WHERE "scope_type" IS DISTINCT FROM (CASE WHEN "course_id" IS NOT NULL THEN 'course' ELSE 'tenant' END);

-- Academy-scoped templates resolve by academy, so the pair must be coherent.
ALTER TABLE "cert_templates" DROP CONSTRAINT IF EXISTS "cert_templates_scope_check";
ALTER TABLE "cert_templates" ADD CONSTRAINT "cert_templates_scope_check" CHECK (
  ("scope_type" = 'course'  AND "course_id" IS NOT NULL AND "academy_id" IS NULL) OR
  ("scope_type" = 'academy' AND "academy_id" IS NOT NULL AND "course_id" IS NULL) OR
  ("scope_type" = 'tenant'  AND "course_id" IS NULL     AND "academy_id" IS NULL)
);

CREATE INDEX IF NOT EXISTS "cert_templates_tenant_academy_idx"
  ON "cert_templates" USING btree ("tenant_id","academy_id");

ALTER TABLE "cert_templates" DROP CONSTRAINT IF EXISTS "cert_templates_academy_id_academies_id_fk";
ALTER TABLE "cert_templates" ADD CONSTRAINT "cert_templates_academy_id_academies_id_fk"
  FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE cascade ON UPDATE no action;

-- ---------------------------------------------------------------------------
-- 2. Issued certificates
-- ---------------------------------------------------------------------------

ALTER TABLE "certifications" ADD COLUMN IF NOT EXISTS "academy_id" uuid;
-- Immutable snapshot of the variable values rendered onto the PDF. Null for
-- historical rows issued before the renderer existed.
ALTER TABLE "certifications" ADD COLUMN IF NOT EXISTS "payload" jsonb;
ALTER TABLE "certifications" ADD COLUMN IF NOT EXISTS "pdf_storage_key" varchar(500);
ALTER TABLE "certifications" ADD COLUMN IF NOT EXISTS "source" varchar(20) DEFAULT 'automatic' NOT NULL;

-- Historical rows predate the explicit source column; the service wrote
-- `source` into metadata before this column existed.
UPDATE "certifications"
SET "source" = COALESCE("metadata"->>'source', 'manual')
WHERE "source" = 'automatic'
  AND "metadata" IS NOT NULL
  AND "metadata" ? 'source'
  AND "metadata"->>'source' IS DISTINCT FROM 'automatic';

CREATE INDEX IF NOT EXISTS "certifications_tenant_user_course_idx"
  ON "certifications" USING btree ("tenant_id","user_id","course_id");

ALTER TABLE "certifications" DROP CONSTRAINT IF EXISTS "certifications_academy_id_academies_id_fk";
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_academy_id_academies_id_fk"
  FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE no action ON UPDATE no action;

-- Idempotency at the database level. `tryAutoIssue` is called from two
-- independent code paths (lesson progress and course completion) and can race,
-- so application-level checks alone are not enough: without this, two concurrent
-- completions could both pass the "already exists?" read and insert twice.
-- Partial, so a revoked certificate does not block re-award.
CREATE UNIQUE INDEX IF NOT EXISTS "certifications_active_award_unique"
  ON "certifications" USING btree ("tenant_id","user_id","course_id")
  WHERE "revoked_at" IS NULL;
