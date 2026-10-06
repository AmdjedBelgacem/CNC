-- 034: Admin custom email system — templates, versions, trigger bindings, outbox.
--
-- Four tables, mirroring the page builder's proven shape (`pages` / `page_versions`)
-- so the versioning, rollback and audit patterns transfer unchanged.
--
-- Design notes that are load-bearing rather than incidental:
--
--  * `email_templates.tenant_id` is NULLABLE, and only for `is_system` rows, so
--    super_admin can author one template every tenant inherits. Every read must
--    branch on it; a tenant-owned row may never have NULL.
--
--  * `email_outbox.idempotency_key` has a PARTIAL unique index. Triggers that are
--    not naturally idempotent deliberately pass no key, and in Postgres NULLs are
--    distinct inside a unique index — so a plain unique() would not reject them
--    (correct), while also failing to protect the rows that do carry a key.
--
--  * `email_trigger_bindings` gets TWO partial unique indexes rather than one
--    composite. A composite unique over (tenant_id, trigger_key, locale) would
--    permit unlimited duplicate SYSTEM defaults, because tenant_id IS NULL for
--    those rows and NULLs never collide. Duplicate system defaults would make
--    trigger resolution non-deterministic — exactly the class of bug that is
--    invisible in dev and produces "random" sends in production.
--
--  * The outbox is the send log. It has no body column, only `body_hash`: a reset
--    URL must never live somewhere that can be logged, queried or exported.
--
-- Every statement is idempotent so this can be re-applied to a database that was
-- already partially migrated by hand.

