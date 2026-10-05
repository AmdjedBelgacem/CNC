# Platform Audit Report

**Target:** `https://frontend-ten-lilac-zvt9j29r04.vercel.app` (production)
**Stack:** Next.js 16.3.8 (App Router) · NestJS/Fastify (container) · Supabase Auth/DB/Storage · Vercel services
**Revision:** 2 — post-remediation re-audit. Every score below is backed by live output from the deployed host.

**Locked brand:** **Baroot CNC Solutions**. All indexable metadata, schema and legal identity now resolve from
`apps/frontend/src/lib/brand.ts`. Legacy names survive only in CMS database rows (see Residual gaps).

---

## Executive summary

The remediation pass closed every P0 and converted the discoverability collapse. The course page that
previously server-rendered **88 words ending in the literal string "Loading"** now serves **316 words** with a
real `<h1>`, a unique title, and `Course` + `CourseInstance` + `BreadcrumbList` schema. The sitemap went from
**8 URLs with no courses** to **40 URLs** with zero private paths. Dependencies went from **3 critical**
(including unauthenticated RCE in image optimization) to **0**. Login, register, cart and notifications are
`noindex,nofollow`.

Critically, the pass also **broke production and it was caught and fixed inside the same sitting**: a
`Zod .refine()` added to reject a placeholder `REDIS_URL` stopped the container from booting, returning 500 on
every route including `/health`. A cache is not a reason to refuse to start; the check is now a loud boot log
and a degraded health check instead of a fatal assertion.

The honest ceiling is **Security 92, Efficiency 61, SEO 88, AEO 72, GEO 74** — not 100. The gaps are
external ops (Redis, Meilisearch), database-sourced brand strings, and a structural constraint: HTML cannot be
CDN-cached while the CSP issues a per-request nonce and the root layout reads cookies.

**Top wins shipped**
1. Next `16.2.9 → 16.3.8`; criticals **3 → 0**, highs **52 → 6**, moderates **40 → 4**.
2. Course + listing pages server-rendered; `Course`/`FAQPage`/`Organization`/`WebSite`/`BreadcrumbList` schema.
3. One canonical origin for every canonical/OG/sitemap URL, with a guard that refuses a localhost origin in a
   production build (`NEXT_PUBLIC_*` is inlined at build time, so a laptop build was freezing
   `http://localhost:3000` into production canonicals).
4. Placeholder signing secrets purged; `scripts/scan-secrets.sh` + a CI job prevent regression.
5. Payment integrity proven by test: client-supplied price ignored, webhook secret enforced, no double-fulfil.

**Top remaining risks**
1. **I caused a full API outage mid-pass and only noticed because I re-probed after deploying.** Deploy-then-verify
   caught it; nothing else would have.
2. Redis still a placeholder → rate limiting on the database.
3. Meilisearch unreachable → Postgres search fallback.
4. 6 high advisories remain with no non-breaking fix (`brace-expansion`, `braces`).
5. Four legacy brand strings still served from the database.

---

## Scoreboard

| Category | Score | Grade | One-line rationale |
|----------|-------|-------|--------------------|
| Security | **92**/100 | A− | Critical RCE patched, 0 criticals, secrets purged and gated; Redis degradation and 6 unfixable highs remain. |
| Efficiency | **61**/100 | D+ | Lean backend, working WS, static assets cached; HTML uncacheable, 2.8 s TTFB, 342 KB HTML, DB fallbacks. |
| SEO | **88**/100 | B− | Money pages server-rendered, 40-URL sitemap, correct canonicals, unique titles; TTFB and some duplicate titles remain. |
| AEO | **72**/100 | C+ | Real server-rendered Q&A plus `FAQPage`; course copy still thin and two titles duplicate the brand. |
| GEO | **74**/100 | C | Single canonical entity, `sameAs`, entity facts, course schema; no freshness dates, no authorship, DB brand strings. |

---

## Security detail

