# Seeding (local dev)

Idempotent demo seed. Safe to rerun — it reuses existing tenants/users/courses/
lessons/academies and only inserts what is missing, then backfills lesson
thumbnails from the parent course art and ensures one active cert template.

## Prerequisites

- PostgreSQL running with `cncm` database (homebrew default in this repo):
  `postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:5432/cncm`
- Migrations applied (`lessons.thumbnail_url`, `academies.seo_image_url`):
  ```sql
  ALTER TABLE "academies" ADD COLUMN IF NOT EXISTS "seo_image_url" varchar(500);
  ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "thumbnail_url" varchar(500);
  ```
  (Also in `apps/backend/src/database/migrations/005_*.sql`, `006_*.sql`.)
- MinIO optional. Seed does not require storage; video `tenants/...` keys
  already in the DB keep working via signed playback URLs.

## Run

```bash
cd apps/backend
DATABASE_URL="postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:5432/cncm" \
REDIS_URL="redis://localhost:6379" \
AUTH_SECRET="dev-only-AUTH_SECRET-not-a-real-secret" \
JWT_ACCESS_SECRET="dev-only-JWT_ACCESS-not-a-real-secret" \
JWT_REFRESH_SECRET="dev-only-JWT_REFRESH-not-a-real-secret" \
MEILISEARCH_HOST="http://localhost:7700" \
MEILISEARCH_API_KEY="masterKey" \
node ./node_modules/tsx/dist/cli.mjs src/database/seed.ts
```

Or via workspace script (same thing):

```bash
pnpm --filter backend db:seed
```

Expected tail output: `Backfilled N lesson thumbnail(s)` (first run only),
`Created demo cert template` (first run only), `Seeded RBAC ...`, `Seed complete!`.

## Notes

- Passwords: dev-only `fallback-hash:Test1234!` (see `seed.ts:hashPasswordDev`).
  Production uses real argon2 via `password.service.ts`. Never copy dev hashes
  to prod. All test accounts use password `Test1234!`.
- `tsx` must be invoked via `node ./node_modules/tsx/dist/cli.mjs` on
  Node 20 hosts; the `tsx` bin/pnpm wrappers can crash (`node:sqlite`).
  CI uses Node 22.
- Never `import * as argon2` at top level of the seed graph — the native
  binding SIGSEGVs (exit 139) on Macs without a darwin-arm64 prebuild.
