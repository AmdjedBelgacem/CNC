# Supabase Signup Fix

Signup was broken end to end. It reported success and the account could never sign in.

## Symptom

```
POST /auth/register   -> 201 Created, {"user": {...}}
POST /auth/login      -> 401 {"message":"Invalid email or password"}
```

The frontend showed a green success state and the new account still could not log in.

## Root cause — two independent defects

### 1. Registration never created the Supabase identity

`SUPABASE_AUTH_ENABLED` makes `login()` authenticate against Supabase
(`supabase-auth.client.ts`). But `AuthService.register()` had **no Supabase branch at all** —
it wrote a local `users` row with a locally-hashed password and sent a verification email.
So the two halves of the auth system had been left unreconciled: every account created after
the Supabase migration existed locally but not in Supabase, and the very next login looked
it up in Supabase, did not find it, and returned 401.

`SupabaseAuthClient.createUser()` already existed and was simply never called.

### 2. `createUser()` threw on success

```ts
if (!json.user?.id) throw new SupabaseAuthError('no_user', ..., 502);
return json.user.id;
```

`POST /auth/v1/admin/users` returns the created user at the **top level** —
`{"id":"bb2d…","aud":"authenticated","email":…}` — with no `user` wrapper. So `json.user?.id`
was always `undefined` and the method threw `no_user`/502 **even when Supabase had created
the account**. That surfaced to the form as a generic "Registration is unavailable", while
Supabase held an orphaned auth user — which is why every retry then failed with
"A user with this email address has already been registered".

Confirmed by calling the admin endpoint directly from the container:

```
status: 200
{"id":"bb2d4326-…","aud":"authenticated","email":"probe.1791222711812@example.com", …}
```

Both shapes are now accepted, so this survives the response ever being enveloped.

## Fix

`register()` now branches to Supabase when Supabase owns credentials:

1. **Supabase first.** `createUser()` runs before the local insert, so a Supabase rejection
   (address taken, weak password) cannot leave an orphaned `pending_verification` row that
   blocks every retry with "already exists".
2. **Then mirror the row** into `users` with `authUserId`, `accountStatus: 'active'` and
   `emailVerifiedAt` set. A previously `deleted` row for the same address is revived rather
   than duplicated, because `users.email` is unique per tenant.
3. **Then establish a session** and return it; the controller sets the auth cookies, so a
   confirmed signup lands authenticated instead of bouncing to the login page for a
   credential it just supplied.

### Email confirmation is no longer a dead end

`createUser()` passes `email_confirm: true`. The address is our own record, so there is no
reason to make a new learner wait on an SMTP round-trip before their first login — and it
means signup works with **no mail provider configured at all**, locally or in CI. The
previous local path produced `pending_verification` users who could never log in because no
SMTP was configured to deliver the confirmation link.

The legacy response is still returned for local-auth mode, now with an explicit
`requiresEmailVerification: true` plus a "check your email" message rather than a hard
failure.

### Errors are translated, not swallowed

Supabase rejections become messages the form can display:

| Supabase response | User sees |
|---|---|
| `422 … already been registered` | An account with this email already exists |
| password policy failure | Password does not meet the required strength |
| `429` | Too many signup attempts. Please try again later. |

Previously any of these produced a bare "Registration failed" with no cause surfaced.

## Verification (local stack, Supabase-backed)

```
register                        -> 201
  authenticated                 -> true
  requiresEmailVerification     -> false
  user                          -> role=learner, accountStatus=active, authUserId set
  cookies set                   -> access-token, refresh-token
GET /auth/me with that session  -> 200  "role":"learner"
POST /auth/login (fresh session)-> 200
duplicate registration          -> 409  "An account with this email already exists"
weak password                   -> 409  "Password does not meet the required strength"
```

Regression, existing superadmin unaffected:

```
login          -> 200  role=super_admin
GET /auth/me   -> 200
logout         -> 200   (requires CSRF token + x-tenant-slug; a 403 without them is the guard working)
GET /auth/me   -> 401
re-login       -> 200
```

`POST /auth/register` returned 403 during testing until `x-tenant-slug` was supplied — the
`TenantGuard`, reproduced identically on the pre-change build, so not a regression.

## Local setup note

For a local run, `SUPABASE_AUTH_ENABLED=true` plus `SUPABASE_URL`,
`SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` (admin API) is enough — no SMTP
required. Keys belong in `apps/backend/.env`, which is gitignored; `scripts/scan-secrets.sh`
fails CI if a key is committed.
