# Deploy log — completed 2026-10-10

**Status: DEPLOYED 2026-10-10.** Third attempt got in on an unbanned egress
(`41.201.115.218`) and completed. Live frontend is
`baroot/frontend:qa-202610080725`; the backend image was rebuilt on the host.
Post-deploy verification is at the bottom of this file.

History — **Status at the time of the second attempt:** SSH to `13.206.178.25:22` is refused
(TCP filtered) while ports 80 and 443 answer and the site serves 200. Only SSH is
filtered, which is a fail2ban ban rather than a host outage.

Attempt log:

| Attempt | Egress IP | Result |
|---|---|---|
| 1 | `105.235.134.182` | filtered |
| 2 | `105.235.136.121` | **connected** — code synced, then filtered again mid-session |
| 3 | `105.235.134.138` | filtered; polled ~15 min, never lifted |

The egress IP rotates through a small pool and at least one member is banned. The
bantime is long enough that waiting does not clear it. Either the bans need lifting from
the Lightsail console, or a bastion / different egress is needed.

What *did* complete on attempt 2, and is safe to leave in place:

* `rsync` of `03669a1..d8ebe14` to `/opt/titanic/cnc` succeeded. `deploy/lightsail/.env`
  was excluded from `--delete`, so `FRONTEND_IMAGE` and every secret are untouched.
  (The only `--delete` failure was the root-owned Caddy `logs/access.log` bind mount,
  which is correct to leave alone.)
* The frontend image transfer and the backend image build were both interrupted and are
  **not** complete. `FRONTEND_IMAGE` still points at `qa-202610072339`.

Post-attempt check from outside confirms the host is healthy and still on the old image:
`/` 200, `/products` 200, and the Arabic navbar renders 1 of its 10 items with the GitHub
button still on `/login`.

The host needs the ban lifted before the steps below can run.

## What is ready

| Artifact | Value |
|---|---|
| Frontend image (built, verified locally) | `baroot/frontend:qa-202610080725` (linux/amd64, 1.69 GB) |
| Previous live frontend image | `baroot/frontend:qa-202610072339` |
| Commits | `03669a1..76dc78b` (5) |
| Prod tenant nav | already seeded with the corrected 10 bilingual rows |

## Steps once SSH is available

```bash
KEY="/Users/mac/programming/projects/pem keys/Cnc-ap-south-1.pem"

# 1. unban first, or every subsequent step fails the same way
sudo fail2ban-client set sshd unbanip 105.235.134.182

# 2. ship the code (frontend dist/ and node_modules are excluded)
rsync -az --delete -e "ssh -i '$KEY'" \
  --exclude node_modules --exclude .next --exclude .git --exclude dist \
  ./ ubuntu@13.206.178.25:/opt/titanic/cnc/

# 3. push the image rather than rebuilding on a 2 GB box
docker save baroot/frontend:qa-202610080725 \
  | ssh -i "$KEY" ubuntu@13.206.178.25 'docker load'

# 4. migrations — 035 adds product_images.hotspots
ssh -i "$KEY" ubuntu@13.206.178.25 \
  'cd /opt/titanic/cnc/apps/backend && npm run db:migrate'

# 5. deploy backend and frontend
ssh -i "$KEY" ubuntu@13.206.178.25 'cd /opt/titanic/cnc && \
  sed -i "s|^FRONTEND_IMAGE=.*|FRONTEND_IMAGE=baroot/frontend:qa-202610080725|" server/.env && \
  docker compose --env-file server/.env -f server/docker-compose.yml \
    up -d --no-build backend frontend'

# 6. smoke
bash scripts/lightsail/smoke.sh
```

The runtime safety-net DDL also adds `product_images.hotspots` on backend boot, so a host
that never runs `db:migrate` still converges — but the migration is what covers the test
suite, which sets `SKIP_SCHEMA_DDL=1`.

## What each commit changes

| Commit | Change | Risk if skipped |
|---|---|---|
| `e8da224` | Per-image hotspots; nav SSR URL fix; search centring; GitHub button removal | Navbar stays empty in SSR; search opens pinned under the header; GitHub still offered |
| `2a332ca` | 643 Arabic keys; 63 files un-hardcoded; `en-US` date/number formatting removed | Arabic readers see English on settings, auth and most public pages |
| `2a4378a` | `POST` blank title/slug rejected on products and courses; `/admin/users` pool fix; `check-availability` 400s | **Drafts with blank titles can still be created; the admin user list 500s on a tenant of >15 members** |
| `32158fb` | Unpublished products no longer readable via `GET /products/:slug` | **Anonymous callers can read draft descriptions by slug** |
| `76dc78b` | Docs only | — |

