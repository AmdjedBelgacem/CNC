import type { Metadata } from 'next';
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://titansofmanufacturing.com';
export function createPageMetadata(title: string, description: string, path: string): Metadata {
  const url = `${BASE_URL}${path}`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: 'TITANS of Manufacturing',
      images: [{ url: `${BASE_URL}/og.png`, width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}
