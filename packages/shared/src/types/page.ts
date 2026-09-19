export type PageStatus = 'draft' | 'published';

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

export const BUILDER_PAGE_SLUGS = ['home', 'academy-landing', 'about', 'privacy', 'refunds', 'terms', 'edu-purchases'] as const;
export type BuilderPageSlug = (typeof BUILDER_PAGE_SLUGS)[number];
