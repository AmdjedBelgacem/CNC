# Local dev runbook

## Services

- PostgreSQL (homebrew, authoritative for `DATABASE_URL` below):
  `postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:5432/cncm`
- Redis `:6379` (`cnc-redis-1` or any local redis)
- MinIO `:9002` API / `:9001` console (`minioadmin/minioadmin`), bucket `titans-local`
  (created by `docker-compose minio-create-bucket`, public read).
- Meilisearch `:7700`, started with `docker compose up -d meilisearch`. Container name is
  `cnc-meilisearch`; data is a bind mount at `.runtime/meili/data` (gitignored, ~1.4 MB).
  That path is deliberate — a named Docker volume is not interchangeable with it, and using
  one starts a second, empty index that the app silently falls back to Postgres search for.

## Backend (`:4000`)

```bash
cd apps/backend
pnpm build   # nest build — never hand-edit dist/
DATABASE_URL="postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:5432/cncm" \
REDIS_URL="redis://localhost:6379" \
AUTH_SECRET="dev-only-AUTH_SECRET-not-a-real-secret" \
JWT_ACCESS_SECRET="dev-only-JWT_ACCESS-not-a-real-secret" \
JWT_REFRESH_SECRET="dev-only-JWT_REFRESH-not-a-real-secret" \
MEILISEARCH_HOST="http://localhost:7700" MEILISEARCH_API_KEY="masterKey" \
FRONTEND_URL="http://localhost:3000" PORT=4000 \
node dist/main.js
```

Migrations are hand-written idempotent SQL in
`apps/backend/src/database/migrations/` (`004_academies`,
`005_academy_seo_image`, `006_lesson_thumbnail`). Apply with psql or
`drizzle-kit migrate`; see `docs/SEEDING.md`. `DrizzleService` runs with
`{ prepare: false }` (postgres-js) to avoid stale prepared-statement
`42703 column does not exist` after DDL.

## Frontend (`:3000`)

```bash
cd apps/frontend
export PATH="/usr/local/bin:$PATH"   # Turbopack PostCSS workers spawn `node`
rm -rf .next                          # after next.config/postcss changes
node ./node_modules/next/dist/bin/next dev --port 3000
```

Notes:

- Single PostCSS config: `postcss.config.mjs` (tailwind v3). Do not re-add
  `postcss.config.ts` (tailwind v4 plugin) — the duplicate broke the CSS
  worker (`spawning node pooled process: No such file` + `puck.css` panic).
- `puck.css` stays global in `src/app/layout.tsx` (Next requires global CSS
  at root). Academy/lesson routes pay that cost; do not move it to a nested
  layout (build error).
- Browser must call the backend via `/api/proxy/*` with
  `credentials: 'include'` (cookies + CSRF forwarded server-side). Never call
  `:4000` directly from client components.

## Auth smoke

1. Login via UI. Confirm `access-token` httpOnly cookie on `:3000`.
2. Open a freePreview lesson → video plays without extra login.
3. Open a gated lesson anon → `401` sign-in prompt; as unenrolled learner →
   `403` enroll prompt; enroll → video plays.
4. Mark complete → progress persists after refresh (mutations send cookies).
