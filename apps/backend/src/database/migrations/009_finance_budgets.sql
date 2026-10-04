CREATE TABLE IF NOT EXISTS "finance_budgets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "period" varchar(20) NOT NULL DEFAULT 'month',
  "category" varchar(50) NOT NULL DEFAULT 'revenue',
  "target_cents" integer NOT NULL DEFAULT 0,
  "notes" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "finance_budgets_tenant_idx" ON "finance_budgets" ("tenant_id");
