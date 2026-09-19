# Launch gates — NO-GO checklist

Nothing here is vague on purpose. Each gate names exact env vars, commands,
and expected output. **Do not promote to staging/production with any P0 gate
red.** Check the box only with evidence pasted next to it.

## P0 gates (block any staging/prod traffic)

### G1 — No dev fallback password hashes outside dev
- [ ] `DATABASE_URL=<target-db-url> ./scripts/scan-dev-hashes.sh --env=prod` → exit 0, `0 user row(s)`.
- [ ] `NODE_ENV=production` boot attempt with this build → `PasswordService`
      throws `Refusing to start ... without argon2 native binding` (by design:
      this build is dev-only; prod needs a build with real argon2 prebuilds).
- [ ] Seed refusal proven: `NODE_ENV=production node ./node_modules/tsx/dist/cli.mjs src/database/seed.ts`
      (from `apps/backend`) → non-zero exit, `Refusing to run demo seed...`
      (no `ALLOW_PROD_SEED` set).

### G2 — No default/guessable secrets
- [ ] `AUTH_SECRET`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` are unique,
      ≥32 chars, and differ from `local-*`, `change-me`, `*-secret-change-me`.
- [ ] Command: `grep -rE "change-me|local-auth-secret|local-access-secret|local-refresh-secret" apps/backend/.env .env 2>/dev/null` → no output for the target env files.
- [ ] `S3_ACCESS_KEY`/`S3_SECRET_KEY` are not `minioadmin` outside local dev.
- [ ] `NODE_ENV=production` boot with placeholder secrets → `config.service`
      zod validation fails fast with explicit error (no silent boot).

### G3 — Storage is real, not MinIO-local assumptions
- [ ] Target `S3_ENDPOINT`/`S3_BUCKET` point at the real object store (not
      `localhost:9002`/`titans-local`) in staging/prod env.
- [ ] `HEAD` on bucket + one `PUT`/`GET` round-trip with target creds → 200.
- [ ] Academy image upload → stored URL host matches target store/CDN, and the
      object loads publicly (or signed playback `206 video/mp4` for videos).
- [ ] Local `http://localhost:9002/...` URLs appear **nowhere** in staging/prod
      rows: `SELECT count(*) FROM academies WHERE hero_image_url LIKE '%localhost%' OR logo_url LIKE '%localhost%' OR seo_image_url LIKE '%localhost%';` → 0 (same for `lessons.thumbnail_url`, `courses.thumbnailUrl`).

### G4 — Paywall + tenant isolation hold on target
- [ ] Run `scripts/qa-critical-path.sh` against staging base URLs
      (`API_BASE=https://... TENANT_SLUG=...`) → `19 pass, 0 fail`
      (typecheck/build steps may be skipped with `--quick` in staging; the
      API matrix must be full).
- [ ] Cross-tenant negative: tenant-A admin JWT vs tenant-B lesson playback →
      `403`/`404`, response body never contains `tenants/`.
- [ ] Lesson metadata never leaks keys: every `videoUrl` in public responses is
      `null` or `http(s)://`, never `tenants/`.

### G5 — Backups exist and were restored once
- [ ] PG: dated dump file + `sha256sum` recorded: `pg_dump "$DATABASE_URL" > backups/pg/cncm-YYYYMMDD.sql`.
- [ ] MinIO/store: `mc mirror` (local) or bucket versioning + replication policy
      ARN (managed store) recorded.
- [ ] Restore drill on a scratch DB/bucket: row counts match
      (`tenants/users/courses/lessons/academies/cert_templates`), one playback
      URL streams `206`. Date + operator recorded here.

## P1 gates (block public launch, may follow staging)

### S1 — Stripe proven in test mode
- [ ] `STRIPE_SECRET_KEY=sk_test_...`, `STRIPE_WEBHOOK_SECRET=whsec_...` set in
      target env (never `sk_live` in staging).
- [ ] `stripe listen --forward-to $API_BASE/payments/webhook` → test checkout
      → webhook `200` → exactly one order row → redelivered `event.id` creates
      zero additional rows (idempotency).
- [ ] Live cutover checklist recorded: keys rotated, webhook secret rotated,
      `FRONTEND_URL` points at public site.

### S2 — Email proven end-to-end
- [ ] `RESEND_API_KEY` (or SMTP `HOST/PORT/USER/PASS/FROM`) set; `SMTP_FROM`
      domain has SPF/DKIM/DMARC.
- [ ] Verification email received in a real inbox; link completes
      register → verify → login. Password-reset link completes once and is
      single-use.
- [ ] All emailed links use the public `FRONTEND_URL`, never `localhost:3000`.

### S3 — Monitoring + uptime
- [ ] Error reporting DSN set (Sentry or equivalent) in backend + frontend;
      test error surfaces in dashboard.
- [ ] Uptime check on `GET /tenants` (or `/health` if added) with alert route.
- [ ] Backend logs retained ≥14 days; MinIO/PG disk alerts configured.

## How to record sign-off

Copy this file to `docs/LAUNCH_GATES-YYYYMMDD.md`, paste command outputs under
each box, name the operator. A gate without pasted evidence is not signed off.
