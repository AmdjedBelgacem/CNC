# Production Readiness — Findings and Fixes

Generated during the post-Supabase hardening pass. Every claim below was verified against
the running stack; nothing is asserted from reading code alone.

## Fixed in this pass

### Meilisearch indexing was silently broken (3 defects)

`POST /admin/search/reindex` returned `{"engine":"meilisearch","indexed":150}` while the index
held **0 documents**. Three independent defects, each of which fails the whole batch
asynchronously:

1. The index was never created with a primary key. The document shape has several `*id`
   fields, so Meilisearch cannot infer one and rejects the batch with
   `index_primary_key_multiple_candidates_found`.
2. The composite document id used `:` as a separator. Meilisearch identifiers allow only
   `[A-Za-z0-9_-]` → `invalid_document_id`.
3. Several entity ids contain `:` themselves (`static:about`, the static legal pages), so
   sanitising only the separator was not enough.

Because `searchMeili` then fell back to Postgres, `/health` and the API both looked healthy.
`documentId()` now sanitises the whole identifier and declares the primary key, and
`prepareMeiliIndex()` ensures the index exists.

Verified on a **fresh** Meilisearch instance: 150 documents, `engine=meilisearch`,
`/health` → `search: up`.

Regression cover: `test/search-index-ids.spec.ts` (8 tests).

### No assets were in Supabase Storage

Both buckets were **empty** while 35 files / 72 MB lived only in
`apps/backend/uploads/`, served by a local-filesystem static route. On any real deployment
the filesystem is ephemeral, so every lesson video and thumbnail would 404.

`scripts/migrate-local-assets.mjs` uploads them and rewrites the database references:

- lesson video + lesson thumbnail → private `media` bucket
- course/asset images → public `uploads` bucket
- stored as `tenants/<tenantId>/...` keys, because `StorageService.isKey()` only treats
  values starting with `tenants/` as storage keys and only those are signed
- each row is rewritten only after the uploaded bytes are re-downloaded and checksum-matched
- a reference whose folder was wrong (`/uploads/lessons/<x>` where the asset is in
  `/uploads/covers/`) is repaired by basename lookup rather than skipped

Verified after the run: private media object returns **HTTP 400** anonymously and
**HTTP 200 / 24,190,239 bytes** with the service key (byte-identical to the source file);
the public asset returns **HTTP 200** anonymously.

### Storage invariants now enforced at boot

`S3_BUCKET`, `S3_MEDIA_BUCKET` and `S3_PUBLIC_URL` are required in production, the media
bucket must differ from the public bucket, and `S3_PUBLIC_URL` must actually address the
public bucket. Without this the app silently falls back to local disk. Covered by
`test/storage-invariants.spec.ts` (10 tests).

### Secret hygiene

- `src/common/security/redact.ts` masks connection strings and known credential shapes
  (`sb_secret_*`, `re_*`, `AKIA*`, JWTs, password/token/api-key fields) — 12 tests.
- The Fastify logger now **explicitly** redacts `authorization`, `cookie`, `x-csrf-token`,
  `x-api-key` and `set-cookie`, and serialises requests without headers, rather than relying
  on Fastify's default request serializer happening to omit them.
- The stale commented-out database password was removed from the root `.env`.
- `docs/ops/CREDENTIAL_ROTATION.md` documents rotating every credential that appeared in
  session output.

### Operational visibility

`GET /health` and `GET /health/ready` report database, Supabase Auth (verified by fetching
the JWKS, not by trusting the env flag), Redis, search, storage and email. `/health` is
always 200; `/health/ready` returns 503 only when a dependency the API cannot work without is
down, so a Redis or Meilisearch outage does not pull the instance out of rotation.

---

## Open items — human action required

### 1. Resend domain + Supabase Auth SMTP (blocks all user email)

The Resend key is restricted to one recipient and no domain is verified, so password
recovery and verification emails cannot be delivered. Follow `docs/ops/EMAIL_SETUP.md`.

### 2. Rotate every credential exposed in session output

DB password, Supabase secret key, S3 secret key, Resend API key and the temporary superadmin
password. See `docs/ops/CREDENTIAL_ROTATION.md`. None are committed; all `.env` files are
gitignored.

### 3. `REDIS_URL` points at another application's Redis — and the throttler is not provably using it

`localhost:6379` is the **`predictify-redis`** container (its keys are Binance trading pairs
such as `last:SPCXB-USD`; db1 on the same host is an unrelated Celery app). Sharing a Redis
with another app risks key collisions and an accidental `FLUSHALL`.

More seriously, the rate limiter's behaviour does not match its configuration:

- `POST /auth/register` and `/auth/forgot-password` correctly return `429`
  (`ThrottlerException`, `limit 3` per hour) — so limiting works
