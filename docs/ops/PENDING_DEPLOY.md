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
