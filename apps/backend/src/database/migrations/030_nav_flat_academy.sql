-- Collapse the navbar to a single, flat Academy link and drop Machines.
--
-- Two menu changes:
--
--   * "Machines" leaves the navbar. The machines themselves stay purchasable
--     in the store, reachable from Store and from the department tiles; they
--     just no longer warrant a top-level entry.
--
--   * "Academy" stops being a dropdown and becomes a plain link to /academy.
--     Its two children were redundant: "Courses" pointed at the academy
--     landing page that /academy already serves, and "Live sessions" duplicated
--     the top-level "Events" entry.
--
-- Written against every tenant, and defensively about shape, because the menu
-- is content an admin can edit: some tenants have the dropdown group, some have
-- only a flat link, and a fresh install can end up with both (the navigation
-- seed and the demo seed each insert one). The migration therefore converts
-- whichever Academy entries exist and leaves exactly one behind.

-- 1. The dropdown's children go first; they only make sense under a group.
DELETE FROM "navigation_items"
WHERE "parent_id" IN (
  SELECT "id" FROM "navigation_items" WHERE "type" = 'group' AND "label" = 'Academy'
);

-- 2. Convert the group itself in place, keeping its label, Arabic label, icon
--    and sort order so an admin's ordering survives.
UPDATE "navigation_items"
SET "type" = 'url',
    "href" = '/academy',
    "page_slug" = NULL
WHERE "type" = 'group' AND "label" = 'Academy';

-- 3. Two seeds can both have created an Academy entry. Keep the oldest row of
--    each duplicate set (ctid ordering) and drop the rest.
DELETE FROM "navigation_items" newer
USING "navigation_items" older
WHERE newer."tenant_id" = older."tenant_id"
  AND newer."parent_id" IS NULL
  AND older."parent_id" IS NULL
  AND newer."label" = 'Academy'
  AND older."label" = 'Academy'
  AND newer.ctid > older.ctid;

-- 4. Any tenant left with no Academy entry gets the plain link.
INSERT INTO "navigation_items" ("tenant_id", "label", "label_ar", "type", "href", "sort_order")
SELECT t.id, 'Academy', 'الأكاديمية', 'url', '/academy', 0
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM "navigation_items" n WHERE n."tenant_id" = t.id AND n."label" = 'Academy'
);

-- 5. Machines out of the navbar.
DELETE FROM "navigation_items"
WHERE "href" = '/products?category=Machines'
   OR "page_slug" = 'our-machines';