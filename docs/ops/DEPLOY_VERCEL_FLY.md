# Deploy: frontend on Vercel, backend on Fly.io

Split the platform so each host pays for the thing it is good at. Vercel runs a
containerless Next.js app — no long-lived Node process, billed on builds and
bandwidth. Fly.io runs one small always-on machine holding the Nest server and its
Socket.IO connections, which a serverless function cannot do.

One codebase. One switch: the frontend reads `API_URL`, so moving the backend to
Hetzner later is a single env change and a redeploy.

---

## Why this split

| Concern | Where | Why not the other side |
| --- | --- | --- |
| SSR, RSC, image optimisation, CDN | Vercel | — |
| Long-running Nest server | Fly | Vercel Functions cannot hold a WebSocket; the previous container service worked but billed container build minutes |
| Socket.IO at `/ws` | Fly | A scale-to-zero serverless instance cannot complete a handshake inside the client's 8s timeout |
| Postgres / Auth / Storage | Supabase Cloud | unchanged, external to both |

---

## ⚠️ Cutover order

**Fly first. Vercel second.**

`vercel.json` in this repo now declares a frontend-only project whose rewrites
point at `${API_URL}`. If you deploy Vercel before Fly exists, every
`/api/proxy/*` request and every server-side fetch fails and the site goes down.
There is no fallback: that is the point of a single backend origin.

1. Deploy Fly.
2. `curl https://<app>.fly.dev/health` — must return JSON.
3. Set `API_URL` on Vercel and deploy.

---

## 1. Fly.io — backend

### 1.1 Install and authenticate

```bash
curl -L https://fly.io/install.sh | sh
fly auth login
```

### 1.2 Create the app from `fly.toml`

```bash
cd /Users/mac/programming/projects/cnc
fly launch --no-deploy --copy-config --name baroot-api
```

`fly.toml` is already committed, so `--copy-config` uses it verbatim. It specifies:

