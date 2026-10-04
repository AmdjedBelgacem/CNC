-- 024: page lifecycle — create / delete / disable, plus SEO and nav hints
--
-- The builder could only ever edit a fixed list of seeded slugs, and `status`
-- had no way to say "this page exists but should not be reachable". A `disabled`
-- page keeps its slug, its version history and its nav entries, but stops being
-- served and stops being offered as a navigation target.

ALTER TABLE "pages"
  ADD COLUMN IF NOT EXISTS "is_system" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "show_in_nav" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "seo_title" varchar(255),
  ADD COLUMN IF NOT EXISTS "seo_description" varchar(500),
  ADD COLUMN IF NOT EXISTS "template" varchar(50);

COMMENT ON COLUMN "pages"."is_system" IS 'Seeded page (home, about, …). Cannot be deleted; only disabled.';
COMMENT ON COLUMN "pages"."show_in_nav" IS 'Offer this page as a navigation target when building a nav tree.';
COMMENT ON COLUMN "pages"."seo_title" IS 'Overrides <title> when set; falls back to the page title.';
COMMENT ON COLUMN "pages"."seo_description" IS 'Overrides the meta description when set.';
COMMENT ON COLUMN "pages"."template" IS 'Layout template the page was created from: blank | landing | content';

-- A disabled page is a normal row; only the public read path cares, and it now
-- filters on this. The index keeps the admin list cheap on large tenants.
CREATE INDEX IF NOT EXISTS pages_tenant_status_idx ON "pages" (tenant_id, status);

-- The seeded slugs are the system pages. Backfilled from the known list so an
-- existing installation protects them from the delete endpoint immediately.
UPDATE "pages"
SET "is_system" = true
WHERE "slug" IN (
  'home', 'academy-landing', 'products', 'feed', 'events', 'about',
  'privacy', 'refunds', 'terms', 'edu-purchases'
);

-- The home page is the tenant's front door: it exists, it is public, and it is
-- not something an admin can quietly take offline.
UPDATE "pages" SET "show_in_nav" = false, "is_system" = true WHERE "slug" = 'home';