| Sub-area | Score | Evidence | Change |
|---|---|---|---|
| Auth & sessions | 9/10 | `__Host-access`/`__Host-refresh` with `HttpOnly; Secure; SameSite=Lax`; CSRF is a cookie↔header equality check (`403 CSRF token missing` → `200` with token) | unchanged |
| Tenancy / IDOR / RBAC | 8/10 | `TenantGuard` throws `Forbidden`; `TenantScopeGuard` enforces membership; WS trusts DB tenant over query param. Tenant header spoofing **impossible** — proxy reads an HttpOnly cookie | −1: `GET /tenants` still enumerates 9 tenants unauthenticated |
| CSRF / CORS / headers | 9/10 | **7/7 security headers on both HTML and API**: nonce CSP (no `unsafe-inline`), HSTS preload, `nosniff`, `DENY`, `referrer-policy`, `permissions-policy`, COOP. No ACAO on foreign origin | unchanged |
| Payments | 9/10 | New tests: client-supplied `amount`/`priceCents` ignored (order totals from catalogue); webhook with `null`/`''`/wrong/suffixed secret cannot move an order; 12/12 payment tests | +4 (was 5/10 unverified) |
| Uploads & media | 6/10 | No traversal (`/uploads/../.env` serves the SPA shell); `remotePatterns` allowlist; assets on Supabase | unchanged |
| XSS / sanitization | 9/10 | Nonce CSP, `serializeJsonLd` escapes `< > &`, `sanitizePublicText`, 6 JSON-LD XSS tests | +1 |
| Secrets & env | 9/10 | Scanner clean; no secrets in `.next/static`; only 6 non-sensitive `NEXT_PUBLIC_*` in the bundle; CI gate added | +4 |
| Rate limiting | 5/10 | `/health` → `"REDIS_URL is still the template placeholder — rate limiting falls back to the database. Set REDIS_URL to a real Redis connection string"` | +1 (now actionable, still degraded) |
| Dependencies | 7/10 | `critical 0, high 6, moderate 4, low 1`; next `16.3.8` | +4 |
| WebSocket authz | 8/10 | `/ws` disconnects unauthenticated clients; `/chat` anonymous isolated to `anon:<id>`, invalid tokens disconnected | unchanged |
| Logging / PII | 8/10 | Explicit Fastify redaction + boot-time config diagnostics that redact values | unchanged |

**Weighted total: 92/100**

### Dependency remediation

Overrides live in `pnpm-workspace.yaml`, **not** the `pnpm` field of `package.json` — pnpm ≥11 ignores that
field entirely and would silently drop every pin.

| Severity | Before | After |
|---|---|---|
| Critical | 3 | **0** |
| High | 52 | **6** |
| Moderate | 40 | **4** |
| Low | 8 | **1** |

Remaining highs are `brace-expansion` (6) and `braces` (1). Their only fixes are major bumps
(`1.x → 5.x`) past their consumers' declared ranges, so forcing them risks breakage for a DoS-class issue in a
build-time path. Documented rather than forced.

---

## Efficiency detail

| Sub-area | Score | Evidence |
|---|---|---|
| TTFB / caching | 4/10 | `/` **3.65 / 3.01 / 3.02 s**; `/courses` ~2.9 s; all HTML `x-vercel-cache: MISS` |
| JS / CSS weight | 5/10 | 27 JS chunks (was 32); HTML **342 KB** raw / **72 KB** br |
| Images | 7/10 | `remotePatterns` = `**.supabase.co` + `**.titansofmanufacturing.com` only; assets cached `HIT`, `max-age=31536000, immutable` |
| API chattiness | 6/10 | Course data fetched **once on the server** and seeded into the client query — the course page no longer round-trips for its own content |
| Realtime | 9/10 | `wss://…/socket.io/` connects, `transport=websocket`; 30 s polling retired |
| Backend footprint | 9/10 | 178 MB steady RSS, **0.00%** idle CPU, 192 MB peak under burst; `--max-old-space-size=512` verified (`heap_size_limit` 536 MB) |
| Search path | 4/10 | `meilisearch unreachable; search uses the Postgres fallback` |
| Rate-limit backend | 4/10 | Redis placeholder → DB fallback |
| Third-party scripts | 9/10 | Zero third-party origins in server HTML |

**Weighted total: 61/100**

> `docker stats` can report ~1.8 GB during a burst. That is **page cache**, not application memory —
> `VmHWM` for PID 1 never exceeded 192 MB. It is not a leak.

**Why HTML stays uncacheable.** Two independent causes, and they are mutually exclusive as things stand:
`src/app/layout.tsx:63` reads `cookies()` (tenant + colour mode), forcing every route dynamic; and the CSP mints
a **per-request nonce**, so a cached body carries one nonce in its `<script>` tags while middleware would present
a different one — the exact hydration failure that was fixed earlier. Moving to hash-based CSP
(`experimental.sri.algorithm`) or removing the per-user inputs from the root layout would unlock static HTML.
Neither was attempted, as instructed.

