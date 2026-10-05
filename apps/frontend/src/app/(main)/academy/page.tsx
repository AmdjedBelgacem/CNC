import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { HomeBuilder } from '@/components/home/home-builder';
import { AcademyPathways } from '@/components/academy/academy-pathways';
import { academyHeroStats } from '@/components/academy/academy-hero-stats';
import { fetchPublishedAcademies } from '@/lib/academies';
import { resolvePageLayout } from '@/lib/builder/theme';
import { DEFAULT_TENANT_SLUG } from '@/lib/tenant-config';
import { serializeJsonLd } from '@/lib/json-ld';

export const metadata: Metadata = {
  title: 'Academies',
  description:
    'Browse branded academies — each with its own courses, hero art, and SEO-optimized landing page.',
  alternates: { canonical: '/academy' },
  openGraph: {
    title: 'Academies | Baroot CNC Solutions',
    description: 'Branded academy destinations with courses, hero art, and learning paths.',
    type: 'website',
    url: '/academy',
  },
};

export default async function AcademyPage() {
  const cookieStore = await cookies();
  const tenantSlug = cookieStore.get('x-tenant-slug')?.value || DEFAULT_TENANT_SLUG;
  const [layout, academies] = await Promise.all([
    resolvePageLayout(tenantSlug, 'academy-landing'),
    fetchPublishedAcademies(tenantSlug),
  ]);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Academies',
    itemListElement: academies.map((academy, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Course',
        name: academy.title,
        description: academy.description || academy.subtitle || undefined,
        image: academy.heroImageUrl || academy.seoImageUrl || undefined,
        url: `/academy/${academy.slug}`,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <HomeBuilder
        layout={layout}
        academies={academies}
        heroStats={academyHeroStats(academies)}
        islands={{
          'academy-pathways': <AcademyPathways academies={academies} />,
        }}
      />
    </>
  );
}
