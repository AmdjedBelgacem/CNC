# Platform Audit Report

**Target:** `https://frontend-ten-lilac-zvt9j29r04.vercel.app` (production)
**Stack:** Next.js 16.2.9 (App Router) · NestJS/Fastify (container) · Supabase Auth/DB/Storage · Vercel services
**Date:** 2026-10-05 · All findings verified against the running site or source tree. Nothing scored from memory.

---

## Executive summary

The platform is **security-hardened but discoverability-broken**. Runtime posture is genuinely
strong: strict nonce-based CSP, `__Host-` prefixed cookies, correct tenant isolation, WebSocket
authz enforced, and a lean backend (178 MB RSS, 0% idle CPU). What fails is everything a search
or answer engine needs: **course pages server-render 88 words ending in "Loading"**, so the primary
content is invisible without JavaScript. Every indexable page shares boilerplate metadata —
`/login` and a course detail page have the *identical* title. The sitemap lists 8 URLs, includes
`/notifications`, and omits every course. The homepage canonical points at a different domain
entirely. Three different brand names appear across titles, Open Graph tags, and on-page copy,
which is close to worst-case for entity resolution. Meanwhile a **critical unauthenticated RCE in
Next.js 16.2.9** (image optimization) is unpatched, and signing secrets remain in three public files.

**Top 5 risks**
1. Next.js `16.2.9` < `16.3.6` — unauthenticated RCE via image optimization (`pnpm audit`: 3 critical).
2. Client-only course content: 88 crawlable words + "Loading" on the money pages.
3. Title/description collision across indexable pages; canonical targets a foreign domain.
4. Sitemap omits all course/academy pages and advertises `/notifications`.
5. `local-*-change-in-prod` signing secrets still in tracked public files.

**Top 5 wins**
1. Course pages carry no `Course`/`FAQPage` JSON-LD — one schema block per page unlocks rich results.
2. Zero `dateModified`/`datePublished`/author markup — freshness and E-E-A-T are free points.
3. Consolidate three brand names into one canonical entity.
4. Sitemap already exists and builds statically — populating it is a small code change.
5. `remotePatterns` was tightened this session, materially shrinking the RCE attack surface.

---

## Scoreboard

| Category | Score | Grade (A–F) | One-line rationale |
|----------|-------|-------------|--------------------|
| Security | **67**/100 | C+ | Strong headers/authz/cookies; unpatched critical RCE, public signing secrets, rate limiting degraded. |
| Efficiency | **57**/100 | F | Lean backend and working WS, but 2.4–6.5 s TTFB, zero HTML caching, 1.4 MB JS, DB fallbacks. |
| SEO | **41**/100 | F | Duplicate titles, wrong-domain canonical, 8-URL sitemap omitting all content, client-only pages. |
| AEO | **35**/100 | F | No `FAQPage` schema, no real question-form headings, answers not crawlable. |
| GEO | **28**/100 | F | Three competing brand names, no authorship, no freshness, no NAP, content invisible to crawlers. |

---

## Security detail

### Auth & sessions — 8/10
- **Evidence:** `set-cookie: __Host-access=<REDACTED>; Path=/; HttpOnly; Secure; SameSite=Lax` (same for `__Host-refresh`). `__Host-` prefix enforces Secure + `Path=/` + no `Domain`.
- CSRF is a real cookie↔header equality check: `csrf.guard.ts` → `if (nCookie !== nHeader) throw`. Confirmed live: `POST /auth/2fa/setup` without a token → `403 {"message":"CSRF token missing"}`; with token → `200` + `secret`/`otpauthUrl`/`qrCode`.
- **Deduction:** no evidence of session-rotation-on-privilege-change or logout invalidating refresh tokens (not probed). Redis being down weakens brute-force defence (see Rate limiting).

