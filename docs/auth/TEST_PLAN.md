# Auth System Test Plan

## Prerequisites
1. Database seeded: `pnpm --filter @titan/backend db:seed`
2. Backend running: `pnpm --filter @titan/backend dev`
3. Frontend running: `pnpm --filter @titan/frontend dev`

---

## 1. Registration Flow

### 1.1 Happy Path - Email/Password Registration
- Navigate to `/register`
- Fill in: name="Test User", email="test-new@example.com", password="Test1234!", confirm password
- Submit
- Expected: Success message, verification email token returned in response
- Verify user appears in DB with `accountStatus: 'pending_verification'`

### 1.2 Duplicate Email (Registered + Verified)
- Register with email "learner@titansofmanufacturing.com"
- Expected: Error "An account with this email already exists"

### 1.3 Duplicate Email (Pending Verification)
- Register with email "pending@titansofmanufacturing.com"
- Expected: Error about pending verification / resend flow

### 1.4 Duplicate Username
- Register with username that already exists
- Expected: Error "Username is already taken"

### 1.5 Weak Password
- Password with < 8 chars, no uppercase, no number
- Expected: Validation error with specific requirements

### 1.6 Invalid Email
- Email without @ symbol
- Expected: Validation error

### 1.7 Missing Accept Terms
- (currently not enforced - would need form checkbox)
- Note: Validation schema requires `acceptTerms: true`

### 1.8 Rate Limiting
- Attempt 4 registrations within 1 hour
- Expected: 4th request returns 429 Too Many Requests

---

## 2. Email Verification

### 2.1 Happy Path
- Call `POST /auth/verify-email` with valid token from registration
- Expected: 200 OK, user `accountStatus` becomes `active`

### 2.2 Expired Token
- Wait 24h+ or manipulate token expiry in DB
- Expected: Error "Verification token has expired"

### 2.3 Invalid Token
- Call with random gibberish token
- Expected: Error "Invalid or expired verification token"

### 2.4 Already Verified
- Verify a user who is already verified
- Expected: Token is single-use, so second use fails

### 2.5 Resend Verification
- Call `POST /auth/resend-verification` with email
- Expected: Success (no leak of whether email exists)
- Check DB: new verification token created

### 2.6 Resend Rate Limiting
- Request resend 4+ times in 1 hour
- Expected: 429 Too Many Requests

---

## 3. Login Flow

### 3.1 Happy Path
- Email: `learner@titansofmanufacturing.com`, Password: `Test1234!`
- Expected: 200 OK, accessToken, refreshToken, user object returned

### 3.2 Wrong Password
- Correct email, wrong password
- Expected: "Invalid email or password"

### 3.3 Non-existent Email
- Email that doesn't exist
- Expected: "Invalid email or password" (same message)

### 3.4 Account Locked (Progressive)
- Attempt login 5 times with wrong password
- Expected 5th attempt: "Account temporarily locked"
- Check DB: `lockedUntil` is set, `accountStatus: 'locked'`

### 3.5 Account Lockout Recovery
- Wait for lockout to expire (15 min) or update DB `lockedUntil` to past
- Expected: Login succeeds, `lockedUntil` cleared, `failedLoginAttempts` reset to 0

### 3.6 Account Lockout Escalated
- Trigger lockout twice (10+ total failures)
- Expected: Lockout duration is 60 minutes

### 3.7 Suspended Account
- Email: `suspended@titansofmanufacturing.com`, Password: `Test1234!`
- Expected: "Your account has been suspended. Contact support."

### 3.8 Deleted Account (Soft)
- Set user `accountStatus: 'deleted'`
- Try login
- Expected: "Invalid email or password" (no leak)

### 3.9 Unverified Email
- Email: `pending@titansofmanufacturing.com`, Password: `Test1234!`
- Expected: Error about verifying email first

### 3.10 Remember Device
- Login with `rememberDevice: true`
- Expected: Refresh token has 30-day expiry

### 3.11 Timing Attack Protection
- Measure response time for existing vs non-existing email
- Expected: Response times are indistinguishable (within network jitter)

### 3.12 Rate Limiting
- 11 login attempts in 60 seconds
- Expected: 429 Too Many Requests

---

## 4. Token Refresh

### 4.1 Happy Path
- Call `POST /auth/refresh` with valid refresh token
- Expected: New accessToken + refreshToken returned

