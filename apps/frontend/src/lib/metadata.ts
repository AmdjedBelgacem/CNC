import type { Metadata } from 'next';
import { BRAND_NAME, SITE_URL, absoluteUrl, OG_IMAGE } from './brand';

/**
 * Canonical + Open Graph metadata for a page.
 *
 * `alternates.canonical` was previously missing here entirely, so most pages shipped no
 * canonical at all and search engines had to guess. It is now always emitted from the one
 * `SITE_URL` origin.
 */
export function createPageMetadata(title: string, description: string, path: string): Metadata {
  const url = absoluteUrl(path);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      title,
      description,
      url,
      siteName: BRAND_NAME,
      images: [OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [OG_IMAGE.url],
    },
  };
}

/**
 * Same as {@link createPageMetadata} but for pages that must never be indexed
 * (login, register, notifications, cart, checkout internals).
 */
export function createNoindexMetadata(title: string, description: string, path: string): Metadata {
  return {
    ...createPageMetadata(title, description, path),
    robots: { index: false, follow: false, nocache: true },
  };
}

export { BRAND_NAME, SITE_URL };
