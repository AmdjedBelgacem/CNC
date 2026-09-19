# Plan: Academies as a First-Class Domain Entity

> Status: **Implementation plan — not yet implemented**
> Date: 2026-09-14
> Scope: monorepo `titans-of-manufacturing` (apps/backend NestJS 11 + Drizzle, apps/frontend Next.js 16 — hosts both the public site and the real admin — and packages/shared @titan/shared)

---

## 1. Executive Summary

Today "Academy" is marketing vocabulary with no domain backing: there is no `academies` table, `/academy` renders a Puck builder landing page (`academy-landing`) whose cards are static seed content, the `academies-dropdown` hardcodes four academies that link to `/courses?academy=…`, and **that query param is never read by the courses page** — the links are cosmetic. Meanwhile Admin manages only Courses via Course Studio. The result is the product/architecture mismatch described in the brief: Academy and Course feel equivalent when they must not be.

This plan introduces a real `academies` entity (tenant-scoped, publishable, brandable) with `courses.academy_id` as an **additive, nullable** FK, new admin CRUD at `/admin/academies`, new public IA at `/academy` → `/academy/[academySlug]` → `/academy/[academySlug]/courses/[courseSlug]`, and 308 compatibility redirects from every legacy `/courses/...` (and defensive `/academy/courses/...`) URL.

Key non-negotiables honored:

- **Academy is not a rename of Course.** Academies own marketing narrative, branding, and a curated ordered set of courses. Courses keep owning curriculum, pricing, SEO, enrollments, progress, and certificates. Enrollments (`enrollments.courseId`), progress (`lesson_progress.lessonId`), and certifications (`certifications.courseId`) are untouched by this plan.
- **Course Studio remains the course editor.** The only Studio change is an Academy picker on the Basics step plus `academyId` in the PATCH payload.
- **Additive migration only.** One idempotent hand-written SQL file (the `0002/0007/0008` pattern), nullable column, FK `ON DELETE SET NULL`, no destructive rewrite. Legacy `/courses` pages keep working before, during, and after rollout; redirects are dynamic per-course so no `next.config` gymnastics are needed.
- **Tenant isolation and role guards preserved.** New endpoints copy the exact guard stack and `effectiveTenant` super-admin pattern from `admin-courses.controller.ts`.

Biggest pre-existing hazards this plan works around (and flags): `courses` slugs are **not unique** at the DB level (only a plain index `tenant_slug_idx`, and `CoursesService.createCourse` never dedupes), and the Payload app (`apps/admin`) mirrors collections but is not the operative admin — it is intentionally out of scope.

---

## 2. Target IA and Domain Model

### 2.1 Product definitions

| | Academy | Course |
|---|---|---|
| What it is | A program / track / vertical (e.g. "CNC Machining Academy", "Aerospace Academy"). A branded destination. | A single teachable unit: curriculum (series → lessons), pricing, certificate issuance. |
| Owned content | Name, slug, description, hero/logo imagery, accent color, SEO fields, sort order, publish/archive state, (later) optional builder landing override. | Everything it has today: series/lessons, difficulty, estimated hours, price/access mode, trailer, thumbnail, per-course SEO, `autoIssueCertificate`, metadata. |
| Does NOT own | Curriculum, pricing, enrollments, certificates. | Branding beyond its own card; academy-level marketing copy. |
| Lifecycle | Draft → published → archived. Publishing is marketing-visible state only. | Unchanged (existing publish gate in `CoursesService.validateForPublish`). |

**Rules of the relationship**

- A course belongs to **0..1** academy (`academy_id` nullable throughout Phase 1–3; optional `NOT NULL` hardening only in Phase 4 after backfill).
- Academy assignment/movement is a metadata-only operation on `courses` — never touches enrollments, progress, or certificates (all keyed by `courseId`/`lessonId`).
- `courses.sort_order` is reinterpreted as **ordering within its academy** (it is already only used as a listing order key; document this).
- Unpublishing/archiving an academy hides the **academy destination** only. Its courses remain reachable via `/courses` (the tenant-wide library) and via their canonical academy URL once reassigned. Archiving does **not** mutate courses.
- Deleting an academy is allowed only when it has zero courses (admin UI offers "move courses first" instead). The FK is `ON DELETE SET NULL` as a belt-and-braces guard.

### 2.2 Target public IA

```
/academy                                              → Academy index (list of published academies)
/academy/[academySlug]                                → Academy landing: branding + its published courses
/academy/[academySlug]/courses/[courseSlug]           → Course detail (canonical, post-Phase 2)
/academy/[academySlug]/courses/[courseSlug]/lessons/[lessonSlug]  → Lesson player
```

**Reserved academy slugs** (rejected at create/validate, because they would collide with static segments under `/academy`): `courses`, `new`, `edit`, `admin`, `api`, `login`, `register`, `account`, `settings`, `sitemap.xml`, `robots.txt`.

**Legacy URLs (all remain functional):**

