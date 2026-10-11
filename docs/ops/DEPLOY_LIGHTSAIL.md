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
---

## www.barootcnc.com handling (added Oct 7 2026)

DNS is intentional on both hosts pointing to the same static IP:

```
barootcnc.com     A  13.206.178.25
www.barootcnc.com A  13.206.178.25
```

Application canonical URL is the apex: `https://barootcnc.com`.

Caddy now serves both names, but keeps apex canonical:

```caddyfile
{$DOMAIN} {
    encode zstd gzip
    # ... full header + route set (socket.io/oauth/uploads/frontend) ...
}

# www and bare-HTTP both canonicalize to apex HTTPS
http://{$DOMAIN}, http://www.{$DOMAIN} {
    redir https://{$DOMAIN}{uri} permanent
}

www.{$DOMAIN} {
    redir https://{$DOMAIN}{uri} permanent
}
```

The www site block exists specifically so it can hold a certificate; without it
auto-TLS still fails for `https://www.…` even though it is only a redirect.

App code alignment for this stack:

- `FRONTEND_URL=https://barootcnc.com`
- `NEXT_PUBLIC_SITE_URL=https://barootcnc.com` (builds canonical hypertext)
- `CORS_ORIGINS` is empty, the backend derives from `FRONTEND_URL` deliberately
- Socket.io / OAauth absolute URLs should use the apex hostname; the middleware
  proxy forwards to `http://backend:4000`, so browsers stay on the apex host

Verification used:

```bash
curl -I https://www.barootcnc.com/                       # 301 -> apex
curl -I https://www.barootcnc.com/courses/...             # 301 -> apex path
curl -I -L https://www.barootcnc.com/api/proxy/health     # 200
curl -I https://barootcnc.com/                            # 200
```

## OAuth (Google) sign-in on this stack (Oct 7 2026)

Three separate things had to line up; each one failed on its own first.

| Symptom | Cause | Fix |
| --- | --- | --- |
| `/api/proxy/auth/oauth/google` 404, then a blank page | the browser was sent to a Next path that only exists under `/api` | frontend calls `/api/proxy/auth/oauth/*`; the proxy must use `redirect: 'manual'` and forward `Location` |
| `invalid_client` from Google | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` never reached the container | both are in `deploy/lightsail/docker-compose.yml` alongside `API_PUBLIC_URL` |
| lands on `/auth/callback?provider=google`, signed out | the callback returned a first-party JWT, which exclusive Supabase mode refuses; and it replied twice (`Reply was already sent`) | see `docs/SUPABASE_AUTH.md` → *Federated sign-in* |

If the callback ever needs re-checking without a browser:

```bash
cd /opt/titanic/cnc/deploy/lightsail
# 1. state + authorize hop (expect 302 to accounts.google.com)
curl -si -c /tmp/c.txt 'https://barootcnc.com/api/proxy/auth/oauth/state' 
curl -si -b /tmp/c.txt -c /tmp/c.txt -o /dev/null -w '%{redirect_url}\n' \
  'https://barootcnc.com/api/proxy/auth/oauth/google?state=<state>&redirect=1'
# 2. after signing in, the callback must set BOTH cookies once
docker compose logs --tail=200 backend | grep -E 'oauth/google/callback|Reply was already sent|Refresh token is not valid'
```

Expected on success: exactly one `302` to `/auth/callback`, two `Set-Cookie` headers
(`__Host-access`, `__Host-refresh`) carrying **Supabase** tokens, and `/auth/me` returning
the user. A local JWT in those cookies is the failure mode above.

## SSH access

The AWS **instance firewall** is the layer that actually gates port 22; UFW on the host
allows 22/80/443 from anywhere (see §4). If 443 answers but 22 times out:

```bash
nc -z -G 8 <host-ip> 22   # blocked here => the Lightsail console firewall, not UFW
```

Fix it in the console: Networking → Firewall → SSH 22 → Source = your current public IP
(`curl -s https://api.ipify.org`). Home ISPs hand out a new address often enough that a
pinned source silently locks you out, so widen to `0.0.0.0/0` while working and rely on the
key plus fail2ban, or keep the pin and re-pin when it changes.

## This host is RUNTIME ONLY — never build the frontend here (Oct 7 2026)