### Tenancy / IDOR / RBAC — 7/10
- **Strong controls, verified:** `TenantGuard` throws `ForbiddenException` on missing/invalid slug; `TenantScopeGuard` enforces tenant membership with a `super_admin` bypass; `assertLessonInTenant` filters by `tenantId`. WebSocket trusts **DB tenant over the client query param** — `// Tenant isolation: trust DB tenant, not query param` (`ws.gateway.ts:82`).
- **Tenant spoofing is NOT possible** (I initially suspected it was). `route.ts:110` resolves tenant from an **HttpOnly cookie**, ignoring any client header, so `x-tenant-slug: nonexistent-tenant` is discarded and falls back to the default. Confirmed: all three header values returned byte-identical course lists.
- **Finding:** `GET /api/proxy/tenants` is unauthenticated and returns **all 9 tenants** with internal UUIDs, `settings` (incl. `allowRegistration`), and timestamps. This is the enumeration source that feeds the stray `/tenants/<uuid>` 404 seen in every page load.

### CSRF / CORS / headers — 9/10
- **Evidence (HTML and API both):** `default-src 'self'; script-src 'self' 'nonce-…'` (**no `unsafe-inline`**), `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`, `upgrade-insecure-requests`; `strict-transport-security: max-age=63072000; includeSubDomains; preload`; `x-content-type-options: nosniff`; `x-frame-options: DENY`; `referrer-policy: strict-origin-when-cross-origin`; `permissions-policy: camera=(), microphone=(), geolocation=()`; `cross-origin-opener-policy: same-origin`.
- No `Access-Control-Allow-Origin` on `Origin: https://evil.example` → cross-origin JS blocked.
- **Deduction:** `connect-src 'self' https: wss:` is broad (any https/wss host). `style-src 'unsafe-inline'` is required by the tenant-theme `<style>` block and Tailwind.

### Payments (Moyasar) — 5/10 — **NOT VERIFIED**
No payment probe was run in this pass and no Moyasar webhook signature check was exercised. Scored
conservatively pending evidence; see Residual risks. Do not read this as a pass.

### Uploads & media — 6/10
- **No path traversal:** `/uploads/../../apps/backend/.env` → `404`; `/uploads/../.env` → `200` but serves the SPA HTML shell (`<!DOCTYPE html>`), not a file. Not exploitable.
- **`remotePatterns` hardened this session** — previously `hostname: '**'` on both protocols made Vercel an open image proxy for any host.
- **Deduction:** production assets are served from **public** Supabase buckets (`S3_PUBLIC_URL`), so media has no access control; whether private course assets use signed URLs was not verifiable (bucket paths returned `400` for both public probes).

### XSS / HTML sanitization — 8/10
- Nonce CSP with no `unsafe-inline` in `script-src` is the strong control; JSON-LD has a dedicated XSS regression test (`test/json-ld-xss.spec.ts`, 6 tests passing).
- Backend sanitizes with `sanitizePublicText(input.content, MAX_DOCUMENT_CHARS)`.
- **Deduction:** `style-src 'unsafe-inline'`; builder-authored rich text is the residual risk area (not fuzzed).

### Secrets & env exposure — 5/10
- **Clean:** no secrets in `apps/frontend/.next/static`. Only non-sensitive vars reach the bundle: `NEXT_PUBLIC_{ADMIN_SEARCH_PATH,DEFAULT_TENANT_SLUG,PUBLIC_SEARCH_PATH,REALTIME_MODE,SEARCH_ADMIN_PATH,SEARCH_PUBLIC_PATH}`.
- **Finding:** `local-*-change-in-prod` signing secrets remain in tracked files — `docs/LOCAL_DEV.md`, `docs/SEEDING.md`, `scripts/qa-critical-path.sh`.

