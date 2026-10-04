CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS "ai_provider_configs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "provider" varchar(64) DEFAULT 'openai-compatible' NOT NULL,
  "base_url" varchar(500) DEFAULT 'https://api.openai.com/v1' NOT NULL,
  "encrypted_api_key" text,
  "api_key_version" integer DEFAULT 1 NOT NULL,
  "primary_model" varchar(200) DEFAULT 'gpt-4o-mini' NOT NULL,
  "fallback_model" varchar(200),
  "enabled" boolean DEFAULT false NOT NULL,
  "public_enabled" boolean DEFAULT false NOT NULL,
  "retrieval_top_k" integer DEFAULT 8 NOT NULL,
  "retrieval_min_score" real DEFAULT 0.2 NOT NULL,
  "max_context_chars" integer DEFAULT 12000 NOT NULL,
  "system_style" text,
  "timeout_ms" integer DEFAULT 15000 NOT NULL,
  "max_tokens" integer DEFAULT 800 NOT NULL,
  "temperature" real DEFAULT 0.2 NOT NULL,
  "embedding_model" varchar(200),
  "embedding_base_url" varchar(500),
  "status" varchar(30) DEFAULT 'disabled' NOT NULL,
  "last_tested_at" timestamp,
  "last_error_code" varchar(80),
  "last_indexed_at" timestamp,
  "last_index_documents" integer DEFAULT 0 NOT NULL,
  "last_index_chunks" integer DEFAULT 0 NOT NULL,
  "last_index_embedded_chunks" integer DEFAULT 0 NOT NULL,
  "last_index_error" varchar(500),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "ai_provider_configs_top_k_check" CHECK ("retrieval_top_k" BETWEEN 1 AND 50),
  CONSTRAINT "ai_provider_configs_min_score_check" CHECK ("retrieval_min_score" BETWEEN 0 AND 1),
  CONSTRAINT "ai_provider_configs_context_check" CHECK ("max_context_chars" BETWEEN 1000 AND 100000),
  CONSTRAINT "ai_provider_configs_timeout_check" CHECK ("timeout_ms" BETWEEN 1000 AND 120000),
  CONSTRAINT "ai_provider_configs_tokens_check" CHECK ("max_tokens" BETWEEN 1 AND 8000),
  CONSTRAINT "ai_provider_configs_temperature_check" CHECK ("temperature" BETWEEN 0 AND 2)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ai_provider_configs_tenant_unique" ON "ai_provider_configs" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_provider_configs_status_idx" ON "ai_provider_configs" ("tenant_id", "status");
--> statement-breakpoint
ALTER TABLE "ai_provider_configs" ADD COLUMN IF NOT EXISTS "last_indexed_at" timestamp;
--> statement-breakpoint
ALTER TABLE "ai_provider_configs" ADD COLUMN IF NOT EXISTS "last_index_documents" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "ai_provider_configs" ADD COLUMN IF NOT EXISTS "last_index_chunks" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "ai_provider_configs" ADD COLUMN IF NOT EXISTS "last_index_embedded_chunks" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "ai_provider_configs" ADD COLUMN IF NOT EXISTS "last_index_error" varchar(500);

CREATE TABLE IF NOT EXISTS "ai_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "source_type" varchar(80) NOT NULL,
  "source_id" varchar(255) NOT NULL,
  "title" varchar(500) NOT NULL,
  "href" varchar(1000) NOT NULL,
  "content" text NOT NULL,
  "audience" varchar(20) DEFAULT 'public' NOT NULL,
  "course_id" uuid,
  "lesson_id" uuid,
  "permission_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "source_updated_at" timestamp DEFAULT now() NOT NULL,
  "content_hash" varchar(128) NOT NULL,
  "status" varchar(30) DEFAULT 'active' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "ai_documents_audience_check" CHECK ("audience" IN ('public', 'free-preview', 'enrolled', 'admin')),
  CONSTRAINT "ai_documents_source_unique_check" UNIQUE ("tenant_id", "source_type", "source_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_documents_tenant_status_idx" ON "ai_documents" ("tenant_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_documents_permission_idx" ON "ai_documents" ("tenant_id", "audience", "course_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_documents_source_updated_idx" ON "ai_documents" ("tenant_id", "source_updated_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_documents_content_search_idx" ON "ai_documents" USING gin (to_tsvector('simple', coalesce("content", '')));

CREATE TABLE IF NOT EXISTS "ai_document_chunks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "document_id" uuid NOT NULL REFERENCES "ai_documents"("id") ON DELETE CASCADE,
  "chunk_index" integer NOT NULL,
  "content" text NOT NULL,
  "audience" varchar(20) DEFAULT 'public' NOT NULL,
  "source_type" varchar(80) NOT NULL,
  "source_id" varchar(255) NOT NULL,
  "title" varchar(500) NOT NULL,
  "href" varchar(1000) NOT NULL,
  "course_id" uuid,
  "lesson_id" uuid,
  "permission_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "source_updated_at" timestamp DEFAULT now() NOT NULL,
  "embedding" jsonb,
  "embedding_model" varchar(200),
  "embedding_updated_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "ai_document_chunks_index_check" CHECK ("chunk_index" >= 0),
  CONSTRAINT "ai_document_chunks_audience_check" CHECK ("audience" IN ('public', 'free-preview', 'enrolled', 'admin')),
  CONSTRAINT "ai_document_chunks_document_index_unique" UNIQUE ("document_id", "chunk_index")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_document_chunks_tenant_audience_idx" ON "ai_document_chunks" ("tenant_id", "audience");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_document_chunks_tenant_course_idx" ON "ai_document_chunks" ("tenant_id", "course_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_document_chunks_embedding_idx" ON "ai_document_chunks" ("tenant_id", "embedding_model");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_document_chunks_content_search_idx" ON "ai_document_chunks" USING gin (to_tsvector('simple', coalesce("content", '')));

CREATE TABLE IF NOT EXISTS "ai_usage_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "request_id" varchar(100) NOT NULL,
  "operation" varchar(50) NOT NULL,
  "provider" varchar(64),
  "model" varchar(200),
  "input_tokens" integer DEFAULT 0 NOT NULL,
  "output_tokens" integer DEFAULT 0 NOT NULL,
  "total_tokens" integer DEFAULT 0 NOT NULL,
  "latency_ms" integer DEFAULT 0 NOT NULL,
  "retrieved_chunk_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "status" varchar(30) NOT NULL,
  "error_code" varchar(80),
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_usage_logs_tenant_created_idx" ON "ai_usage_logs" ("tenant_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_usage_logs_user_created_idx" ON "ai_usage_logs" ("user_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_usage_logs_status_idx" ON "ai_usage_logs" ("tenant_id", "status");

CREATE TABLE IF NOT EXISTS "ai_audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "action" varchar(100) NOT NULL,
  "entity_type" varchar(100),
  "entity_id" varchar(255),
  "outcome" varchar(30) NOT NULL,
  "details" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "ip" varchar(45),
  "user_agent" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_audit_logs_tenant_created_idx" ON "ai_audit_logs" ("tenant_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_audit_logs_action_idx" ON "ai_audit_logs" ("tenant_id", "action");
