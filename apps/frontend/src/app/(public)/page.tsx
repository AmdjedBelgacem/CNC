import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getLocale } from 'next-intl/server';
import { coerceLocale } from '@/i18n/config';
import { HomeBuilder } from '@/components/home/home-builder';
import { fetchPublishedAcademies } from '@/lib/academies';
import { fetchPublishedCourses } from '@/lib/courses';
import { fetchPublishedSponsors } from '@/lib/sponsors';
import { applyLiveHomeMetrics, buildLiveHomeMetrics } from '@/lib/home-metrics';
import { resolvePageLayout } from '@/lib/builder/theme';
import { ensureParitySections } from '@titan/shared';
import { DEFAULT_TENANT_SLUG } from '@/lib/tenant-config';
import { serializeJsonLd } from '@/lib/json-ld';
import { BRAND_NAME, OG_IMAGE, SITE_URL, absoluteUrl, organizationJsonLd, webSiteJsonLd } from '@/lib/brand';
import { faqJsonLd, breadcrumbJsonLd } from '@/lib/schema';
import { HOMEPAGE_FAQ } from '@/lib/faq-content';
import { HomeFaqSection, HomeGuidesSection } from '@/components/home/home-extras';
export const metadata: Metadata = {
  title: 'CNC Machining Courses & Certification',
  description:
    'Baroot CNC Solutions delivers simulation-first CNC machining courses, technical resources and industry-recognised certification for machinists, engineers and manufacturing teams.',
  keywords: [
    'CNC training',
    'CNC certification',
    'manufacturing academy',
    '5-axis machining',
    'CNC courses',
    'G-code training',
  ],
  alternates: { canonical: absoluteUrl('/') },
  openGraph: {
    title: `${BRAND_NAME} | CNC Machining Courses & Certification`,
    description:
      'Simulation-first CNC machining courses, technical resources and industry-recognised certification for manufacturing professionals.',
    type: 'website',
    url: absoluteUrl('/'),
    siteName: BRAND_NAME,
    // The homepage previously shipped no og:image at all, so every share of the most
    // important URL rendered without a preview card.
    images: [OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${BRAND_NAME} | CNC Machining Courses & Certification`,
    description:
      'Simulation-first CNC machining courses and industry-recognised certification for manufacturing professionals.',
    images: [OG_IMAGE.url],
  },
};
export default async function HomePage() {
  const cookieStore = await cookies();
  const tenantSlug = cookieStore.get('x-tenant-slug')?.value || DEFAULT_TENANT_SLUG;
  const locale = coerceLocale(await getLocale());
  const [rawLayout, academies, courses, sponsors] = await Promise.all([
    resolvePageLayout(tenantSlug, 'home', locale),
    fetchPublishedAcademies(tenantSlug),
    fetchPublishedCourses(tenantSlug, 6, locale),
    fetchPublishedSponsors(tenantSlug),
  ]);
  const courseTotal =
    academies.reduce((sum, a) => sum + (a.courseCount || 0), 0) || courses.length;
  // Bake live counts into the layout on the server so SSR HTML and client
  // hydration always match (no client-side text rewrites).
  const layout = applyLiveHomeMetrics(
    ensureParitySections(rawLayout, 'home'),
    buildLiveHomeMetrics({
      academyCount: academies.length,
      courseCount: courseTotal,
      sponsorCount: sponsors.length,
    }),
  );
  // JSON-LD reflects live catalog data, never hardcoded course names.
  const organizationNode = {
    '@context': 'https://schema.org',
    ...organizationJsonLd(),
    ...(academies.length > 0
      ? {
          hasOfferCatalog: {
            '@type': 'OfferCatalog',
            name: 'CNC Manufacturing Academies',
            itemListElement: academies.slice(0, 10).map((a) => ({
              '@type': 'Course',
              name: a.title,
              description: a.description || a.subtitle || undefined,
              url: absoluteUrl(`/academy/${a.slug}`),
              provider: { '@id': `${SITE_URL}/#organization` },
            })),
          },
        }
      : {}),
  };
  const websiteNode = { '@context': 'https://schema.org', ...webSiteJsonLd() };
  // Question/answer pairs, so answer engines can lift a clean Q->A instead of scraping prose.
  const faqNode = { '@context': 'https://schema.org', ...faqJsonLd(HOMEPAGE_FAQ) };
  const breadcrumbNode = {
    '@context': 'https://schema.org',
    ...breadcrumbJsonLd([{ name: 'Home', path: '/' }]),
  };
  return (
    <div>
      {' '}
      {[organizationNode, websiteNode, faqNode, breadcrumbNode].map((node, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(node) }}
        />
      ))}{' '}
      <HomeBuilder
        layout={layout}
        academies={academies}
        academyLimit={4}
        courses={courses}
        sponsors={sponsors}
        islands={{
          'home-faq': <HomeFaqSection />,
          'home-guides': <HomeGuidesSection />,
        }}
      />{' '}
    </div>
  );
}
