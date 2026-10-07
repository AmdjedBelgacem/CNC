# Credential rotation checklist — barootcnc.com

Nothing here is applied automatically. Rotate when you decide to; the order matters,
because two of these invalidate live sessions.

Secrets live in ONE place: `/opt/titanic/cnc/deploy/lightsail/.env` (mode `600`,
owner `ubuntu`). The API receives them as compose environment variables, so a change
needs `docker compose up -d <service>` — not a rebuild, and never a commit.

```bash
ssh -i "~/pem keys/Cnc-ap-south-1.pem" ubuntu@13.206.178.25
cd /opt/titanic/cnc/deploy/lightsail
sudo cp .env /root/.env.bak-$(date -u +%Y%m%d%H%M)   # before every change
```

Verify afterwards with `sudo node -e "..."` inside the container, or simply:

```bash
docker compose --project-name titan exec backend printenv SUPABASE_SECRET_KEY | wc -c
```

## Order of operations (lowest blast radius first)

### 1. `AUTH_SECRET`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` — cheapest, do first
Signs the pending-2FA cookie, the first-party JWTs and several HMAC tokens.
Rotating them does NOT touch Supabase-issued sessions, so no user is signed out of
their Supabase session; it only drops local artefacts.

```bash
NEW=$(openssl rand -base64 48 | tr -d '\n')
sed -i "s|^AUTH_SECRET=.*|AUTH_SECRET=$NEW|" .env
NEW2=$(openssl rand -base64 48 | tr -d '\n'); sed -i "s|^JWT_ACCESS_SECRET=.*|JWT_ACCESS_SECRET=$NEW2|" .env
NEW3=$(openssl rand -base64 48 | tr -d '\n'); sed -i "s|^JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=$NEW3|" .env
chmod 600 .env
docker compose --project-name titan up -d backend     # no rebuild
curl -sS https://barootcnc.com/api/proxy/health | head -c 200
```
Anyone mid-2FA at that moment must restart the login. Nothing else.

### 2. `RESEND_API_KEY`
Resend → API keys → create new → update `.env` → recreate `backend`. Verify by
triggering a registration with a real inbox and confirming delivery.

### 3. `S3_ACCESS_KEY` / `S3_SECRET_KEY`
Create a new key pair, update `.env`, recreate `backend`, verify an upload, then
delete the old key. Buckets `uploads` (public) and `media` (private) are unaffected.

### 4. `GOOGLE_CLIENT_SECRET` (and GitHub if ever configured)
Create the new client secret in the Google console, update `.env`, recreate
`backend`, then run one real Google sign-in. The OAuth **callback URI stays the
same**, so no console redirect-URI change is needed.

### 5. `SUPABASE_SECRET_KEY` (service role) — the dangerous one
Project → Settings → API → rotate secret key. It may take a minute to propagate.
Update `.env`, recreate `backend`, then verify auth still works:

```bash
docker compose --project-name titan exec backend printenv SUPABASE_SECRET_KEY | head -c 8   # expect sb_secret_
curl -sS -o /dev/null -w '%{http_code}\n' https://barootcnc.com/api/proxy/auth/me
```
Users are NOT signed out: sessions are validated against the project's JWKS, which
is unaffected by rotating the issuing key.

### 6. `DATABASE_URL` password
Supabase → Settings → Database → reset password. Update `.env`, recreate
`backend` and `frontend`, verify `/api/proxy/health` reports `database: up`. Do this
with care and never in a hurry — it is the one change that can make the whole
application unavailable.

### 7. `AI_ASSISTANT_ENCRYPTION_KEY`
Only needed if per-provider keys are stored through the admin UI; changing it makes
existing stored provider keys unreadable. Rotate together with re-entering them.

## After any rotation

```bash
bash scripts/lightsail/smoke.sh          # from the repo, or copy the checks below
sudo ausearch --input-logs -k secrets_write -ts today | tail    # proof the file changed
sudo fail2ban-client status caddy-auth-abuse | grep -E "Total failed|Currently banned"
```

Never commit a rotated value. `.env` is excluded from rsync and the server has no
git checkout.
