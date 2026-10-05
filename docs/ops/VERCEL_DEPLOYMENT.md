# Deploying to Vercel (frontend + backend services)

One Vercel project, two services, one domain. The frontend owns all public traffic; the
backend is **internal** and reached over a service binding.

```
                      ┌──────────────────── your-domain.com ─────────────────────┐
  /auth/oauth/*  ───► │                                                        │
  /socket.io/*   ───► │  backend — CONTAINER service (long-running Node)        │
                      │      ▲                                                 │
                      │      │ private link — binding API_INTERNAL_URL           │
  /*  (catch-all) ──► │  frontend (Next.js) ──► /api/proxy/* ────────────────────┘
                      └────────────────────────────────────────────────────────┘
```

## Topology

| Service | Root | Runtime | Public? | Reached by |
| --- | --- | --- | --- | --- |
| `frontend` | `apps/frontend` | Next.js function | Yes — catch-all `/(.*)` | Browser |
| `backend` | `.` (repo root) | **container** | `/auth/oauth/*`, `/socket.io/*` | Binding from `frontend` |

### Why the backend is a container

It was first deployed as a Node function, which failed at the launcher with
`Invalid export found in module "/var/task/main.js"` across several correctly-delivered
attempts (`.cts` + `export =`, and CommonJS emit). A container runs the same long-running
`node dist/main.js` that serves `/health` locally, so local and production behaviour are
identical by construction — and it also allows the Socket.IO connections at `/ws` to be
held, which a function cannot do.

The Dockerfile lives at the **repository root** because Vercel uses the service root as
the container build context, and the image needs the whole pnpm workspace. Hence
`"root": "."` for the backend service.

`apps/admin` (Payload CMS) is **not** part of this project — it deploys separately.

## Why the backend is internal

All browser API traffic already goes to the frontend's own proxy: `api-client.ts` sets
`BROWSER_BASE = '/api/proxy'`. The proxy then calls the backend **server-side**, where it
uses `API_INTERNAL_URL` — the binding. So no `/api/*` public rewrite is needed, and the
backend is never exposed to the internet.

Two paths are exposed publicly, because both are browser-initiated and cannot pass through
the frontend proxy:
- `/auth/oauth/*` — `connected-accounts/page.tsx` does `window.location.href = ...`, a
  full-page browser navigation.
- `/socket.io/*` — the Socket.IO transport endpoint. The namespace (`/ws`, `/chat`) is
  carried in the handshake, so one rewrite covers them all. Without it the upgrade request
  falls through to the catch-all and Next.js answers `308`. `connected-accounts/page.tsx` does
`window.location.href = ${NEXT_PUBLIC_API_URL}/auth/oauth/google` — a full-page browser
navigation that cannot go through a proxy. Hence the one narrow rewrite.

> **Why there is no `/api` rewrite:** the backend has no global prefix, so it serves
> `/courses` and `/auth/login` at its root. Vercel forwards rewrite paths unstripped, so
> `/api/courses` would reach the backend as `/api/courses` and 404 on every route.

## Project setup

1. **Import the repo** in Vercel. Vercel reads `vercel.json` and detects the two services.
2. **Add the env vars** below for each service (Project → Settings → Environment Variables,
   scoped per service).
3. **Deploy.** Both services build independently.
4. **Verify** with the checklist at the bottom.

Do not set `API_INTERNAL_URL` yourself — the binding injects it.

## Env vars — `backend` service

### Required: the process will not boot without these

`config.service.ts` refuses to start in production if any are missing, a placeholder, or
shorter than the minimum length.

| Var | Notes |
| --- | --- |
| `NODE_ENV` | Must be `production`. Selects `__Host-` prefixed, `Secure` cookies. |
| `DATABASE_URL` | Supabase **session pooler, port 5432** (not 6543 — that returns an empty `search_path`). URL-encode the password. |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `AUTH_SECRET` | Each needs real entropy (min length enforced). |
| `S3_BUCKET` | Public bucket, e.g. `uploads`. |
| `S3_MEDIA_BUCKET` | Private bucket for paid video, e.g. `media`. **Must differ from `S3_BUCKET`** or boot fails. |
| `S3_PUBLIC_URL` | Must contain the value of `S3_BUCKET`. |
| `S3_ACCESS_KEY`, `S3_SECRET_KEY` | Supabase Storage S3 keys. |

### Auth and Supabase

`SUPABASE_AUTH_ENABLED=true`, `SUPABASE_URL`, `SUPABASE_JWKS_URL`,
`SUPABASE_SECRET_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`), **and `SUPABASE_PUBLISHABLE_KEY`**
(or `SUPABASE_ANON_KEY`).

`SUPABASE_PUBLISHABLE_KEY` is easy to overlook and breaks password login when missing:
`SupabaseAuthClient` throws `not_configured`, and the login route maps any non-400 error
from Supabase to a generic `401 Authentication is unavailable` — which reads like bad
credentials rather than a missing env var. It is the key GoTrue needs for the password
grant, and it is public by design, so store it as Config.

### Routing / OAuth

| Var | Value |
| --- | --- |
| `FRONTEND_URL` | **Your Vercel domain.** Used as the CORS origin — if wrong, browser calls fail. |
| `API_PUBLIC_URL` | Your public API origin (used by OAuth callbacks and email links). |
| `NEXT_PUBLIC_API_URL` | **Your site origin**, not a backend URL. The OAuth redirect depends on it. |
| `GOOGLE_OAUTH_CLIENT_ID` / `_SECRET` / `_REDIRECT_URI` | Redirect URI must be `https://<domain>/auth/oauth/google/callback`. |
| `GITHUB_CLIENT_ID` / `_SECRET` | Callback `https://<domain>/auth/oauth/github/callback`. |

