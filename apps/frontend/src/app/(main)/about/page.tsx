import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getLocale } from 'next-intl/server';
import { coerceLocale } from '@/i18n/config';
import { HomeBuilder } from '@/components/home/home-builder';
import { AboutFactsSection } from '@/components/home/home-extras';
import { liveIslandSlot } from '@/components/home/live-island-header';
import { resolvePageLayout } from '@/lib/builder/theme';
import { ensureParitySections } from '@titan/shared';
import { DEFAULT_TENANT_SLUG } from '@/lib/tenant-config';
import { BRAND_NAME, OG_IMAGE, absoluteUrl } from '@/lib/brand';
import { aboutJsonLd } from '@/lib/schema';
import { serializeJsonLd } from '@/lib/json-ld';

export const metadata: Metadata = {
  title: `About ${BRAND_NAME}`,
  description: `${BRAND_NAME} teaches CNC machining through simulation-first courses and industry-recognised certification, serving machinists, engineers and manufacturing teams.`,
  // Was the relative '/about', which resolved against the wrong metadataBase and produced
  // a canonical pointing at a different origin than the one serving the page.
  alternates: { canonical: absoluteUrl('/about') },
  openGraph: {
    type: 'profile',
    title: `About ${BRAND_NAME}`,
    description: `Who ${BRAND_NAME} is, what it teaches, and who it serves.`,
    url: absoluteUrl('/about'),
    siteName: BRAND_NAME,
    images: [OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: `About ${BRAND_NAME}`,
    description: `Who ${BRAND_NAME} is, what it teaches, and who it serves.`,
    images: [OG_IMAGE.url],
  },
};

export default async function AboutPage() {
  const locale = coerceLocale(await getLocale());
  const cookieStore = await cookies();
  const tenantSlug = cookieStore.get('x-tenant-slug')?.value || DEFAULT_TENANT_SLUG;
  const layout = ensureParitySections(await resolvePageLayout(tenantSlug, 'about'), 'about');

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(aboutJsonLd()) }}
      />
      <HomeBuilder
        layout={layout}
        islands={{
          'about-facts': (
            <AboutFactsSection
              header={liveIslandSlot(layout, 'about-facts', 'header', locale)}
              items={liveIslandSlot(layout, 'about-facts', 'items', locale)}
              footer={liveIslandSlot(layout, 'about-facts', 'footer', locale)}
            />
          ),
        }}
      />
    </>
  );
}