### 4.2 Token Rotation
- After refresh, try to use the old refresh token again
- Expected: Error - old token is revoked

### 4.3 Token Reuse Attack (Stolen Token)
- Simulate: User A refreshes (gets new token). Attacker presents old token.
- Expected: Both old and new tokens should be invalidated (token family kill)

### 4.4 Expired Token
- Wait for refresh token to expire (7d / 30d)
- Expected: Error "Refresh token expired"

### 4.5 Invalid Token
- Random string
- Expected: "Invalid or expired refresh token"

---

## 5. Password Reset

### 5.1 Happy Path
- Call `POST /auth/forgot-password` with valid email
- Call `POST /auth/reset-password` with token + new password
- Expected: Password changed, all sessions revoked, can login with new password

### 5.2 Non-existent Email
- Call forgot-password with unknown email
- Expected: 200 OK (no leak)

### 5.3 Expired Token
- Wait 1h+ for reset token to expire
- Expected: "Reset token has expired"

### 5.4 Invalid Token
- Random token
- Expected: "Invalid or expired reset token"

### 5.5 Rate Limiting
- 4 password reset requests in 1 hour
- Expected: 429

---

## 6. Change Password

### 6.1 Happy Path
- Authenticated, call `POST /auth/change-password` with correct current + new password
- Expected: Password changed, all sessions revoked, need to re-login

### 6.2 Wrong Current Password
- Incorrect current password
- Expected: "Current password is incorrect"

### 6.3 Weak New Password
- New password doesn't meet requirements
- Expected: Validation error

### 6.4 No Password Set (OAuth-only user)
- User without passwordHash tries to change password
- Expected: "Password login is not set up for this account"

---

## 7. 2FA Flow

### 7.1 Setup 2FA
- Call `POST /auth/2fa/setup` (authenticated)
- Expected: Returns secret, QR code data URL, otpauthUrl

### 7.2 Enable 2FA
- Call `POST /auth/2fa/enable` with valid TOTP code + secret
- Expected: 2FA enabled, backup codes returned

### 7.3 Login with 2FA
- Login with 2FA-enabled user
- Expected: `twoFactorRequired: true` in response, `twoFactorRequired: true` in frontend store

### 7.4 Verify 2FA Token
- Call `POST /auth/2fa/verify` with valid TOTP code
- Expected: `verified: true`

### 7.5 Invalid 2FA Token
- Wrong code
- Expected: Error "Invalid verification code"

### 7.6 Backup Code
- Use a backup code instead of TOTP
- Expected: Verified, code consumed (removed from list)

### 7.7 Backup Code Reuse
- Try to use the same backup code again
- Expected: Fails (code already consumed)

### 7.8 Disable 2FA
- Call `POST /auth/2fa/disable` with valid TOTP code
- Expected: 2FA disabled, `user.twoFactorEnabled` = false

---

## 8. OAuth Flow

### 8.1 Google OAuth Login (New User)
- Click "Continue with Google"
- Expected: Redirect to Google, then callback creates user + links account

### 8.2 GitHub OAuth Login
- Same flow as Google

### 8.3 OAuth + Existing Email (Link)
- Login with Google using email that already has an account
- Expected: OAuth account linked to existing user

### 8.4 OAuth Account Already Linked
- Try to link same Google account to different user
- Expected: Conflict error

### 8.5 Unlink OAuth Account (Has Password)
- Unlink provider
- Expected: Success

### 8.6 Unlink OAuth Account (No Password, Only One Provider)
- Try to unlink when no password set and only 1 OAuth account
- Expected: Error requiring password setup first

---

## 9. Session Management

### 9.1 List Sessions
- Call `GET /auth/sessions` (authenticated)
- Expected: Array of sessions with device info, IP, timestamps

### 9.2 Revoke Session
- Revoke a non-current session
- Expected: Session revoked, that device cannot refresh tokens

### 9.3 Revoke Current Session (via logout)
- Call `POST /auth/logout` with refresh token
- Expected: Current session revoked

### 9.4 Logout Everywhere
- Call `POST /auth/logout-everywhere`
- Expected: All sessions revoked

---

## 10. Authorization & RBAC

### 10.1 Role Hierarchy
- `super_admin` can access all routes
- `admin` can access admin routes
- `learner` cannot access admin routes
- Test with each role against various protected endpoints

