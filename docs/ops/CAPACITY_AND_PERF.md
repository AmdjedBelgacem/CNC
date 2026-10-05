# Capacity and Performance

Measured on a local stack that mirrors the deployed topology: one backend process (Docker,
capped at **2 vCPU / 1.5 GB**), Postgres 16 in Docker, Redis 7 in Docker, Meilisearch in
Docker, and `next build && next start` for the frontend. Seeded with the project's own
`db:push` + `seed` (12 courses, 20 products, 36 lessons, 25 sponsors).

**Nothing here was run against Vercel or production.** The load generator shares the host
with the target (10 cores / 32 GB), so absolute throughput is depressed by contention and
the numbers should be read as a *relative* before/after plus a conservative capacity floor.

---

## 1. Baseline capacity model

Before measuring, the expected bottlenecks on a single-instance setup:

| Bottleneck | Why it matters here |
|---|---|
| **Single Node process** | One event loop serves every request. Any synchronous work or CPU-bound task (argon2, JSON serialisation of large payloads) blocks all of it. |
| **DB pool size** | `DATABASE_POOL_MAX` was 10. Every request needing more than one query queues here, and *everything* queues behind it — including `/health`. |
| **Redis absent → DB rate limiting** | With Redis unreachable the throttler falls back to the database, adding a write per request to the same pool that is already the bottleneck. |
| **SSR TTFB** | HTML is rendered per request (see §5), so every page view costs a full render plus its data fetches. |
| **N+1 queries** | Course detail loads a course, then its series, then lessons per series. |

Modelled expectation before testing: a 10-connection pool against a single event loop caps
useful concurrency at roughly the pool size for multi-query endpoints, i.e. **~10–20
in-flight requests** doing real work, with everything else queueing.

---

## 2. Load harness

`scripts/load/api.js` (k6). Stages ramp **10 → 25 → 50 → 100 → 200 VU** and abort on
`functional_failures > 1%` or p95 over budget.

```bash
BASE_URL=http://127.0.0.1:5400 \
COURSE_SLUG=cnc-milling-fundamentals \
P95_BUDGET_MS=750 \
k6 run scripts/load/api.js
```

Scenarios: `GET /health`, `GET /courses` (list), `GET /courses/:slug` (detail),
`GET /search?q=cnc`. Per-endpoint trends so a slow route cannot hide in an aggregate.

### Gotcha worth knowing: the global rate limit blocks load testing

The global throttler was hardcoded to `limit: 100` per 60 s **per client IP**. Every run
429'd after the first hundred requests, which measures the limiter rather than the
application. Two changes:

- `THROTTLE_LIMIT` / `THROTTLE_TTL_MS` (defaults unchanged at 100 / 60 000) so the ceiling
  is tunable without a code change.
- `THROTTLER_ENABLED=false` removes the guard entirely, for local load testing only —
  the same shape as the seed script's `ALLOW_PROD_SEED` gate. Off by default.

This is also a **production** finding: at 100 req/min per IP, any client behind carrier NAT
or a corporate proxy — where thousands of users share one address — is throttled. Raise
`THROTTLE_LIMIT` to match real per-client rates.

---

## 3. Results: before → after

Identical profile (10→200 VU, same data, same 2 vCPU / 1.5 GB cap).

| Metric | Baseline | +indexes, pool 20, course cache | +search cache |
|---|---|---|---|
| Throughput | **193 req/s** | 248 req/s | **799 req/s** (+314%) |
| p50 latency | 277 ms | 226 ms | **68.6 ms** (−75%) |
| p95 latency | 1.18 s | 1.19 s | **320 ms** (−73%) |
| p99 (approx, from p95/max spread) | — | — | ~1.4 s worst case |
| Error rate | 0% | 0% | **0%** (98,116 requests) |
| `courses` list p95 | 1.24 s | 736 ms | **289 ms** (−77%) |
| `courses/:slug` p95 | 874 ms | 634 ms | **291 ms** (−67%) |
| `search` p95 | 1.30 s | 1.86 s | **289 ms** (−78%) |
| `/health` p95 | 836 ms | 1.25 s | 648 ms |
| Peak CPU | 146% of 200% | 136% | ~136% |
| Peak memory | 1.7 GiB (cgroup cap) | 1.7 GiB | ~1.4 GiB |
| Postgres connections | 11 | 21 | ≤21 |
| Redis keys (catalogue cache) | n/a | 2 | 3 |

### Reading the numbers honestly

- **`/health` was the tell.** It is one indexed lookup, yet it reported an **836 ms p95** at
  baseline. It cannot be slow on its own merits — it was queueing behind the DB pool. When
  `/health` is slow, the pool is the bottleneck, not the endpoint.
- **Search got worse before it got better** (1.30 s → 1.86 s) once the course endpoints were
  cached and traffic redistributed onto the Postgres fallback, which scans and ranks the
  catalogue per query. Caching search closed that gap and took it to the fastest tier.
- **Peak memory is page cache, not a leak.** The cgroup cap was hit in every run, but
  `VmHWM` for PID 1 stayed around 190–200 MB. `docker stats` reports cgroup memory, which
  includes reclaimable page cache.

---

## 4. What was changed, and why each was worth it

### 4.1 Missing indexes on the hottest read path
`series` and `lessons` carried **only their primary keys**. Both lookups the course detail
page depends on were sequential scans:

```
EXPLAIN SELECT * FROM series  WHERE course_id = $1;  ->  Seq Scan on series
EXPLAIN SELECT * FROM lessons WHERE series_id = $1;  ->  Seq Scan on lessons
```

