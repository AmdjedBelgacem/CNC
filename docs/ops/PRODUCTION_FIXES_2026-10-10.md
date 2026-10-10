# Production fixes — 2026-10-10

## 1. Root causes

### Search was exact
Meilisearch is **not configured** on this deployment (`MEILI_HOST` empty), so every query took
the Postgres fallback. That compared the raw query with a single `ILIKE '%query%'`, so
punctuation decided relevance:

| query | before | after |
|---|---|---|
| `3-axis` | 1 | 3 |
| `3 axis` | 2 | 3 |
| `3_axis` | **0** | 3 |
| `3/axis` | **0** | 3 |
| `machining-center` | **0** | 2 |

Normalisation, tokenisation and matching now live in one shared module
(`packages/shared/src/search/match.ts`) so the query, the ranked text and the filter cannot
drift apart. Ranking is tiered: exact > phrase > all-tokens > partial.

**Two defects in the first version of the SQL filter**, both caught only because the live
endpoint returned nothing:

- `replace()` in Postgres takes a **literal string**, not a regex, so the normalisation removed
  nothing and silently made the filter far stricter than the matcher. Now `regexp_replace`.
- The squashed form was **ANDed** in as an extra requirement instead of offered as an
  alternative, so a query matching on tokens alone could still be excluded.
- A stray `}` in the template (`ESCAPE '\'})`) produced a Postgres scanner error. TypeScript
  cannot see inside a template string, so it passed typecheck. The regression test asserts the
  malformed sequence rather than counting brackets, which cannot cope with the nested templates.

### Course publish was blocked by a false negative
`validateForPublish` inlined a **second copy** of the old media regex, matching only
app-relative paths. I had fixed the DTOs earlier and missed this one. Since uploads moved to S3
the uploader returns an absolute URL, so *every* genuinely uploaded resource failed the check.

Reproduced live: thumbnail and SEO satisfied, one real S3 resource attached, and the only
remaining reason was "Upload every course resource before publishing".

Now uses `isUploadedMediaRef` — the same validator the DTOs use. Empty is still accepted by the
shared rule (clearing an optional media field must not require `null`), so the preflight checks
emptiness itself: a resource with no URL is not an uploaded file.

### Settings
An evidence-first route-by-route audit found:

| defect | effect |
|---|---|
| `accentColor` missing from the tenant patch whitelist | every save returned 200 and showed "Settings saved" while discarding the value |
| payment config fail-closed path returned **HTTP 200** with the error in the body | the panel's non-throwing `api.put` read it as success and toasted "Saved" with payments disabled |
| theme `glass.blur` capped at 64 in the editor, schema max 30 | values 31-64 accepted by the input, rejected on save |
| AI `maxTokens` accepted 1-255, server `@Min(256)` | a value the form called valid was rejected on save |
| `providerPayload` (raw provider webhook body) spread into the order list | reached every `orders:view` holder, under a comment claiming the opposite |
| reauth modal posted via raw `fetch` with no CSRF header | worked only because the BFF mints a token for it server-side |

**AI credentials were verified sound rather than assumed:** AES-256-GCM at rest, masked GET,
fails closed, no key in the test-connection response, and a second save that omits the key
leaves it configured.

### Product gallery
Already correct and verified through the real endpoints: two images attached via
`POST /:slug/images` with `sortOrder` 0 and 1, then a `PATCH` that omits images entirely — two
images, both in order, after the save. `images` is deliberately not part of the PATCH body, so
an ordinary product save can never touch them.

### Icons
`/icons/icon-32.png` and `/icons/icon-180.png` returned 404, so the browser fell back to
`/favicon.ico` for the tab and iOS had no touch icon. Both generated from the existing 192px
asset; the metadata API now declares the full set plus `apple-touch-icon`, which iOS ignores
the manifest for.

## 2. Code + migrations
No schema migrations were needed. The media validator moved to the shared package
(`packages/shared/src/common/validators/uploaded-media-url.ts`) because the builder is a
frontend consumer and the backend is another; a second copy is how they drift.

## 3. Tests
- `packages/shared/tests/search-match.test.ts` — normalisation, tokenisation, tier ranking,
  empty/wildcard input
- `apps/backend/test/search-normalization.spec.ts` — the service ranks on normalised text, the
  SQL pre-filter is token-based, and the generated SQL contains no malformed sequence
- `apps/backend/test/course-publish-resource-check.spec.ts` — a real S3 resource passes, an
  empty one does not, and the preflight no longer inlines a private copy of the pattern
- `packages/shared/tests/section-background.test.ts` — background schema accepts the controls,
  an empty object leaves defaults untouched, and out-of-range values are rejected

## 4. Operator QA checklist
1. Search `3_axis`, `3/axis`, `machining-center` — all return results.
2. Search an empty query and a bare `%` — no results, no error.
3. Upload a course resource, then publish — the resource check passes; a course with no
   resource is still blocked with a precise message.
4. Admin settings: change the accent colour, save, reload — the value persists.
5. Payments: try to enable without a secret key — the panel must show an error, not "Saved".
6. Theme editor: the blur slider now stops at 30.
7. AI settings: `maxTokens` below 256 is rejected by the form, not the server.
8. Product: attach two gallery images, save the product, reload — both images remain in order.
9. Tab icon and iOS touch icon load (no 404 in the network tab).
10. Builder: set a section background colour, gradient, image and glass; publish; the public
    page renders it and a `javascript:` or third-party URL is dropped.

## 5. Residual risks
- **Meilisearch is unconfigured here**, so the separator/ranking/typo settings added to
  `prepareMeiliIndex` are untested against a live engine. They are the same rules the Postgres
  fallback uses, but a real index should be stood up and reindexed before relying on them.
- The SQL pre-filter normalises in the query, so it cannot use a plain index on the raw column.
  The fallback is bounded to 2000 candidates and cached, which is why this is acceptable; if the
  catalogue grows, add a generated normalised column with an index.
- `isCurrent` on the session list is always `false` (the request's token hash is never passed),
  so every session shows a Revoke button including the live one. Not fixed here — it needs the
  session token hash threaded through, which touches the auth cookie contract.
- The `/billing` settings page is static markup with no API behind it, so its invoices panel is
  permanently empty. Either wire it to `/payments/orders/mine` or mark it not-yet-implemented.
- The backend image is now a clean Dockerfile build rather than the earlier hot-patch.