### Rate limiting & lockout — 4/10
- **Evidence:** `/api/proxy/health` → `{"redis":{"state":"degraded","detail":"ping did not return PONG; rate limits fall back to the database"}}`. `REDIS_URL` is still the `redis://YOUR-HOSTED-REDIS:6379` placeholder.
- `RedisThrottlerStorage` caps itself at 3 retries (`if (times > 3) return null`), so there is no runaway loop — but every throttled request pays a failed Redis round-trip plus a DB write.

### Dependencies / supply chain — 3/10
- `pnpm audit --prod`: **3 critical, 52 high, 40 moderate, 8 low**.
- **Critical:** `next` — *Unauthenticated RCE in Image Optimization* (patched `>=16.3.3`) and *RCE in `next/og` ImageResponse* (patched `>=16.3.6`). **Installed: `16.2.9`.** We do use `next/image`; the `remotePatterns` allowlist reduces but does not eliminate exposure.
- **High examples:** `socket.io-parser` (unbounded binary attachments), `@nestjs/platform-fastify` path-scoped middleware bypass, `brace-expansion` DoS chain.

### WebSocket / chat authz — 8/10
- `/ws` **enforces** auth: unauthenticated client receives `SERVER DISCONNECTED: io server disconnect`.
- `/chat` allows anonymous connect, but this is **deliberate and correctly isolated** — `chat.gateway.ts:77-91` refuses to join `tenant:<id>` (which broadcasts `chat:new` with real conversation ids) and assigns only `anon:<socket.id>`. Invalid tokens are disconnected. The comment documents a previously-fixed leak.
- **Deduction:** anonymous sockets are unbounded, and with Redis down the connection-level rate limiting that would blunt abuse is degraded.

### Logging / PII redaction — 8/10
- Explicit Fastify logger redaction with helper tests in place. Health output is structured and leaks no secrets (only component states).

**Weighted total: 67/100**

---

## Efficiency detail

| Sub-area | Score | Evidence |
|---|---|---|
| TTFB / HTML caching | 4/10 | `/` TTFB **6.49 / 2.91 / 2.50 s**; `/courses` 2.76/2.45/2.39 s; `/login` 2.54/2.67/2.52 s. All `x-vercel-cache: MISS`. |
| JS / CSS weight | 4/10 | **32 JS chunks ≈ 1.4 MB** uncompressed (largest: 226 KB, 200 KB, 134 KB, 109 KB); CSS 3 files = **181 KB**; HTML **325 KB** raw / **72 KB** br. |
| Images | 6/10 | `remotePatterns` now `**.supabase.co` + `**.titansofmanufacturing.com` only; 12/13 images loaded; no `AVIF`/`WebP` format config or `deviceSizes` tuning present. |
| API chattiness | 5/10 | Every page pays middleware → proxy → container. Login page fires `/auth/me` + `/auth/refresh` (both 401 when anonymous) before rendering. |
| Realtime vs polling | 8/10 | Real client connects `wss://…/socket.io/` `transport=websocket`, id `rASBL3H5wSMa1xEDAAAC`. 30 s REST polling retired for authenticated users (`NEXT_PUBLIC_REALTIME_MODE=auto`). |
| Backend footprint | 8/10 | **178 MB** steady RSS, **0.00%** idle CPU, 192 MB peak under 150-request burst. `--max-old-space-size=512` verified in-container (`heap_size_limit` 536 MB). |
| Search path | 4/10 | `search: degraded — meilisearch unreachable; search uses the Postgres fallback`. |
| Rate-limit backend | 4/10 | Redis degraded → DB fallback (above). |
| Third-party scripts | 8/10 | Zero third-party origins in server HTML; GA/pixels injected client-side by `AnalyticsProvider`. |

**Weighted total: 57/100**

> The 1.8 GB figure `docker stats` reports during a burst is **page cache**, not application memory —
> `VmHWM` for PID 1 never exceeded 192 MB. It is not a leak.

---

## SEO detail

