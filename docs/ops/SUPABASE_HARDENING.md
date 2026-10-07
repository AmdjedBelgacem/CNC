# Supabase / data-plane hardening

The database is Supabase Cloud (project ref `ccnbudciixhwjogtnklk`, region
`ap-southeast-1`). It is the only place customer data lives, so a dashboard
compromise there is far worse than anything on the app host.

## What is already true (verified Oct 7 2026)

- The **service role key is not in the frontend bundle**. Checked against the shipped
  image, not just the source:

```bash
cd /opt/titanic/cnc/deploy/lightsail
SUP=$(sudo grep '^SUPABASE_SECRET_KEY=' .env | cut -d= -f2-)
docker exec titan-frontend-1 sh -c "grep -rl '$SUP' /repo/apps/frontend/.next 2>/dev/null | head"
# -> no output = the secret key never reaches a browser
```

- The publishable key is browser-safe by design; it is not even present in the bundle
  (auth goes through our own BFF, not supabase-js in the page).
- `SUPABASE_SECRET_KEY` reaches only the `backend` container, via compose.
- All API access is server-side; the browser only ever talks to `/api/proxy/*`.

## Do this in the Supabase dashboard

1. **Enable leaked-password protection**
   Authentication → Sign In / Providers → enable "Leaked Password Protection". GoTrue
   then refuses any password found in the Have I Been Pwned corpus. We do not verify
   passwords ourselves any more (Supabase is the credential authority), so this control
   is the only one we have.

2. **Turn on MFA for the dashboard, for every human**
   Authentication → Users → require 2FA for project members. Every operator who can
   reach this project can read every row.

3. **Review who has access**
   Project Settings → Members. Remove anyone who has left. Keep the list to people who
   actually deploy.

4. **Rotate the leaked service-role key if it was ever pasted anywhere.**
   Rotation order and exact commands: `docs/ops/ROTATION_CHECKLIST.md`, section 5. Users
   are not signed out — sessions validate against the JWKS, which is unaffected.

5. **Restrict database connectivity.**
   Settings → Database → Connection string. The host currently connects through the
   Supavisor pooler. Consider adding an IP allowlist so the database refuses the entire
   internet, not just unknown credentials.

6. **Confirm email templates cannot be abused as a mail cannon.** Authentication →
   Emails → SMTP is our own Resend account; the provider key is rate-limited per
   sending domain.

## RLS review — the largest remaining data-plane risk

This application talks to Postgres with the **service role**, which bypasses Row Level
Security entirely. That is normal for a backend-owned database, but it means RLS is
currently *not* a safety net: if any future code path ever queries Supabase directly
from a client (a `supabase-js` in the browser, an exposed anon key, a webhook), every
row is readable unless RLS says otherwise.

So: treat enabling RLS as a hardening project, not a toggle. Highest-risk tables,
by blast radius if exposed:

| Table | Why it is high risk |
| --- | --- |
| `users` | identity, email addresses, `auth_user_id`, roles — direct account takeover vector |
| `refresh_tokens`, `user_sessions` | session material; exposure means session theft |
| `orders`, `order_items`, `product_purchases` | payment history and what each customer bought |
| `payments_config` | provider secret material is stored encrypted here |
| `impersonation_sessions` | an exposed row is an active admin impersonation grant |
| `notifications`, `platform_notification_feeds` | private messages between users |
| `dm_*`, `chat_messages` | direct messages |
| `audit_logs`, `login_history` | who did what — invaluable to an attacker for stealth |
| `email_outbox` | outbound mail bodies, including verification links |
| `ai_documents`, `ai_usage_logs` | customer content and provider metadata |
| `rbac_roles`, `rbac_permissions`, `user_tenant_roles` | privilege definition itself |

Suggested order of work:

1. Decide whether any table is ever read from a browser. If none are, document that
   explicitly — it is what makes RLS optional rather than an emergency.
2. If the anon key is ever used, start with `users`, `orders`, `product_purchases`,
   `notifications`, `dm_*`: enable RLS with **deny all**, then add the narrow policies
   the client actually needs.
3. Confirm the anon key is not present in any client bundle (the check above).
4. Only then consider tightening the backend to a non-bypassing role.

## Password reset / account recovery

Supabase owns it, and SMTP is our Resend account. Verify `Authentication → URL
Configuration` still points only at `https://barootcnc.com` — a stale entry there is
a token-leak path that no amount of host hardening covers.
