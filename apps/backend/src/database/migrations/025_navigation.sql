-- 025: navigation tree — Arabic labels, page links, dropdown groups, cascade
--
-- The public navbar was a hardcoded array in nav-main.tsx, so changing a menu
-- item meant a deploy and could not differ per tenant.
--
-- `navigation_items` already existed from migration 0000 but was never read by
-- any service and is empty in every environment, so it is extended in place
-- rather than replaced by a second table. Extending keeps `relations.ts` valid
-- and leaves no dead table behind.
--
-- Nesting is `parent_id`, and depth is capped at two levels (group -> child) in
-- the service: a third level is not reachable on a phone, and a hover menu
-- nobody can reach is a support ticket.

ALTER TABLE "navigation_items"
  ADD COLUMN IF NOT EXISTS "label_ar" varchar(120),
  ADD COLUMN IF NOT EXISTS "type" varchar(20) NOT NULL DEFAULT 'url',
  ADD COLUMN IF NOT EXISTS "page_slug" varchar(100),
  ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL,
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;

COMMENT ON COLUMN "navigation_items"."type" IS 'page | url | group';
COMMENT ON COLUMN "navigation_items"."page_slug" IS 'Set for type = page; resolved to /slug when rendered.';
COMMENT ON COLUMN "navigation_items"."label_ar" IS 'Arabic label. Falls back to label when absent.';

-- A group has no target of its own, so href can no longer be required.
ALTER TABLE "navigation_items" ALTER COLUMN "href" DROP NOT NULL;

-- The FK on parent_id was never declared, so deleting a group left its children
-- pointing at a row that no longer exists. Cascade is what makes a delete
-- performed in the nav editor complete.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'navigation_items_parent_id_fkey'
  ) THEN
    ALTER TABLE "navigation_items"
      ADD CONSTRAINT "navigation_items_parent_id_fkey"
      FOREIGN KEY ("parent_id") REFERENCES "navigation_items"(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS navigation_items_tenant_parent_idx
  ON "navigation_items" (tenant_id, parent_id, sort_order);

-- Seed the four links that were previously hardcoded, so an upgrade does not
-- blank the navbar. Mirrors NAV_ITEMS in nav-main.tsx at the time of writing.
INSERT INTO "navigation_items" (tenant_id, label, href, sort_order, type)
SELECT t.id, v.label, v.href, v.sort_order, 'url'
FROM tenants t
CROSS JOIN (VALUES
  ('Academy',   '/academy',  0),
  ('Products',  '/products', 1),
  ('Resources', '/feed',     2),
  ('Events',    '/events',   3)
) AS v(label, href, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM navigation_items n WHERE n.tenant_id = t.id);
