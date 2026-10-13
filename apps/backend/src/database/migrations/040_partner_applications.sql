DO $$ BEGIN CREATE TYPE partner_application_status AS ENUM ('pending','under_review','approved','rejected','needs_info'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE partner_application_type AS ENUM ('sponsor','distributor','training_center','affiliate','other'); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "partner_applications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "type" partner_application_type NOT NULL,
  "company_name" varchar(200) NOT NULL,
  "website" varchar(500),
  "contact_name" varchar(200) NOT NULL,
  "email" varchar(320) NOT NULL,
  "phone" varchar(60),
  "country" varchar(100),
  "city" varchar(100),
  "message" text NOT NULL,
  "social_links" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "audience_size" varchar(100),
  "status" partner_application_status DEFAULT 'pending' NOT NULL,
  "admin_notes" text,
  "reviewer_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "reviewed_at" timestamp,
  "rejection_reason" text,
  "info_request_message" text,
  "source" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp
);

CREATE INDEX IF NOT EXISTS "partner_applications_tenant_status_idx" ON "partner_applications" ("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "partner_applications_tenant_email_idx" ON "partner_applications" ("tenant_id", "email");
CREATE INDEX IF NOT EXISTS "partner_applications_tenant_created_idx" ON "partner_applications" ("tenant_id", "created_at");