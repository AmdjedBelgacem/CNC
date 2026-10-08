-- 036: Product pricing modes, and a real quote-request pipeline.
--
-- Two separate needs, one migration.
--
-- 1. `products.pricing_mode`
--
--    A CNC shop sells three different ways and a single nullable `price` cannot express
--    any of them honestly:
--
--      'fixed'   an exact figure. What the site does today.
--      'from'    a headline "from X", with the real figure varying by variant. For
--                anything with a size/finish range — a machine that comes as 3-axis or
--                5-axis, or a vise in four jaw widths.
--      'request' no figure at all. Large machines are quoted per configuration, and
--                publishing a number either understates the job or anchors the buyer to
--                the cheapest variant.
--
--    NOT NULL with a default of 'fixed' so every existing product is explicitly 'fixed'
--    and no row changes meaning on deploy. Nullable would have made the read path guess.
--
-- 2. `quotes` becomes a pipeline rather than a contact form.
--
--    The table was name/email/company/message with no tenant and no product, so a request
--    could not be attributed, triaged, or answered. Adding:
--
--      tenant_id  required for RLS-style scoping and for the admin list filter
--      product_id / variant_id  what was actually asked about, so the admin opens the
--                 product rather than guessing from free text
--      status     new → contacted → closed. Without it there is no way to know a request
--                 was handled, and no way to avoid replying twice
--      quoted_price  minor units, same convention as products.price — never a float, and
--                 never a formatted string
--      admin_note  the conversation, which otherwise lives in someone's inbox
--
--    Existing rows keep their NULLs: they were genuine contact-form submissions with no
--    product behind them, and backfilling a tenant would be a guess.
CREATE TABLE IF NOT EXISTS "quotes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(255) NOT NULL,
  "email" varchar(255) NOT NULL,
  "company" varchar(255) NOT NULL,
  "message" text,
  "tenant_id" uuid REFERENCES "tenants"("id") ON DELETE SET NULL,
  "product_id" uuid REFERENCES "products"("id") ON DELETE SET NULL,
  "variant_id" uuid,
  "status" varchar(20) DEFAULT 'new' NOT NULL,
  "quoted_price" integer,
  "admin_note" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- The table predates this migration, so on an existing database CREATE IF NOT EXISTS is
-- a no-op and the added columns have to be applied separately.
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "tenant_id" uuid REFERENCES "tenants"("id") ON DELETE SET NULL;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "product_id" uuid REFERENCES "products"("id") ON DELETE SET NULL;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "variant_id" uuid;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "status" varchar(20) DEFAULT 'new' NOT NULL;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "quoted_price" integer;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "admin_note" text;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "pricing_mode" varchar(20) DEFAULT 'fixed' NOT NULL;

-- The admin inbox: newest first, scoped by tenant.
CREATE INDEX IF NOT EXISTS "quotes_tenant_created_idx" ON "quotes" ("tenant_id", "created_at" DESC);
-- "How many unhandled requests are there?" is asked on every dashboard load.
CREATE INDEX IF NOT EXISTS "quotes_status_idx" ON "quotes" ("status") WHERE "status" = 'new';
-- Guard against a buyer submitting the same request repeatedly.
CREATE INDEX IF NOT EXISTS "quotes_product_email_idx" ON "quotes" ("product_id", "email");

COMMENT ON COLUMN "products"."pricing_mode" IS
  'How this product is priced: ''fixed'' (exact figure), ''from'' (headline figure, varies by variant), ''request'' (no figure, quote on request).';
COMMENT ON COLUMN "quotes"."status" IS
  'new → contacted → closed. ''closed'' is an end state, not a deletion.';
COMMENT ON COLUMN "quotes"."quoted_price" IS
  'The price quoted back, in minor units, matching products.price. NULL until someone decides one.';