| Legacy URL | Behavior after Phase 2 |
|---|---|
| `/courses` | Kept permanently as the tenant-wide "All courses" library (no redirect). |
| `/courses?academy=X` | Server `redirect()` to `/academy/X` (the param was previously ignored — cosmetic links become real). |
| `/courses/[slug]` | Fetch course; if it has an academy → `permanentRedirect()` (308) to `/academy/[a]/courses/[slug]`; if not → keep rendering the legacy page (unassigned course). |
| `/courses/[slug]/lessons/[lessonSlug]` | Same rule, redirect to `/academy/[a]/courses/[slug]/lessons/[lessonSlug]`. |
| `/academy/courses/[slug]` (defensive) | Static route shadowing the reserved segment; resolves the course and 308s to its canonical academy URL (or `/courses/[slug]` if unassigned). |

Because redirects are implemented in server components via Next's `redirect()`/`permanentRedirect()` after a data fetch, they are per-course and need no `next.config.ts` rewrite rules (there are none today — confirmed `next.config.ts` has no `redirects`/`rewrites`).

### 2.3 Domain model summary

```
tenant
 └── academy (0..n)          [NEW: slug unique per tenant, publish/archive, branding, SEO]
      └── course (0..n)      [courses.academy_id → academies.id, nullable, ON DELETE SET NULL]
           └── series → lessons     (unchanged)
enrollments / lesson_progress / certifications / cert_templates  (unchanged, still course-bound)
pages / page_versions / themes      (unchanged; academies are typed pages, not builder pages, in Phase 1–2)
```

---

## 3. Schema + Migration Plan

### 3.1 New file: `apps/backend/src/database/schema/academies.ts`

Mirrors the conventions of `schema/courses.ts` / `schema/pages.ts` (tenant FK, timestamps, explicit index callbacks):

```ts
export const academies = pgTable('academies', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  slug: varchar('slug', { length: 200 }).notNull(),
  title: varchar('title', { length: 300 }).notNull(),
  subtitle: varchar('subtitle', { length: 500 }),
  description: text('description'),
  heroImageUrl: varchar('hero_image_url', { length: 500 }),
  logoUrl: varchar('logo_url', { length: 500 }),
  accentColor: varchar('accent_color', { length: 7 }), // branding/theme override, optional
  seoTitle: varchar('seo_title', { length: 300 }),
  seoDescription: varchar('seo_description', { length: 500 }),
  isPublished: boolean('is_published').notNull().default(false),
  isArchived: boolean('is_archived').notNull().default(false),
  publishedAt: timestamp('published_at'),
  archivedAt: timestamp('archived_at'),
  sortOrder: integer('sort_order').notNull().default(0),
  metadata: jsonb('metadata'), // future: per-academy builder layout override key, etc.
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  tenantSlugUnique: uniqueIndex('academies_tenant_slug_unique').on(table.tenantId, table.slug), // pages-style uniqueness
  publishedIdx: index('academies_tenant_published_idx').on(table.tenantId, table.isPublished, table.sortOrder),
}));
```

Note: unlike `courses` (non-unique index — see risks), academies get a **unique `(tenant_id, slug)`** like `pages` do (`pages_tenant_slug_idx`), since academy slugs are now path segments.

### 3.2 Changes to `apps/backend/src/database/schema/courses.ts`

Add to the `courses` table:

```ts
academyId: uuid('academy_id').references(() => academies.id, { onDelete: 'set null' }),
```

and to the index callbacks:

```ts
academyIdx: index('courses_academy_idx').on(table.tenantId, table.academyId, table.isPublished, table.sortOrder),
```

### 3.3 Changes to `apps/backend/src/database/schema/relations.ts`

```ts
export const academiesRelations = relations(academies, ({ one, many }) => ({
  tenant: one(tenants, { fields: [academies.tenantId], references: [tenants.id] }),
  courses: many(courses),
}));

// inside coursesRelations: add
academy: one(academies, { fields: [courses.academyId], references: [academies.id] }),

// inside tenantsRelations: add
academies: many(academies),
```

Re-export from `schema/index.ts`. `DrizzleService` passes the whole schema to drizzle, so `db.query.academies` and nested course↔academy relations work with zero wiring changes.

### 3.4 Migration file: `apps/backend/src/database/migrations/004_academies.sql`

Follows the established hand-written **idempotent** pattern (`0002_rbac_roles_permissions.sql`, `0007_cert_templates_course_id.sql`, `0008_course_auto_issue.sql` — files 001–003 are also untracked by the drizzle journal, so `004_` is the next in that series):

