-- 004_academies.sql — hand-written, idempotent (IF NOT EXISTS), not tracked in meta/_journal.json.
-- Introduces academies as a first-class entity above courses. Additive only:
-- new table + nullable courses.academy_id FK (ON DELETE SET NULL). Rollback:
--   ALTER TABLE "courses" DROP COLUMN IF EXISTS "academy_id";
--   DROP TABLE IF EXISTS "academies";

CREATE TABLE IF NOT EXISTS "academies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "slug" varchar(200) NOT NULL,
  "title" varchar(300) NOT NULL,
  "subtitle" varchar(500),
  "description" text,
  "hero_image_url" varchar(500),
  "logo_url" varchar(500),
  "accent_color" varchar(7),
  "seo_title" varchar(300),
  "seo_description" varchar(500),
  "is_published" boolean DEFAULT false NOT NULL,
  "is_archived" boolean DEFAULT false NOT NULL,
  "published_at" timestamp,
  "archived_at" timestamp,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "academies_tenant_slug_unique" ON "academies" ("tenant_id", "slug");
CREATE INDEX IF NOT EXISTS "academies_tenant_published_idx" ON "academies" ("tenant_id", "is_published", "sort_order");

ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "academy_id" uuid REFERENCES "academies"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "courses_academy_idx" ON "courses" ("tenant_id", "academy_id", "is_published", "sort_order");
