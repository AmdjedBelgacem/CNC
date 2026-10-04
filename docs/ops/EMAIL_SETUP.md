# Email Setup — Resend + Supabase Auth SMTP

Transactional app email works today. **Auth email does not**, and that blocks the 12
users who still need a password setup. Both remaining steps are dashboard-only.

## Current state

```
RESEND_API_KEY  configured   -> send to ahmed@barootcnc.com returned 200
Resend key type restricted    -> only the account owner may be a recipient
Supabase Auth SMTP            -> not configured; GoTrue falls back to its own rate-limited
                                 built-in SMTP, which cannot deliver to arbitrary domains
```

Consequence: password-reset and verification emails to real users fail. The app's
`forgot-password` path must not 500 — see "Validating without the domain" below.

---

## Step 1 — Verify a domain in Resend (human, ~2 min)

Resend → **Domains** → **Add Domain** → e.g. `titansofmanufacturing.com`.

Add the DNS records it gives you. Typical set:

| Type | Name | Value |
| --- | --- | --- |
| `MX` | `send` | `feedback-smtp.us-east-1.amazonses.com` |
| `TXT` | `send` | `p=MIGf...` (SPF) |
| `TXT` | `resend._domainkey` | (DKIM, value shown in the dashboard) |

Wait for status **Verified**. Resend shows a DNS checkmark per record.

Then confirm:

```bash
curl -s https://api.resend.com/domains -H "Authorization: Bearer $RESEND_API_KEY"
```

Set the app's sender to the verified domain in `apps/backend/.env`:

```
SMTP_FROM=TITANS of Manufacturing <notifications@titansofmanufacturing.com>
```

## Step 2 — Point Supabase Auth SMTP at Resend (human, ~1 min)

Supabase → **Authentication → Providers → Email (SMTP)**.

| Field | Value |
| --- | --- |
| Host | `smtp.resend.com` |
| Port | **587** |
| Username | `resend` |
| Password | your Resend API key |
| Sender | `notifications@<your-verified-domain>` |

**Port choice: 587 (STARTTLS).** It works on every network including those that block
465; use 465 only if your egress path requires implicit TLS.

Leave *"Enable email confirmations"* on unless you want to skip verification. Turn off
*"Confirm email"* only if you plan to verify addresses by other means.

Supabase rate-limits by design: roughly 2–3 recovery emails/hour/address and a daily
ceiling per project. Send in batches (see Step 3).

## Step 3 — Trigger recovery for the 12 users (script, in-repo)

```bash
cd apps/backend
# Always dry-run first:
npm run db:send-recovery -- --database "$DATABASE_URL" --dry-run
# Then, deliberately:
npm run db:send-recovery -- --database "$DATABASE_URL" --limit 5   # small batch first
npm run db:send-recovery -- --database "$DATABASE_URL"              # remainder
```

The script is rate-limited (configurable delay), audited to `audit_logs`, idempotent, and
skips addresses that already have a usable password. It uses Supabase's
`generate_link`/`recover` path, so the email is Supabase's, delivered through Resend.

---

## Validating without the domain verified

You do not have to wait to prove the code path is sound:

```bash
# The endpoint must answer 200/202 even while email is undeliverable — the user
# must never learn whether an address exists, and a failed send must not 500.
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  http://localhost:4000/auth/forgot-password \
  -H 'content-type: application/json' \
  -d '{"email":"learner@titansofmanufacturing.com"}'
```

A **404/202** is correct. A **500** is a bug in our handler, not a Resend problem.

To confirm end-to-end delivery once the domain is verified:

```bash
curl -s -X POST http://localhost:4000/auth/forgot-password \
  -H 'content-type: application/json' -d '{"email":"<a-real-test-address>"}'
# then check Resend → Logs for a delivered message, and Supabase → Auth → Users
# for the recovery link being generated.
```