```sql
-- 004_academies.sql — hand-written, idempotent (IF NOT EXISTS), NOT added to meta/_journal.json
CREATE TABLE IF NOT EXISTS "academies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "slug" varchar(200) NOT NULL,
  "title" varchar(300) NOT NULL,
  "subtitle" varchar(500),
  "description" text,
  "hero_image_url" varchar(500),
  "logo_url" varchar(500),
  "accent_color" varchar(7),
  "seo_title" varchar(300),
  "seo_description" varchar(500),
  "is_published" boolean NOT NULL DEFAULT false,
  "is_archived" boolean NOT NULL DEFAULT false,
  "published_at" timestamp,
  "archived_at" timestamp,
  "sort_order" integer NOT NULL DEFAULT 0,
  "metadata" jsonb,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "academies_tenant_slug_unique" ON "academies" ("tenant_id", "slug");
CREATE INDEX IF NOT EXISTS "academies_tenant_published_idx" ON "academies" ("tenant_id", "is_published", "sort_order");

ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "academy_id" uuid REFERENCES "academies"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "courses_academy_idx" ON "courses" ("tenant_id", "academy_id", "is_published", "sort_order");
```

Deployment notes:

- `ADD COLUMN` without a default is metadata-only in PG 11+ (no table rewrite, no long lock).
- The two indexes on `academies` are on a brand-new table (instant). `courses_academy_idx` is on the hot `courses` table — if the production table is large, run that one statement separately with `CREATE INDEX CONCURRENTLY` (cannot be inside a transaction; acceptable without since the column starts empty, but prefer CONCURRENTLY in prod runbooks).
- The migration is safe to re-run and safe to run **before** the new backend deploy (old code ignores the column/table).
- Rollback: `ALTER TABLE "courses" DROP COLUMN IF EXISTS "academy_id"; DROP TABLE IF EXISTS "academies";` — FK is `SET NULL` so an academy delete never cascades into course loss.

### 3.5 RBAC seeding (schema-adjacent, data)

`apps/backend/src/modules/rbac/rbac.constants.ts` — add to `PERMISSION_CATALOG` (new `academies` group, following the `courses` group at lines 47–52):

```ts
{ key: 'academies:view',    group: 'academies', label: 'View academies',     description: 'See academies and their course rosters' },
{ key: 'academies:create',   group: 'academies', label: 'Create academies',   description: 'Create new academy drafts' },
{ key: 'academies:edit',     group: 'academies', label: 'Edit academies',    description: 'Edit academy details and assign courses' },
{ key: 'academies:publish',  group: 'academies', label: 'Publish academies',  description: 'Publish, unpublish, archive and restore academies' },
{ key: 'academies:delete',   group: 'academies', label: 'Delete academies',   description: 'Delete empty academies' },
```

`SYSTEM_ROLE_PERMISSIONS`: `admin` gets all `academies:*`; `instructor` gets `academies:view` (they author courses; they do not own the vertical); `super_admin` already resolves `['*']`. `seedRbac` in `src/database/seed.ts` (and standalone `seed-rbac.ts`) upserts the catalog with `onConflictDoNothing` on `key` — rerunning it is the deploy step for existing environments.

### 3.6 Migration of existing courses

Two-step, **no automatic data invention**:

1. **Phase 1–2 (default): leave `academy_id` NULL.** Unassigned courses are fully functional: they appear on `/courses`, their legacy `/courses/[slug]` page keeps rendering (no redirect target yet). Nothing breaks, nothing is faked.
2. **Phase 2 (controlled backfill):** an idempotent script `apps/backend/src/database/seed-academies.ts` (runnable standalone like `seed-rbac.ts`) creates, per tenant that has ≥1 course, one default academy using only real data — `slug: 'general'`, `title: '<tenant.name> Academy'` (e.g. "CNC Fundamentals Academy"), `description: tenant.description` — and sets `academy_id` for every NULL course of that tenant. The same action is exposed as an explicit admin button ("Create default academy & assign unassigned courses") on `/admin/academies` so operators confirm it per tenant. After backfill, every `/courses/[slug]` URL 308s to a canonical academy URL.

A **pre-flight duplicate-slug check** ships with the backfill: because `courses` has no unique `(tenant_id, slug)` constraint (pre-existing gap — `createCourse` at `courses.service.ts:149` never dedupes), the script reports duplicates instead of guessing; the fix (unique constraint) is an open question, not smuggled into this migration.

---

## 4. API Plan (Backend)

New Nest module `apps/backend/src/modules/academies/` (`academies.module.ts`, `admin-academies.controller.ts`, `academies.controller.ts`, `academies.service.ts`, `dto/academies.dto.ts`), registered in `app.module.ts`.

### 4.1 Admin CRUD — `admin-academies.controller.ts` (`@Controller('admin/academies')`)

Guard stack **identical to `admin-courses.controller.ts:27`**: `@UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard, RolesGuard)` + per-handler `@Roles('super_admin', 'admin')` + the `effectiveTenant(req, queryTenantId?)` super-admin `?tenantId=` override (copy of `admin-courses.controller.ts:35-49`). Permission keys from §3.5 are seeded for UI affordances (`useCan`) and optional Phase 4 `@Permissions` hardening — matching how `admin/courses` endpoints work today (Roles-only).

