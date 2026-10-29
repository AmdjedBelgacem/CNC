-- 043: Live sessions.
--
-- Live teaching runs on Google Meet; recorded video stays on Mux. A live session
-- belongs to a course (optionally to one series within it), carries its own
-- schedule and the Meet URL an enrolled learner can open only inside the join
-- window. `status` is a plain varchar like every other lifecycle column in this
-- schema (draft | scheduled | live | completed | cancelled) — no Postgres enum,
-- so a new state never needs a migration.
CREATE TABLE IF NOT EXISTS "live_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "course_id" uuid NOT NULL REFERENCES "courses"("id"),
  "series_id" uuid REFERENCES "series"("id"),
  "title" varchar(300) NOT NULL,
  "description" text,
  "starts_at" timestamp NOT NULL,
  "ends_at" timestamp NOT NULL,
  "timezone" varchar(64) DEFAULT 'UTC' NOT NULL,
  "meet_url" varchar(500),
  "meet_provider" varchar(30) DEFAULT 'google_meet' NOT NULL,
  "calendar_event_id" varchar(200),
  "status" varchar(20) DEFAULT 'draft' NOT NULL,
  "capacity" integer,
  "created_by_id" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "live_sessions_course_start_idx"
  ON "live_sessions" ("tenant_id", "course_id", "starts_at");
CREATE INDEX IF NOT EXISTS "live_sessions_status_start_idx"
  ON "live_sessions" ("tenant_id", "status", "starts_at");

COMMENT ON COLUMN "live_sessions"."meet_url" IS
  'Google Meet URL (https://meet.google.com/...). Never returned to non-enrolled learners; join endpoint gates on enrollment + time window.';