A Next.js production build on this 2 GB instance has **twice** driven the kernel
OOM-killer into rebooting the box. Both times the site went down *and* SSH became
unreachable (TCP :22 accepted, sshd never got a banner because the host was
swapping), which is indistinguishable from an intrusion if you did not know the
cause.

```
21:05  docker compose build frontend   -> next-build RSS ~1.4 GB, load 22+
21:27  reboot (kernel OOM)
21:29  reboot (kernel OOM)
```

### Policy

- **Never** run `next build`, `docker compose build frontend`, or any image build
  that includes the frontend on this host while the stack is serving.
- Build frontend images in CI or on a larger machine, then `docker save | docker load`.
- Only the **backend** image is built on the host, and only when its code changed.
- `scripts/lightsail/deploy.sh` enforces this: it refuses when `MemTotal < 4096 MB`
  and prints the off-box build recipe. It builds the backend only.
- The Dockerfile heap cap (`ENV NODE_OPTIONS=--max-old-space-size=1400` in the build
  stage) is a **safety net only**, not permission to build here.

```
# backend-only deploy (the supported path)
bash scripts/lightsail/deploy.sh

# frontend: build off-box, ship it, switch over
bash scripts/lightsail/push-frontend.sh
```

`push-frontend.sh` does the whole off-box path: cross-builds for `linux/amd64`, transfers the
image **gzipped**, retries the transfer, verifies it landed before touching anything, then
replaces `FRONTEND_IMAGE` in place and recreates only the frontend.

The retry and verification are the point. The SSH link drops without warning during long
transfers, and piping `docker save` straight into `ssh docker load` sends a few hundred megabytes
of uncompressed tar — a broken pipe halfway through leaves nothing usable on either side. Gzip
cuts the bytes, `set -o pipefail` turns a truncated stream into a failure rather than a silent
partial, and the image is only switched over once the host confirms it is present. A failed
attempt therefore costs a few minutes instead of leaving the box without a frontend.

Useful flags: `--tag <name>` to choose the tag, `--skip-build` to re-push an image already built
locally, `--push-only` to ship without restarting the service.

Underlying commands, if you ever need them by hand:

```sh
docker buildx build --platform linux/amd64 --load \
  -f apps/frontend/Dockerfile -t baroot/frontend:<tag> \
  --build-arg NEXT_PUBLIC_SITE_URL=https://barootcnc.com \
  --build-arg NEXT_PUBLIC_DEFAULT_TENANT_SLUG=cnc-fundamentals .
docker save baroot/frontend:<tag> | gzip | \
  ssh ubuntu@13.206.178.25 'gunzip | docker load'

# on the host: replace the key in place, never append (a second line is ambiguous)
cd deploy/lightsail
sed -i 's|^FRONTEND_IMAGE=.*|FRONTEND_IMAGE=baroot/frontend:<tag>|' .env
docker compose --project-name titan up -d --no-build frontend
```

`FRONTEND_IMAGE` is what makes this safe: with it set, compose uses the image that was
built elsewhere and **never invokes a build on this host**. Unset (a fresh clone), it
behaves exactly as before and builds locally.

Always pass `--no-build` on that `up`, and verify the image actually changed:

```bash
docker inspect titan-frontend-1 --format '{{.Config.Image}}'   # expect baroot/frontend:<tag>
docker exec titan-frontend-1 sh -c "grep -rl '<a string unique to your change>' /repo/apps/frontend/.next/static | head -1"
bash scripts/lightsail/smoke.sh
```

The second check matters: a stale container looks identical to a successful deploy
from the outside, and shipping a frontend is how you discover you did not.

### Host hardening applied

| Layer | Setting |
| --- | --- |
| sshd | `PasswordAuthentication no`, `KbdInteractive no`, `PermitRootLogin no`, `MaxAuthTries 4`, `AllowUsers ubuntu` — `/etc/ssh/sshd_config.d/50-baroot-hardening.conf` |
| UFW | `deny incoming`, allow 22/80/443, enabled at boot |
| fail2ban | `sshd` jail: maxretry 5, findtime 10m, bantime 1h |
| updates | `unattended-upgrades` + `apt-daily-upgrade.timer` |
| sysctl | `/etc/sysctl.d/99-baroot-hardening.conf` — redirects off, broadcast pings ignored, `rp_filter=2` (**loose, not 1**: this host is a Docker bridge router and strict mode drops container NAT return traffic) |
| secrets | `deploy/lightsail/.env` is `600`, no `.git` on the host, `.env.fly` quarantined out of the deploy tree |
| edge | HSTS, `X-Frame-Options SAMEORIGIN`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `Server` stripped |