| Method & path | Purpose | Notes |
|---|---|---|
| `GET /admin/academies?status=&search=&tenantId=` | List (incl. drafts/archived) | Joins course counts; mirrors `findForAdmin` shape of courses. |
| `POST /admin/academies` | Create draft | `{ slug, title }` min; server `uniqueAcademySlug(tenantId, base)` appends `-2`, `-3` (same loop pattern as `uniqueSeriesSlug`, courses.service.ts:319). Rejects reserved slugs (§2.2). |
| `PATCH /admin/academies/:slug` | Update fields | `UpdateAcademyDto`; `academyId`-free. |
| `GET /admin/academies/:slug/validate` | Publish readiness | `{ ok, reasons[] }` — requires title, slug; **warns** (does not block) on zero courses. |
| `POST /admin/academies/:slug/publish` / `unpublish` / `archive` / `restore` | Lifecycle | Sets flags + timestamps; does not touch courses. |
| `DELETE /admin/academies/:slug` | Delete | **409 with course count** if courses exist; succeeds only when empty. |
| `POST /admin/academies/:slug/courses` | Assign/move courses | Body `{ courseSlugs: string[] }`; validates every course is in the same tenant; single transaction updating `courses.academy_id`. |

### 4.2 Public endpoints — `academies.controller.ts` (`@Controller('academies')`)

Public (no auth — `TenantResolveGuard` resolves tenant from `x-tenant-slug`, first-active fallback unchanged):

- `GET /academies` → published, non-archived academies ordered by `sort_order`, each with `{ id, slug, title, subtitle, description, heroImageUrl, logoUrl, accentColor, courseCount }` (courseCount = published, non-archived courses).
- `GET /academies/:slug` → single academy (published only, 404 otherwise) with nested `courses[]` (published, non-archived, `sort_order`, each with the summary fields the current `CourseCard` consumes: slug, title, subtitle, thumbnailUrl, difficulty, estimatedHours).

These follow the exact scoping idiom of `CoursesService.findByTenant` (`courses.service.ts:95-124`): every query `and(eq(academies.tenantId, tenantId), eq(academies.isPublished, true), eq(academies.isArchived, false))`.

### 4.3 Changes to the existing courses module

`apps/backend/src/modules/courses/`:

1. **DTOs** (`dto/courses.dto.ts`): `CreateCourseDto`/`UpdateCourseDto` gain optional `@IsUUID() academyId` (Update also accepts `null` to unassign).
2. **Service** (`courses.service.ts`):
   - `createCourse` / `updateCourse`: persist `academyId` after validating `academies.tenantId === tenantId` (tenant-scoped FK check — no cross-tenant academy assignment).
   - `findByTenant`: accept `academySlug` filter → inner-join `academies` on `(tenantId, slug)`, published flag respected; this makes `GET /courses?academy=X` real (currently ignored).
   - `findBySlug`: include the `academy` relation (`{ id, slug, title, accentColor }`) in the response — needed by the public course page for breadcrumbs, canonical URL, and redirect logic.
   - `getStudio`: include `academyId` so Studio can render the picker; also expose `academies` list (or the Studio fetches `GET /admin/academies` separately — preferred, keeps payloads lean).
   - `validateForPublish`: **unchanged** (no new hard requirement; optionally add a non-blocking warning "course has no academy").
   - `findForAdmin`: support `academy=<slug>` filter + return each course's `academy` summary for the admin list column.
3. **Public course JSON**: additive `academy` object — old clients/consumers unaffected.
4. **`deleteCourse`** (courses.service.ts:486-519): **no changes needed** — it already hard-deletes enrollments/certs/progress in a transaction keyed by course; academy membership is just a column on the deleted row.

### 4.4 Search & analytics

- **Search** (`src/modules/search/search.service.ts`): `searchPublic` (117-233) gains an `academies` result type — `ilike` over `title`/`slug`/`description`, published + non-archived only; admin `search` (32-115) likewise. Additive to the result union; frontend search page gets an "Academies" section.
- **Analytics** (`src/modules/admin/admin-analytics.controller.ts`, `admin.service.ts`): additive new endpoint `GET /admin/analytics/academies` — per-academy enrollment and completion rollups (raw SQL joining `courses` → `enrollments` grouped by `academy_id`, same style as `getTopCourses` at admin.service.ts:305-318), behind the same Redis `cached()` 300s wrapper with a new cache key namespace (`academies:{tenantId}:{range}` — existing keys unaffected). Existing `top-courses`/`breakdowns`/`insights` responses are **unchanged** in shape. Phase 3.

---

## 5. Admin UI Plan (all in `apps/frontend` — the operative admin)

### 5.1 New pages

