-- 005_academy_seo_image.sql — add SEO image for academies (upload-only, no external URLs)
-- Branding (hero/logo) already exists as hero_image_url/logo_url but must now be upload-only.
-- SEO image (og:image) is new for social/search previews.

ALTER TABLE "academies" ADD COLUMN IF NOT EXISTS "seo_image_url" varchar(500);
