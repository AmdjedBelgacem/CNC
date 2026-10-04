-- Unified order abstraction for Moyasar, plus per-tenant gateway config and
-- platform-level Google connections.
-- Idempotent: the database may have been created with drizzle-kit push.

-- ---------------------------------------------------------------------------
-- 1. Orders: gateway-neutral payment identity.
-- ---------------------------------------------------------------------------
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "provider" varchar(32) NOT NULL DEFAULT 'moyasar';
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "provider_payment_id" varchar(255);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "provider_payload" jsonb;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "idempotency_key" varchar(120);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "paid_at" timestamp;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "refunded_at" timestamp;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "canceled_at" timestamp;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "failure_reason" varchar(255);
--> statement-breakpoint
-- SAR unless a tenant says otherwise; halalas are the smallest unit.
ALTER TABLE "orders" ALTER COLUMN "currency" SET DEFAULT 'SAR';
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "orders_tenant_idempotency_unique"
  ON "orders" ("tenant_id", "idempotency_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_provider_idx" ON "orders" ("provider_payment_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_status_idx" ON "orders" ("tenant_id", "status");

-- ---------------------------------------------------------------------------
-- 2. Order lines: what is being sold, and whether it has been fulfilled.
--    Fulfillment is tracked per line so a duplicate webhook cannot double-enroll.
-- ---------------------------------------------------------------------------
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "item_type" varchar(32) NOT NULL DEFAULT 'product';
--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "ref_id" uuid;
--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "unit_amount_cents" integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "currency" varchar(3) DEFAULT 'SAR';
--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "fulfillment_state" varchar(20) NOT NULL DEFAULT 'pending';
--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "fulfilled_at" timestamp;
--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "fulfillment_error" varchar(255);
--> statement-breakpoint
-- Backfill the frozen unit amount and currency from the legacy price column so
-- existing orders are readable by the new code.
UPDATE "order_items" SET "unit_amount_cents" = "price" WHERE "unit_amount_cents" = 0 AND "price" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_items_order_idx" ON "order_items" ("order_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "order_items_order_ref_unique"
  ON "order_items" ("order_id", "item_type", "ref_id");

-- ---------------------------------------------------------------------------
-- 3. Per-tenant gateway credentials. Secrets are encrypted; the publishable key
--    is the only value that ever reaches the browser.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "payment_configs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants" ("id") ON DELETE CASCADE,
  "provider" varchar(32) NOT NULL DEFAULT 'moyasar',
  "publishable_key" varchar(200),
  "encrypted_secret_key" text,
  "secret_key_version" integer NOT NULL DEFAULT 1,
  "encrypted_webhook_secret" text,
  "currency" varchar(3) NOT NULL DEFAULT 'SAR',
  "enabled" boolean NOT NULL DEFAULT false,
  "success_url" varchar(500),
  "cancel_url" varchar(500),
  "live_mode" boolean NOT NULL DEFAULT false,
  "status" varchar(30) NOT NULL DEFAULT 'disabled',
  "last_tested_at" timestamp,
  "last_error_code" varchar(80),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_configs_tenant_provider_unique"
  ON "payment_configs" ("tenant_id", "provider");

-- ---------------------------------------------------------------------------
-- 4. Platform-level Google connections. Never tenant-scoped: one Google
--    account links every Google surface for the install.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "google_integrations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "service" varchar(40) NOT NULL,
  "encrypted_refresh_token" text,
  "connected_email" varchar(320),
  "external_account_id" varchar(255),
  "external_account_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "scopes" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "status" varchar(30) NOT NULL DEFAULT 'not_connected',
  "last_verified_at" timestamp,
  "last_error_code" varchar(80),
  "last_error_message" varchar(500),
  "connected_by" uuid,
  "connected_at" timestamp,
  "disconnected_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "google_integrations_service_unique"
  ON "google_integrations" ("service");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "google_integrations_status_idx" ON "google_integrations" ("status");

CREATE TABLE IF NOT EXISTS "google_oauth_states" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "state_hash" varchar(64) NOT NULL,
  "service" varchar(40) NOT NULL,
  "initiated_by" uuid NOT NULL,
  "csrf_token" varchar(120) NOT NULL,
  "return_to" varchar(500),
  "redirect_uri" varchar(500) NOT NULL,
  "expires_at" timestamp NOT NULL,
  "consumed_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "google_oauth_states_hash_unique"
  ON "google_oauth_states" ("state_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "google_oauth_states_expiry_idx" ON "google_oauth_states" ("expires_at");