### 10.2 Role-Based Guard
- Decorate a test endpoint with `@Roles('super_admin')`
- Call as learner: Expected 403 Forbidden

### 10.3 Tenant Scope
- User cannot access data from a tenant they don't belong to
- Cross-tenant user (role assigned via `user_tenant_roles`) CAN access assigned tenant

### 10.4 Super Admin Bypass
- Super admin can access any tenant's data

---

## 11. Admin Actions

### 11.1 List Users
- `GET /admin/users` as super_admin
- Expected: Full user list

### 11.2 Change Role
- `PATCH /admin/users/:id/role` as super_admin
- Expected: Role changed, audit logged

### 11.3 Suspend User
- `POST /admin/users/:id/suspend`
- Expected: User suspended, sessions revoked

### 11.4 Unsuspend User
- `POST /admin/users/:id/unsuspend`
- Expected: User reactivated

### 11.5 Force Password Reset
- `POST /admin/users/:id/force-password-reset`
- Expected: Password nulled, reset token generated

### 11.6 Impersonation
- `POST /admin/users/:id/impersonate`
- Expected: Returns access token for target user
- Check audit log for impersonation event

### 11.7 View Audit Logs
- `GET /admin/audit-logs`
- Expected: Array of audit entries

### 11.8 Soft Delete User
- `DELETE /admin/users/:id`
- Expected: User status = 'deleted', sessions revoked

---

## 12. Multi-Tenant Tests

### 12.1 User in Single Tenant
- Default user can only access their own tenant data

### 12.2 User with Cross-Tenant Roles
- `cross-tenant@titansofmanufacturing.com` has learner role in tenant1 + instructor role in tenant2
- Verify they can access instructor features in tenant2

### 12.3 Tenant Slug Resolution
- Different subdomain resolves different tenant
- Auth flows should respect `x-tenant-slug` header

---

## 13. Edge Cases

### 13.1 Concurrent Password Reset
- Request 2 reset tokens; use both
- Expected: First succeeds, second fails (single-use)

### 13.2 Token Expiry Clock Skew
- System clock is slightly off (30s)
- Expected: JWT validation tolerates up to 30s skew

### 13.3 Email Change During Active Session
- Change email while logged in on multiple devices
- Expected: All sessions revoked, need to login with new email

### 13.4 Role Change While Active
- Admin changes user's role while logged in
- Expected: Existing JWT still has old role (15 min max), new JWT has updated role

### 13.5 Tenant Removal
- Remove user's cross-tenant role
- Expected: User loses access to that tenant on next request

### 13.6 Guest → Auth Conversion
- Not implemented yet (would need cart merge flow)

### 13.7 Very Long-Lived Sessions
- "Remember this device" creates 30-day tokens
- Verify refresh token rotation still works correctly after 29 days

---

## 14. Security Hardening Tests

### 14.1 Password Hash Verification
- Check that `passwordHash` uses Argon2id format ($argon2id$...)
- Verify that plaintext passwords are never stored

### 14.2 Token Entropy
- Refresh tokens should be 128 hex chars (512 bits)
- Verification tokens should be 64 hex chars (256 bits)

### 14.3 No Sensitive Data in Logs
- Search logs for password, token, secret
- Expected: No sensitive data leaked

### 14.4 CORS
- Requests from unauthorized origins should be blocked

### 14.5 Security Headers
- Check for X-Content-Type-Options, X-Frame-Options, etc.

### 14.6 SQL Injection
- Attempt SQL injection in email/password fields
- Expected: Drizzle ORM parameterizes queries, no injection possible

### 14.7 Input Validation Bypass
- Attempt to send malformed JSON, extra fields
- Expected: ValidationPipe whitelist strips unknown fields, validation fails

---

## Running Tests

### Automated Tests
```bash
# Backend tests (if using Jest/Vitest)
pnpm --filter @titan/backend test

# Frontend tests
pnpm --filter @titan/frontend test
```

### Manual Testing Flow
1. Start services: `docker compose up -d`
2. Push schema: `pnpm --filter @titan/backend db:push`
3. Seed data: `pnpm --filter @titan/backend db:seed`
4. Start backend: `pnpm --filter @titan/backend dev`
5. Start frontend: `pnpm --filter @titan/frontend dev`
6. Test each flow using the test cases above
7. Check audit logs in DB to verify logging