CREATE TABLE IF NOT EXISTS "email_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid REFERENCES "tenants"("id") ON DELETE CASCADE,
  "slug" varchar(100) NOT NULL,
  "name" varchar(160) NOT NULL,
  "category" varchar(20) NOT NULL,
  "layout" jsonb NOT NULL,
  -- Held on the template too, not only on versions: the editor needs them while
  -- the template is still a draft, and a version row does not exist until publish.
  "subject_template" varchar(500) DEFAULT '' NOT NULL,
  "preheader_template" varchar(300),
  "variable_schema" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "status" varchar(12) DEFAULT 'draft' NOT NULL,
  "is_system" boolean DEFAULT false NOT NULL,
  "version" integer DEFAULT 0 NOT NULL,
  "published_at" timestamp,
  "published_by_id" uuid REFERENCES "users"("id"),
  "updated_by_id" uuid REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  -- A system template must have no tenant; a tenant template must have one.
  -- Enforced in the database so a service-layer slip cannot create an orphaned
  -- template that no tenant can reach and no resolution can find.
  CONSTRAINT "email_templates_system_tenant_check"
    CHECK ((is_system AND tenant_id IS NULL) OR (NOT is_system AND tenant_id IS NOT NULL)),
  CONSTRAINT "email_templates_status_check"
    CHECK (status IN ('draft', 'published', 'archived'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "email_templates_tenant_slug_idx"
  ON "email_templates" ("tenant_id", "slug");
CREATE INDEX IF NOT EXISTS "email_templates_tenant_category_idx"
  ON "email_templates" ("tenant_id", "category");
CREATE INDEX IF NOT EXISTS "email_templates_status_idx"
  ON "email_templates" ("status");

COMMENT ON TABLE "email_templates" IS
  'Admin-authored email templates. Structured block layout; NOT Puck page data.';
COMMENT ON COLUMN "email_templates"."tenant_id" IS
  'NULL only for is_system templates, which every tenant inherits.';
COMMENT ON COLUMN "email_templates"."version" IS
  'Latest published version number. Increments only on publish.';

CREATE TABLE IF NOT EXISTS "email_template_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "template_id" uuid NOT NULL REFERENCES "email_templates"("id") ON DELETE CASCADE,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "version" integer NOT NULL,
  "subject_template" varchar(500) NOT NULL,
  "preheader_template" varchar(300),
  "layout" jsonb NOT NULL,
  "variable_schema" jsonb DEFAULT '[]'::jsonb NOT NULL,
  -- The artifact a reviewer approved, rendered from the trigger's sample payload.
  -- Reference only: per-send bodies re-run the same deterministic render.
  "compiled_html" text NOT NULL,
  "compiled_text" text NOT NULL,
  "compile_hash" varchar(64) NOT NULL,
  "schema_version" integer DEFAULT 1 NOT NULL,
  "status" varchar(12) DEFAULT 'published' NOT NULL,
  "note" varchar(500),
  "changed_by_id" uuid REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "email_template_versions_status_check"
    CHECK (status IN ('snapshot', 'published'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "email_template_versions_tpl_version_idx"
  ON "email_template_versions" ("template_id", "version");
CREATE INDEX IF NOT EXISTS "email_template_versions_tenant_idx"
  ON "email_template_versions" ("tenant_id");

COMMENT ON COLUMN "email_template_versions"."compile_hash" IS
  'sha256(compiled_html + compiled_text + compiler version). The snapshot-test contract.';
COMMENT ON COLUMN "email_template_versions"."compiled_html" IS
  'Reviewed reference artifact, not the per-send body. Data tables driven by {{#each}} cannot be frozen; sends re-render deterministically.';

CREATE TABLE IF NOT EXISTS "email_trigger_bindings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid REFERENCES "tenants"("id") ON DELETE CASCADE,
  "trigger_key" varchar(60) NOT NULL,
  "template_id" uuid NOT NULL REFERENCES "email_templates"("id") ON DELETE CASCADE,
  "locale" varchar(10),
  "enabled" boolean DEFAULT true NOT NULL,
  "delay_minutes" integer DEFAULT 0 NOT NULL,
  "updated_by_id" uuid REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "email_trigger_bindings_delay_check" CHECK (delay_minutes >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "email_bindings_tenant_trigger_locale_idx"
  ON "email_trigger_bindings" ("tenant_id", "trigger_key", "locale")
  WHERE "tenant_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "email_bindings_system_trigger_locale_idx"
  ON "email_trigger_bindings" ("trigger_key", "locale")
  WHERE "tenant_id" IS NULL;
CREATE INDEX IF NOT EXISTS "email_bindings_trigger_idx"
  ON "email_trigger_bindings" ("trigger_key");

COMMENT ON COLUMN "email_trigger_bindings"."trigger_key" IS
  'References TRIGGER_REGISTRY in the backend. No free-text triggers exist.';
COMMENT ON COLUMN "email_trigger_bindings"."enabled" IS
  'false = explicit no-send. The template is retained, never deleted to stop mail.';

CREATE TABLE IF NOT EXISTS "email_outbox" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "trigger_key" varchar(60) NOT NULL,
  "template_id" uuid REFERENCES "email_templates"("id") ON DELETE SET NULL,
  "template_version" integer DEFAULT 0 NOT NULL,
  "recipient_email" varchar(320) NOT NULL,
  "recipient_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "locale" varchar(10),
  "payload" jsonb NOT NULL,
  "subject" varchar(500) NOT NULL,
  "from_address" varchar(320) NOT NULL,
  "reply_to" varchar(320),
  "idempotency_key" varchar(200),
  "status" varchar(12) DEFAULT 'queued' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "last_error_code" varchar(60),
  "last_error_message" varchar(500),
  "provider" varchar(20) DEFAULT 'resend' NOT NULL,
  "provider_id" varchar(120),
  -- sha256 of the final body only. The body itself is never stored, so a reset
  -- or certificate URL cannot leak through a log, export or support query.
  "body_hash" varchar(64),
  "scheduled_for" timestamp DEFAULT now() NOT NULL,
  "sent_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "email_outbox_status_check"
    CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'dead')),
  CONSTRAINT "email_outbox_attempts_check" CHECK (attempts >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "email_outbox_idempotency_idx"
  ON "email_outbox" ("idempotency_key") WHERE "idempotency_key" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "email_outbox_drain_idx"
  ON "email_outbox" ("status", "scheduled_for");
CREATE INDEX IF NOT EXISTS "email_outbox_tenant_idx" ON "email_outbox" ("tenant_id");
CREATE INDEX IF NOT EXISTS "email_outbox_trigger_idx" ON "email_outbox" ("trigger_key");
CREATE INDEX IF NOT EXISTS "email_outbox_recipient_idx" ON "email_outbox" ("recipient_user_id");
CREATE INDEX IF NOT EXISTS "email_outbox_created_idx" ON "email_outbox" ("created_at");

COMMENT ON TABLE "email_outbox" IS
  'Outbox doubles as the send log: one row per logical send, mutated through its lifecycle.';
COMMENT ON COLUMN "email_outbox"."idempotency_key" IS
  'Duplicate-suppression claim. Partial unique index; NULL means intentionally non-idempotent.';
COMMENT ON COLUMN "email_outbox"."body_hash" IS
  'sha256 of the rendered body. The body is deliberately not persisted.';