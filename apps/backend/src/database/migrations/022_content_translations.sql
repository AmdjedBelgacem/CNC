-- 022: Arabic content for academies, products and events
--
-- Courses, series and lessons already carry a `translations` jsonb column and a
-- locale resolver in CoursesService. Academies, products and events had no
-- equivalent, so an Arabic visitor got the English row with no way for an author
-- to fix it. This adds the same shape, and the same resolver is then applied to
-- those three read paths.
--
-- The shape matches CourseContentTranslation: a flat object per locale holding
-- only human-readable text. Anything that is a value rather than copy (price,
-- capacity, dates, slugs, image URLs) stays in the base columns and is never
-- translated, because translating it would corrupt the data.

ALTER TABLE "academies"
  ADD COLUMN IF NOT EXISTS "translations" jsonb;

ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "translations" jsonb;

ALTER TABLE "events"
  ADD COLUMN IF NOT EXISTS "translations" jsonb;

-- A GIN index so a search across Arabic copy does not scan the whole table.
CREATE INDEX IF NOT EXISTS "academies_translations_gin"
  ON "academies" USING gin ("translations" jsonb_path_ops);

CREATE INDEX IF NOT EXISTS "products_translations_gin"
  ON "products" USING gin ("translations" jsonb_path_ops);

CREATE INDEX IF NOT EXISTS "events_translations_gin"
  ON "events" USING gin ("translations" jsonb_path_ops);

COMMENT ON COLUMN "academies"."translations" IS 'Per-locale copy: {"ar":{"title":…,"description":…,"seoTitle":…,"seoDescription":…}}';
COMMENT ON COLUMN "products"."translations" IS 'Per-locale copy: {"ar":{"title":…,"description":…,"tagline":…,"features":[…]}}';
COMMENT ON COLUMN "events"."translations" IS 'Per-locale copy: {"ar":{"title":…,"description":…,"location":…}}';
