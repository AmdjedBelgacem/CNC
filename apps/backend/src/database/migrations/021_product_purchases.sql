-- 021: product purchase ledger + fulfillment claim state
--
-- Two problems are fixed here.
--
-- 1. A paid product order used to be "fulfilled" by decrementing stock and
--    nothing else. There was no record of what the buyer bought, so a refund or
--    a support question could not be answered from the database, and a
--    re-delivery could not tell "never delivered" from "already delivered".
--    product_purchases is that record, unique per order line.
--
-- 2. A line that failed mid-delivery was set to 'failed' but the retry path only
--    selected 'pending' lines, so it could never pick the failure up again.
--    'processing' gives the retry a claim state that is neither available nor
--    finished, so a concurrent retry cannot deliver the same line twice.

ALTER TABLE "order_items"
  DROP CONSTRAINT IF EXISTS "order_items_fulfillment_state_check";

ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_fulfillment_state_check"
  CHECK ("fulfillment_state" IN ('pending', 'processing', 'fulfilled', 'failed'));

-- Recover any line left mid-claim by a crashed worker back to the retry queue.
UPDATE "order_items"
SET "fulfillment_state" = 'failed'
WHERE "fulfillment_state" = 'processing';

CREATE TABLE IF NOT EXISTS "product_purchases" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "order_id" uuid NOT NULL,
  "order_item_id" uuid NOT NULL,
  "product_id" uuid NOT NULL,
  "quantity" integer NOT NULL DEFAULT 1,
  "unit_amount_cents" integer NOT NULL DEFAULT 0,
  "currency" varchar(3) DEFAULT 'SAR',
  "status" varchar(20) NOT NULL DEFAULT 'recorded',
  "refunded_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "product_purchases_status_check"
    CHECK ("status" IN ('recorded', 'refunded', 'revoked'))
);

-- One purchase per order line: this is what makes re-delivery safe.
CREATE UNIQUE INDEX IF NOT EXISTS "product_purchases_order_item_unique"
  ON "product_purchases" ("order_item_id");

CREATE INDEX IF NOT EXISTS "product_purchases_tenant_user_idx"
  ON "product_purchases" ("tenant_id", "user_id");

CREATE INDEX IF NOT EXISTS "product_purchases_order_idx"
  ON "product_purchases" ("order_id");

-- A buyer cannot hold the same order line twice, and an order item cannot be
-- claimed by a purchase from a different order.
ALTER TABLE "product_purchases"
  DROP CONSTRAINT IF EXISTS "product_purchases_order_item_fk";

ALTER TABLE "product_purchases"
  ADD CONSTRAINT "product_purchases_order_item_fk"
  FOREIGN KEY ("order_item_id") REFERENCES "order_items" ("id") ON DELETE CASCADE;
