import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { CourseGrid } from './course-grid';
import { CategoryFilter } from '@/components/academy/category-filter';
import { Skeleton, SkeletonCourseCard } from '@/components/ui/skeleton';
import { fetchPublishedCourses } from '@/lib/courses';
import { DEFAULT_TENANT_SLUG } from '@/lib/tenant-config';
import { BRAND_NAME, OG_IMAGE, absoluteUrl } from '@/lib/brand';
import { breadcrumbJsonLd } from '@/lib/schema';
import { serializeJsonLd } from '@/lib/json-ld';
import type { ContentLocale } from '@titan/shared';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('courses');
  const title = `${t('title')} | CNC Machining Courses`;
  const description = t('subtitle');
  return {
    title,
    description,
    alternates: { canonical: absoluteUrl('/courses') },
    openGraph: {
      type: 'website',
      title,
      description,
      url: absoluteUrl('/courses'),
      siteName: BRAND_NAME,
      images: [OG_IMAGE],
    },
    twitter: { card: 'summary_large_image', title, description, images: [OG_IMAGE.url] },
  };
}

/**
 * Server component: the listing is fetched here so the first HTML response contains real
 * course cards instead of a skeleton grid.
 */
export default async function CoursesPage() {
  const locale = (await getLocale()) as ContentLocale;
  const courses = await fetchPublishedCourses(DEFAULT_TENANT_SLUG, 60, locale).catch(() => []);
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 border-b border-border pb-8">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Course Library
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Project-based CNC courses from beginner to master. Each course includes video lessons,
          downloadable CAD files, process sheets, and a certificate of completion.
        </p>
      </div>

      {/* Both children read search params, so each needs its own boundary — that
          is also what lets the filter appear instantly while the grid's data is
          still resolving. `fallback={null}` was the old value here, which meant
          a blank gap under the heading on every cold load. */}
      <Suspense fallback={<CategoryFilterSkeleton />}>
        <CategoryFilter />
      </Suspense>

      <Suspense fallback={<CourseGridSkeleton />}>
        <CourseGrid initialCourses={{ data: courses as never[] }} />
      </Suspense>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(
            breadcrumbJsonLd([
              { name: 'Home', path: '/' },
              { name: 'Courses', path: '/courses' },
            ]),
          ),
        }}
      />
    </div>
  );
}

/**
 * Placeholder for `<CategoryFilter>`: the filter bar's own height, so the
 * heading above it doesn't shift when the real control resolves.
 */
function CategoryFilterSkeleton() {
  return (
    <div
      className="flex flex-wrap gap-2"
      role="status"
      aria-busy="true"
      aria-label="Loading filters"
    >
      <span className="sr-only">Loading filters</span>
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-28 rounded-full" />
      ))}
    </div>
  );
}

/**
 * Placeholder for `<CourseGrid>`.
 *
 * A reduced card count (6 rather than 9) on purpose: this shows while the
 * server is still working, and a short list that grows reads as "more is
 * arriving" whereas a long one that disappears and reappears reads as a glitch.
 */
function CourseGridSkeleton() {
  return (
    <div
      className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
      role="status"
      aria-busy="true"
      aria-label="Loading courses"
    >
      <span className="sr-only">Loading courses</span>
      {Array.from({ length: 6 }).map((_, i) => (
        <SkeletonCourseCard key={i} />
      ))}
    </div>
  );
}