Cheap at seed size, expensive at catalogue size, on the most requested read in the product.
Added in `033_hot_path_indexes.sql`: `series(course_id, sort_order)`,
`lessons(series_id, sort_order)`, plus `tenant_id` on both and covering indexes for
`lesson_progress` and `notifications`.

`courses` was already indexed correctly, which is exactly why the listing was faster than
the detail page — the gap pointed straight at the missing indexes.

### 4.2 Connection pool 10 → 20
The pool was the queue. 20 roughly doubles read concurrency while staying well inside
Postgres' default `max_connections` of 100. **Raise further only with a connection budget** —
every connection here is one unavailable elsewhere. Also added
`DATABASE_STATEMENT_TIMEOUT_MS` (default 15 s) so a runaway query fails fast instead of
holding a slot and starving every waiter.

### 4.3 Short-TTL read-through cache for public reads
`PublicCacheService` — 60 s TTL, keyed by tenant + locale + every filter, with a local L1
map in front of Redis. Applied to course list, course detail and search.

Deliberate properties:
- **Fails open.** Any Redis error is a miss; the database is queried. A cache outage is
  never an outage.
- **Never stores user state.** Only responses identical for every anonymous visitor.
- **Invalidates by prefix** with `SCAN`, never `KEYS` (which blocks Redis' event loop).

This is what produced the largest single win: search results and catalogue reads stop
touching the pool at all under burst.

### 4.4 Meilisearch fail-fast — already correct
`SearchService` already carries a circuit breaker: a failed query flips `meiliState` to
`down` with a 30 s cooldown before falling back to Postgres, and `execute()` skips the
attempt entirely while the circuit is open. Verified rather than rewritten.

---

## 5. Stated capacity

Assumptions: single backend process on 2 vCPU / 1.5 GB; Postgres and Redis on the same host;
seed-scale catalogue (12 courses / 20 products); k6 co-located with the target, which
**understates** throughput.

| Load | Measured |
|---|---|
| Comfortable sustained | **~200 concurrent VU at 799 req/s, p95 320 ms, 0 errors** |
| Comfortable for interactive use | **~50 concurrent users** with p95 well under 300 ms |
| Breaking point | **Not reached.** The brief capped the ramp at 200 VU and the run finished clean, so the ceiling is above 200 VU. CPU peaked at ~136% of the 200% cap, leaving headroom. |

**These are single-process numbers and do not scale linearly.** The correct reading is:
one 2-vCPU process comfortably serves a few hundred concurrent users for this read-heavy
mix, and the honest limit is CPU on one event loop, not the database.

---

## 6. Frontend snappiness

`next build && next start`, warm, against the optimised backend:

| Page | TTFB (before, production) | TTFB (after, local) |
|---|---|---|
| `/` | 2.5–6.5 s | **0.60 s** |
| `/courses` | ~2.8 s | **0.59 s** |
| `/courses/:slug` | ~2.8 s | **0.61 s** |
| `/login` | ~2.5 s | **0.61 s** |

Most of that is the backend: course and search reads went from ~300 ms+ to ~70 ms, and the
SSR pass reuses them.

Already shipped in the same line of work:
- **No client refetch after SSR.** Course detail and listing are fetched on the server and
  seeded into the React Query cache, so the first paint does no duplicate work. Course HTML
  went from 88 words ending in "Loading" to 316 words of real content.
- **JSON payload**: JS is 27 chunks / ~336 KB HTML raw (72 KB brotli). Admin and builder
  surfaces are still bundled into the public graph — the next meaningful win is route-level
  dynamic import for `/admin/*` and the builder, which were deliberately left alone here to
  keep this change set reviewable.

---

## 7. Reproducing

```bash
# local datastores
docker run -d --name lt-postgres -e POSTGRES_PASSWORD=ltpass -e POSTGRES_DB=ltdb -p 5440:5432 postgres:16-alpine
docker run -d --name lt-redis -p 6380:6379 redis:7-alpine

# schema + data
cd apps/backend && DATABASE_URL=postgresql://postgres:ltpass@localhost:5440/ltdb pnpm db:push
DATABASE_URL=... node ../../node_modules/tsx/dist/cli.mjs src/database/seed.ts

# backend (note host.docker.internal for container->host services)
docker run -d --name lt-backend -p 127.0.0.1:5400:4000 --memory=1500m --cpus=2 \
  -e DATABASE_URL=postgresql://postgres:ltpass@host.docker.internal:5440/ltdb \
  -e REDIS_URL=redis://host.docker.internal:6380 \
  -e SUPABASE_AUTH_ENABLED=false -e NODE_ENV=production \
  -e THROTTLER_ENABLED=false <image>

# load
BASE_URL=http://127.0.0.1:5400 k6 run scripts/load/api.js
```

`SUPABASE_AUTH_ENABLED=false` keeps Supabase out of the local path; production auth is
covered by the signup fix note instead.

---

## 8. Not addressed

- **Authenticated load scenarios.** The optional `AUTH_COOKIE` scenario is wired but unused:
  with `SUPABASE_AUTH_ENABLED=false` the JWT verifier still refuses locally-minted HS256
  tokens with `Unsupported token algorithm for this project: HS256`. That looks like the
  verifier's `enabled` flag not being honoured on that path and is worth a separate look;
  it is a correctness bug, not a performance one, so it was not fixed in this pass.
- **Multi-instance / horizontal scale.** Everything here assumes one process. The cache is
  already Redis-backed so it would survive more than one, but nothing has been tested that way.
- **Write-heavy mix.** Progress sync and chat were not load tested; progress writes are the
  most likely place a single process saturates first.
- **`/admin/*` route-level code splitting** (see §6).