| Route | File (new) | Contents |
|---|---|---|
| `/admin/academies` | `src/app/(admin)/admin/academies/page.tsx` | Academy list: `AdminHero`, `StatStrip` (total/published/drafts), `PillTabs` (All/Drafts/Published/Archived), `SearchInput`, `TableCard` rows (title, slug, status pill, course count, updated), row menu with publish/unpublish/archive/restore — mirrors `admin/courses/page.tsx` structure exactly. Client page fetching `/api/proxy/admin/academies`. |
| `/admin/academies/new` | `src/app/(admin)/admin/academies/new/page.tsx` | Copies `/admin/courses/new`: auto-create draft `slug = 'academy-' + Date.now().toString(36)` via `POST /api/proxy/admin/academies`, then `router.replace` to the edit page. |
| `/admin/academies/[slug]/edit` | `src/app/(admin)/admin/academies/[slug]/edit/page.tsx` + `academy-editor.tsx` | One-screen editor (academies are far simpler than courses — no studio wizard needed): sections **Basics** (title, slug w/ inline validation, subtitle, description), **Branding** (hero image, logo, accent color — reuse the tenant-settings upload patterns from `admin/settings`), **SEO** (seoTitle, seoDescription), **Courses in this academy** (roster list with per-course "Move to…" select and "Assign course" picker — course picker clones the debounced-search pattern from `certificates/issue-sheet.tsx:37-76`), plus publish/unpublish in the header. |

All built from `components/admin/admin-ui.tsx` primitives (`Select`, `TableCard`, `PillTabs`, `EmptyState`, …). Pages sit under the existing `(admin)` layout so `AdminGate`, the cookie redirect, and CSRF proxying apply automatically.

### 5.2 Course Studio changes (minimal, additive)

- `src/app/(admin)/admin/courses/studio/types.ts`: add `academyId: string | null` and `academy?: { id, slug, title } | null` to `CourseStudioData`.
- `CourseStudio.tsx`: add `academyId` to `scalarPatch()` (lines 19-38) so it flows through the existing 700ms-debounced autosave → `PATCH /api/proxy/admin/courses/:slug`.
- `StepBasics.tsx`: add an **Academy** select populated from `GET /api/proxy/admin/academies?limit=100` (options: "No academy" + academies), value = `academyId`, change → `update({ academyId })`.
- `completeness.ts`: untouched — academy is not a publish blocker (matches backend).

### 5.3 Navigation & i18n

- `components/admin/admin-rail.tsx`: add `{ href: '/admin/academies', roles: ['super_admin', 'admin', 'instructor'], match: (p) => p.startsWith('/admin/academies') }` to `tabsBase` (lines 30-91), insert **above** Courses; wire `tabKeyMap` → `'academies'`; render the desktop rail button (some buttons are hand-rendered in JSX — check the desktop section when editing).
- `messages/en.json` + `messages/fr.json`: add `admin.academies` (+ any drawer/editor keys) under the existing `admin.*` namespace (en.json lines 92-135). **Both locales** — the app ships en + fr.
- Admin search palette (`admin-search-palette.tsx`) picks up academies automatically once backend `/search` includes them.

### 5.4 Secondary admin surfaces

- `/admin/courses` list: add an **Academy** column + optional filter dropdown (`GET /api/proxy/admin/courses?academy=`).
- `/admin/analytics`: Phase 3 — optional "By academy" breakdown consuming `GET /admin/analytics/academies`.
- Certificates issue-sheet course picker: optional Phase 3 polish (group options by academy); zero functional impact.

---

## 6. Public UI / Builder Plan

### 6.1 New public pages

| Route | File (new) | Behavior |
|---|---|---|
| `/academy` (index) | `src/app/(main)/academy/page.tsx` — **rewrite of the existing file** | Server component: `GET /academies` (via `${API_URL}/academies` with tenant slug header, `revalidate: 60`, same idiom as `lib/builder/theme.ts`). Renders a directory grid of academy cards (hero image, title, subtitle, course count) linking to `/academy/[slug]`. **Compat fallback:** if zero published academies exist, render the current builder `academy-landing` layout (`resolvePageLayout(tenantSlug, 'academy-landing')`) — so pre-migration content looks identical until real academies exist. |
| `/academy/[academySlug]` | `src/app/(main)/academy/[academySlug]/page.tsx` | Fetch `GET /academies/:slug`; `notFound()` if missing/unpublished/archived. Renders: branded header (hero image, title, subtitle/description, accent color applied via inline CSS vars), then the academy's course grid reusing the existing `CourseCard` component; course links point at `/academy/[slug]/courses/[courseSlug]`. `generateMetadata` from `seoTitle`/`seoDescription` with `alternates.canonical = /academy/[slug]`. |
| `/academy/[a]/courses/[c]` | `src/app/(main)/academy/[a]/courses/[c]/page.tsx` | **Extract** the current course-detail page body (`app/(main)/(academy)/courses/[slug]/page.tsx`) into a shared component (e.g. `components/academy/course-detail.tsx`) and mount it under the new path, adding: academy breadcrumb (`/academy` → academy title → course), and `alternates.canonical = /academy/[a]/courses/[c]`. Data fetch gains academy scoping (fetch by academy slug + course slug). |
| `/academy/[a]/courses/[c]/lessons/[l]` | same pattern for the lesson/player page | Existing `LessonPlayer` receives `academySlug` too so its "Back to course" link uses the new path. |
| `/academy/courses/[slug]` (static, reserved) | `src/app/(main)/academy/courses/[slug]/page.tsx` | Defensive legacy shim: fetch course by slug; `permanentRedirect()` to `/academy/[a]/courses/[slug]` (or `/courses/[slug]` if unassigned). Static segment shadows the dynamic `[academySlug]` route — this is exactly why `courses` is a reserved academy slug. |

