# Phase 1 — moving Postgres to Supabase

Status: **complete and verified locally.** The only step that needs your Supabase
credentials is marked `[NEEDS CREDENTIALS]` below.

## What was wrong, and why this had to be fixed first

The local database was created with `drizzle-kit push`, which writes the schema
directly from TypeScript and records **no migration history**. So the numbered
migrations had effectively never run. Replaying them into an empty database failed,
and a naive connection-string swap would have produced a silently incomplete schema:

| Problem | Impact if unfixed |
| --- | --- |
| 11 migrations absent from `meta/_journal.json` | Admin builder, academies, portfolio, certificates and finance never created |
| `021` ran before `020`, which adds the column it constrains | Replay aborts |
| `002` dropped `themes` while `theme_versions` referenced it | Replay aborts (`2BP01`) |
| `products` had 7 columns, 2 indexes, 2 FKs only in the live DB | **Store and checkout broken** |
| Schema/migrations disagreed on `courses.currency`, `courses.access_mode`, `cert_templates.course_id`, `themes.tokens` | `push` and `migrate` produced different databases |

All of the above are fixed. `products` is reconciled by
`032`'s predecessor `031_products_schema_reconciliation.sql`; the schema now matches
the migrations for the other four.

## Verified result

```
39 migrations replay from empty           -> applied cleanly
compare-schemas live vs replayed          -> SCHEMAS MATCH (80/80 tables, 68/68 functions)
migrate-data cncm -> fresh target         -> DATA MIGRATION VERIFIED (80/80 tables)
backend booted on the migrated DB         -> login 200, argon2id hash verified, RBAC resolved
page + API sweep on the migrated DB       -> 103 pass / 0 fail (81 pages, 22 endpoints)
```

### Cross-version verification (both Supabase versions)

Local development runs **PostgreSQL 18.3**, which Supabase does not offer, so the
whole pipeline was rehearsed against real PG 17 and PG 15 containers:

```
                                    PG 17          PG 15
40 migrations replayed              clean          clean
compare-schemas (PG18 live vs PG)    80/80 tables   80/80 tables
migrate-data PG18 → PG              VERIFIED       VERIFIED
backend booted, login                HTTP 200       HTTP 200
page + API sweep                     103/0 fail     103/0 fail
```

Two real cross-version issues were found and fixed by doing this:

1. **`pg_dump` from PG 18 emits `SET transaction_timeout`**, which PG 15/16 reject
   outright (`unrecognized configuration parameter`). Added to `migrate-data.mjs`,
   which now detects the target's `server_version_num` and strips version-gated GUCs.
2. **NOT NULL moved into `pg_constraint` in PG 17.** Comparing PG 18 against PG 15
   produced 548 spurious differences. `compare-schemas.mjs` now excludes `contype='n'`
   and relies on `information_schema.columns.is_nullable`, which is version-stable.

Both `pg_trgm` and `pgcrypto` are present on 15 and 17. The only remaining difference
is the `fips_mode()` builtin — pgcrypto 1.4 on PG 18 vs 1.3 on 15/17 — which nothing
in the codebase calls; the comparator treats it as an accepted version difference.

**Both versions Supabase offers are now verified.** If you use the newer PG 17, use
that; the rehearsal covers either.

## CUTOVER — COMPLETED against the live project

Project `pyyrctqhdgfsmxiafvfm`, region **eu-west-1**, **PostgreSQL 17.11**.

```
db:migrate                -> 40 migrations applied
db:compare-schema         -> SCHEMAS MATCH (80/80 tables)
db:migrate-data --truncate-> DATA MIGRATION VERIFIED (80/80 tables)
backend on Supabase       -> login 200, 10/10 API reads 200
page sweep                -> 103 pass / 0 fail
backend suite             -> 652/652
```

Row counts on Supabase: 9 tenants, 13 users (all 13 linked to auth.users), 11
user_roles, 27 courses, 20 products, 3 orders, 10 pages.

### Use the SESSION pooler (port 5432), not the transaction pooler

This was the single most dangerous finding of the cutover.

Supabase's **transaction** pooler (6543, Supavisor) hands back an **empty
`search_path`**. Every unqualified reference then fails:

```
SELECT count(*) FROM "users"   -> ERROR: relation "users" does not exist
```

Drizzle generates unqualified SQL throughout, so on 6543 the application would have
been dead on arrival — every query failing. Worse, `psql`/`pg_dump` cannot fix it:
`PGOPTIONS`, `options=-c search_path=public` and `SET search_path` are all discarded
by Supavisor.

The **session** pooler (5432) returns the normal `"$user", public, extensions`, so
everything works unmodified. Use 5432 for migrations, backfills and admin scripts.

If you must use 6543 at high concurrency, the driver must set it itself.
`drizzle.service.ts` now does this when it detects a Supabase host:

```ts
ssl: { rejectUnauthorized: false },      // postgres.js ignores sslmode=no-verify
connection: { search_path: 'public' },   // overrides the pooler's empty path
```

### Other cutover fixes

- **`SELF_SIGNED_CERT_IN_CHAIN`** — `pg`/drizzle-kit needs `sslmode=no-verify`;
  postgres.js ignores that value and needs `ssl: { rejectUnauthorized: false }`.
- **`--truncate`** on `db:migrate-data` — several migrations insert seed rows (a demo
  tenant, the RBAC catalogue), so restoring on top collided on `tenants_pkey`.
- **Schema-qualify `TRUNCATE`** — `quote_ident()` quotes but does not qualify, which
  fails under an empty `search_path`.
- **App-owned function comparison** — Supabase installs pgcrypto into an `extensions`
  schema and ships ~60 platform functions (`auth`/`storage`/`realtime`/`vault`), so
  `compare-schemas.mjs` now compares only non-extension functions in `public`.
- **Count errors now surface** — a failed count silently read as "0 rows", which
  briefly looked like a failed migration when the data was actually fine.

## Commands

```bash
# Repair the journal and re-check ordering (both idempotent, safe to re-run)
npm run db:repair-journal
npm run db:check-order

# Rehearse the whole migration locally before touching a remote database
createdb phase1_rehearsal
npm run db:replay-check phase1_rehearsal
npm run db:compare-schema <current-db> phase1_rehearsal
npm run db:migrate-data -- --source <current-db> --target phase1_rehearsal
dropdb phase1_rehearsal
```

## `[NEEDS CREDENTIALS]` — the actual cutover

Requires a Supabase project. Use the **transaction pooler**; the driver already sets
`prepare: false`, which Supavisor requires.

```bash
export DATABASE_URL='postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?sslmode=require'
```

Then, in order:

```bash
# 1. Create the schema on Supabase (40 migrations)
cd apps/backend && npm run db:migrate

# 2. Prove it matches before loading any data
npm run db:compare-schema <current-db> "$DATABASE_URL"

# 3. Copy the data and verify every table
npm run db:migrate-data -- --source <current-db> --target "$DATABASE_URL"

# 4. Seed anything the data copy does not carry, then point the app at Supabase
npm run db:seed
```

`DATABASE_POOL_MAX` (default 10) and `DATABASE_CONNECT_TIMEOUT_MS` are configurable in
`.env`; keep the pool under your project's per-client connection cap.

### After cutover

- Direct (non-pooler) connections are IPv6-only unless the IPv4 add-on is enabled.
- Back up the source before copying: `pg_dump --format=custom --file=backup.dump <db>`.
- Rollback is just restoring the previous `DATABASE_URL`; the source is untouched.

## Phase 2 — Supabase Auth

See [`SUPABASE_AUTH.md`](./SUPABASE_AUTH.md).