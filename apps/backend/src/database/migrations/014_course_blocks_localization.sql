ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "translations" jsonb;
--> statement-breakpoint
ALTER TABLE "series" ADD COLUMN IF NOT EXISTS "translations" jsonb;
--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "translations" jsonb;
--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "content_blocks" jsonb;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lesson_quiz_attempts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "lesson_id" uuid NOT NULL REFERENCES "lessons"("id") ON DELETE CASCADE,
  "quiz_id" varchar(100) NOT NULL,
  "answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "score" integer NOT NULL,
  "passed" boolean NOT NULL,
  "attempt_number" integer NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lesson_quiz_attempts" ADD COLUMN IF NOT EXISTS "tenant_id" uuid;
--> statement-breakpoint
ALTER TABLE "lesson_quiz_attempts" ADD COLUMN IF NOT EXISTS "user_id" uuid;
--> statement-breakpoint
ALTER TABLE "lesson_quiz_attempts" ADD COLUMN IF NOT EXISTS "lesson_id" uuid;
--> statement-breakpoint
ALTER TABLE "lesson_quiz_attempts" ADD COLUMN IF NOT EXISTS "quiz_id" varchar(100);
--> statement-breakpoint
ALTER TABLE "lesson_quiz_attempts" ADD COLUMN IF NOT EXISTS "answers" jsonb DEFAULT '{}'::jsonb;
--> statement-breakpoint
ALTER TABLE "lesson_quiz_attempts" ADD COLUMN IF NOT EXISTS "score" integer;
--> statement-breakpoint
ALTER TABLE "lesson_quiz_attempts" ADD COLUMN IF NOT EXISTS "passed" boolean;
--> statement-breakpoint
ALTER TABLE "lesson_quiz_attempts" ADD COLUMN IF NOT EXISTS "attempt_number" integer;
--> statement-breakpoint
ALTER TABLE "lesson_quiz_attempts" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();
--> statement-breakpoint
ALTER TABLE "lesson_quiz_attempts" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "lesson_quiz_attempts_tenant_user_lesson_quiz_attempt_idx" ON "lesson_quiz_attempts" ("tenant_id", "user_id", "lesson_id", "quiz_id", "attempt_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lesson_quiz_attempts_tenant_user_lesson_idx" ON "lesson_quiz_attempts" ("tenant_id", "user_id", "lesson_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lesson_quiz_attempts_tenant_lesson_quiz_idx" ON "lesson_quiz_attempts" ("tenant_id", "lesson_id", "quiz_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lesson_quiz_attempts_created_at_idx" ON "lesson_quiz_attempts" ("created_at");