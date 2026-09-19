import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { ArrowRight, GraduationCap } from 'lucide-react';
import { fetchPublishedAcademies } from '@/lib/academies';
import { DEFAULT_TENANT_SLUG } from '@/lib/tenant-config';
import { AcademyCard } from '@/components/academy/academy-card';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Academies',
  description:
    'Browse branded academies — each with its own courses, hero art, and SEO-optimized landing page.',
  alternates: { canonical: '/academy' },
  openGraph: {
    title: 'Academies | TITANS of Manufacturing',
    description: 'Branded academy destinations with courses, hero art, and learning paths.',
    type: 'website',
    url: '/academy',
  },
};

export default async function AcademyPage() {
  const cookieStore = await cookies();
  const tenantSlug = cookieStore.get('x-tenant-slug')?.value || DEFAULT_TENANT_SLUG;

  // Real backend data — only published, non-archived academies for this tenant.
  const academies = await fetchPublishedAcademies(tenantSlug);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Academies',
    itemListElement: academies.map((a, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Course',
        name: a.title,
        description: a.description || a.subtitle || undefined,
        image: a.heroImageUrl || a.seoImageUrl || undefined,
        url: `/academy/${a.slug}`,
      },
    })),
  };

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-12 md:px-10 md:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="mb-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
        <div className="max-w-xl">
          <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary">
            <GraduationCap className="h-4 w-4" /> Academies
          </p>
          <h1 className="font-display mb-4 text-[40px] font-semibold leading-[1.15] md:text-[44px]">
            Choose your academy
          </h1>
          <p className="leading-6 text-muted-foreground">
            Branded destinations, each with its own hero art, courses, and SEO landing page.
            {academies.length > 0
              ? ` ${academies.length} ${academies.length === 1 ? 'academy' : 'academies'} live.`
              : ' New academies appear here once published.'}
          </p>
        </div>
        <Link
          href="/courses"
          className="group inline-flex min-h-11 items-center rounded-full border border-violet-600/20 px-6 text-xs font-bold uppercase tracking-wider text-[#7c3aed] transition hover:bg-violet-600/5"
        >
          View all courses <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>

      {academies.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-gray-300 py-24 text-center dark:border-[#38383A]">
          <GraduationCap className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <h2 className="text-lg font-semibold">No academies published yet</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Publish an academy from Admin → Academies. It will show up here with its uploaded
            hero, logo, and SEO image — no external URLs needed.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {academies.map((a) => (
            <AcademyCard key={a.id} academy={a} />
          ))}
        </div>
      )}
    </div>
  );
}
