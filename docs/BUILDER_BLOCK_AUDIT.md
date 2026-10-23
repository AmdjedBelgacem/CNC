# Admin Builder Block Audit

## Scope

The audit covers the live `/admin/builder` editor:

- all 41 blocks registered in `packages/shared/src/blocks/registry.ts` and rendered by
  `apps/frontend/src/components/builder/blocks/*`;
- the insert menu, canvas selection/drag behaviour, Layers tree, inspector controls;
- save, section save, publish, per-block Arabic translation and page-level Arabic translation;
- the public renderers that use the same block components.

`nav` and `footer` remain registered for backwards compatibility with existing layouts, but are
filtered out of the insert menu because the public page shell already renders them.

## Fixes

### Media

- Added a shared `MediaPlaceholder` for editor-only empty/failed images.
- `image`, `hero`, `hero-console`, `feature-tiles`, `program-card`, `testimonial-card`, and CTA
  banner images now show a visible placeholder while editing instead of a zero-height or hidden
  element.
- Image failure state resets when the URL changes, so replacing a broken URL recovers without a
  reload.
- Public pages still render nothing for empty/failed leaf images; designed fallbacks (for example
  blueprint art) are unchanged.
- Added image/alt controls to Program Card and an avatar upload control to Testimonial Card.
- Added the missing `program-cards`, `testimonials`, and `live-island` inspectors.

### Selection and structure

- Hero, Feature Tiles, and CTA Banner now render their anchor `id`, matching the inspector field.
- Legacy `nav` is registered with Puck again, so old layouts remain editable; it is not insertable.
- The insert menu is registry-driven and excludes page chrome.
- Add-block placement is validated against the selected zone's `allow`/`max`; a disallowed insert
  falls back to the end of the root zone rather than silently doing nothing.
- Layers rows support HTML5 drag-and-drop reordering within and between valid zones. The drag
  payload now carries the source node id/type, so a container cannot be dropped into its own
  subtree and cross-zone drops are checked against the destination slot's `allow`/`max`.
- Hero content allows `image` and `icon` children, so the inspector can add them without a publish
  validation failure.
- Clicking links/CTAs on the canvas selects the block instead of navigating away.

### Inspector and visual controls

- Text hex colours now apply.
- Progress Card contrast and track styling are corrected.
- Card accepts `3xl` radius and `shadow-xl` elevation.
- Section background and border are separate controls and render independently.
- Stats respects authored margins.
- CTA banner padding and URL safety were corrected.
- Variant/tone props have defensive fallbacks instead of blank output.
- Added missing spacing/layout/advanced groups to Program Card, Testimonial Card, Hero Console,
  Twin Section, Spotlight Cards, Closing CTA, Card Grid, CTA Signup, and Catalog Hero.
- Every registry block has an inspector; image-bearing cards expose upload fields (covered by
  `builder-add-block-menu.spec.ts`).
- Hero Console reserves space beneath the console for its floating metric badge. At 1440px the
  badge used to sit on top of the mode selector, hiding the view controls.
- In Arabic, the simulator console keeps its telemetry, axis values and mode tabs LTR while the
  section itself mirrors. This prevents strings such as `mm/min 4,200 :FEED` and signed values
  such as `142.308+`.

### Save and publish

- Section save only targets a `section` container; otherwise it shows a clear toast instead of
  appearing to do nothing.
- Publish warning detection now descends into slot children and recognises visual content. Hidden
  blocks are reported separately, and only genuinely empty visible leaves count as empty.
- Publish can seed an Arabic layout when a page has none, and merges the current English structure
  into existing Arabic copy, so newly added English blocks do not require a manual sync.
- `mergeLayoutStructure` now also takes `visible` from English, so unhiding an English block
  unhides it for Arabic visitors.

### Arabic

- The admin builder always loads the English page, regardless of the admin UI locale. It used to
  follow the request locale, so an Arabic-language admin could save the translated tree back into
  the English draft.
- Per-block translation addresses nodes by stable `props.id` and uses prop-relative paths. Array
  position changes or reordering cannot write a translation into the wrong block.
- The page translation panel reads the live canvas layout, not the last saved English snapshot, so
  unsaved English edits are included.
- Page-level coverage aligns saved Arabic to the current English structure by node id.
- Page and per-block Arabic saves update the editor's Arabic state without refetching and
  discarding unsaved English edits.
- Arabic AI replies are selected from the user's message language, overriding the UI locale.
- Per-block AI translation failures and successes show toasts instead of failing silently.
- Page-level translation splits fields into groups of 40, matching the translate endpoint's
  request cap. Previously a page with more fields silently translated only the first 40.
- "Translate missing fields" now excludes fields that already have a different Arabic value, and
  applies the result onto the existing Arabic tree. Previously it re-translated reviewed copy and
  rebuilt the draft from English, erasing manual corrections.
