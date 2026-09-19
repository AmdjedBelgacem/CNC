ALTER TABLE "cert_templates" ADD COLUMN IF NOT EXISTS "course_id" uuid REFERENCES "courses"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "cert_templates_tenant_course_idx" ON "cert_templates" USING btree ("tenant_id","course_id");