## After deploying

1. `/admin/products/<slug>` — add hotspots to two different images and confirm each image
   keeps its own markers.
2. Open a published product with hotspots; click a marker: the popup must appear anchored
   over the number with a notch, and close on outside click and on Escape. This is the one
   item that could not be verified without a browser — product data is client-fetched, so
   it is absent from SSR HTML for every product.
3. Confirm the Arabic navbar renders all 10 items.
4. Confirm `GET /products/<draft-slug>` returns 404 anonymously and 200 with an admin token.

## Post-deploy verification (2026-10-10)

| Check | Result |
|---|---|
| `GET /` `/products` `/login` | 200 |
| 47 routes x en/ar | all 200, or 307 to `/login?returnUrl=…` for `/admin/*` and `/account` |
| `MISSING_MESSAGE` in any Arabic page | none |
| Arabic navbar, server-rendered | **10/10** items present (was 1/10) |
| `>GitHub<` on `/login` | 0 occurrences (Google retained) |
| `GET /products/check-availability` anon, no params / bad uuid | 400, 400 (was 500) |
| `product_images.hotspots` column on prod | present |
| `navigation_items` rows | 10 |
| deployed backend bundle contains create guards, `includeUnpublished`, `mapWithConcurrency`, hotspots DDL | all present |
| deployed frontend bundle contains `data-hotspot-root` + `pointerdown` handler | present |

Two notes for the record:

* **Authenticated endpoints could not be smoke-tested from outside.** The production JWT
  secret differs from the local dev one, so a locally minted token is rejected with
  `Unknown token signing key` — correct behaviour. The deployed-code checks above are
  string assertions against the shipped `dist/`, which is why they were used instead.
* The remaining `!top-4` hits in the bundle are Tailwind's generated `.!top-4` utility CSS
  (it appears because Tailwind scans source text, including the comment explaining why
  those classes were removed). The component itself no longer passes them.

Still to do visually, per `API_SWEEP_QA.md`: confirm the hotspot click-to-open popover in a
browser. Product data is client-fetched, so it cannot be asserted from server HTML.

## ⚠️ Backend image is currently a hot-patch, not a clean build

`titan-backend:latest` on the host was produced by layering a single recompiled file onto the
previous image:

    FROM titan-backend:latest
    COPY products.service.js /repo/apps/backend/dist/modules/products/products.service.js

**Why:** a normal backend build cannot currently run on this machine.
`apt-get update` fails signature verification inside `node:22-bookworm-slim` because the
environment clock reads October 2026, so the Debian archive signatures do not validate
("At least one invalid signature was encountered"). The frontend image builds because its
layers are cached locally; a cold backend build does not.

Building the backend **on the host** is not an acceptable workaround. That was attempted and the
Docker daemon died mid-build, taking Caddy down with it and darkening the whole site until it was
started again. Do not repeat it.

**Action required:** once the clock or apt trust store is corrected, rebuild the backend from
source off-box (`docker buildx build --platform linux/amd64 -f Dockerfile -t titan-backend:<tag> .`)
and redeploy, so the running image matches the Dockerfile. The hot-patch and a clean build produce
the same behaviour; the difference is provenance.

## Deployment safety rule

`docker compose up -d` can leave a container stopped after a daemon restart even under
`unless-stopped`. After any deploy that touches the host Docker daemon, verify all four
containers are `Up` — `caddy`, `frontend`, `backend`, `redis` — and not just that the site
responds.

## Backend image is still a hot-patch — required follow-up