### 6.2 Legacy `/courses` pages (modify, don't delete)

- `app/(main)/(academy)/courses/page.tsx`: read `searchParams.academy` at the top → if present, `redirect('/academy/' + param)`; otherwise render the tenant-wide library exactly as today (permanent fixture).
- `app/(main)/(academy)/courses/[slug]/page.tsx` (and `lessons/[lessonSlug]/page.tsx`): after `getCourse(slug)`, if `course.academy?.slug` exists → `permanentRedirect(\`/academy/${academy.slug}/courses/${slug}\`)`; else render as today.
- `course-grid.tsx` stays as-is (fetches `/api/proxy/courses`).

### 6.3 Navigation components (currently hardcoded cosmetic academies)

- `components/layout/academies-dropdown.tsx` (hardcoded 4 academies → `/courses?academy=`, lines 5-34): convert to data-driven — fetch `/api/proxy/academies` (react-query like other client components) and render real published academies linking to `/academy/[slug]`; keep a sensible empty state (hide the dropdown when no academies). 
- `components/home/core-academies.tsx` (lines 14-36): same treatment.
- `components/layout/footer.tsx` (lines 7-9): same treatment or static `/academy` link (footer is also a builder block — see below).
- `nav-main.tsx` / `mobile-sidebar.tsx` already link `/academy` — no change needed.

### 6.4 Builder blocks (`academy-grid`, `academy-card`)

The blocks live in three synchronized places: shared registry (`packages/shared/src/blocks/registry.ts`), Puck config (`apps/frontend/src/lib/builder/puck-config.tsx`), and renderers (`apps/frontend/src/components/builder/blocks/`). All changes are **additive optional props** — existing published layouts remain valid (zod `.optional()`).

**`academy-card`** — target an academy explicitly:

- `academyCardPropsSchema` (registry.ts:306-319): add `academySlug: z.string().max(200).optional()`.
- `puck-config.tsx` (500): add an `academySlug` text field (later: a picker fed by `/api/proxy/academies`).
- `academy-card-block.tsx`: when `academySlug` is set, `href` resolves to `/academy/${academySlug}` (string concat — no fetch; `href` remains an optional manual override). Resolution mirrors `isInternalHref` usage.

**`academy-grid`** — render live academies:

- `academyGridPropsSchema` (registry.ts:482-494): add `source: z.enum(['manual', 'live']).optional()` (default `'manual'`).
- `academy-grid-block.tsx`: in `manual` mode, unchanged (slots). In `live` mode, render the `resolvedAcademies` prop (injected server-side, below) as cards: image, title, description, course count, link `/academy/[slug]`.
- **Server-side data enrichment** (new, additive): public pages already resolve layouts in `resolvePageLayout` (`lib/builder/theme.ts:39`). Add an `enrichLayoutForPublic(layout, tenantSlug)` step before `<BlockRenderer>`: walk nodes, find `academy-grid` with `source: 'live'`, fetch `GET /academies` once (server-side, cached with `revalidate: 60`), and inject `resolvedAcademies` into those nodes' props. This keeps the renderer pure (props-only, editor/public parity — the Puck editor canvas shows the manual/placeholder preview with a hint field, since `live` blocks have no static children).
- **Seeds** (`packages/shared/src/blocks/seeds.ts`): update `ACADEMIES` seed cards (404-442) and `seedAcademyLandingLayout` (769+) to use `academySlug` instead of dead-end hrefs (`/courses?academy=cnc` → `academySlug: 'cnc'`), and `seedAcademyGrid` (501) default `source: 'manual'`. Seeds only affect **new** tenants/fallbacks; existing published layouts keep working via the redirects in §6.2 — **no content migration of published page JSON is required**.
- `BUILDER_PAGE_SLUGS` / `BUILDER_PAGE_DEFS` / `DEFAULT_LAYOUTS` (`packages/shared/src/types/page.ts:71`, `constants/page-defaults.ts`): unchanged in Phase 1–2 (`academy-landing` remains the builder page behind the `/academy` zero-academies fallback). Phase 3 may add an `academies-index` seed layout.

### 6.5 SEO

