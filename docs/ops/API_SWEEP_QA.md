# API sweep + page verification — findings

Run against the local stack (`node dist/main` on :4000, the built frontend image on
:3100) with a super-admin session minted the same way the OAuth callback does
(`generate_link` + immediate redeem — no email sent, no password read or reset).

The route table is extracted from the backend's own startup log rather than hand-written:

```bash
grep -oE "Mapped \{/[^,]*, (GET|POST|PATCH|PUT|DELETE)\} route" .dev-logs/backend.log \
  | sed -E 's/Mapped \{(.*), (GET|POST|PATCH|PUT|DELETE)\} route/\2 \1/' | sort -u > /tmp/routes.txt
node scripts/qa/api-sweep.mjs --phase=all
```

## Result

303/303 checks green: 140 guard checks, 140 per-route 5xx checks, 16 CRUD round trips,
7 malformed-write rejections. 28 routes are skipped by name because they send email,
charge a card, call an AI provider, message a person, upload, or mutate global config.

## Defects found and fixed

| # | Defect | Symptom | Fix |
|---|--------|---------|-----|
| 1 | `ProductsService.create(data: any)` inserted the raw body | `title: ''` stored as sent → blank product in the catalog; `tenantId`/`isPublished`/`status`/`role` injectable | Validate + use the PATCH allowlist; `tenantId` moved to a separate trusted argument |
| 2 | `CoursesService.createCourse` had the same hole | `POST /admin/courses` with `title: ''` returned 201 | Same guard |
| 3 | `getUsersForAdmin` used `Promise.all` over one RBAC query per user | `GET /admin/users` → 500 `EMAXCONNSESSION`; the more members a tenant had, the more reliably it failed (pooler caps at 15 clients) | Bounded-concurrency drain |
| 4 | `GET /products/check-availability` passed unvalidated ids to Postgres | 500 (`invalid input syntax for type uuid`) instead of 400 | `ParseUUIDPipe` + positive-integer `quantity` |
| 5 | **`GET /products/:slug` served unpublished drafts** | Anonymous caller read a draft's description by slug, while the list endpoint hid it | Explicit `includeUnpublished`, admin-only |

#5 is the one to keep an eye on: the admin/public distinction used to be inferred from
whether a locale argument happened to be passed, so the public path never triggered it.
Courses and academies were audited and are already correct — their detail routes 404 for
drafts and their admin routes still resolve.

## Page verification

47 routes crawled in both locales against the production build. All public routes 200;
`/admin/*` and `/account` return 307 to `/login?returnUrl=…` (correct for anonymous
callers). Zero `MISSING_MESSAGE` anywhere in the Arabic render.

Verified in the rendered output:

* all 10 navbar items present server-side, in Arabic, after seeding the nav table —
  the earlier symptom was SSR falling back to `localhost:4000` plus an empty
  `navigation_items` table, not a rendering bug;
* the search palette no longer carries `!top-4 !translate-y-0 sm:!top-20`, so it uses
  the base dialog's centring;
* `>GitHub<` appears 0 times on `/login` and `/register`; `>Google<` still 1.

Not verifiable without a browser: the hotspot click-to-open popover. Product data is
fetched client-side (`useProduct`), so it is absent from SSR HTML for *every* product —
grepping the server response proves nothing either way. The marker code
(`data-hotspot-root`) and the `pointerdown` outside-click handler are both present in the
shipped `linux/amd64` bundle. Confirm visually once deployed.

## Hygiene

The sweep created and deleted only `qa-*` records. Two leak modes were found and fixed
along the way — courses have no `DELETE /admin/courses/:slug` (the delete route is
`/courses/:slug`), so they were being marked non-removable and orphaned; six were removed.
`products` and `courses` are back at their pre-sweep baselines (21 / 27).

Note: `products` and `courses` tables both have a `slug` column, but `posts`, `groups`
and `categories` do not share the same validation, so a `__qa_` prefix with underscores is
rejected by academies. The stamp uses `qa-<base36>` hyphens.

## Known follow-ups (not fixed, not in scope here)

* `events` has no `currency` column, yet `events/page.tsx` hardcodes `priceCurrency: 'USD'`
  in JSON-LD while the backend resolves currency from `payments_config` (default `SAR`).
  Needs a schema change plus a decision on which currency is authoritative.
* `admin/certificates/templates-tab.tsx` builds a date sample in a module-scope constant,
  so it cannot reach `useLocale()` without restructuring the file.
* `admin/users/learner-drawer.tsx` formats currency by dividing by a hardcoded 100 rather
  than `currencyFractionDigits`, which would misstate amounts for 0- and 3-digit
  currencies. `formatMinorUnits` would fix it but pins `numberingSystem: 'latn'`, which
  is a product decision, not a refactor.
* 27 sites previously hardcoded `'en-US'` into `toLocaleDateString`/`Intl.NumberFormat`;
  all are now locale-aware. `products-islands.tsx` still passes a literal `'en-US'` to
  `formatMinorUnits` for server-rendered islands that have no shopper preference yet.