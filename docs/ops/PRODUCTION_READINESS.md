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