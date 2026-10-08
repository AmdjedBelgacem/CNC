-- 035: Per-image hotspots for products.
--
-- Hotspots used to be a single `products.pinpoints` array, which is only
-- unambiguous when a product has exactly one picture. The gallery landed after
-- that field, so a product could show image 2 with markers that were positioned
-- for image 1 — every marker pointing at the wrong feature.
--
-- The fix moves the coordinates onto the image they annotate. `products.pinpoints`
-- is intentionally LEFT IN PLACE and left non-empty: it is still the fallback for a
-- single-image product whose gallery has not been migrated yet, and dropping it
-- here would destroy markers for those rows. The backfill below only touches rows
-- that already have a gallery, so nothing is double-represented:
--
--   * gallery exists with no hotspots -> copy the product-level pinpoints onto the
--     primary image, which is the only image they could have described;
--   * gallery exists and already has hotspots -> leave it alone;
--   * no gallery yet -> do nothing, the runtime backfill handles it later.
--
-- `hotspots` is jsonb of {id, x, y, label, tooltip, detail}[] with x/y in whole
-- percent of the image box. The same shape as the course `InteractiveHotspot`, so
-- the renderer and the authoring model are shared rather than parallel.

ALTER TABLE "product_images" ADD COLUMN IF NOT EXISTS "hotspots" jsonb;

-- Adopt the legacy product-level markers for galleries that were built before this
-- migration. `is_primary` picks the one image the old coordinates referred to.
UPDATE "product_images" AS pi
SET "hotspots" = p."pinpoints"
FROM "products" AS p
WHERE p."id" = pi."product_id"
  AND pi."is_primary" = true
  AND pi."hotspots" IS NULL
  AND p."pinpoints" IS NOT NULL
  AND jsonb_typeof(p."pinpoints") = 'array'
  AND p."pinpoints" <> '[]'::jsonb;

COMMENT ON COLUMN "product_images"."hotspots" IS
  'Hotspots annotated on this single image: [{id,x,y,label,tooltip,detail}] with x/y as percent of the image box.';