- `app/sitemap.ts` (currently a static hardcoded list): add `/academy` and, for the default tenant, fetch published academies and emit `/academy/[slug]` entries (server-side fetch with `x-tenant-slug: DEFAULT_TENANT_SLUG`; multi-tenant sitemap strategy is an open question — §10).
- Canonical tags: new academy pages and relocated course pages set `alternates.canonical` to their new URLs (the 308 redirects from legacy paths prevent duplicate-content confusion).
- `robots.ts` needs no change.

### 6.6 Shared package types

`packages/shared/src/types/academy.ts` (new): `AcademySummary`, `AcademyDetail` (with nested `CourseSummary[]`), exported from `src/index.ts`. The backend DTO shapes should match these (frontend has local duplicate types today, e.g. studio `types.ts` — the new pages use the shared types; retrofitting studio types is optional and out of scope).

---

## 7. Migration / Compatibility Plan

Ordered, each step independently deployable and backward-safe:

1. **DB migration first** (`004_academies.sql`) — additive; old code ignores it. Rerun `seed-rbac` (or the catalog upsert path in `seed.ts`) to register permission keys.
2. **Backend deploy** — new `/academies` + `/admin/academies` endpoints; courses DTO/service/relations gain `academyId`/`academy`. All responses additive; existing clients unaffected.
3. **Frontend deploy** — admin pages + rail item + Studio picker; public academy routes appear (empty until content exists — `/academy` still falls back to the builder landing); legacy `/courses` behavior unchanged except `?academy=` now redirects.
4. **Content creation (per tenant, no downtime)** — operators create real academies in `/admin/academies` and assign courses (individually from Studio, or via the bulk assign endpoint / academy editor roster). Each assignment instantly makes that course's legacy URL 308 to its canonical academy URL.
5. **Optional backfill** — run `seed-academies.ts` (or click the admin action) to create the tenant-derived default academy and sweep remaining NULL courses (§3.6).
6. **Builder content** — no forced migration: existing card hrefs like `/courses?academy=cnc` now redirect properly. Editorial pass (optional) upgrades cards to `academySlug`/live grids.
7. **Defensive shims** — `/academy/courses/[slug]` static route maps any external links of that shape to canonical URLs.

**Zero/low-downtime rationale:** no destructive DDL, no column rewrite, no data backfill in the deploy path (operator-triggered), no removal of legacy routes at any point, redirects are data-driven per course, and the academy index degrades gracefully to current content when no academies exist. Rollback at any phase = revert deploys; column/table can be dropped last (FK `SET NULL`).

**Invariants protected:** enrollments (`enrollments.user_course_idx`), lesson progress, certificates and auto-issue (`CertificationService.tryAutoIssue` reads `course.autoIssueCertificate` — untouched), playback paywall (`getLessonPlaybackUrl` — untouched), Course Studio flows, builder page rendering (props-only renderer, optional-prop schemas), tenant isolation (per-query `tenantId` + guards unchanged).

---

## 8. Phased Rollout

| Phase | Contents | Exit criteria |
|---|---|---|
| **0 — Decisions & groundwork** (tiny PR) | Reserved-slug list agreed; permission keys added to `PERMISSION_CATALOG` + seeds; shared `AcademySummary`/`AcademyDetail` types. | `pnpm typecheck` + `lint` clean; rbac seed reruns cleanly on dev DB. |
| **1 — Entity + Admin** | `004_academies.sql`; schema/relations; `academies` module (admin + public controllers, service, DTOs); `/admin/academies` list + editor pages; admin rail + i18n (en/fr); Studio academy select; public `GET /academies` + `/academies/:slug` (backend only — no public page yet beyond existing `/academy`). | Admin can CRUD + publish academies and assign courses; course↔academy assignment visible in API responses; existing suite green. |
| **2 — Public IA + compat** | `/academy` index (with builder fallback), `/academy/[slug]`, relocated course/lesson routes, legacy redirects (`/courses/[slug]`, `?academy=`, `/academy/courses/[slug]`), breadcrumbs + canonicals, sitemap additions. | All URLs in §2.2 resolve or 308 correctly; Lighthouse/SEO spot-check; legacy bookmarks behave. |
| **3 — Discoverability & polish** | Data-driven `academies-dropdown`/`core-academies`/footer; search includes academies (public + admin); `academy-grid` live source + server enrichment; `academy-card.academySlug`; admin courses list academy column/filter; `/admin/analytics/academies`; certificate picker grouping. | Search returns academies; builder can build a live academy grid; analytics rollup renders. |
| **4 — Hardening (optional)** | Backfill to zero NULL `academy_id`; then `ALTER TABLE courses ADD CONSTRAINT … NOT NULL VALID` + `VALIDATE` (zero-downtime constraint); optionally add `@Permissions('academies:*')` + `PermissionsGuard` to admin-academies handlers; decide Payload & study-groups questions (§10). | No NULL academy rows; constraint validated without locks. |

Sequencing rule: each phase is a shippable increment; nothing in phases 1–3 removes or rewrites any existing route, table, or flow.

---

## 9. Acceptance Criteria

