-- 007_user_theme_tokens.sql — per-user design tokens (colors, fonts, radius)

ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "theme_tokens" jsonb;
