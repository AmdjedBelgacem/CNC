# Authentication & Authorization Security Notes

## Architecture Overview

The auth system uses a JWT-based stateless authentication model with refresh token rotation. Access tokens are short-lived (15 minutes), while refresh tokens are stored hashed in the database and rotated on every use. This limits the blast radius of token theft.

## Key Security Decisions

### 1. Password Hashing: Argon2id

- **Algorithm**: Argon2id (hybrid against side-channel + GPU attacks)
- **Parameters**: Time cost=3, Memory cost=64MB, Parallelism=4
- **Why**: Argon2id is the winner of the PHC (Password Hashing Competition) and is resistant to both GPU cracking and side-channel attacks. The memory-hard property makes it expensive to brute force.
- **Rehash on login**: The system checks `argon2.needsRehash()` and can transparently upgrade hashes when parameters change.

### 2. Token Design

#### Access Tokens (JWT)
- **Expiry**: 15 minutes
- **Type claim**: Includes `type: 'access'` to prevent refresh tokens from being used as access tokens
- **Contents**: `sub` (user ID), `email`, `role`, `tenantId`, `type`, `iat`, `exp`
- **No sensitive data**: Tokens only contain identifiers, never passwords or secrets
- **Clock skew**: JwtModule handles 30s clock skew by default
- **Key rotation**: Each JWT includes a `kid` (key ID) header when signed with a rotated key. The `signing_keys` table stores all active keys. Old keys remain valid for verification until rotated out.

#### Refresh Tokens
- **Format**: Cryptographically random 64-byte hex string (128 chars)
- **Storage**: SHA-256 hashed in database (never stored in plaintext)
- **Rotation**: Old token is revoked when new one is issued; reuse of a revoked token invalidates ALL sessions for that user (token family invalidation)
- **Expiry**: 7 days (30 days with "remember this device")
- **Database columns**: `isRevoked`, `revokedAt` for audit trail

### 3. Rate Limiting

Every auth endpoint is rate-limited with progressively stricter limits. All rate limiting is backed by Redis (via custom `RedisThrottlerStorage` implementation using `ioredis`), ensuring correct behavior across multiple NestJS instances:

| Endpoint | Window | Limit | Rationale |
|----------|--------|-------|-----------|
| Login | 60s | 10 | Prevent brute force without breaking UX |
| Register | 1h | 3 | Prevent account creation abuse |
| Verify email | 1h | 5 | Prevent token enumeration |
| Password reset | 1h | 3 | Prevent email flooding |
| Global | 60s | 100 | General API protection |

### 4. Account Lockout

- **Threshold**: 5 failed attempts triggers lockout
- **Duration**: 15 minutes initial, 60 minutes after 10+ failures (escalating)
- **Scope**: Per-email, regardless of IP (prevents distributed attacks)
- **Tracking**: Both in-memory (failed_login_attempts table) and per-user (users.failedLoginAttempts column)
- **Auto-recovery**: Lock auto-expires; no admin intervention needed for temporary locks

### 5. Account Status State Machine

```
pending_verification
        |
    [verify email]
        |
      active  <──>  suspended  (admin action)
        |              |
     [5 failures]   [unsuspend]
        |
      locked
        |
    [timeout]
        |
      active
        |
    [soft delete]
        |
      deleted  (retention period, then permanent)
```

### 6. Email Verification

- **Token**: 32 random bytes, hex-encoded (64 chars)
- **Storage**: SHA-256 hashed in `verification_tokens` table
- **Expiry**: 24 hours
- **Single-use**: Token is marked as `usedAt` after successful verification
- **No timing leaks**: Resend endpoint always returns success (does not reveal if email exists)
- **Email delivery**: Uses Resend API in production; falls back to console logging in development. HTML + plain text templates for verification, password reset, and security notifications.

### 7. Refresh Token Rotation & Reuse Detection

- On each refresh, the old token is revoked and a new one issued
- If a *revoked* token is presented (e.g., stolen token being used after legitimate rotation), the system detects the replay and:
  1. Immediately revokes ALL remaining valid refresh tokens for that user
  2. Revokes all user sessions
  This prevents an attacker from continuing to use a stolen token after the legitimate user has rotated it.
