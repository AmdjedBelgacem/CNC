# Phase 2 — Supabase Auth (EXCLUSIVE)

Supabase Auth is now the **only** credential authority and the **only** token issuer.
The application no longer verifies passwords or issues its own access tokens.

**Status: exclusive and verified against the live project** (`pyyrctqhdgfsmxiafvfm`).

```
old application password (scrypt)  -> 401   no longer accepted
wrong Supabase password            -> 401
hand-minted local HS256 JWT        -> 401   rejected even when signed
                                        with the app's own JWT_ACCESS_SECRET
valid Supabase ES256 token         -> 200
page sweep                         -> 103 pass / 0 fail
backend suite                      -> 652/652
```

## What "exclusive" means in code

- `JwtAuthGuard` no longer falls back to the local JWT strategy. When
  `SUPABASE_AUTH_ENABLED=true` it validates **only** against the project's JWKS.
- `POST /auth/login` brokers to Supabase's password grant. The app never hashes or
  compares a credential; it resolves the local `users` row by email purely to attach
  tenancy and RBAC.
- `POST /auth/refresh` uses Supabase's refresh grant.
- Tokens still travel in the existing httpOnly cookies, so CSRF and middleware
  behaviour are unchanged. `SupabaseAuthGuard` reads the cookie **and** the
  `Authorization` header, matching `JwtStrategy`'s extraction.

## Consequences

- **Every user must have a Supabase password.** 12 of 13 accounts were created with
  unusable random passwords, so those users must complete a password setup before they
  can sign in. Password reset is handled by Supabase (SMTP → Resend).
- The first-party JWT strategy, `scrypt`/`argon2` login and local session issuance
  remain in the codebase but are unreachable while the flag is on. They are the
  rollback path if the flag is turned off.
- App-side 2FA (TOTP), login history, lockout and session revocation remain in force;
  they are layered on top of a Supabase-authenticated identity.

## Verified working

```
13 application users synced to auth.users, all linked via users.auth_user_id
genuine ES256 token                  -> accepted
tampered payload                     -> rejected
HS256 downgrade attempt              -> rejected (JWKS project refuses HMAC entirely)
alg:none                             -> rejected
HS256 signed with a guessed secret   -> rejected
unknown tenant slug                  -> 403
/admin/users, /admin/ai, payments    -> 200 with permissions ["*"] from local RBAC
page sweep (81 pages + 22 endpoints) -> 103 pass / 0 fail
```

## Signing: this project is ES256, not HS256

The project publishes an **asymmetric** key at
`https://<ref>.supabase.co/auth/v1/.well-known/jwks.json` (EC P-256). Consequences
handled in `SupabaseTokenVerifier`:

- HS256 is **refused outright** when a JWKS URL is configured, so a token cannot be
  downgraded and checked against public key material.
- The algorithm is taken from the published key, never from the token header alone.
- ECDSA signatures arrive as raw R||S and are converted to ASN.1 DER before
  verification, because Node's verifier expects DER.
- `verify()` must be called **as a method** on the verifier object. Extracting it
  (`const check = verifier.verify`) detaches `this`, and Node then throws on
  `undefined[kHandle]` — which silently fails every token.

Both HS256 (legacy shared-secret projects) and JWKS (modern projects) are supported,
and never mixed.

## Configuration

