# Pending deploy — 5 commits not yet on the server

**Status: blocked.** SSH to `13.206.178.25:22` is refused (TCP filtered) while the site
itself answers 200, which is the signature of a fail2ban ban on this machine's egress IP
(`105.235.134.182`) rather than a host outage. The host needs the ban lifted from the
console or by an unbanned address before the steps below can run.

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