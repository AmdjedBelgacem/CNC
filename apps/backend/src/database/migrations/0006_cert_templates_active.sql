ALTER TABLE "cert_templates" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;
ALTER TABLE "cert_templates" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "cert_templates" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
CREATE INDEX IF NOT EXISTS "cert_templates_tenant_active_idx" ON "cert_templates" USING btree ("tenant_id","is_active");