- `shared-cpu-1x`, 256 MB (Fly's smallest)
- `min_machines_running = 1` — see [Cost](#cost) before you run this
- health check on `/health` every 15s
- `DATABASE_POOL_MAX = 10` — **not** the schema default of 20

### 1.3 Set secrets

Secrets are not in git and are not passed on the command line. Create a
git-ignored file (`chmod 600`) and let Fly parse it:

```bash
umask 077
cp .env.example .env.fly
$EDITOR .env.fly      # fill in real values; delete keys you do not need
```

Then:

```bash
./scripts/fly/deploy.sh --secrets
```

`--from-file` means no secret value ever appears in `ps` or in shell history.

Required on Fly (full matrix at the end):

```bash
fly secrets set --app baroot-api \
  DATABASE_URL=... \
  AUTH_SECRET=... \
  JWT_ACCESS_SECRET=... \
  JWT_REFRESH_SECRET=... \
  SUPABASE_URL=... SUPABASE_SECRET_KEY=... SUPABASE_AUTH_ENABLED=true \
  RESEND_API_KEY=... \
  S3_ENDPOINT=... S3_ACCESS_KEY=... S3_SECRET_KEY=... S3_BUCKET=... \
  AI_ASSISTANT_ENCRYPTION_KEY=... \
  FRONTEND_URL=https://<your-vercel-production-domain>
```

### 1.4 Deploy and verify

```bash
./scripts/fly/deploy.sh          # or: fly deploy --app baroot-api
fly status --app baroot-api
curl -fsS https://baroot-api.fly.dev/health | jq
```

`/health` must return JSON. Expect `overall: degraded` with `redis: degraded`
until you provision Redis — that is the honest report, not a failure.

---

## 2. Vercel — frontend

The project must be **frontend only**. `vercel.json` no longer declares a
`services` block or `"runtime": "container"`.

### 2.1 Project settings

| Setting | Value |
| --- | --- |
| Root Directory | `apps/frontend` |
| Framework Preset | Next.js |
| Install Command | `cd ../.. && pnpm install --frozen-lockfile` |
| Build Command | `cd ../.. && pnpm turbo build --filter=@titan/frontend` |
| Node.js | 24.x |

Both commands climb out of `apps/frontend` because the app is one package of a
pnpm workspace and needs `packages/shared`.

> **Before your first deploy, delete the old container service.** If the project
> still carries the `services` block from the previous layout, Vercel keeps
> building the backend as well. `vercel.json` is the source of truth once
> committed; if the dashboard still shows two services, the project predates this
> change and needs recreating.

### 2.2 Environment variables (Production)

| Variable | Value | Notes |
| --- | --- | --- |
| `API_URL` | `https://baroot-api.fly.dev` | The single switch. Server-only. |
| `FRONTEND_URL` | your Vercel production URL | Kept in sync with Supabase |
| `NEXT_PUBLIC_SITE_URL` | your Vercel production URL | Canonical + OG |
| `NEXT_PUBLIC_API_URL` | your Vercel production URL | Fallback only; `API_URL` wins |
| `NEXT_PUBLIC_WS_URL` | *leave empty* | See [WebSockets](#websockets) |
| `NEXT_PUBLIC_DEFAULT_TENANT_SLUG` | your tenant slug | |
| `NEXT_PUBLIC_REALTIME_MODE` | `auto` | |

Preview deployments need nothing extra — `*.vercel.app` is allowed by suffix.

### 2.3 Deploy

```bash
vercel --prod
```

---

## 3. Supabase Auth redirect URLs

Auth → URL Configuration → **Redirect URLs**, add:

```
https://<your-vercel-domain>
https://<your-vercel-domain>/auth/callback
```

Site URL → your Vercel production domain.

**Until this is done, every email link 400s and Google/GitHub OAuth is broken.**
This is the single most common thing forgotten after moving a frontend domain.

Also verify: Resend sending domain verified, and the Moyasar webhook URL points at
the new frontend (payments stop verifying otherwise).

---

## 4. WebSockets — read this before enabling realtime

Vercel **does not proxy WebSocket upgrades** through rewrites. Their own community
threads confirm `wss://` rewrite destinations are ignored; HTTP works, the upgrade
does not. So the `/socket.io/:path*` rewrite in `vercel.json` carries Socket.IO's
**HTTP long-polling transport only**.

That is fine, and is the recommended default:

- `NEXT_PUBLIC_WS_URL` stays **empty**, so the browser goes same-origin to
  `/socket.io/…`, the rewrite forwards to Fly, and `transports: ['websocket',
  'polling']` tries the upgrade, fails, and settles on polling.
- Polling costs more requests and more latency than a real WebSocket. For chat and
  notifications on a small site that is acceptable.

### Do not point `NEXT_PUBLIC_WS_URL` at the Fly host

It looks like the clean fix and it is not. The auth cookie is `__Host-access`,
which is **host-only by definition** — it has no `Domain` attribute, so the
browser will not send it to `baroot-api.fly.dev`. A cross-origin socket would
connect *unauthenticated*, because the frontend's socket clients do not send a
token in `handshake.auth`.

Three real options, in order of effort:

1. **Stay on polling.** Nothing to change.
2. **Serve the frontend from a subdomain of the API domain** and relax
   `__Host-` to `__Secure-` plus an explicit `Domain`. Weakens the cookie
   guarantee — not recommended casually.
3. **Pass the access token in `handshake.auth`.** The gateway already reads
   `client.handshake.auth.token` before the cookie, so this is a small frontend
   change in the two socket clients. Requires an access token reachable in the
   browser (yours is `httpOnly`, so it needs an endpoint or a memory copy).

---

## 5. Cookies and CORS

Cookie policy is unchanged and needs no edit: `__Host-access` / `__Host-refresh`,
`httpOnly`, `Secure` in production, `SameSite=Lax`, `Path=/`. They are set by the
Vercel origin via `/api/proxy/*`, so the browser only ever talks to one origin and
cross-site cookie rules never come into play. That is the reason to keep the BFF
rather than calling Fly directly from the browser.

CORS accepts a comma-separated list from `CORS_ORIGINS`, falling back to
`FRONTEND_URL`, and matches `*.vercel.app` by suffix so preview origins need no
configuration. `apps/backend/src/common/http/cors-origins.ts` is shared by the
REST CORS block and the Socket.IO gateway — before this they resolved the same
variable two different ways.

The Fly host is publicly reachable, so it is also directly callable. That is
acceptable because every protected route is behind `JwtAuthGuard`; there is no
additional origin to lock down.

---

## 6. Redis and Meilisearch

| Service | Recommendation |
| --- | --- |
| Redis | **Upstash** free tier. `REDIS_URL=rediss://…:6379`. No free managed Redis exists on Fly, so Upstash is the only zero-cost path. |
| Redis (Fly native) | `fly redis create` — billed like any other machine, so not free. |
| Redis (unset) | App boots; `/health` reports `redis: degraded`; rate limiting falls back to the database and the public cache is bypassed. Functional, slower. |
| Meilisearch | Optional. Unset means search falls back to Postgres, which is correct but slower. No free managed tier worth depending on. |

Never point `REDIS_URL` at another application's Redis: the throttler and the
public cache share the keyspace and will evict each other.

---

## 7. Smoke checklist

Run in order. Stop at the first failure.

```bash
APP=baroot-api
D=https://your-vercel-domain

# 1. Backend up and reporting honestly
curl -fsS https://$APP.fly.dev/health | jq '.status, .checks'

# 2. Frontend serving
curl -fsS -o /dev/null -w '%{http_code}\n' $D/

# 3. Public read through the BFF
curl -fsS -o /dev/null -w '%{http_code}\n' $D/api/proxy/courses

# 4. Signed-up session survives the domain change
curl -s -c /tmp/j -X POST $D/api/proxy/auth/register \
  -H 'content-type: application/json' \
  -H "x-tenant-slug: $TENANT" \
  -d '{"email":"probe@example.com","password":"Str0ng-Probe!9","name":"Probe"}'
curl -fsS -b /tmp/j $D/api/proxy/auth/me -H "x-tenant-slug: $TENANT"
grep -c '__Host-access' /tmp/j     # HttpOnly cookies are prefixed in the jar

# 5. Uploaded media still resolves (this is the rewrite most likely to be missed)
curl -fsS -o /dev/null -w '%{http_code}\n' $D/uploads/<a-real-file>

# 6. Realtime settles on polling
#    DevTools -> Network -> WS: expect the websocket attempt to fail, then
#    repeated /socket.io/?EIO=4 polling requests to succeed.
```

---

## <a name="cost"></a>8. Cost reality

`min_machines_running = 1` is **not free**. Fly's free allowance does not cover an
always-on machine, so this is roughly USD 2–5/month for `shared-cpu-1x` at 256 MB,
billed hourly whether or not anyone is on the site.

It buys realtime. If you would rather pay nothing:

```toml
[http_service]
  min_machines_running = 0
  auto_stop_machines = "stop"
  auto_start_machines = true
```

…and set `NEXT_PUBLIC_REALTIME_MODE=polling` on Vercel, which skips sockets
entirely and uses the existing REST poller. Everything else keeps working.

On 256 MB: the image's `NODE_OPTIONS=--max-old-space-size=512` is **larger** than
the machine, and that is deliberate. V8 sizes its heap against the limit it is
given, so an unbounded heap means the kernel OOM-kills the process before V8 feels
pressure and collects. Measured working set is ~178 MB. If you see restarts under
load, raise to `fly machine update --memory 512` and set
`NODE_OPTIONS=--max-old-space-size=384` — do not tune anything else first.

---

## <a name="hetzner"></a>9. Moving to Hetzner later

**Nothing about the backend changes except the URL.**

What stays identical: the `Dockerfile` (same image Fly runs), `fly.toml` (ignored),
every Nest module, the DB schema, and the frontend source.

```bash
docker build -t baroot-api .
docker run -d --name baroot-api --restart unless-stopped \
  -p 8080:8080 --env-file /srv/baroot/api.env baroot-api
# TLS: Caddy or nginx in front, terminating on :443 and proxying to :8080
```

Then **one change**, on Vercel:

```
API_URL=https://api.your-domain.com
```

`vercel.json`, `next.config.ts` and the BFF resolve through `API_URL`, so the
frontend needs no code edit and no rebuild of anything else. `docker-compose.yml`
and `docs/LOCAL_DEV.md` are untouched and still describe the local stack.

---

## 10. CI notes

Nothing new is required. If you add a deploy job:

- **Vercel** — `vercel pull --yes --environment=production`, then `vercel build`
  and `vercel deploy --prebuilt`. Use a scoped, expiring token; do not echo it.
- **Fly** — `fly auth login --token $FLY_API_TOKEN` from a repo secret, then
  `fly deploy --remote-only`. Add `flyctl` from `superfly/flyctl-actions`.
- **Order in CI** — backend first, then wait for `/health`, then frontend. A green
  frontend build proves nothing if the backend origin is dead.
- `scripts/scan-secrets.sh` runs in CI already and will fail on any committed
  `.env.fly`.
---

# Run log — the deploy that actually happened

Recorded 2026-10-06. Commands are real and redacted; no secret value appears here.

## Live URLs

| Role | URL |
| --- | --- |
| Backend (Fly) | `https://baroot-api.fly.dev` |
| Frontend (Vercel) | `https://cnc-web-topaz.vercel.app` |
| Vercel project | `cnc-web` (Next.js, Root Directory `apps/frontend`) |
| Fly app | `baroot-api`, `shared-cpu-1x` / 256 MB, `min_machines_running = 1` |
| Superseded | Vercel project `cnc` — safe to delete |

## What was run

```bash
# Fly
fly launch --no-deploy --copy-config --name baroot-api   # then fly.toml restored
umask 077 && cp .env.example .env.fly && $EDITOR .env.fly # 33 keys, mode 600, gitignored
./scripts/fly/deploy.sh --secrets                          # flyctl 0.4.x has no --from-file
./scripts/fly/deploy.sh
fly scale count 1 --yes --app baroot-api                   # deploy left 2 machines running
curl -fsS https://baroot-api.fly.dev/health

# Vercel
rm -rf .vercel
vercel link --yes --project cnc-web --scope <team>
# Root Directory=apps/frontend via the Vercel API
vercel env add API_URL production --no-sensitive
vercel deploy --prod
```

Build time fell from **12 minutes** (backend container on Vercel) to **1–3 minutes**
(frontend only). That is the consumption win in concrete terms.

## Four things that broke, and why

**1. `fly launch` overwrote `fly.toml`.** `--copy-config` still regenerated it and emitted
`[[vm]] memory = '1gb'`. Leaving the block out to mean "the default" had stopped meaning
the smallest machine — at 1 GB the cost is ~4x. Now pinned explicitly.

**2. Two machines ran after one deploy**, each billed hourly. `fly scale count 1` fixed
it. Check `fly machine list` after every deploy.

**3. `vercel.json` must live at `apps/frontend/vercel.json`.** With Root Directory set to
`apps/frontend`, Vercel reads `vercel.json` from *inside* it; the repo-root copy is
silently ignored and the build falls back to Vercel's Next.js defaults.

**4. Backend routing: three layers, only one works.**

| Layer | Result |
| --- | --- |
| `next.config` rewrites | Middleware runs first and its matcher is a catch-all, so `/socket.io` and `/auth/oauth` got the Next.js 404 page. |
| `vercel.json` rewrites | `${API_URL}` did not expand. Hardcoding the Fly URL worked instantly — which is how the cause was isolated — but loses the single-switch property. |
| **middleware** | **Works.** Runs first, and in the `nodejs` runtime `process.env` is fully readable, so `API_URL` works even as a Secret. |

`/socket.io` also needs its trailing slash restored: Vercel strips it before middleware
sees the request, so forwarding bare `/socket.io` gave Fastify `Cannot GET /socket.io`.

## Socket.IO was never mounted — pre-existing

`@nestjs/platform-fastify` ignores `@WebSocketGateway` until an adapter is registered, and
none ever was, so nothing served `/socket.io` and every handshake 404'd. It was invisible
because the frontend degrades to its REST poller, and the docs claimed realtime worked
based on the rewrite existing rather than on a socket ever opening.

Fixed by `app.useWebSocketAdapter(new IoAdapter(app))`. Direct on Fly and through the
public origin the handshake now returns the Engine.IO OPEN packet. The **websocket upgrade
still cannot traverse Vercel**; long-polling does, which is the working path.

## Smoke results

| Check | Result |
| --- | --- |
| `GET https://baroot-api.fly.dev/health` | **200** — `degraded`: database/auth/storage/email up, redis + search degraded (unprovisioned) |
| Vercel `/`, `/academy`, `/courses`, `/about` | **200** |
| `POST /api/proxy/auth/register` | **201** — authenticated, role `learner`, `authUserId` set |
| `GET /api/proxy/auth/me` with cookies | **200** — same user; `__Host-access` + `__Host-refresh` set |
| `/socket.io?EIO=4&transport=polling` | **200** — Engine.IO OPEN packet |
| `/auth/oauth/google` | **302** to the backend |
| CORS, production origin | allow-origin set, credentials allowed |
| CORS, foreign origin | no allow-origin header |
| Guards | `/auth/me` and `/admin/email/*` → **401** unauthenticated |
| Nest container on Vercel | **none** — preset Next.js, Root Directory `apps/frontend` |

## Human-only steps still outstanding

**1. Supabase Auth URL Configuration.** Read-only with the service-role key
(`/auth/v1/admin/settings` → 404). In the dashboard:

- Site URL → `https://cnc-web-topaz.vercel.app`
- Redirect URLs → include the same, plus `https://cnc-web-topaz.vercel.app/auth/callback`

Lower urgency than usually stated: the frontend uses **no** Supabase browser SDK, so auth
flows through the Nest BFF and the app's own verification/reset links are built from
`FRONTEND_URL`. The allowlist only affects OAuth, which has no client IDs configured at all.
`mailer_autoconfirm` is `false`, consistent with the intended policy.

**2. Delete the superseded Vercel project `cnc`.** It still holds the old container service
and the previous environment. Keep it until the new deployment has run a day.

**3. Resend sending domain.** Still unverified — `verificationEmailSent` reports `false`
and no real mail can leave.

**4. Moyasar webhook** must point at `https://cnc-web-topaz.vercel.app` or payments stop
verifying.

**5. Upstash Redis.** Free tier; set `REDIS_URL` on Fly. Until then rate limiting uses the
database fallback and `/health` stays `degraded`.

## Test accounts created during the smoke run

`probe*@example.com`, `smoke*@example.com` and `final*@example.com` rows exist in
production Supabase. Delete them before launch:

```sql
delete from users
 where email like 'probe%@example.com'
    or email like 'smoke%@example.com'
    or email like 'final%@example.com';
```
