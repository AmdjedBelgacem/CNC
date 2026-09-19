ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "price_cents" integer;
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "currency" varchar(8) DEFAULT 'USD' NOT NULL;
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "access_mode" varchar(20) DEFAULT 'open' NOT NULL;
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "trailer_url" varchar(500);
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "seo_title" varchar(300);
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "seo_description" text;
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "seo_keywords" varchar(300);
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "og_image_url" varchar(500);
