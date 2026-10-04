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

## Payments gates (Moyasar)

### M1 — Fail closed, no silent acceptance
- [ ] `SECRETS_ENCRYPTION_KEY` is 32 bytes and set on the server. Proof:
      write a credential through `PUT /admin/payments/config` → row shows
      `encrypted_secret_key` starting `v1:1:`, and `GET` returns
      `secretKeyConfigured: true` with the key itself absent.
- [ ] Unset encryption key → `PUT /admin/payments/config` returns `503` and the
      row is unchanged. Command: temporarily blank the env, retry, restore.
- [ ] Tenant with no credentials → `POST /payments/moyasar/create-order` returns
      `503 Payments are not configured for this workspace` and writes no order.
- [ ] A `pk_test_`/`sk_test_` pair that Moyasar rejects → order stays `pending`,
      `lastErrorCode` populated. Never `paid` without a verified fetch.

### M2 — Settlement cannot be forged
- [ ] `GET /payments/moyasar/callback?order=<own>&payment=<not-a-real-id>` →
      `status: failed` and `orders.status` still `pending`.
- [ ] Webhook with a wrong `x-moyasar-token` → `{"handled":false,"reason":"bad_secret"}`
      and no order mutation.
- [ ] Webhook with no configured secret → `reason: "webhook_secret_not_configured"`.
- [ ] Amount mismatch: order total edited after checkout (or gateway amount
      altered) → `amount_mismatch`, no fulfilment, no enrolment granted.
- [ ] `npx vitest run test/payments-google-invariants.spec.ts` → all pass.
- [ ] `npx vitest run test/payment-pipeline.integration.spec.ts` → all pass
      (real Postgres + a fixture gateway: webhook-only settlement, replay,
      ownership, retry, purchase ledger).

### M2b — The buyer can actually buy
- [ ] `/checkout?order=<id>` for a direct-bought course and for an event ticket
      renders that order's lines and total from the server, with an empty cart.
- [ ] A direct buy of an order that is already paid, canceled, or owned by
      someone else shows a message and no payment form.
- [ ] Cart is still full after a failed payment, and empty after a verified
      `paid`.
- [ ] `analytics` purchase events report `SAR`, not a hardcoded `USD`.

### M3 — Real money, once, end to end
- [ ] Low-value live/test card through `/checkout` → success page shows `paid`.
- [ ] Database: `orders.status='paid'`, `paid_at` set, `provider_payment_id` set,
      matching line `fulfillment_state='fulfilled'`.
- [ ] The entitlement exists: course enrolled, or event registered, or stock
      decremented exactly once.
- [ ] Callback replayed twice, then the same webhook again → still one
      fulfilment, no double grant.
- [ ] Tenant isolation: user B reading user A's order → `404`, and user B calling
      the callback for user A's order → `404 Order not found` with the order
      still `pending`.
- [ ] A product order leaves a `product_purchases` row; inventory drops by the
      quantity exactly once; a full refund marks the purchase `refunded`.

### M4 — Refunds and cancellation
- [ ] Refund a paid order → `status='refunded'`, refund visible in the Moyasar
      dashboard for the same amount.
- [ ] Refund a `pending` order → `400 Only a paid order can be refunded`.
- [ ] Cancel stale pending order → `canceled`; its checkout page shows failure,
      not a payable form.

## Google integration gates

### G-INT1 — Access is platform-only
- [ ] `GET /admin/integrations` as `super_admin` → `200`; as `admin`/`learner` →
      `403`; anonymous → `401`.
- [ ] `POST /admin/integrations/:service/connect` as non-super-admin → `403`.
- [ ] No response body from any read endpoint contains `refresh_token` or
      `encryptedRefreshToken`. Proof: pipe the response through
      `grep -ci 'refresh'` → `0`.

### G-INT2 — Blocked, not fake
- [ ] With `GOOGLE_OAUTH_CLIENT_ID` unset, all four services report
      `status: blocked` with `blockedReason` naming the missing variables, and
      `connect` returns `400`.
- [ ] `platform.encryptionReady` is true and a secret write still succeeds.

### G-INT3 — OAuth is bound to the human who started it
- [ ] Callback with an unknown state → redirect with `result=unknown_state` and
      no outbound call to Google's token endpoint.
- [ ] Callback replayed with the same state → `result=state_already_used`.
- [ ] Callback with another user's id in `initiated_by` → `initiator_mismatch`.
- [ ] Callback with the wrong CSRF value → `csrf_mismatch`.
- [ ] Expired state (>10 min) → `state_expired`.
- [ ] Declining consent in Google's screen → `result=denied`.

### G-INT4 — Stored tokens are usable and revocable
- [ ] Real connect for each service → `status: connected` with a non-null
      `externalAccountId` and the expected scopes.
- [ ] `google_integrations.encrypted_refresh_token` starts `v1:1:`; the plaintext
      token appears nowhere in logs or API responses.
- [ ] `POST /admin/integrations/:service/test` refreshes the token and updates
      `last_tested_at`; after revoking access in the Google account it reports
      `revoked` with `invalid_grant`.
- [ ] `POST /admin/integrations/:service/disconnect` clears the token and the
      status returns to `not_connected`.

## How to record sign-off

Copy this file to `docs/LAUNCH_GATES-YYYYMMDD.md`, paste command outputs under
each box, name the operator. A gate without pasted evidence is not signed off.
