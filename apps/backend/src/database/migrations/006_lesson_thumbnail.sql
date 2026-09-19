-- 006_lesson_thumbnail.sql — add thumbnail image to lessons

ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "thumbnail_url" varchar(500);