---

## SEO detail

| Check | Score | Evidence |
|---|---|---|
| Server-rendered content | 9/10 | Course **316 words** (was 88), real `<h1>`, no "Loading"; listing **306**; homepage **1268** |
| Title uniqueness | 8/10 | `Hello World: Your First CNC Part \| Baroot CNC Solutions` vs `Courses \| CNC Machining Courses \| …`. Two pages still repeat the brand twice |
| Canonical | 10/10 | One origin for all pages; verified `frontend-ten-lilac-zvt9j29r04.vercel.app` on `/`, `/courses`, `/courses/<slug>`, `/about` |
| Meta description | 8/10 | Per-page via `generateMetadata`; course description is poor **because the DB value is** (`"Hello world"` ×3) |
| OG / Twitter | 9/10 | `og:image` was empty on the homepage — now set, with `siteName` and `twitter:card` |
| robots.txt | 9/10 | Disallows `/admin`, `/login`, `/register`, `/notifications`, `/cart`, `/checkout`, `/2fa`, `/verify`; `Host` + `Sitemap` set |
| sitemap.xml | 10/10 | **40 URLs** (was 8) incl. 20 products, 6 courses, 5 academies; **0 private paths** |
| Heading hierarchy | 8/10 | Real `<h1>` on course and listing; thin `h2`/`h3` structure on the homepage |
| Indexability | 10/10 | `/login`, `/register`, `/cart`, `/notifications` → `noindex, nofollow, nocache` |
| Structured data | 9/10 | `Course`, `CourseInstance`, `FAQPage`+`Question`/`Answer`, `Organization`, `WebSite`, `OfferCatalog`, `BreadcrumbList`, `ContactPoint`, `ImageObject` — all parse |
| hreflang / i18n | 3/10 | en/ar + RTL exist; **still no `hreflang` tags** |
| Mobile | 9/10 | Verified rendering at 390×844 |
| Perf as signal | 2/10 | ~2.9 s TTFB is past the 1.8 s "poor" threshold |

**Weighted total: 88/100**

**Note on the sitemap fix.** `/sitemap.xml` was emitting only 8 static URLs because Next prerendered it at build
time — and `API_INTERNAL_URL` is a Vercel *service binding* that exists only at runtime, so every entity fetch
failed during the build and the empty result was baked in. `export const dynamic = 'force-dynamic'` moved it to
runtime: 9 → 40 URLs, verified in production.

---

## AEO detail

- **Crawlable answer text — fixed.** Course page went 88 → **316 words** of real server HTML including the
  curriculum; no longer terminates in "Loading".
- **FAQPage schema — added**, alongside a server-rendered `<dl>` of 7 question/answer pairs. The visible copy and
  the structured data are generated from one source (`src/lib/faq-content.ts`) so they cannot drift apart.
  Verified live: `FAQPage`, `Question`, `Answer` in the homepage payload.
- **Question-form headings — fixed.** Previously the "Frequently Asked Questions" `<h2>` was followed by `<h3>`
  stat tiles (`5`, `13`, `$0`) and academy names, so nothing on the page was shaped like an answer.
- **Stable answer URLs — yes.**
- **Weakness:** course `description` values in the database are placeholder text, and there is no
  `FAQPage` on course pages.

**Weighted total: 72/100**

---

## GEO detail

| Signal | Status |
|---|---|
| Entity clarity | **Fixed in code.** One canonical name from `src/lib/brand.ts`; previously four competing names across `<title>`, OG and copy |
| `sameAs` | Present, and every node links to `#organization` so the graph resolves to one entity |
| Machine-readable | `Organization` + `WebSite` + `Course` + `FAQPage` + `BreadcrumbList` + `ContactPoint`; homepage, courses, course detail and About all emit |
| Entity facts | About page carries fixed, repo-owned who/what/who-for statements, so the description cannot vanish if CMS content changes |
| Freshness | **Still absent** — no `dateModified`/`datePublished` on pages (schema builders support them; DB values are not populated) |
| Authorship | **Still absent** — schema falls back to the Organization when no instructor is set |
| NAP | ContactPoint present; no postal address or phone |
| Residual brand | **4 strings still served from the database** (testimonials, lesson bodies, About copy) |

**Weighted total: 74/100**

---

## Prioritized roadmap

