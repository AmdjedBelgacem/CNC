# Product gallery + save pipeline — manual QA

Automated coverage: `apps/backend/test/product-gallery.spec.ts` (26 tests, real
Postgres). The frontend behaviour below needs a browser.

## Before you start

The **admin frontend still runs the old image** on this host. The wipe fix and the
gallery UI ship with the next off-box frontend build. Until then the API already
refuses a destructive save (400 "Title cannot be empty"), so the old UI fails loudly
instead of destroying data. Verify the admin sections after the next frontend deploy.

## A. Save semantics (after the frontend build)

1. Open an existing product with a title, description, price and an image.
   **The form must be populated.** Previously it rendered blank with Save enabled —
   that blank form was the data loss.
2. Change only the title, save. Reload: description, price, thumbnail, pinpoints,
   documents and features are all intact.
3. Save again immediately. No change; no duplicated rows.
4. Clear the description, save: it clears. Clear nothing, save: nothing clears.
5. Open the same product in two tabs, edit in both, save the first, then save the
   second: expect a conflict message and **your edits still in the form** (not
   discarded), then reload.

## B. Gallery (after the frontend build)

6. Add three images. Expect three tiles, the first marked Primary.
7. Press "Make primary" on the third: the badge moves and the product thumbnail
   follows immediately.
8. Reorder with ↑/↓: order persists after a reload.
9. Remove the primary image: another image is promoted automatically and the product
   keeps a thumbnail.
10. Remove every image: the admin shows the empty state; the storefront shows a
    placeholder.
11. Set alt text on an image, blur the field, reload: it persisted.
12. Try the 12-image cap: the add button disables at 12.
13. Upload a non-image and an oversized image: both are rejected with a message.

## C. Storefront

14. A product with 1 image: single image, no thumbnail strip.
15. A product with N images: main image plus a thumbnail strip; ← / → move between
    thumbnails; Tab reaches the strip.
16. A product with 0 images: placeholder, no broken image icon.
17. Cards and listings still show the primary image (unchanged behaviour).

## D. Already verified against production (2026-10-07)

Replayed live, each confirmed by response body:

| Check | Result |
| --- | --- |
| The payload that wiped the product | `400 Title cannot be empty.` — row untouched |
| Partial save (title only) | other fields preserved |
| Mass assignment (`tenantId`/`isPublished`/`status`) | ignored, not applied |
| Add 3 images | ordered 0,1,2; first is primary |
| Set 3rd image primary | `thumbnailUrl` followed the primary |
| Reorder | renumbered from 0, no duplicate sort orders |
| Ordinary save after images exist | images untouched; explicit `null` still clears |
| Foreign image URL | rejected (`evil.example.com`, `169.254.169.254`, `/etc/passwd`) |
| Stale write | `409` with a readable message |
| Delete primary | promoted `/uploads/covers/g2.png`, exactly one primary, title intact |
| Cross-tenant image id | `404`, existence not leaked |

## E. Your existing blank product

`2ae3557a-3e60-456e-ae46-1b9e8a92fd5b` is blank (`title=""`, everything null). The
database kept no history of the old values, so the text has to be retyped. Uploaded
files were not deleted, so the images are still in the `uploads` bucket and can be
re-attached through the gallery manager. Delete the row when you no longer need it —
it is otherwise a valid, empty product.
