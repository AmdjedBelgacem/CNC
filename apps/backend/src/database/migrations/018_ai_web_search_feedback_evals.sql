-- Web search, feedback and evals: the assistant's measurable learning loop.
-- Idempotent so it can be applied to databases that were schema-pushed.

CREATE TABLE IF NOT EXISTS "ai_web_search_configs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "provider" varchar(32) NOT NULL DEFAULT 'none',
  "encrypted_api_key" text,
  "api_key_version" integer NOT NULL DEFAULT 1,
  "enabled" boolean NOT NULL DEFAULT false,
  "max_results" integer NOT NULL DEFAULT 5,
  "timeout_ms" integer NOT NULL DEFAULT 8000,
  "allowed_domains" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "allowed_modes" jsonb NOT NULL DEFAULT '["fact_check"]'::jsonb,
  "cache_ttl_seconds" integer NOT NULL DEFAULT 3600,
  "status" varchar(30) NOT NULL DEFAULT 'disabled',
  "last_tested_at" timestamp,
  "last_error_code" varchar(80)
);
CREATE UNIQUE INDEX IF NOT EXISTS "ai_web_search_configs_tenant_unique"
  ON "ai_web_search_configs" ("tenant_id");

CREATE TABLE IF NOT EXISTS "ai_web_search_cache" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "provider" varchar(32) NOT NULL,
  "query_hash" varchar(64) NOT NULL,
  "query" text NOT NULL,
  "results" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "result_count" integer NOT NULL DEFAULT 0,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "ai_web_search_cache_lookup_unique"
  ON "ai_web_search_cache" ("tenant_id", "provider", "query_hash");
CREATE INDEX IF NOT EXISTS "ai_web_search_cache_expiry_idx"
  ON "ai_web_search_cache" ("expires_at");

CREATE TABLE IF NOT EXISTS "ai_feedback" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "conversation_id" uuid NOT NULL REFERENCES "ai_conversations"("id") ON DELETE CASCADE,
  "message_id" uuid NOT NULL REFERENCES "ai_messages"("id") ON DELETE CASCADE,
  "rating" integer NOT NULL,
  "reason" varchar(200),
  "mode" varchar(32),
  "used_web" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
-- One vote per member per answer; a re-vote updates in place.
CREATE UNIQUE INDEX IF NOT EXISTS "ai_feedback_voter_unique"
  ON "ai_feedback" ("message_id", "user_id");
CREATE INDEX IF NOT EXISTS "ai_feedback_tenant_rating_idx"
  ON "ai_feedback" ("tenant_id", "rating");
CREATE INDEX IF NOT EXISTS "ai_feedback_conversation_idx"
  ON "ai_feedback" ("conversation_id");

CREATE TABLE IF NOT EXISTS "ai_eval_cases" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "slug" varchar(120) NOT NULL,
  "question" text NOT NULL,
  "mode" varchar(32) NOT NULL DEFAULT 'general',
  "expect_keywords" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "forbid_keywords" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "min_citations" integer NOT NULL DEFAULT 0,
  "expect_refusal" boolean NOT NULL DEFAULT false,
  "expect_web" boolean NOT NULL DEFAULT false,
  "source_ref" jsonb,
  "enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "ai_eval_cases_tenant_slug_unique"
  ON "ai_eval_cases" ("tenant_id", "slug");
CREATE INDEX IF NOT EXISTS "ai_eval_cases_enabled_idx"
  ON "ai_eval_cases" ("tenant_id", "enabled");

CREATE TABLE IF NOT EXISTS "ai_eval_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "label" varchar(120) NOT NULL,
  "model" varchar(200),
  "prompt_version" varchar(40),
  "web_enabled" boolean NOT NULL DEFAULT false,
  "total_cases" integer NOT NULL DEFAULT 0,
  "passed_cases" integer NOT NULL DEFAULT 0,
  "score" real NOT NULL DEFAULT 0,
  "citation_coverage" real NOT NULL DEFAULT 0,
  "groundedness" real NOT NULL DEFAULT 0,
  "refusal_accuracy" real NOT NULL DEFAULT 0,
  "avg_latency_ms" integer NOT NULL DEFAULT 0,
  "details" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "ai_eval_runs_tenant_created_idx"
  ON "ai_eval_runs" ("tenant_id", "created_at");

-- Stamped on every answer so an eval run and live traffic are comparable.
ALTER TABLE "ai_messages" ADD COLUMN IF NOT EXISTS "prompt_version" varchar(40) DEFAULT 'v1' NOT NULL;
