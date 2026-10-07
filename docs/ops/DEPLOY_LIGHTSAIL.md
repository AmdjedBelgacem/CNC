# Deploy to AWS Lightsail (single origin) — Frontend + Backend + Caddy + Redis

This replaces the dual Vercel (frontend) + Fly.io (backend) layout with one host:

```
Browser ──► Caddy :443 ──┬── /api/proxy/*, /socket.io/*, /auth/oauth/*, /uploads/* ──► Backend :4000 (Nest)
                          └── everything else ────────────────────────────────────────► Frontend :3000 (Next)
```

Redis and Meilisearch are internal only. Supabase Cloud is external and stays put.
The browser never talks to a second host.

---

## 1. Prerequisites

- One Ubuntu 22.04/24.04 host (Lightsail or otherwise) with a public IP.
- This repository on the host (rsync or git clone).
- The existing Supabase project (`DATABASE_URL`, keys, buckets) you have been using.

---

## 2. Lightsail console (AWS clicks)

1. **Create instance** → Ubuntu 24.04 LTS, small burstable ($12/mo gets you 4 GB; 1 GB and 2 GB tiers exist but are uncomfortable for Node build — see §10).
2. Name it, create, wait for it to reach **Running**.
3. Open its **Networking** tab → **Firewall**:

   | Protocol | Port | Source |
   | --- | --- | --- |
   | SSH | 22 | your IP only (or 0.0.0.0/0 while testing) |
   | HTTP | 80 | 0.0.0.0/0 |
   | HTTPS | 443 | 0.0.0.0/0 |

   Keep **the instance firewall and the UFW configured in bootstrap in sync** — they are
   two separate layers. The docs' UFW section mirrors what bootstrap does.
4. **Attach a static IP** (Networking → Attach static IP) and create the DNS A record
   `barootcnc.com → <static-ip>` at your DNS provider. Also `www` if you use it.

---

## 3. SSH in

```bash
ssh -i "/Users/mac/programming/projects/pem keys/Cnc-ap-south-1.pem" ubuntu@<host-ip>
```

---

## 4. Bootstrap the host

```bash
cd /opt/titanic/cnc   # or wherever you rsync'd it
sudo bash scripts/lightsail/bootstrap.sh
```

What it does (all idempotent):

- Installs Docker Engine 27 + the compose plugin.
- Adds a **2 GiB swap file**. On a ~1.9 GiB instance this is not optional — `next build`
  and `docker build` both need headroom and will OOM-kill without it.
- Opens UFW to **22 (SSH), 80, 443 only**, default-deny inbound.
- Installs and enables fail2ban with an SSH jail (maxretry 5 → 1h ban).
- Enables unattended security upgrades.
- Prepares `/opt/titanic` with the right ownership and a default docker json log cap.

Run it again after a reboot or a fresh host; each step checks state first.

---

## 5. Get the repo onto the host

```bash
rsync -av --exclude node_modules --exclude .next --exclude .git \
  /path/to/local/cnc/ ubuntu@<host-ip>:/opt/titanic/cnc
```

Or clone from your fork and checkout the same branch.

---

## 6. Configure secrets (.env)

```bash
cd /opt/titanic/cnc/deploy/lightsail
cp .env.example .env
chmod 600 .env
$EDITOR .env
```

Required (see the matrix in §9 — **real** values, `.env` stays untracked):

`DOMAIN`, `ACME_EMAIL`, `FRONTEND_URL`, `DATABASE_URL`, `SUPABASE_URL`,
`SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_JWKS_URL`,
`AUTH_SECRET`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `RESEND_API_KEY`,
`SMTP_FROM`, `S3_*` (all six), `AI_ASSISTANT_ENCRYPTION_KEY`.

Optional (leave unset to keep the safe degradation):

`MEILISEARCH_HOST` / `MEILISEARCH_API_KEY`, `MOYASAR_*`, `NEXT_PUBLIC_WS_URL`, `GA/METRICS`.

> **Keep `DATABASE_URL` host on port 5432 and `DATABASE_POOL_MAX` at 10.** Supabase's
> session-mode pooler caps at 15 clients across everything that touches the project,
> and 20 already broke one of the earlier deployments with EMAXCONNSESSION.

