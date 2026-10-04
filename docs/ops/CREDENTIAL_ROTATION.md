# Credential Rotation Runbook

Rotating anything listed here is safe and does not require downtime. Order matters:
rotate the credential, then update the config that consumes it, then verify.

## 1. Superadmin Supabase password

The account used a temporary password issued during setup. Replace it.

```bash
# Requires SUPABASE_URL + SUPABASE_SECRET_KEY in apps/backend/.env
export SUPABASE_URL=... SUPABASE_SECRET_KEY=...
USER_ID=$(psql "$SUPABASE_DB_URL" -t -A -c \
  "SELECT auth_user_id FROM users WHERE email='superadmin@titansofmanufacturing.com'")
curl -X PUT "$SUPABASE_URL/auth/v1/admin/users/$USER_ID" \
  -H "apikey: $SUPABASE_SECRET_KEY" -H "Authorization: Bearer $SUPABASE_SECRET_KEY" \
  -H 'content-type: application/json' -d '{"password":"<NEW>"}'
```

Then sign in once at `/login` to confirm, and delete the value from any shell history.

## 2. Supabase database password

Supabase → **Settings → Database** → **Reset database password**.

Then update `DATABASE_URL` in `apps/backend/.env`. The password **must be URL-encoded** —
Supabase passwords commonly contain `@`, `/`, `+` or `!`, any of which will break an
unencoded connection string:

```bash
node -e "console.log(encodeURIComponent(process.argv[1]))" '<NEW_PASSWORD>'
```

Verify before restarting anything:

```bash
psql "postgresql://postgres.<ref>:$(node -e "console.log(encodeURIComponent(process.argv[1]))" '<NEW>')@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require" -c 'select 1'
```

Use port **5432** (session pooler). Port 6543 returns an empty `search_path`, which breaks
every unqualified query — see `docs/PHASE1_SUPABASE_POSTGRES.md`.

## 3. Keys exposed in session output

These were printed in a working session and should be treated as disclosed:

| Credential | Where to rotate |
| --- | --- |
| Supabase DB password | Supabase → Settings → Database |
| `supadmin` test password (`SupabaseTest123!x`) | Section 1 above |
| `SUPABASE_SECRET_KEY` | Supabase → Settings → API Keys → rotate |
| S3 secret access key | Supabase → Storage → S3 Settings → regenerate |
| Resend API key | Resend → API Keys → create new, revoke old |

None of these values are committed — `.env`, `apps/backend/.env` and
`apps/frontend/.env.local` are all gitignored, and `.env.example` contains no real values.
Verify at any time:

```bash
git grep -lE 'sb_secret_|re_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}' || echo 'clean'
```

## 4. Application secrets

Regenerating `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` / `AUTH_SECRET` invalidates all
sessions and all pending 2FA markers. Do it as a deliberate mass sign-out, not casually.

`AUTH_SECRET` signs the pending-2FA cookie and CSRF values.

## 5. Verifying nothing leaks

`src/common/security/redact.ts` masks connection strings and known credential shapes, and
the Fastify logger redacts `authorization`, `cookie`, `x-csrf-token` and `set-cookie`
explicitly. `test/redact.spec.ts` locks that behaviour (12 tests).

```bash
npm run typecheck && npx vitest run test/redact.spec.ts
```
