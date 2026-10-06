# Email Setup — Resend (app mail) + Supabase Auth SMTP (optional)

## The intended production policy

Decided explicitly, because the previous behaviour was an accident rather than a choice.

**Who sends what**

| Mail | Sent by | Transport | Gate |
| --- | --- | --- | --- |
| Email verification ("verify your address") | **This application** | Resend | **Not a gate** |
| Password reset / forgot password | **This application** | Resend | Not a gate |
| Supabase-native notices (magic link, OTP, invite) | Supabase | Supabase SMTP → Resend | Supabase's own |

The application sends verification and reset itself because it already owns a working
`verification_tokens` table and a `/auth/verify-email` endpoint that consumes it. Routing
those through Supabase's SMTP instead would add a second token system for no benefit.

**Why confirmation is not a gate.** `accountStatus` stays `active` at signup and
`emailVerifiedAt` stays null until the link is opened. So:

- a new account can sign in immediately, even if its mail provider cannot deliver;
- the address is still *proven* rather than merely typed, and the audit trail records
  whether delivery succeeded.

This was chosen deliberately. An earlier change set `email_confirm: true`, which made signup
work but silently removed verification entirely — users were told nothing and no email was
ever sent. Gating on confirmation would fix that only by re-breaking signup for anyone whose
mail cannot be delivered. If you want confirmation enforced, that is a one-line policy
change plus verified SMTP, and it should be made when the domain is live, not before.

**Failure is never silent.** The mailer checks the resolved provider error (the Resend SDK
resolves on API errors instead of throwing), so `verificationEmailSent` in the register
response is truthful, and a failed send is logged with the status and reason.

## Current state

```
RESEND_API_KEY  configured   -> sends accepted (verified against the live key)
Resend key type restricted    -> only the account owner may be a recipient
Sending domain   NOT verified -> titansofmanufacturing.com returns 403
Supabase SMTP     not configured
```

So: the code path is correct and observable, but **no real email can leave the system until
a sending domain is verified**. Both remaining steps are dashboard-only.

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
SMTP_FROM=notifications@titansofmanufacturing.com
```

**`SMTP_FROM` must be a bare email address, not `"Name <address>"`.** The config schema
validates it with `z.string().email()`, so a display-name form fails boot with
`SMTP_FROM: Invalid email` — verified, it is a real startup failure, not a warning. The
display name is added by the application, which now sends as `Baroot CNC Solutions <
SMTP_FROM>`.

Until a domain is verified, omit `SMTP_FROM` entirely and the app sends as
`Baroot CNC Solutions <onboarding@resend.dev>`. That address only delivers to your own
Resend account, which is enough to prove the path end-to-end.

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