- The review dialog no longer treats English fallback copy as a finished Arabic translation, and
  field labels keep their slot position so duplicate `text` props in one block are distinguishable.
- The Arabic panel wraps its actions and long field list inside the inspector width. At 1440px the
  review/translate row used to overflow the panel and clip the Translate button off-screen.
- Page save reports the number of translated fields, not the total field count.
- Builder save and publish toasts pass the slug required by the localized message; the missing
  interpolation variable previously raised a console `FORMATTING_ERROR` after every save.

### Admin analytics

- Removed the server-side role check on the analytics route. It decoded the `role` claim from the
  Supabase access-token cookie, where the value is always `authenticated`, not the tenant role, so
  every admin — including a super admin — was redirected to `/admin` before the dashboard rendered.
  Access control remains with the hydrated client gate and the API's `@Roles` guards.
- The analytics dashboard exposes the Visitors KPI and Visitors Over Time series, with the 7d /
  30d / 90d / 12m range selector and super-admin tenant filter.
- Supabase sign-in now writes the application's own `user_sessions` row, hashed from the Supabase
  refresh token. The local-password branch already did this, but the Supabase branch only wrote an
  audit log, so on this deployment the Visitors KPI and series were permanently zero. Password
  sign-in records the row in `AuthController`; OAuth, magic-link and post-2FA sign-in record it
  through `AuthService.issueSessionForUser`. The session row is what both Settings' session list
  and the analytics query read.

## Verification

- `pnpm --filter @titan/shared test` — 125 tests.
- `pnpm --filter @titan/frontend test` — 222 tests.
- `pnpm --filter @titan/frontend typecheck`.
- `pnpm --filter @titan/backend typecheck`.
- Backend i18n catalog tests include the new builder group and analytics strings.
- Backend `oauth-supabase-session.spec.ts` — 20 tests, including the new assertion that a
  successful Supabase login records one session row and a pending 2FA login records none.
- Live runtime QA against the deployed admin (frontend `qa-20261023-builder-final5`,
  backend `qa-20261023-analytics-session2`):
  - the insert menu contains 39 options, with every registry block except `nav`/`footer`;
  - adding a Badge appends it at the root and Save completes without a `FORMATTING_ERROR` toast;
  - the Hide block control persists `visible: false`; a later publish keeps it hidden;
  - page-level "Translate missing fields" sent the missing set in two chunks, moved coverage from
    35/71 to 66/71, reported 36 translated fields, and preserved a manually reviewed Arabic title;
  - the review dialog showed per-slot labels such as `BLOCK 1 · CONTENT · ITEM 1 · TEXT` with no
    duplicate labels, and Save Arabic page reported the translated coverage (66), not the total;
  - publish produced version 1; the public Arabic payload had the same 40 root nodes as English,
    included the block added after the Arabic copy was saved, and inherited `visible: false` for
    the hidden Live Island block;
  - the Arabic public page rendered the translated hero copy;
  - Layers drag moved Hero below Stats and undo restored the original order; dragging Hero into its
    own badge was rejected without changing the root order;
  - the builder still loaded `resolvedLocale: en` while the admin UI itself was in Arabic;
  - the home builder reports exactly 5 hidden blocks, 1 empty block, and missing SEO copy;
  - the home Hero inspector exposes its background image and upload controls;
  - the English and Arabic homepages render, and both content payloads have the same 10 root
    blocks with the same hidden states;
  - the Arabic homepage rendered 1,255 Arabic characters in a fresh browser context, with the
    console telemetry pinned LTR;
  - the hero metric badge sits below the console mode bar (badge top 705px, mode selector bottom
    678px at 1440×1000), so it no longer covers the view controls;
  - `/admin/analytics` stayed on the dashboard instead of redirecting, every dashboard API
    returned 200, the Visitors KPI read 1, `/admin/analytics/visitors?range=30d` returned
    `[{"date":"2026-10-23","count":1}]`, and switching to the 7-day range returned 200 (measured
    before the temporary QA account was removed);
  - before the session fix the same visitors endpoint returned `[]` and the KPI read 0.

## Known gaps

- Anonymous visitor tracking is deferred; the analytics visitor series counts distinct
  authenticated users with an active `user_sessions` row. There is no anonymous-versus-signed-in
  filter yet because anonymous sessions are not stored. The session row's `last_active_at` is set
  at sign-in; it is not yet refreshed by later page activity.
- Layers reordering uses HTML5 drag-and-drop, which is pointer-only. Keyboard reordering is not
  implemented yet.
- Legacy Arabic FAQ copy still contains English source text; it is a content translation gap, not
  a builder rendering bug.
- The full backend test suite still contains pre-existing failures outside this audit (DB-backed
  integration tests, `auth-session-probe`, an RTL `ml-5` assertion, and `page-slugs`). The
  targeted backend auth tests and both TypeScript checks pass.
