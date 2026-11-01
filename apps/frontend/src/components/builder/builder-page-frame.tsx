'use client';

import type { ReactNode } from 'react';
import { LegalDocument } from '@/components/layout/legal-document';
import { useBuilderLivePreview } from '@/components/builder/live-preview-context';

/**
 * Pages whose public route wraps the block output in a frame of its own.
 *
 * Keep this in step with the routes: `privacy`, `terms` and `refunds` render
 * `<LegalDocument><BlockRenderer/></LegalDocument>`. The canvas used to draw the
 * bare blocks, so an author edited a page that looked different from the one
 * they published.
 */
const LEGAL_PAGES = new Set(['privacy', 'terms', 'refunds']);

/** Puck `root.render`: wraps the canvas content in the same frame production uses. */
export function BuilderPageFrame({ children }: { children: ReactNode }) {
  const preview = useBuilderLivePreview();
  if (preview && LEGAL_PAGES.has(preview.pageSlug)) {
    return <LegalDocument progress={false}>{children}</LegalDocument>;
  }
  return <>{children}</>;
}