- **Token family invalidation**: All tokens for the user are revoked on password change, email change, or admin force-logout
- This is the industry-standard approach (similar to Auth0's token rotation)

### 8. 2FA (TOTP)

- **Algorithm**: TOTP (RFC 6238) with 30-second window
- **Window**: ±1 step (allows 30s clock skew)
- **Backup codes**: 8 single-use, 10-character hex codes, stored hashed
- **Setup**: QR code generated with `otpauth://` URI
- **Enforcement**: Admin roles must have 2FA enabled; checked by `TwoFactorRequiredGuard`
- **Notifications**: Email sent when 2FA is enabled

### 9. Session Management

- Every refresh token creation also creates a `user_sessions` record
- Sessions track IP, user agent, device info, last active time
- Users can view all sessions and revoke individual ones
- "Logout everywhere" revokes all refresh tokens and sessions
- Concurrent session limit: 10 (configurable in `AUTH_CONSTANTS`)

### 10. Audit Logging

Every sensitive action is logged to the `audit_logs` table:

- Login success/failure
- Registration
- Email verification
- Password change/reset
- 2FA enable/disable
- OAuth link/unlink
- Role changes
- User suspension/unsuspension
- Impersonation start
- Account deletion
- Admin force password reset
- Signing key rotation

Audit logs include: user ID, action, entity type/ID, IP, user agent, tenant ID, and structured details (JSON). Logs are immutable (append-only).

### 11. CSRF Protection

- **Pattern**: Double-submit cookie (synchronizer token)
- **How it works**: On first load, the client GETs `/auth/csrf-token`. The server returns the token in the response body AND sets it as a non-httpOnly cookie (`csrf-token`). For all state-changing requests (POST/PUT/PATCH/DELETE), the client sends the same token as an `x-csrf-token` header. The server compares the cookie value with the header value.
- **Validation**: Token is HMAC-signed with a server-side secret to prevent forgery
- **Exempt routes**: GET/HEAD/OPTIONS requests are exempt (no state change)
- **CORS**: `credentials: true` with explicit `x-csrf-token` allowed header
- **Graceful degradation**: If CSRF token is missing/stale, the server returns 403. The client automatically re-fetches the CSRF token and retries the request.
- **Why not SameSite=Strict**: SameSite=Lax is used to allow OAuth redirects while still preventing cross-site POST requests

### 12. JWT Signing Key Management

- **Current key**: The active signing key is stored in the `signing_keys` database table
- **Initialization**: On first startup, the env `JWT_ACCESS_SECRET` is imported into the `signing_keys` table
- **Rotation**: Admin can call `POST /admin/rotate-key` to generate a new key. The previous key is marked `isActive=false` but remains in the database for verification of existing tokens.
- **Verification**: The `JwtStrategy` uses `secretOrKeyProvider` to look up the correct key by `kid` (key ID) from the JWT header. If no `kid` is present, it falls back to the env secret.
- **Expiry**: Inactive keys older than 30 days are automatically cleaned up

**Key Rotation Process (for production)**:
1. Generate new key: `POST /admin/rotate-key` (super_admin only)
2. Old tokens remain valid until they expire naturally (15 min access, 7-30 day refresh)
3. New tokens are signed with the new key
4. After 30 days, old keys are garbage-collected
5. Emergency rotation: if a key is compromised, all users should be force-logged out after rotation

### 13. Security Headers

- `helmet` middleware adds: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Strict-Transport-Security, etc.

### 14. Input Validation

- All auth endpoints validate input with Zod schemas (in @titan/shared)
- Password strength enforced: 8+ chars, uppercase, lowercase, number
- Email validated for format
- UUIDs validated where required

### 15. No Information Leakage

- Login returns "Invalid email or password" regardless of whether the email exists
- A random delay (100-200ms) is added to the "user not found" path to prevent timing attacks
- Password reset always returns success (doesn't reveal if email exists)
- Resend verification always returns success
- Error messages are generic; internal errors are logged but not exposed

### 16. Tenant Isolation

- Every user has a primary tenant
- `TenantScopeGuard` ensures users can only act within their allowed tenants
- `user_tenant_roles` table enables cross-tenant access with specific roles
- Super admin can bypass tenant scoping

### 17. Email Delivery

- **Provider**: Resend (with `RESEND_API_KEY` env var)
- **Fallback**: In development mode (NODE_ENV=development), emails are logged to console instead of sent
- **Templates**: HTML + plain text for each email type
  - Email verification
  - Password reset
  - Password changed notification
  - Email changed notification
  - 2FA enabled notification
- **Retry logic**: Exponential backoff (500ms, 1s, 2s), 3 attempts, only retries on 5xx or 429 responses
- **Rate limiting**: Per-recipient rate limiting is enforced by Resend's API (not implemented in-app)
- **Security**: Full tokens are never logged. Only the recipient and subject are logged for debugging.

### 18. Timing Attack Resistance

- Password comparison is constant-time via Argon2id's built-in verification
- When a user doesn't exist, the system adds a random delay (100-200ms) before returning "Invalid email or password"
- This makes it impossible to distinguish between "user exists + wrong password" and "user doesn't exist" by timing alone

### 19. Concurrent Password Reset Protection

- Password reset tokens are single-use (marked `usedAt` on consumption)
- The first token to be consumed wins; subsequent attempts with other tokens fail
- This prevents race conditions where two simultaneous reset requests could both succeed

### 20. Impersonation

- Only `super_admin` can impersonate
- Impersonation generates a new JWT for the target user with `impersonating: true` and `impersonatedBy` fields
- Full audit trail logged on impersonation start
- Frontend displays a visible amber banner when impersonating (shown in the nav bar)
- All admin actions during impersonation are logged with the impersonating admin's ID

## Database Schema Design Rationale

### Why separate auth tables instead of embedding in users?
- Clean separation of concerns
- Enables efficient cleanup of expired tokens
- Audit logs are append-only and won't slow down user queries
- Easier to index and query independently

### Why hash refresh tokens?
- If the database is compromised, attackers can't use refresh tokens directly
- SHA-256 is sufficient here because tokens already have 512 bits of entropy

### Why UUIDs?
- Non-enumerable (vs auto-increment)
- Safe to expose in URLs and logs
- No conflicts in distributed systems
- Standard for PostgreSQL

## Threat Model

### Mitigated Threats
| Threat | Mitigation |
|--------|-----------|
| Brute force login | Rate limiting + account lockout + Argon2id |
| Token theft (access) | Short expiry (15 min) |
| Token theft (refresh) | Rotation + revocation + hashed storage + family invalidation |
| Session hijacking | Device fingerprinting + session management UI |
| CSRF | Double-submit cookie pattern |
| XSS | Non-httpOnly CSRF token + Content-Type validation |
| SQL injection | Drizzle ORM parameterized queries |
| Account enumeration | Generic error messages + random timing delay |
| Password cracking | Argon2id memory-hard hashing |
| Replay attacks | Token rotation, short expiry, single-use verification tokens |
| Privilege escalation | Hierarchical RBAC + permission guards |
| Cross-instance rate limiting | Redis-backed ThrottlerStorage |
| Concurrent reset race | First-consumed token wins, single-use enforcement |

### Out of Scope
- Rate limiting at the network level (WAF/Cloudflare) - should be added in production
- Hardware security keys (WebAuthn/FIDO2) - future enhancement
- Passkeys - future enhancement

## Production Readiness Checklist

### Authentication
- [x] HTTPS enforced in production (via reverse proxy)
- [x] CORS restricted to single frontend origin
- [x] All rate limits configured and Redis-backed
- [x] Account lockout after 5 failed attempts
- [x] No information leakage in error messages
- [x] Timing attack resistance on login
- [x] CSRF protection on all state-changing endpoints
- [x] OAuth state parameter protection
- [x] Refresh token rotation with reuse detection
- [x] Token family invalidation on security events
- [x] Password hashing with Argon2id
- [x] JWT signing key rotation support
- [x] Email verified before login
- [x] Generic error messages everywhere
- [x] Session management for users
- [x] SECURITY.md: [Object object] is not valid JSON

### Authorization
- [x] Hierarchical RBAC (6 roles)
- [x] Permission system (granular, role-based)
- [x] Tenant isolation (primary + cross-tenant roles)
- [x] Admin impersonation with audit trail
- [x] All admin actions audited
- [x] Force password reset for admins
- [x] Account suspension/unsuspension

### Operations
- [x] Audit logging for all sensitive actions
- [x] Email delivery via Resend (with fallback)
- [x] Email templates (HTML + plain text)
- [x] Retry logic for email sending
- [x] Key rotation procedure documented
- [x] Expired session/token cleanup
- [x] 2FA backup codes for account recovery
- [x] Rate limit documentation

### Monitoring & Alerts
- [ ] Failed login rate alert
- [ ] Audit log anomaly detection
- [ ] Email delivery failure rate alert
- [ ] Account lockout rate monitoring
- [ ] CSRF token failure monitoring
- [ ] Key rotation schedule (recommended: every 90 days)