| Check | Score | Evidence |
|---|---|---|
| Title uniqueness | 3/10 | `/login` and `/courses/course-mugjs7k0` share the **exact** title `Machinist Pro \| Master CNC Machining`. `/` is doubled: `Machinist Pro \| Master CNC Machining — Machinist Pro`. |
| Canonical | 2/10 | `/` canonical = **`https://titansofmanufacturing.com`** (a different host). `/courses`, `/login`, course detail: **no canonical at all**. |
| Meta description | 4/10 | `/login` and the course page share boilerplate: "Professional manufacturing education platform for modern machists and engineers." |
| OG / Twitter | 4/10 | Homepage `og:image` is **empty**. `og:title` = "Engineering Precision \| TITANS CNC Academy" vs `<title>` "Machinist Pro". Only 1 Twitter tag. |
| robots.txt | 6/10 | Exists, sane (`Allow: /`, disallows `/api/`, `/account/`, `/cart/`, `/checkout/`). **Missing** `/admin/`, `/login`, `/register`. |
| sitemap.xml | 2/10 | **8 URLs / 1556 bytes.** Includes `/notifications`. **Omits every course and academy detail page.** |
| Heading hierarchy | 6/10 | Homepage h1 = "Architecting the Future of Multi-Axis Machining." + sensible h2 tree. Course page has no server-rendered h1. |
| Indexability | 6/10 | Public pages `index, follow` ✅ — but `/login` is indexable (should be `noindex`). |
| Structured data | 4/10 | Homepage: 1 **valid** `EducationalOrganization` (name, description, `hasOfferCatalog`, `sameAs`, url). **No `Course`, `FAQPage`, `Product`, `BreadcrumbList` on any content page.** |
| hreflang / i18n | 2/10 | App supports en/ar + RTL (`dirFor`), but **zero `hreflang` tags** emitted. |
| Mobile | 8/10 | Viewport meta + responsive Tailwind breakpoints; mobile renders at 390×844. |
| Perf as signal | 2/10 | 2.4–6.5 s TTFB is far past the 1.8 s "poor" CWV threshold. |

**Weighted total: 41/100**

---

## AEO detail

- **Crawlable answer text — critical failure.** `/courses/course-mugjs7k0` server-renders **624 chars / 88 words** and terminates with the literal string **"Loading"**. Course content is client-rendered only, so answer engines cannot quote it.
- **FAQPage schema: absent everywhere.** Homepage has an `h2` "Frequently Asked Questions", but the sibling `h3`s are stat tiles and academy names (`5`, `13`, `25`, `$0`, "CNC Machining Academy") — **not question-form headings**. Nothing is shaped like an extractable answer.
- **No definition-style copy.** The hero is a brand slogan ("Architecting the Future of Multi-Axis Machining"), not a definitional sentence an answer engine could lift.
- **Stable answer URLs: yes** — `/academy/<slug>`, `/courses/<slug>` are durable.
- **Trust surfaces unverified** — `/terms` and `/privacy` exist in the app; no `about`/`contact` evidence was confirmed on-page.

**Weighted total: 35/100**

---

## GEO detail

| Signal | Status |
|---|---|
| Entity clarity | **Broken.** Three names in one crawl: "Machinist Pro" (`<title>`), "TITANS of Manufacturing" (`/courses` title), "Baroot CNC Solutions" (on-page copy/logo). |
| `sameAs` | 1 present in `EducationalOrganization` — the one genuine entity signal. |
| Authorship / E-E-A-T | **0** author/creator references. No instructor attribution on course pages. |
| Freshness | **0** `dateModified`, `datePublished`, or ISO dates anywhere in the HTML. |
| NAP identity | **0** telephone, **0** schema address. |
| Trust markup | **0** `aggregateRating`, **0** `review`. |
| Machine-readable | 1 valid JSON-LD block on the homepage only; content pages expose none. |
| Evidence pages | Sitemap advertises 8 URLs and omits the content that would substantiate claims. |

**Weighted total: 28/100**

