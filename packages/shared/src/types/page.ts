export type PageStatus = 'draft' | 'published' | 'disabled';

/**
 * Structural types for the Puck-based layout data model.
 * Kept dependency-free so both the backend (validation) and frontend (rendering + editor)
 * share exactly one representation of a page layout.
 *
 * Mirrors Puck's slot data shape: nested children live INLINE on the owning
 * node (`node.props[slotName]`, an array of child nodes). The top-level
 * `zones` map is legacy (DropZone-era) input only — it is accepted on read
 * and migrated to the inline shape, never produced by new code.
 */
export interface PuckNode {
  type: string;
  props?: Record<string, unknown>;
}

export interface PageLayout {
  root: {
    props?: Record<string, unknown>;
  };
  content: PuckNode[];
  zones?: Record<string, PuckNode[]>;
  /**
   * Layout schema version. 2 = canonical nested-composition shape built by
   * the seeds. All new layouts are produced directly in this shape.
   */
  schemaVersion?: 2;
}

export interface SavedSectionRecord {
  id: string;
  tenantId: string;
  name: string;
  /** The container node (usually a section) with its slot children inline. */
  node: PuckNode;
  /** Legacy DropZone-era entries. Accepted on read, merged inline, never written by new code. */
  zones?: Record<string, PuckNode[]>;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PageRecord {
  id: string;
  tenantId: string;
  slug: string;
  title: string;
  layout: PageLayout;
  status: PageStatus;
  version: number;
  publishedAt: string | null;
  publishedById: string | null;
  updatedById: string | null;
  isSystem: boolean;
  showInNav: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  template: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PageVersionRecord {
  id: string;
  pageId: string;
  tenantId: string;
  version: number;
  layout: PageLayout;
  status: 'snapshot' | 'published';
  note: string | null;
  changedById: string | null;
  createdAt: string;
}

export const BUILDER_PAGE_SLUGS = ['home', 'academy-landing', 'products', 'feed', 'events', 'about', 'privacy', 'refunds', 'terms', 'edu-purchases'] as const;
export type BuilderPageSlug = (typeof BUILDER_PAGE_SLUGS)[number];

/* ------------------------------------------------------------------ slugs */

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Slugs the routing table already owns.
 *
 * A custom page cannot be served from these: Next.js resolves a real route
 * directory before a dynamic `[slug]`, so a page created at `/products` would
 * exist, publish cleanly, and then 404 for every visitor with no error anywhere.
 * The list is the union of the `(main)`, `(store)`, `(social)`, `(academy)` and
 * `(admin)` route folders plus the auth and checkout paths.
 */
export const RESERVED_SLUGS: readonly string[] = [
  // (main) — these are real folders and always win over [slug]
  'academy', 'about', 'privacy', 'terms', 'refunds', 'edu-purchases', 'events', 'feed', 'products',
  'groups', 'learning', 'sponsors', 'titan-tv', 'verify', 'ai', 'home',
  // reserved without a folder today, but the app must never grow one by accident
  'admin', 'api', 'login', 'logout', 'signup', 'account', 'settings',
  'cart', 'checkout', 'payments', 'orders', 'search', 'notifications',
  '_next', 'static', 'assets', 'well-known', 'favicon.ico', 'robots.txt', 'sitemap.xml',
  'wp-admin', 'wp-login.php',
];

export function normalizeSlug(input: string): string {
  return String(input ?? '')
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

export interface SlugValidation {
  ok: boolean;
  slug: string;
  reason?: 'empty' | 'format' | 'reserved' | 'system';
}

/**
 * One rule for every entry point. The admin create dialog, the duplicate action
 * and the PATCH endpoint all call this, so a slug that the UI accepts is a slug
 * the database accepts.
 */
export function validateSlug(input: string, options: { systemSlugs?: readonly string[] } = {}): SlugValidation {
  const slug = normalizeSlug(input);
  if (!slug) return { ok: false, slug, reason: 'empty' };
  if (slug.length > 100) return { ok: false, slug, reason: 'format' };
  if (!SLUG_PATTERN.test(slug)) return { ok: false, slug, reason: 'format' };
  // `systemSlugs` is checked first on purpose: every built-in slug is also a
  // reserved route, so checking `reserved` first would report the vaguer reason
  // and the more specific "this is a built-in page" branch would be dead code.
  if (options.systemSlugs?.includes(slug)) return { ok: false, slug, reason: 'system' };
  if (RESERVED_SLUGS.includes(slug)) return { ok: false, slug, reason: 'reserved' };
  return { ok: true, slug };
}

/* --------------------------------------------------------------- templates */

export const PAGE_TEMPLATES = ['blank', 'landing', 'content'] as const;
export type PageTemplate = (typeof PAGE_TEMPLATES)[number];

/* ------------------------------------------------------------- navigation */

export type NavItemType = 'page' | 'url' | 'group';

/**
 * A navigation item as the admin editor sees it: every field is editable and
 * nothing has been pruned, so a link to a disabled page is still visible (and
 * flagged) rather than silently missing.
 */
export interface NavItemInput {
  id?: string;
  label: string;
  labelAr?: string | null;
  type: NavItemType;
  href?: string | null;
  pageSlug?: string | null;
  children?: NavItemInput[];
  visible?: boolean;
  icon?: string | null;
  openInNewTab?: boolean;
}

/** A navigation item as the public navbar consumes it: resolved, pruned, localized. */
export interface NavItemView {
  id: string;
  label: string;
  type: NavItemType;
  href: string;
  pageSlug: string | null;
  openInNewTab: boolean;
  icon: string | null;
  children: NavItemView[];
}

/** The maximum nesting depth a navigation tree may have. See migration 025. */
export const NAV_MAX_DEPTH = 2;