### Services with no Vercel equivalent — you must provision these

| Var | Notes |
| --- | --- |
| `REDIS_URL` | Hosted Redis required. Rate limiting falls back to the database without it. |
| `MEILISEARCH_HOST`, `MEILISEARCH_API_KEY` | Optional — search falls back to Postgres full-text, and `/health` reports `degraded`. |

### Optional integrations

`RESEND_API_KEY` (transactional email), `SMTP_*`, `MOYASAR_*`, `STRIPE_*`, `MUX_*`,
`AI_ASSISTANT_ENCRYPTION_KEY`, `AI_SECRET_ENCRYPTION_KEY`, `SECRETS_ENCRYPTION_KEY`,
`FX_RATES_URL`, `GOOGLE_ADS_DEVELOPER_TOKEN`.

`AI_PROVIDER_ALLOW_PRIVATE_HOSTS` permits the AI provider to call internal addresses
(SSRF). Note that `ai-provider.service.ts` already forces it **off** whenever
`NODE_ENV === 'production'`, so on Vercel it is inert — it is listed here only so nobody
"fixes" it by setting the variable.

## Env vars — `frontend` service

| Var | Value |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Your site origin (browser-visible; only the OAuth redirect needs it). |
| `NEXT_PUBLIC_SITE_URL` | Your site origin, used for canonical/OG metadata. |
| `NEXT_PUBLIC_DEFAULT_TENANT_SLUG` | e.g. `cnc-fundamentals`. |
| `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_SNAPCHAT_PIXEL_ID` | Optional analytics. |

`NEXT_PUBLIC_*` values are **inlined at build time** — changing one requires a rebuild,
not just a redeploy.

## Local testing

Run it from the repository root so it picks up `vercel.json`. Binding variables are
injected automatically, so proxy behaviour matches production.

```bash
# If the Vercel CLI is not installed globally:
npx vercel@latest dev

# ...or, to run everything without authenticating against Vercel Cloud:
npx vercel@latest dev -L
```

> `vercel dev` may not service WebSocket upgrades depending on CLI version.

## Post-deploy verification

```bash
DOMAIN=https://your-domain.com

# 1. Frontend serves the catch-all
curl -s -o /dev/null -w '%{http_code}\n' $DOMAIN/

# 2. OAuth rewrite reaches the backend (expect 302/401, NOT 404 from the frontend)
curl -s -o /dev/null -w '%{http_code}\n' $DOMAIN/auth/oauth/state

# 3. Proxy path is handled by the frontend and reaches the backend internally
curl -s -o /dev/null -w '%{http_code}\n' $DOMAIN/api/proxy/courses

# 4. No public surface leaks the backend
curl -s -o /dev/null -w '%{http_code}\n' $DOMAIN/courses   # frontend page, 200
```

Then confirm in the app: sign in, upload an avatar, open a course video, run a search, and
start an OAuth connection.


## Required in production (boot refuses without these)

`config.service.ts` calls `process.exit(1)` on invalid environment, so the container will
not start unless all of these are set. Discovered by booting the image, not from docs:

- `NODE_ENV=production`
- `DATABASE_URL`, `AUTH_SECRET`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
- `S3_BUCKET`, `S3_MEDIA_BUCKET`, `S3_PUBLIC_URL`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`
- `REDIS_URL` — **required**, despite degrading gracefully when unreachable
- `AI_PROVIDER_ALLOWED_HOSTS` — **required** (e.g. `api.openai.com`)
- `AI_ASSISTANT_ENCRYPTION_KEY` (or `AI_SECRET_ENCRYPTION_KEY`)

## Realtime

The container supports WebSockets. `NEXT_PUBLIC_REALTIME_MODE` defaults the frontend to
`polling`, which skips the socket entirely — set it to `auto` or `socket` to enable
realtime on the container.

## Verifying after deploy

```bash
D=https://your-domain.com
curl -s -o /dev/null -w '%{http_code}\n' $D/                                  # frontend
curl -s -o /dev/null -w '%{http_code}\n' $D/auth/oauth/state                  # backend
curl -s $D/api/proxy/health                                                    # binding path
curl -s "$D/socket.io/?EIO=4&transport=polling"                                # realtime
```

## Known gaps

These are **not** solved by this configuration:

**Resolved by the container migration:** the Nest-on-Fastify function-runtime export
problem, and the Socket.IO limitation (a function pins connections to one instance and
socket.io was not a supported framework there). Both are now moot.

Still open:

1. **Redis is unreachable in production, and rate limiting is effectively OFF.**
   `REDIS_URL` is still the placeholder, so `RedisThrottlerStorage` fails **open** — every
   request is allowed. That is the right failure mode for availability but it means
   `/auth/login` (limit 10/min), `/auth/forgot-password` (3/hour) and the admin write
   routes are currently unthrottled in production. Provision a hosted Redis and set
   `REDIS_URL`; until then treat the deployment as unsuitable for public sign-ups.
2. **Meilisearch is not configured.** Search falls back to Postgres full-text and
   `/health` reports `search: degraded`. Omit the variables rather than pointing them at
   `localhost`.
3. **`/health` has no public rewrite.** It matches the catch-all, so the frontend answers
   404. Use `$D/api/proxy/health` (which the binding reaches) or add a rewrite before the
   catch-all.
4. **Email is unconfigured** — no verified Resend domain and no Supabase Auth SMTP, so
   password-recovery and verification mail cannot be delivered. See
   `docs/ops/EMAIL_SETUP.md`.

## Rollback

`vercel.json` is inert until the project is deployed, so reverting the commit is safe:

```bash
git revert <commit>
```

Deployments are immutable on Vercel — use the dashboard to promote a previous
deployment rather than rebuilding.