import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { HomeBuilder } from '@/components/home/home-builder';
import { fetchPublishedAcademies } from '@/lib/academies';
import { resolvePageLayout } from '@/lib/builder/theme';
import { DEFAULT_TENANT_SLUG } from '@/lib/tenant-config';
export const metadata: Metadata = {
  title: 'Machinist Pro | Master CNC Machining',
  description:
    'Master CNC machining through expert-led, simulation-first courses, technical resources, and industry-recognized manufacturing certifications.',
  keywords: [
    'CNC training',
    'CNC certification',
    'manufacturing academy',
    '5-axis machining',
    'CNC courses',
    'G-code training',
  ],
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Engineering Precision | TITANS CNC Academy',
    description: 'Expert-led CNC education built for modern manufacturing professionals.',
    type: 'website',
    url: '/',
  },
};
export default async function HomePage() {
  const cookieStore = await cookies();
  const tenantSlug = cookieStore.get('x-tenant-slug')?.value || DEFAULT_TENANT_SLUG;
  const [layout, academies] = await Promise.all([
    resolvePageLayout(tenantSlug, 'home'),
    fetchPublishedAcademies(tenantSlug),
  ]);
  // JSON-LD reflects live catalog data, never hardcoded course names.
  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'EducationalOrganization',
    name: 'Ahmad CNC',
    description: 'Expert-led CNC manufacturing education and professional certification.',
    url: 'https://titansofmanufacturing.com',
    sameAs: [],
    ...(academies.length > 0
      ? {
          hasOfferCatalog: {
            '@type': 'OfferCatalog',
            name: 'CNC Manufacturing Academies',
            itemListElement: academies.slice(0, 10).map((a) => ({
              '@type': 'Course',
              name: a.title,
              description: a.description || a.subtitle || undefined,
              url: `/academy/${a.slug}`,
            })),
          },
        }
      : {}),
  };
  return (
    <div>
      {' '}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />{' '}
      <HomeBuilder layout={layout} academies={academies} />{' '}
    </div>
  );
}
