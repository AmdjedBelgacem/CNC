'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { LegalDocument } from '@/components/layout/legal-document';
import { useBuilderLivePreview } from '@/components/builder/live-preview-context';
import { useCanvasLocale } from '@/components/builder/canvas-locale';

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
  const { locale, dir, messages } = useCanvasLocale();
  const marker = useRef<HTMLSpanElement>(null);

  // The canvas is its own document (Puck's iframe). Direction and language are set on that
  // document's root, exactly where the public layout sets them, so `rtl:` variants, logical
  // properties and fonts resolve the same way they do for a visitor.
  useLayoutEffect(() => {
    const root = marker.current?.ownerDocument?.documentElement;
    if (!root) return;
    const apply = () => {
      if (root.dir !== dir) root.dir = dir;
      if (root.lang !== locale) root.lang = locale;
    };
    apply();
    // Puck mirrors the host page's <html> attributes into the frame, which put the admin's
    // own direction back on the canvas. Re-assert the canvas language whenever that happens.
    const observer = new MutationObserver(apply);
    observer.observe(root, { attributes: true, attributeFilter: ['dir', 'lang'] });
    return () => observer.disconnect();
  }, [dir, locale]);

  const framed =
    preview && LEGAL_PAGES.has(preview.pageSlug) ? <LegalDocument progress={false}>{children}</LegalDocument> : <>{children}</>;
  return (
    <>
      <span ref={marker} hidden />
      {messages ? (
        <NextIntlClientProvider locale={locale} messages={messages as never}>
          {framed}
        </NextIntlClientProvider>
      ) : (
        framed
      )}
    </>
  );
}