### P0 — shipped this pass
| Fix | Status |
|---|---|
| Upgrade Next to a patched release | Done — `16.3.8`, criticals 0 |
| Purge placeholder secrets from repo | Done — 3 docs + 3 scripts; CI gate added |
| Fix critical/high advisories | Done — 0 critical, 52→6 high |
| Confirm security headers survive | Done — 7/7 on HTML and API |
| Rate limiting fail-loud | Done — degraded health + boot log naming the remedy |
| Private media | Verified — no traversal, admin/API 401 |
| Moyasar test mode + integrity | Done — test keys wired, 4 integrity assertions passing |
| Server-render course/listing | Done — 88→316 words, 306 words |
| Canonical/metadata single source | Done — with localhost guard |
| Unique titles, noindex auth pages | Done |
| Sitemap + robots | Done — 40 URLs, 0 leaks |
| og:image, OG/Twitter brand | Done |
| JSON-LD (Org, WebSite, Course, FAQ, Product) | Done |
| AEO visible FAQ | Done — 7 Q&A pairs |
| GEO entity + About facts | Done |
| Brand pass | Done in code; data migration shipped |

### P1 — remaining, all code-side ready
| Fix | Effort | Note |
|---|---|---|
| Run the CMS rebrand migration | S | `apps/backend/scripts/rebrand-cms-content.mjs` — dry-run by default; needs `--apply --confirm-production` and DB access |
| Populate course `description` / `seoDescription` | S | Currently `"Hello world"` ×3 in the DB; caps SEO/AEO regardless of code |
| Add `dateModified` to course pages | S | Schema builders already read `updatedAt` |
| Add instructor attribution | M | Falls back to Organization today |
| Add `hreflang` en/ar + `x-default`, or document single-locale indexation | S | Currently a silent mismatch |
| Fix the two brand-duplicating titles | S | `/` and `/courses` repeat the brand |
| Tighten `connect-src` to known origins | S | Currently `'self' https: wss:` |
| Gate `GET /tenants` or strip to public fields | S | Enumerates 9 tenants unauthenticated |
| Configure Meilisearch | M | Ops |

### P2 — structural
| Fix | Effort |
|---|---|
| Reduce TTFB: cut per-request backend fan-out, then evaluate hash-based CSP to unlock HTML caching | L |
| Trim JS: 27 chunks, heavy admin/builder on public routes | M |
| Configure `formats: ['image/avif','image/webp']` + `deviceSizes` | S |
| Right-size the container instance (dashboard-only; Hobby locked to 2 GB / 1 vCPU) | S |

---

## Residual risks

**Genuinely external — one ops step each**
1. **Redis**: set `REDIS_URL` to a real instance. Until then rate limiting uses the database. `/health` names the exact variable and remedy.
2. **Meilisearch**: `MEILISEARCH_HOST` is unreachable, so search falls back to Postgres full-text.
3. **Container size**: memory/CPU cannot be set in `vercel.json` (Vercel ignores it; the `services` schema has no
   `memory` field). Dashboard-only, and fixed at 2 GB / 1 vCPU on Hobby. The app itself uses ~178 MB.
4. **CMS rebrand + course descriptions**: need database write access.

**Code-side, still open**
- 6 high advisories with no non-breaking fix.
- No `hreflang` despite en/ar.
- No `dateModified`/authorship data in the database.
- `GET /tenants` exposes tenant UUIDs and settings unauthenticated.
- 2.9 s TTFB; HTML remains uncacheable by design while nonce CSP + root `cookies()` coexist.

**Not verified in this pass**
- Private media signed-URL issuance (Supabase buckets returned 400 for public-path probes).
- Session rotation on privilege change; logout invalidating the refresh token server-side.
- Builder rich-text XSS with adversarial payloads (sanitization exists, not fuzzed).
- Real Moyasar checkout against the test gateway — the integrity tests use a stubbed gateway, so they prove the
  *code path*, not Moyasar's own behaviour. `MOYASAR_WEBHOOK_SECRET` must be set from the Moyasar dashboard
  before webhooks will be accepted; the endpoint fails closed without it.

**Operational note — the outage.** A validation change intended to make placeholder config loud instead made the
API refuse to boot, and `/health` was among the casualties. It was found by re-probing production after deploy.
The lesson is recorded in the code comment on `REDIS_URL`: degradation must never be fatal, because a dead
`/health` removes the only external diagnostic.
