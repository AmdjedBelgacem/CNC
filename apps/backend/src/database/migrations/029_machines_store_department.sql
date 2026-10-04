-- Machines become a store department rather than an editorial page.
--
-- The `our-machines` builder page is informational, so the navbar entry led to
-- a page with nothing to buy while the two CNC mills in the catalogue sat
-- behind the generic "Store" link. Repoint the item at the store filtered to
-- the Machines category.
--
-- Only the navbar item type changes. The `our-machines` page row is left in
-- place so the content stays reachable from the builder and the footer, and so
-- this can be reverted by changing the type back.
UPDATE "navigation_items"
SET "type" = 'url',
    "href" = '/products?category=Machines',
    "page_slug" = NULL
WHERE "type" = 'page'
  AND "page_slug" = 'our-machines';