Backend env (`apps/backend/.env`, which `dotenv` loads from the backend's CWD):

```
SUPABASE_AUTH_ENABLED=true
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...   # browser-safe
SUPABASE_SECRET_KEY=sb_secret_...             # ADMIN ONLY — never in a browser
SUPABASE_JWKS_URL=https://<ref>.supabase.co/auth/v1/.well-known/jwks.json
```

Supabase → Authentication → SMTP, so auth emails go out through Resend:

| Field | Value |
| --- | --- |
| Host | `smtp.resend.com` |
| Port | `465` (TLS) or `587` (STARTTLS) |
| Username | `resend` |
| Password | your Resend API key |
| Sender | a verified Resend domain |

Transactional app email continues to use the existing `Resend` client in
`email.service.ts` — independent paths.

## Token flow

`JwtAuthGuard` tries the **local JWT strategy first** so existing sessions keep
working, then falls back to `SupabaseAuthGuard` when Supabase auth is enabled. The
guard resolves `request.user` with the same 13-field shape `JwtStrategy` produces, so
all 144 `@CurrentUser()` sites and the RBAC guards are unaffected — there is a test
asserting that field set against the JWT strategy source.

Permissions come from `RbacService.resolvePermissions()` against **this application's
own** roles/permissions tables. A Supabase claim is never treated as a grant.

`SupabaseTokenVerifier` and `SupabaseAuthGuard` are exported from the global
`AuthModule` because `JwtAuthGuard` is also registered in feature modules (admin
controllers) that do not import `AuthModule`; without the export, Supabase tokens
work on auth routes but 401 on `/admin/*`.


## Shape

```
auth.users (Supabase)          users (this app, unchanged)
  id  ──────────────────────►  auth_user_id   (added by migration 032)
                                  id ◄── 48 foreign keys across the schema
```

`users.auth_user_id` is nullable with a partial unique index, so the 40 migrations
apply cleanly to a database of unsynced users.

## Rollout

1. Ship Phase 2 with `SUPABASE_AUTH_ENABLED=false`. Nothing changes.
2. Run the sync and send setup emails.
3. Verify sign-in works, then flip the flag.
4. Keep the existing JWT strategy in place during the transition so both paths work.

## Known consequence

After the flip, **every existing user must complete a password reset**. That was the
agreed trade-off in preference to running a dual scrypt+bcrypt verifier.

## Storage — Supabase S3 (live, both paths)

`https://pyyrctqhdgfsmxiafvfm.storage.supabase.com/storage/v1/s3`, region `eu-west-1`.

| Bucket | Access | Holds |
| --- | --- | --- |
| `uploads` | **public** | avatars, covers, portfolio images, course images |
| `media` | **private** | paid lesson video |

```
S3 credentials verified        -> ListBuckets OK
avatar upload via API          -> 200, stored in Supabase
public URL fetch               -> 200 image/png, bytes identical to upload
backend boot                   -> "Uploads -> Supabase Storage bucket uploads"
                                 "S3 storage configured for bucket media"
presigned lesson-video PUT     -> correctly signed
lesson-video playback URL      -> signed (NOT the public base)
```

`UploadService` (avatars/covers/portfolio) now writes to Supabase with a **local-disk
fallback** when S3 is unset, so a machine without credentials still works.

### Three traps hit while doing this

1. **Supabase's S3 layer is not a faithful S3 implementation for bucket admin.**
   `CreateBucket` appeared to succeed and `HeadBucket` reported OK, but `ListBuckets`
   stayed empty — and a later `DeletePublicAccessBlock` **deleted the bucket outright**.
   Buckets must be created through the native Storage API (`POST /storage/v1/bucket`),
   where `public: true/false` is set at creation.
2. **One bucket for both public and private content leaked paid video.** Avatars and
   lesson video originally shared `S3_BUCKET`. Video now uses `S3_MEDIA_BUCKET`, and
   `resolvePlaybackUrl` only returns the public base URL when the bucket it serves *is*
   the public bucket — otherwise it always signs.
3. **`S3_PUBLIC_URL` was only a commented example line**, so it silently read as unset.

Config keys: `S3_BUCKET` (public), `S3_MEDIA_BUCKET` (private),
`S3_PUBLIC_URL` (public base for `S3_BUCKET` only).

## Email — Resend (live, domain-restricted)

```
RESEND_API_KEY configured  -> send returned 200 (id 01a10839-...)
```

The key is **restricted**: Resend allows delivery only to `ahmed@barootcnc.com` until a
domain is verified. Password-reset and verification emails to real users will fail until
that is done. Both remaining steps are dashboard-only:

1. Verify a domain in Resend and set the `from` address to it.
2. Point Supabase Auth -> SMTP at the same Resend account
   (`smtp.resend.com`, 465/587, user `resend`, password = API key).

## Still not Supabase

- **Redis** (`localhost:6379`) — tokens, payments, rate limiting. No Supabase equivalent.
- **Meilisearch** (`localhost:7700`) — currently down, so search is broken.