> **Generate strong values** for every `_SECRET` and `_KEY`:
> `openssl rand -hex 32`. Never reuse a secret from Vercel/Fly `.env.local` files.

---

## 7. Build and launch

```bash
cd /opt/titanic/cnc
sudo bash scripts/lightsail/deploy.sh
```

It runs `docker compose ... build --pull`, then `up -d`, then smokes the stack
from inside the compose network. First build is the long one: on 2 GB it can
take 5–10 minutes as Next.js type-checks. Subsequent builds are cached.

Expected output ending in `compose ps` and no failures. If it fails mid-build:

```bash
sudo docker compose -f deploy/lightsail/docker-compose.yml --project-name titan logs --tail=80 backend
sudo docker compose -f deploy/lightsail/docker-compose.yml --project-name titan logs --tail=80 frontend
```

---

## 8. Make it public (DNS + TLS)

Once `http://$DOMAIN/__ping` answers (you can fake an earlier answer by editing
`/etc/hosts` on your laptop to map `$DOMAIN` to the server's IP):

```bash
# on the server:
curl -fsS http://localhost/__ping              # should print 'pong'
# from your laptop now that DNS is live:
curl -fsS http://$DOMAIN/__ping
curl -fsS https://$DOMAIN/__ping               # Caddy has provisioned TLS
curl -fsS https://$DOMAIN/api/proxy/health | head -c 300
```

That last call is the round trip through Caddy → Next → proxy → Fly-equivalent
(here Caddy → frontend → backend through the API_URL) that proves the whole path.

### Pointing Supabase at the new origin

Supabase Cloud stores nothing from this deployment, but its **Auth settings reference
the old Vercel domain**. Update them now:

1. Authentication → URL Configuration:
   - **Site URL** → `https://$DOMAIN`
   - **Redirect URLs** → `https://$DOMAIN`, `https://$DOMAIN/auth/callback`

2. Search Console (if you register the OAuth client there too): same redirect
   URIs, added to the existing Google OAuth client.

3. Moyasar / Resend webhooks that currently hit the Vercel origin: update to
   `https://$DOMAIN/...`.

---

## 9. Env-variable matrix

| Variable | Lives in | Value |
| --- | --- | --- |
| `DOMAIN` | `deploy/lightsail/.env`, Caddy container env | `barootcnc.com` |
| `ACME_EMAIL` | Caddy env | `ops@barootcnc.com` |
| `API_UPSTREAM` / `FRONTEND_UPSTREAM` | Caddy env | `backend:4000` / `frontend:3000` |
| `API_URL` | frontend container env | `http://backend:4000` |
| `NEXT_PUBLIC_SITE_URL` | baked into the frontend image at build | `https://$DOMAIN` |
| `NEXT_PUBLIC_API_URL` | baked into the frontend image | blank |
| `NEXT_PUBLIC_WS_URL` | baked into the frontend image | blank (same-origin WS) |
| `NEXT_PUBLIC_DEFAULT_TENANT_SLUG` | baked in | `cnc-fundamentals` |
| `NEXT_PUBLIC_REALTIME_MODE` | baked in | `auto` |
| `FRONTEND_URL` | backend container env | `https://$DOMAIN` |
| `CORS_ORIGINS` | backend container env | `https://$DOMAIN` (usually empty → falls back to FRONTEND_URL) |
| `DATABASE_URL` | backend env | Supabase session pooler, port 5432 |
| `DATABASE_POOL_MAX` | backend env | `10` (Supabase cap is 15) |
| `REDIS_URL` | backend env | `redis://redis:6379/0` |
| `MEILISEARCH_HOST` | backend env | blank, or `http://meilisearch:7700` if you enable the `search` profile |
| `MEILISEARCH_API_KEY` | backend env and meilisearch container env | any long string when the profile is on |
| `SUPABASE_*` | backend env | keys rotated from earlier docs (the new `ccnbudci…` project) |
| `S3_*` | backend env | same project, same `uploads`/`media` buckets |
| `RESEND_API_KEY` + `SMTP_FROM` | backend env | `notifications@$DOMAIN` on a verified Resend domain |
| `AI_ASSISTANT_ENCRYPTION_KEY` | backend env | `openssl rand -hex 32` |
| `MOYASAR_*` | backend env | leave empty to disable payments (fails closed) |

> The single frontend switch is **API_URL**. Change it and rebuild the backend;
> flipping it to `https://api.some-host` later moves the API without touching Next.

---

## 10. RAM plan

Measured steady-state (this app, backend alone): ~180 MB. Building the image is
what hurts — `next build` peaks around 1.2–1.5 GB. Running on 1 GB RAM will OOM-kill
the build. Recommendation, tightest-to-loosest:

| RAM | Verdict for production |
| --- | --- |
| **4 GB** (instance $27/mo) | ✅ Comfortable, build without swap, room for Redis + Meili |
| **2 GB** (instance $18/mo) | ⚠️ Works but fragile — swapfile + sequential builds (`--parallel false`), no Meilisearch in-memory traffic |
| **1 GB** (instance $7/mo) | ❌ Not production-viable — you will lose builds and Redis on traffic |

The DreamCompute `DCNM1` `small` (4 GB / 80 GB SSD) at roughly $27/mo is the sweet
spot here. Keep Meilisearch on its `search` profile skipuntil RAM allows.

---

## 11. Smoke checklist

Run these from your laptop once DNS is live and Caddy has TLS:

```bash
D=https://barootcnc.com

# Caddy TLS and public ping
curl -fsS "$D/__ping"                                     # -> pong
curl -fsSI "$D/"                                           # -> 200, text/html

# Backend, through Caddy's backend routes (proves the direct paths work)
curl -fsS "$D/api/proxy/health" | head -c 300              # -> backend JSON, status degraded OK

# The BFF path specifically (Caddy sends it to Next which proxies with serverApiUrl)
curl -fsS -X POST "$D/api/proxy/auth/register" \
  -H 'content-type: application/json' -H 'x-tenant-slug: cnc-fundamentals' \
  -d '{"email":"check@example.com","password":"Str0ng-Probe!9","name":"Probe"}'
# Expect 201, account created — or 500 if the tenant is missing (it exists, so should be 201).

# Auth via the BFF (set cookie then call /me)
curl -fsS -c /tmp/cj -X POST "$D/api/proxy/auth/login" \
  -H 'content-type: application/json' -H 'x-tenant-slug: cnc-fundamentals' \
  -d '{"email":"check@example.com","password":"Str0ng-Probe!9"}' >/dev/null
curl -fsS -b /tmp/cj "$D/api/proxy/auth/me" -H 'x-tenant-slug: cnc-fundamentals'

# Socket.IO through Caddy (no WS upgrade test yet, just the polling handshake)
curl -fsS "$D/socket.io/?EIO=4&transport=polling&tenant=cnc-fundamentals" | head -c 80

# Unknown tenant returns 404, not a 500 UUID leak
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$D/api/proxy/auth/register" \
  -H 'content-type: application/json' -H 'x-tenant-slug: ghost' \
  -d '{"email":"g@example.com","password":"Str0ng-Probe!9","name":"G"}'
```

If real websockets are needed (chat/notifications): confirm Socket.IO handshake on
`?EIO=4&transport=websocket` returns the upgrade packet. Vercel never proxies the
upgrade; this deployment does.

---

## 12. Rollback

The old Vercel+Fly path is unaffected — both are still up until you decommission
them. Rollback path:

1. `docker compose -f deploy/lightsail/docker-compose.yml --project-name titan down` on the Lightsail host.
2. Revert DNS `A` record → the old host.
3. Or simpler: keep DNS and point `API_URL` back at the old Fly origin (`https://baroot-api.fly.dev`) in
   `deploy/lightsail/.env`, then `--no-build` up again.

Nothing on Supabase changes — `DATABASE_URL`, keys, buckets, and auth config stay
exactly as they are for the Vercel/Fly deployments. Rollback is a DNS or one-env-line
answer.

---

## 13. Things intentionally NOT in scope

- Multiple regions or load balancer: the host is a single point of failure. Supabase
  Cloud has its own durability; if the Lightsail box is lost, the data and auth stay and
  only DNS has to move.
- Automated TLS renewals: Caddy handles Let's Encrypt rotation natively, and the
  `caddy_data` volume survives restarts.
- Monitoring: log rotation is set in compose (`max-size: 30m`,3 files). For proactive
  alerts, watch `/health` from UptimeRobot or similar rather than pulling in Prometheus.