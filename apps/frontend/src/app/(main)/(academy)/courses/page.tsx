import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { CourseGrid } from './course-grid';
import { CategoryFilter } from '@/components/academy/category-filter';
import { Skeleton, SkeletonCourseCard } from '@/components/ui/skeleton';

export async function generateMetadata() {
  const t = await getTranslations('courses');
  return {
    title: `${t('title')} — TITANS of Manufacturing`,
    description: t('subtitle'),
  };
}

export default function CoursesPage() {
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
        <CourseGrid />
      </Suspense>
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