`certifications.pdf_url` was widened to `text` by migration `037_certificate_pdf_url_text.sql`,
applied directly to the database, so certificate issuance works in production today. The
running image is still layered over an earlier build rather than rebuilt from source; see the
note above for why (apt signature verification fails against this environment's clock).
Rebuild off-box once the clock is corrected, so the deployed image matches the Dockerfile.

## Course studio media is now presigned

The studio previously base64-encoded media into JSON, which hit the 2 MB API body limit and
surfaced as "File is too large" for files the UI said it accepted (10 MB thumbnails, 500 MB
trailers). All course media — trailer, thumbnail, lesson video, lesson attachments, block
media, SEO OG image, course resources — now uses the presigned direct upload that products
already used. Verified with a 5 MB image: PUT to storage 200, public read 200.

The lesson-video path no longer falls back to base64 when presigning fails. That fallback
converted any storage fault into "File is too large", describing neither the cause nor the
author's file; the real error now surfaces.

## Service worker no longer intercepts navigations

Document navigations are left to the browser. Four successive fixes to the worker's
navigation handler each still left a blank page reachable, so the interception was removed
rather than patched again. Consequences to be aware of:

- Offline navigation now shows the browser's own offline error page instead of an in-app one.
  `/offline` is still precached and served if a user reaches it directly.
- The `pages-*` cache is no longer read for page loads, only written. It can be removed in a
  later change if it is not wanted.

## Builder provisioning

`GET /builder/pages` now reconciles the system page set: any of the ten `BUILDER_PAGE_SLUGS`
without a row is inserted with `getDefaultLayout(slug)` and `is_system = true`. This is
idempotent (`onConflictDoNothing` against the `(tenant_id, slug)` unique index) and runs on
every list.

Before this, `provisionPage` was reachable only from `getPage`, so rows materialised only if
somebody opened a page by slug. Production held a single row — `home`, a draft at version 0 —
while the site resolves ten slugs through the builder. The builder listed one page against a
website built from ten, and the nine without rows could only render the hardcoded seed layout.

Seeded layouts are byte-identical to the `getDefaultLayout` fallback the site already used, so
provisioning changes what is *manageable*, not what is *displayed*. Nothing is published as a
side effect; Publish remains the only action that does that.

All ten pages are currently drafts at version 0, which renders exactly the seed content the
site showed before. Verified end to end: editing `about` and publishing changed the live page,
and resetting plus republishing restored it.

## Careful when deleting users

`pages.updated_by_id`, `pages.published_by_id` and `page_versions.changed_by_id` are foreign
keys to `users`. Sweeping every FK-referencing table when removing an account deleted a real
page row whose last editor was the synthetic QA user. Page rows are production content: detach
those references with `UPDATE ... SET <col> = NULL`, never `DELETE` from `pages`.

## The service worker is removed

`apps/frontend/public/sw.js` is a stub: it deletes every cache and unregisters itself on
install and activate, with `skipWaiting` and `clients.claim` so it applies on the next load.
`PWARegister` registers nothing and instead purges existing registrations and caches on every
page load.

Removing registration is what matters. A stale worker keeps controlling a visitor's browser
until each tab closes, so every fix only helped people arriving after it — which is why four
successive fixes produced reports I could not reproduce from a clean profile. The failures were:
`respondWith` handed `undefined`; cached HTML arrived without its scripts; `/offline` failed
because it is itself a Next page; and the catch-all branch rethrew on a network-and-cache miss
(`ERR_CACHE_MISS`, `TypeError: Failed to fetch`).

Verified from a browser carrying the old worker: caches purged, `navigator.serviceWorker.controller`
false, zero service-worker console errors across the site.

## Builder pages are published and self-describing

All ten `BUILDER_PAGE_SLUGS` rows are `published` at version 1, each with a `page_versions`
snapshot of the seeded layout — byte-identical to the `getDefaultLayout` fallback the site
already rendered, so nothing displayed changed. `/content/pages/<slug>` now answers 200
instead of falling through to a code default, and the builder reports "Live" instead of "Draft"
for pages that were already on the website.

The builder canvas reports live data for `live-island` blocks (`useIslandSummary`) and for
placeholder catalog-hero stats (`useCatalogStats`), read from the same public endpoints the
site uses. The islands themselves are async server components and cannot render in the editor;
rather than fork their markup into a second implementation that would drift, the canvas reports
what each section resolves to plus a link to the rendered page.

Known cosmetic difference: the editor's price range is rendered without a currency prefix
(`0.01 – 0.01`) where the site formats it (`SAR 0.01 – SAR 0.01`). The values agree; only the
currency label is missing, because the shared formatter is used server-side.