If a frontend build is ever genuinely unavoidable, stop the stack first so ~600 MB
is free, and expect the site to be down for the duration:
`docker compose --project-name titan stop caddy backend frontend redis`.

## Lightsail console firewall parity (operator checklist)

The host-side UFW rules below are not sufficient on Lightsail: the **instance
firewall in the AWS console is a separate layer** and is checked *before* the host
ever sees a packet. If it disagrees with UFW, UFW is not the thing protecting you.

> AWS CLI on the ops laptop currently fails `InvalidClientTokenId` and the host has
> no CLI/credentials, so the console could not be verified or edited
> programmatically. It must be checked by hand.

Lightsail → **Instances** → select `barootcnc` → **Networking** → **Firewall**:

| Rule | Protocol | Port | Source | Notes |
| --- | --- | --- | --- | --- |
| SSH | TCP | 22 | **your current public IP** (`curl -s ifconfig.me`) | Never `0.0.0.0/0` in steady state |
| HTTP | TCP | 80 | `0.0.0.0/0` | ACME challenges + redirect to HTTPS |
| HTTPS | TCP | 443 | `0.0.0.0/0` | the only app port |

Verify there is **no other rule** — especially 3000 (frontend), 4000 (backend),
6379 (Redis), 2019 (Caddy admin) or 5432/6543 (Postgres). Nothing but Caddy should
ever have needed a host port, so any such rule is either dead or a mistake:

```bash
# host-side confirmation that only Caddy is published
sudo docker ps --format '{{.Names}} {{.Ports}}' | grep -E '0\.0\.0\.0'
# -> titan-caddy-1 0.0.0.0:80->80/tcp 0.0.0.0:443->443/tcp      (expected)
sudo ss -tlnp | grep -E ':3000|:4000|:6379'                     # -> empty (expected)
```

To open browser SSH (which bypasses the IP-pinned SSH rule) without widening it,
keep the SSH rule pinned to your IP and use the console **Connect** button instead.

**Before any `sshd` change:** take a snapshot (Networking → instance → **Snapshot**)
so a bad edit cannot lock the operator out; `sudo sshd -t` validates config, and
`sudo systemctl reload ssh` keeps existing sessions alive.

## Companion documents

| Document | Purpose |
| --- | --- |
| `docs/ops/CLOUDFLARE_IN_TERNT.md` | Putting Cloudflare in front, in the order that will not brick the site |
| `docs/ops/ROTATION_CHECKLIST.md` | Per-secret rotation procedure, cheapest blast radius first |
| `docs/ops/SUPABASE_HARDENING.md` | Dashboard MFA, leaked-password protection, RLS risk tables |
| `docs/ops/RECOVERY.md` | Snapshots, restore, and what a snapshot does not cover |
| `scripts/lightsail/smoke.sh` | One-command post-deploy / post-restore verification (exit 0 = healthy) |

Edge rate limiting lives in the Caddyfile (`auth_login`, `auth_write`, `oauth`,
`auth_refresh`). It needs the `caddy-ratelimit` module, which the official image does
not ship — see `CADDY_IMAGE` in `deploy/lightsail/.env` and the off-box build in
`apps/frontend`-style workflow documented in `scripts/lightsail/deploy.sh`:

```bash
# build OFF the production host (laptop or CI, targeting linux/amd64)
docker buildx build --platform linux/amd64 --load \
  -f deploy/lightsail/Caddyfile.Dockerfile -t baroot/caddy-ratelimit:2.10.2 .
docker save baroot/caddy-ratelimit:2.10.2 | gzip | \
  ssh ubuntu@13.206.178.25 'gunzip | docker load'
```

Application-layer abuse (repeated auth failures) is blocked by the `caddy-auth-abuse`
fail2ban jail, which reads Caddy's JSON access log from a path glob so it survives
container recreation, and bans on ports 80/443 only — never SSH.
