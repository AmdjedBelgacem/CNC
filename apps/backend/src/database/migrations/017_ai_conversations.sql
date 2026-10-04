-- Persistent AI assistant conversations.
CREATE TABLE IF NOT EXISTS "ai_conversations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" varchar(200),
  "source" varchar(32) NOT NULL DEFAULT 'general',
  "source_ref" jsonb,
  "status" varchar(16) NOT NULL DEFAULT 'active',
  "last_message_at" timestamp NOT NULL DEFAULT now(),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversation_id" uuid NOT NULL REFERENCES "ai_conversations"("id") ON DELETE CASCADE,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role" varchar(16) NOT NULL,
  "content" text NOT NULL,
  "citations" jsonb,
  "meta" jsonb,
  "created_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_conversations_user_last_message_idx" ON "ai_conversations" ("user_id", "last_message_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_conversations_tenant_idx" ON "ai_conversations" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_conversations_status_idx" ON "ai_conversations" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_messages_conversation_created_idx" ON "ai_messages" ("conversation_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_messages_tenant_idx" ON "ai_messages" ("tenant_id");