- those counters survive a backend restart, so they are durable
- but repeated attempts add **zero** keys to the Redis instance at `REDIS_URL`
  (DBSIZE 1030 → 1030, no key with a TTL above 600s), and the app holds live TCP
  connections to that instance
- `RedisThrottlerStorage` logs no "storage unavailable" warnings, so it is not failing open

So the configured Redis-backed throttler is **not demonstrably the component enforcing the
limit**, despite `ThrottlerModule.forRootAsync({ storage: new RedisThrottlerStorage(config) })`
and `@Throttle` metadata being present. This needs a focused fix: point `REDIS_URL` at a
dedicated instance and add a test that asserts a counter key actually appears.

### 4. One lesson video is a 3-byte placeholder

`lessons.a46fa270…` points at a 3-byte `.mp4` and was deliberately skipped by the migration
(it would have uploaded a broken file). It still references a local path that will 404 in
production. It needs a real upload or should be unpublished.

---

## Deployment

Vercel (frontend + backend services, backend internal behind a binding) is documented in
`docs/ops/VERCEL_DEPLOYMENT.md`. That includes the env vars the backend refuses to boot
without, the OAuth rewrite, and three gaps this deployment does **not** solve: the
unverified Nest-on-Fastify runtime path, the Socket.IO gateway at `/ws`, and the need for
hosted Redis and Meilisearch.

---

## Verified state

```
backend tests   682 passed / 52 files
smoke matrix    11/14 passed, 3 awaiting a human, 0 failed
health          status=up  db=up auth=up redis=up search=up storage=up email=up
```

Evidence for the matrix is in `docs/ops/SMOKE_EVIDENCE.md`; regenerate with:

```bash
cd apps/backend && npm run smoke:production -- --api http://localhost:4000 \
  --out ../../docs/ops/SMOKE_EVIDENCE.md
```
---

# Addendum — platform pass (signup, email, Redis, Meili)

## Blocker: the Vercel project is paused

```
project `frontend`  ->  paused: true        (API /v9/projects/frontend)
production, preview and git-preview URLs -> 503 DEPLOYMENT_PAUSED
deployments         ->  state READY (the pause is account-level, not a build failure)
```

Every deployment reports READY while the project serves 503, which is a Vercel
account-level pause — most commonly a spend/plan limit reached on the team. **This cannot be
lifted from the CLI or the REST API**; it needs a billing action in the dashboard.

**Consequence:** no live verification was possible during this pass. Everything below was
verified against a local container built from the same commit, and the deployed signup proof
that *was* captured immediately before the pause is recorded under P0-1.

## P0-1 — Deployed signup: PASS (evidence captured pre-pause, commit `d759b5b`)

```
POST https://frontend-…vercel.app/api/proxy/auth/register      -> 201
  authenticated        : true
  verificationEmailSent: false   (truthful — see P0-2)
  role                 : learner
  accountStatus        : active
  authUserId           : SET
  emailVerifiedAt      : null    (not pre-set; set when the link is opened)
  cookies              : __Host-access, __Host-refresh
```

Re-verification after unpausing is a single command:

```bash
D=https://frontend-ten-lilac-zvt9j29r04.vercel.app
curl -s -c /tmp/j -X POST "$D/api/proxy/auth/register" \
  -H 'content-type: application/json' -H 'x-tenant-slug: cnc-fundamentals' \
  -d '{"email":"probe@example.com","password":"Str0ng-Probe!9","name":"Probe"}'
curl -s -b /tmp/j "$D/api/proxy/auth/me" -H 'x-tenant-slug: cnc-fundamentals'
```

## P0-2 — Email

Policy is now explicit (see `EMAIL_SETUP.md`): **the application sends verification and
password reset through Resend; confirmation is not a gate.** `emailVerifiedAt` stays null
until the link is opened, and the account is usable immediately.

Code verified locally against the real Resend key:

```
undeliverable recipient -> verificationEmailSent:false, 422 logged, token retained
deliverable address    -> verificationEmailSent:true
```

Both reset paths return actionable 400s rather than 500s (`VerifyEmailDto` /
`EmailOnlyDto`), and the error body names the field.

## P0-3 — Redis is a real dependency

Measured ladder, same image, three configurations:

| `REDIS_URL` | Result |
| --- | --- |
| unset | **Refuses to boot** — `REDIS_URL: Required` |
| `redis://YOUR-HOSTED-REDIS:6379` | boots, health `degraded` with the exact remedy |
| real instance | health `up`, **write round-trip verified** (probe key set/read/del) |

Health no longer reports `disabled` for an unset URL (that would have looked healthy while
rate limiting ran on the database), and a reachable-but-unwritable Redis is now detected
rather than assumed good.

