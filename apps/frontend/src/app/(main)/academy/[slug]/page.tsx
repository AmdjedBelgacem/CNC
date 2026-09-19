import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, BookOpen, GraduationCap } from 'lucide-react';
import { fetchAcademyDetail, fetchPublishedAcademies } from '@/lib/academies';
import { DEFAULT_TENANT_SLUG } from '@/lib/tenant-config';
import { CourseCard } from '@/components/academy/course-card';

export const revalidate = 60;

type Props = { params: Promise<{ slug: string }> };

async function getTenantSlug(): Promise<string> {
  const cookieStore = await cookies();
  return cookieStore.get('x-tenant-slug')?.value || DEFAULT_TENANT_SLUG;
}

export async function generateStaticParams() {
  // Best-effort pre-render of published academies; fallback is dynamic render.
  try {
    const academies = await fetchPublishedAcademies(DEFAULT_TENANT_SLUG);
    return academies.map((a) => ({ slug: a.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { slug } = await props.params;
  const tenantSlug = await getTenantSlug();
  const academy = await fetchAcademyDetail(tenantSlug, slug);
  if (!academy) return { title: 'Academy not found' };

  const title = academy.seoTitle?.trim() || academy.title;
  const description =
    academy.seoDescription?.trim() || academy.description || academy.subtitle || 'Academy landing page';
  const ogImage = academy.seoImageUrl || academy.heroImageUrl || academy.logoUrl || undefined;

  return {
    title,
    description: description.slice(0, 160),
    alternates: { canonical: `/academy/${academy.slug}` },
    openGraph: {
      title,
      description: description.slice(0, 200),
      type: 'website',
      url: `/academy/${academy.slug}`,
      ...(ogImage ? { images: [{ url: ogImage, width: 1200, height: 630, alt: academy.title }] } : {}),
    },
    twitter: {
      card: ogImage ? 'summary_large_image' : 'summary',
      title,
      description: description.slice(0, 200),
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}

export default async function AcademyDetailPage(props: Props) {
  const { slug } = await props.params;
  const tenantSlug = await getTenantSlug();
  const academy = await fetchAcademyDetail(tenantSlug, slug);
  if (!academy) notFound();

  const accent = academy.accentColor || '#7c3aed';
  const hero = academy.heroImageUrl || academy.seoImageUrl;
  const courses = academy.courses ?? [];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: academy.seoTitle || academy.title,
    description: academy.seoDescription || academy.description || academy.subtitle,
    image: academy.seoImageUrl || hero || undefined,
    url: `/academy/${academy.slug}`,
    hasCourseInstance: courses.map((c) => ({
      '@type': 'CourseInstance',
      courseMode: 'online',
      courseWorkload: c.estimatedHours ? `PT${c.estimatedHours}H` : undefined,
      url: `/courses/${c.slug}`,
    })),
  };

  return (
    <div className="min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Hero — uploaded branding art, not external URLs */}
      <div className="relative overflow-hidden border-b">
        {hero ? (
          <div className="relative h-[280px] w-full md:h-[360px]">
            {/* Plain <img>: MinIO/S3 upload URL, no next/image remote-pattern dependency */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={hero}
              alt={academy.title}
              loading="eager"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
          </div>
        ) : (
          <div className="h-[180px] w-full" style={{ backgroundColor: `${accent}14` }} />
        )}
        <div className="container relative mx-auto px-4">
          <div className={hero ? '-mt-16 pb-8 md:-mt-20' : 'py-10'}>
            <Link
              href="/academy"
              className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> All academies
            </Link>
            <div className="flex flex-wrap items-end gap-5">
              {academy.logoUrl ? (
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-white/60 bg-white shadow-lg md:h-24 md:w-24">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={academy.logoUrl} alt="" className="h-full w-full object-cover" />
                </div>
              ) : (
                <div
                  className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl shadow-lg md:h-24 md:w-24"
                  style={{ backgroundColor: `${accent}18` }}
                >
                  <GraduationCap className="h-10 w-10" style={{ color: accent }} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h1
                  className={
                    hero
                      ? 'text-3xl font-bold tracking-tight text-white drop-shadow md:text-4xl'
                      : 'text-3xl font-bold tracking-tight md:text-4xl'
                  }
                >
                  {academy.title}
                </h1>
                {academy.subtitle ? (
                  <p className={hero ? 'mt-1 text-white/85' : 'mt-1 text-lg text-muted-foreground'}>
                    {academy.subtitle}
                  </p>
                ) : null}
                <p className={`mt-2 flex items-center gap-1.5 text-sm ${hero ? 'text-white/80' : 'text-muted-foreground'}`}>
                  <BookOpen className="h-4 w-4" />
                  {academy.courseCount} {academy.courseCount === 1 ? 'course' : 'courses'}
                  <span
                    className="ml-2 inline-block h-2 w-10 rounded-full"
                    style={{ backgroundColor: accent }}
                    aria-hidden
                  />
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10">
        {academy.description ? (
          <p className="max-w-3xl whitespace-pre-line leading-relaxed text-muted-foreground">
            {academy.description}
          </p>
        ) : null}

        <h2 className="mb-6 mt-10 text-2xl font-bold">
          Courses in this academy {courses.length > 0 ? `(${courses.length})` : ''}
        </h2>
        {courses.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-gray-300 py-16 text-center dark:border-[#38383A]">
            <BookOpen className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Courses will appear here once they are assigned and published.
            </p>
            <Link href="/courses" className="mt-4 text-sm font-bold" style={{ color: accent }}>
              Browse all courses
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => (
              <CourseCard
                key={c.id}
                slug={c.slug}
                title={c.title}
                subtitle={c.subtitle}
                thumbnailUrl={c.thumbnailUrl}
                difficulty={c.difficulty ?? 1}
                estimatedHours={c.estimatedHours}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
