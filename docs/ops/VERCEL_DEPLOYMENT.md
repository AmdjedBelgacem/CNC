# Deploying to Vercel (frontend + backend services)

One Vercel project, two services, one domain. The frontend owns all public traffic; the
backend is **internal** and reached over a service binding.

```
                      ┌───────────────────────── your-domain.com ─────────────────────────┐
  /auth/oauth/*  ───► │  backend (internal service, @vercel/node)                          │
                      │      ▲                                                          │
                      │      │ private link — binding API_INTERNAL_URL                    │
  /*  (catch-all) ──► │  frontend (Next.js) ──► /api/proxy/*  ────────────────────────────┘
                      └──────────────────────────────────────────────────────────────────────┘
```

## Topology

| Service | Root | Public? | Reached by |
| --- | --- | --- | --- |
| `frontend` | `apps/frontend` | Yes — catch-all `/(.*)` | Browser |
| `backend` | `apps/backend` | Only `/auth/oauth/*` | Binding from `frontend` |

`apps/admin` (Payload CMS) is **not** part of this project — it deploys separately.

## Why the backend is internal

All browser API traffic already goes to the frontend's own proxy: `api-client.ts` sets
`BROWSER_BASE = '/api/proxy'`. The proxy then calls the backend **server-side**, where it
uses `API_INTERNAL_URL` — the binding. So no `/api/*` public rewrite is needed, and the
backend is never exposed to the internet.

The single exception is the OAuth handshake. `connected-accounts/page.tsx` does
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
`SUPABASE_SECRET_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`).

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

## Known gaps

These are **not** solved by this configuration:

1. **Nest-on-Fastify behind the Vercel Node runtime is unverified.** Vercel documents
   Express, Hono, h3, Bun and Python — not Nest/Fastify. `src/vercel-entry.ts` delegates
   to Fastify's `request` listener so local and deployed behaviour match, but confirm with
   `vercel dev` and a real deploy. The fallback is switching Nest to the Express adapter.
2. **Socket.IO at `/ws` will not work.** Vercel Functions do support WebSockets (public
   beta, requires Fluid Compute), but socket.io is not a supported framework, and a
   connection is pinned to a single instance. `notification-socket-provider.tsx` and
   `chat-widget.tsx` need either an external WebSocket host or a polling fallback.
3. **`/health` is not publicly reachable.** It matches the catch-all, so it is handled by
   the frontend and returns 404, not by the backend. For uptime checks either add a
   rewrite (`{"source": "/health", "destination": {"service": "backend"}}` before the
   catch-all) or probe the internal service URL.

## Rollback

`vercel.json` is inert until the project is deployed, so reverting the commit is safe:

```bash
git revert <commit>
```

Deployments are immutable on Vercel — use the dashboard to promote a previous
deployment rather than rebuilding.