## P0-5 — Meilisearch

Health no longer stops at `/health`, which answers even when the index is missing. It now
reads the index the application actually queries:

```
search up       : "meilisearch, index 'titan_search' with 150 documents"
search down     : "meilisearch is up but index 'titan_search' is unavailable (HTTP …)"
MEILISEARCH_HOST unset : degraded, "no full-text index"
```

Local container is compose-managed and healthy (`cnc-meilisearch`, 150 documents); a live
query returns CNC Machining Academy, CNC Bilingual Content Blocks Demo, CNC Milling
Fundamentals.

## Correction: the HS256 bug was not real

Previously reported as "when `SUPABASE_AUTH_ENABLED=false`, HS256 tokens are rejected". **Not
reproducible.** Tested both configurations against the current build:

```
flag=false, no SUPABASE_URL     -> /auth/me 200  role=learner
flag=false, SUPABASE_URL set    -> /auth/me 200  role=learner
```

The earlier failure came from a stale container from an earlier session still bound to the
port — the same stray-process trap that produced the earlier "throttle is stuck at 100"
confusion. `test/jwt-auth-flag-routing.spec.ts` now pins the routing so a genuine regression
is caught immediately.

## Operator checklist — do these

1. **Unpause the Vercel project.** Resolve the spend/plan limit, then re-run the P0-1 command.
2. **Verify a sending domain in Resend** and set `SMTP_FROM=<bare address>` on the backend.
   Without it, every email fails with 403 `domain is not verified`.
3. **Provision a dedicated Redis** and set `REDIS_URL`. Do not point it at another app's
   instance — the throttler and public cache share the keyspace and will evict each other.
   Confirm via `/health`: `redis: up` and probe keys appear.
4. **Set `MEILISEARCH_HOST` + `MEILISEARCH_API_KEY`** to a reachable Meilisearch and reindex
   (`POST /api/proxy/search/reindex`). Confirm via `/health`: `search: up` naming the index.
5. **Rotate the superadmin password.** It is still the seeded test credential used throughout
   this work and is known to anyone reading the transcript.
6. **Rotate the Moyasar live keys.** `pk_live_`/`sk_live_` were pasted into a chat session
   and must be treated as exposed. Only test keys are configured in the app.
7. **Set `MOYASAR_WEBHOOK_SECRET`** from the Moyasar dashboard. The webhook endpoint fails
   closed without it, so no payment settlement can occur.
8. **Run the CMS rebrand** against production:
   `node apps/backend/scripts/rebrand-cms-content.mjs` (dry run), then
   `--apply --confirm-production`. Four legacy brand strings remain in CMS rows.

---

# Addendum — new Vercel account migration

Production moved to a new Vercel account and a fresh project. Four things cost
real time and are worth not rediscovering:

**1. `vercel env pull` cannot read sensitive values.** It writes the literal
string `[SENSITIVE]` for every secret. Transferring env from one project to
another by pull-then-push therefore uploads placeholders, and the app boots with
no database, no JWT secret and no mail key while looking correctly configured.
Recovered from `apps/backend/.env`, but `API_PUBLIC_URL`,
`GOOGLE_OAUTH_REDIRECT_URI` and `NEXT_PUBLIC_DEFAULT_TENANT_SLUG` had to be
supplied by hand. **Verify secrets functionally — by calling the endpoint — never
by reading them back.**

**2. dotenv quotes are syntax, not content.** `env pull` quotes every value. Pushing
those quotes verbatim made Next reject the build:
`destination does not start with /, http:// or https://`, because the rewrite target
was literally `"https://…"`. Strip surrounding quotes before re-pushing.

**3. Zod defaults do not save you from a missing numeric var.** `DATABASE_POOL_MAX`
and `DATABASE_CONNECT_TIMEOUT_MS` are declared
`z.coerce.number().default(...)`, but coercion turns an absent value into `NaN`
*before* the default is considered, so omitting them fails boot with
`Expected number, received nan`. **Set numeric vars explicitly.**

**4. Supabase's session-mode pooler caps at 15 clients.** `DATABASE_POOL_MAX=20`
(the schema default) exhausts it: `(EMAXCONNSESSION) max clients reached in session
mode - max clients are limited to pool_size: 15`, and every request 500s. Set 10.

**Nest DI is not covered by unit tests here.** AuthModule re-exporting
`EmailService` after the class moved to `EmailModule` passed 749 tests and took
production down with `UnknownExportException`, because the suite builds services
with mocks and never instantiates a module. `test/di-graph.spec.ts` now asserts
that no module exports a provider it does not provide.

**Migration 034 was applied to production** (four `email_*` tables, additive and
idempotent). Without it the outbox dispatcher logged a failing query every 5s.