**Build hygiene**
- `pnpm typecheck`, `pnpm build`, `pnpm lint` clean across the monorepo; existing backend vitest suite passes unmodified.

**Admin**
- Admin/super_admin can create, edit, publish, unpublish, archive, restore, and delete (empty-only) academies; instructors cannot (role-gated).
- Course Studio shows the Academy select, autosaves `academyId` via the existing PATCH flow, and publish gating is unchanged.
- Moving a course between academies (either from Studio or the academy roster) does **not** alter enrollments, progress, or certificates (verify via existing rows before/after).
- Tenant isolation: tenant A's admin never sees tenant B's academies (all list/read/write paths tenant-scoped); `super_admin` with `?tenantId=` sees the target tenant (audit-logged, per `effectiveTenant`).
- Admin rail shows "Academies" in en + fr; admin search palette surfaces academies.

**Public**
- `/academy` lists only published academies; falls back to the current builder landing when none exist.
- `/academy/[slug]` renders academy branding + its published courses only; unknown/unpublished/archived slug → 404.
- `/academy/[a]/courses/[c]` and `.../lessons/[l]` behave identically to today's course/player (enroll button, progress, paywall, playback).
- `/courses/[slug]` 308s to the canonical URL when the course has an academy; renders the legacy page when it doesn't. `/courses?academy=X` redirects to `/academy/X`. `/academy/courses/[slug]` shim works.
- Reserved academy slugs rejected at create; duplicate slugs get `-2` suffixes; `(tenant, slug)` uniqueness enforced in DB.
- Sitemap includes `/academy` and published academy pages.

**Migration**
- `004_academies.sql` is re-runnable (no-op second run) and deployable before/after backend deploys; rollback path documented (§3.4).
- Backfill script is idempotent, invents no data (uses real tenant fields), and reports duplicate course slugs instead of guessing.

**Security**
- New admin endpoints carry the full guard stack (`JwtAuthGuard, TenantGuard, TenantScopeGuard, RolesGuard` + `@Roles`); public academy endpoints leak no drafts/archived rows and no cross-tenant data.

---

## 10. Open Questions

1. **Default academy naming** — backfill proposes `slug: 'general'`, `title: '<tenant.name> Academy'`. Acceptable, or should unassigned courses stay visible only via `/courses` indefinitely (no backfill at all)?
2. **Fate of `/courses` long-term** — this plan keeps it permanently as the tenant-wide library. Alternative: make it redirect-only to `/academy` once every course is assigned. Recommendation: keep (it serves search-all and the zero-academy period).
3. **Course slug uniqueness** (pre-existing gap) — `courses` has no unique `(tenant_id, slug)` constraint and `createCourse` doesn't dedupe (unlike series/lessons). Duplicates would make legacy redirects nondeterministic. Add a unique constraint opportunistically (only safe if no dupes exist today — needs a prod data check first)?
4. **Per-academy builder landing override** — should `/academy/[slug]` optionally render a Puck layout (e.g. via `academies.metadata.layoutPage` or a `BUILDER_PAGE_SLUGS` convention) instead of the typed page? Deferred to Phase 3+; the typed page ships first.
5. **Multi-tenant SEO** — `tenants.domain` exists but is unused (tenant resolution is `x-tenant-slug` header + first-active fallback, not host-based), and `sitemap.ts` is static for a single base URL. Academy pages are tenant-scoped by the same mechanism as courses, so parity is preserved — but if host-based tenant routing is ever built, sitemap/canonicals need revisiting.
6. **Payload app (`apps/admin`)** — it mirrors Drizzle collections but the operative admin is the Next.js `/admin` (Course Studio, etc.). Plan deliberately does **not** add an Academies Payload collection; do we freeze Payload entirely, or keep collections in sync manually? (Already drifted; recommend freezing and documenting.)
7. **`study_groups.academy` varchar** — free-text tags (`cnc`, `aerospace`, …) semantically overlap the new entity. Non-goal for now; a Phase 4 option is FK-ing groups to academies.
8. **Instructor permissions** — plan gives instructors `academies:view` only (verticals are admin-owned). Should instructors be able to propose/create academies?
9. **Academy-level assets** — accent color is the only branding field in v1; should v1 also include `og_image_url` per academy (courses have `ogImageUrl` today)?
10. **Analytics cache** — academy rollups add a Redis key per tenant+range; confirm the cache-invalidation story (current analytics endpoints don't invalidate on data change either — same behavior, 300s TTL).

---

### Non-Goals (explicit)

- No rename/redefinition of Course; no changes to series/lessons structure.
- No changes to enrollments, lesson progress, certificates, auto-issue logic, or the paywall.
- No replacement of Course Studio; no new builder for academies in v1.
- No destructive migration, no forced rewrite of published builder page JSON, no mass URL breakage.
- No Meilisearch indexing (dep exists but unused — search stays SQL `ilike`).
- No multi-tenancy model changes (no host-based routing, no RLS).
- No Payload CMS work.
