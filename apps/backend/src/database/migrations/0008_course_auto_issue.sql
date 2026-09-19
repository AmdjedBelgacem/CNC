ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "auto_issue_certificate" boolean DEFAULT true NOT NULL;