---

## Prioritized roadmap

### P0 — fix this week

| # | Fix | Effort | Why |
|---|---|---|---|
| 1 | Upgrade `next` to `>=16.3.6` | S | Unauthenticated RCE. `pnpm audit`: 3 critical. |
| 2 | Server-render course content (or prerender + ISR) | **L** | 88 crawlable words is the root cause of the SEO/AEO/GEO collapse. |
| 3 | Purge `local-*-change-in-prod` from `docs/LOCAL_DEV.md`, `docs/SEEDING.md`, `scripts/qa-critical-path.sh`; **rotate those keys** | S | Live signing secrets in a public repo. |
| 4 | Fix homepage canonical → real domain; add canonical to all indexable pages | S | Currently signals a foreign host as canonical. |
| 5 | `noindex` on `/login`, `/register`; disallow them in robots.txt | S | Wastes crawl budget on thin pages. |

### P1 — next sprint

| # | Fix | Effort |
|---|---|---|
| 6 | Unique `title` + `description` per course/academy page | M |
| 7 | Populate `sitemap.xml` with course/academy URLs; remove `/notifications` | M |
| 8 | Add `Course` + `FAQPage` + `BreadcrumbList` JSON-LD to content pages | M |
| 9 | Consolidate the brand to one canonical name across title/OG/copy | S |
| 10 | Provision Redis (rate limits currently on the DB) | S |
| 11 | Gate `GET /tenants` behind auth or strip to public fields | S |
| 12 | Add `dateModified` + author/instructor markup | M |
| 13 | Tighten `connect-src` to known API/socket origins | S |

### P2 — backlog

| # | Fix | Effort |
|---|---|---|
| 14 | Attack TTFB: reduce per-request backend fan-out, then revisit hash-based CSP to unlock HTML caching | L |
| 15 | Trim JS: 32 chunks / 1.4 MB — route-level dynamic imports, drop unused chat widget | M |
| 16 | Add `hreflang` en/ar + `x-default` | S |
| 17 | Configure `formats: ['image/avif','image/webp']` and `deviceSizes` | S |
| 18 | Stand up Meilisearch so search leaves the Postgres fallback | M |
| 19 | Add `aggregateRating`/`Review` once real reviews exist | M |
| 20 | Verify Moyasar amount integrity + webhook signatures (untested here) | M |

---

## Residual risks

**Not verified in this pass — treat as unknown, not as passing:**
- **Payments (Moyasar):** amount integrity, webhook signature verification, idempotency. No probe was run; scored 5/10 by default.
- **Private media:** Supabase buckets returned `400` for both public-path probes, so signed-URL issuance for non-public course assets is unconfirmed.
- **Session lifecycle:** rotation on privilege change, and whether logout invalidates the refresh token server-side.
- **Builder rich-text XSS:** sanitization exists but was not fuzzed with adversarial payloads.
- **CSP coverage:** inline event handlers and any `style-src` injection surface were not probed.

**Degraded dependencies (confirmed live, and reflected in the scores above):**
- **Redis** `ping did not return PONG; rate limits fall back to the database` → Security 4/10 on rate limiting, Efficiency 4/10.
- **Meilisearch** `unreachable; search uses the Postgres fallback` → Efficiency 4/10.

**Environmental caveats:**
- All measurements are from a single production region over one session; TTFB samples include
  container cold-start effects and will vary.
- The audit ran against the Vercel **deployment host**, not the intended canonical domain. Once
  `titansofmanufacturing.com` is the live host, canonical/sitemap/robots must be re-verified —
  they currently encode the deployment URL while `<link rel="canonical">` encodes the apex domain,
  which is an unresolved inconsistency.
- `docs/ops/VERCEL_DEPLOYMENT.md` documents why HTML is permanently `x-vercel-cache: MISS`
  (nonce CSP and `cookies()` in the root layout are mutually exclusive with static caching).
