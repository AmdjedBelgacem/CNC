-- 042: Product type.
--
-- `category` is the department a shopper browses ("CNC Machines", "Tooling").
-- `product_type` is the kind of product inside it ("Vertical Machining Center",
-- "Collet Systems"). The storefront needs both dimensions: a department filter
-- alone cannot separate a 3-axis mill from a laser cutter, and a type filter
-- alone loses the department-level navigation.
--
-- Nullable on purpose: existing rows have no type and an empty value is
-- honest. The backfill below fills only obvious matches; anything ambiguous
-- stays NULL for an admin to classify.
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "product_type" varchar(100);

CREATE INDEX IF NOT EXISTS "prod_type_idx" ON "products" ("tenant_id", "product_type");

COMMENT ON COLUMN "products"."product_type" IS
  'Kind of product within its category, e.g. Vertical Machining Center, Laser Cutting Machine, Collet Systems.';

-- Backfill the catalogue we know about. Every predicate is a title/slug match,
-- not a category-wide guess, so a new product never inherits a type it did not
-- declare. `WHERE product_type IS NULL` makes this safe to re-run.
UPDATE "products"
SET "product_type" = CASE
  WHEN lower("title") LIKE '%laser%' THEN 'Laser Cutting Machine'
  WHEN lower("title") LIKE '%5-axis%' OR lower("title") LIKE '%5 axis%' THEN '5-Axis Machining Center'
  WHEN lower("title") LIKE '%machining center%' THEN 'Vertical Machining Center'
  WHEN lower("title") LIKE '%cnc mill%' OR lower("title") LIKE '%vmc%' THEN 'CNC Mill'
  WHEN lower("title") LIKE '%collet%' THEN 'Collet Systems'
  WHEN lower("title") LIKE '%vise%' OR lower("title") LIKE '%jaw%' THEN 'Vises & Jaws'
  WHEN lower("title") LIKE '%caliper%' THEN 'Calipers'
  WHEN lower("title") LIKE '%indicator%' THEN 'Indicators'
  WHEN lower("title") LIKE '%edge finder%' THEN 'Edge Finders'
  WHEN lower("title") LIKE '%face mill%' THEN 'Indexable Milling'
  WHEN lower("title") LIKE '%bandsaw%' OR lower("title") LIKE '%saw blade%' THEN 'Bandsaw Blades'
  WHEN lower("title") LIKE '%tap & die%' OR lower("title") LIKE '%tap and die%' THEN 'Threading'
  WHEN lower("title") LIKE '%deburring%' THEN 'Deburring'
  WHEN lower("title") LIKE '%coolant%' THEN 'Coolant Systems'
  WHEN lower("title") LIKE '%poster%' OR lower("title") LIKE '%reference%' THEN 'Reference Posters'
  WHEN lower("title") LIKE '%cap%' OR lower("title") LIKE '%hat%' THEN 'Apparel'
  WHEN lower("title") LIKE '%organizer%' OR lower("title") LIKE '%rack%' THEN 'Tool Storage'
  WHEN lower("title") LIKE '%end mill kit%' THEN 'End Mill Kits'
  WHEN lower("title") LIKE '%course%' THEN 'Online Courses'
  WHEN lower("title") LIKE '%tool kit%' THEN 'Measurement Kits'
END
WHERE "product_type" IS NULL;
