import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { BRAND_NAME } from '@/lib/brand';

/**
 * A tab title for a route whose page is a client component (and so cannot export metadata).
 *
 * Without one, these routes inherited the site-wide homepage title — every settings page, the
 * account area, checkout and most auth screens read the same in the tab strip, in history and to
 * a screen reader announcing the page. Use it from a `layout.tsx` next to the page:
 *
 *   export const generateMetadata = pageTitle('settingsBilling');
 *   export default PassThroughLayout;
 */
export function pageTitle(key: string) {
  return async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations('pageTitles');
    return brandedTitle(t(key));
  };
}

/**
 * A layout title that keeps the site suffix for the pages below it.
 *
 * A plain-string `title` in a layout discards the inherited `%s | Brand` template for every
 * route nested under it, so `/settings/account/security` lost its suffix and `/verify/[number]`
 * did too. Supplying `default` (this segment's own title — the inherited template adds the
 * suffix to it) and `template` (what the descendants get) keeps both.
 */
export function brandedTitle(text: string): Metadata {
  return { title: { default: text, template: `%s | ${BRAND_NAME}` } };
}

export function PassThroughLayout({ children }: { children: ReactNode }) {
  return children;
}

/**
 * Localized title + description (and, optionally, canonical and Open Graph) for a server page.
 * These pages exported a static English `metadata` object, so an Arabic visitor got an English
 * tab title, search snippet and link preview. Strings live under `pageMeta.<key>`.
 */
export function pageMeta(
  key: string,
  opts: { canonical?: string; noindex?: boolean; og?: boolean; description?: boolean } = {},
) {
  const withDescription = opts.description !== false;
  return async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations('pageMeta');
    const title = t(`${key}.title`);
    const meta: Metadata = { title };
    if (withDescription) meta.description = t(`${key}.description`);
    if (opts.canonical) meta.alternates = { canonical: opts.canonical };
    if (opts.noindex) meta.robots = { index: false, follow: false, nocache: true };
    if (opts.og) {
      meta.openGraph = {
        title: `${title} | ${BRAND_NAME}`,
        description: t(`${key}.ogDescription`),
        type: 'website',
        url: opts.canonical,
      };
    }
    return meta;
  };
}
