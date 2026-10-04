-- 031: reconcile `products` with the Drizzle schema.
--
-- products.academy_id, course_id, is_archived, seo_title, seo_description, status
-- and track_inventory existed only in the live database because it was created with
-- `drizzle-kit push`, which writes the schema straight from the TypeScript without
-- recording a migration. No .sql file ever added them, so replaying the journal into
-- an empty database produced a products table missing all seven — which would have
-- silently broken the store and checkout on a managed database.
--
-- Definitions are copied verbatim from the live schema so this is a no-op on any
-- database that already has them; the IF NOT EXISTS guards make it safe to apply
-- to both push-created and fully-migrated databases.

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "academy_id" uuid;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "course_id" uuid;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "is_archived" boolean DEFAULT false;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "seo_title" varchar(200);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "seo_description" varchar(500);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "status" varchar(20) DEFAULT 'draft';
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "track_inventory" boolean DEFAULT true;

CREATE INDEX IF NOT EXISTS "prod_academy_idx" ON "products" USING btree ("academy_id");
CREATE INDEX IF NOT EXISTS "prod_course_idx" ON "products" USING btree ("course_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_academy_id_fkey'
  ) THEN
    ALTER TABLE "products"
      ADD CONSTRAINT "products_academy_id_fkey"
      FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id")
      ON DELETE set null ON UPDATE no action;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_course_id_fkey'
  ) THEN
    ALTER TABLE "products"
      ADD CONSTRAINT "products_course_id_fkey"
      FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id")
      ON DELETE set null ON UPDATE no action;
  END IF;
END $$;