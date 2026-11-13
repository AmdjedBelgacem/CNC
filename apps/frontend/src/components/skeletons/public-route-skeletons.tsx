'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Repeat, SkeletonRegion } from '@/components/ui/skeletons/region';
import { useRememberedListCount } from '@/lib/admin-shape-memory';
import {
  CertificateListSkeleton,
  CourseFilterSkeleton,
  CourseGridSkeleton,
  DifficultyBarSkeleton,
  EmptyStateSkeleton,
  EnrollmentRowSkeleton,
  LanguageLineSkeleton,
  PublicPageHeaderSkeleton,
} from '@/components/ui/skeletons/public';
import { cn } from '@/lib/utils';

/* -----------------------------------------------------------------------------
 * Public route skeletons. One composition per route; each copies the real
 * page's containers (max-width, gutters, vertical padding, grid tracks) and
 * replaces only the content. `*Body` variants omit the region and the page
 * chrome so a client component can render the same shape in its own loading
 * branch, inside a page that already drew its chrome.
 * --------------------------------------------------------------------------- */

/* ── /courses ────────────────────────────────────────────────────────────── */

/**
 * `app/(main)/(academy)/courses/page.tsx`. The filter only renders when there are
 * academies, and an empty catalogue shows `EmptyState`; both counts are remembered by
 * `CategoryFilter` and `CourseGrid`.
 */
export function CoursesIndexSkeleton() {
  const academies = useRememberedListCount('public-course-academies', 4, 20);
  const courses = useRememberedListCount('public-courses', 6, 12);
  return (
    <SkeletonRegion>
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-16 lg:px-8">
        <PublicPageHeaderSkeleton leadLines={3} />
        {academies > 0 ? (
          <CourseFilterSkeleton chips={[32, 96, 120, 84, 104, 88, 112].slice(0, Math.min(academies + 1, 7))} />
        ) : null}
        <div className="space-y-8">
          {courses === 0 ? <EmptyStateSkeleton descriptionLines={1} /> : <CourseGridSkeleton count={courses} />}
        </div>
      </div>
    </SkeletonRegion>
  );
}

/* ── /courses/[slug] ─────────────────────────────────────────────────────── */

function HeroStatSkeleton({ width }: { width: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <Skeleton className="size-8 rounded-full" />
      <Skeleton className={cn('h-3', width)} />
    </div>
  );
}

function StatTileSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border/70 bg-card p-5 shadow-xs">
      <Skeleton className="size-10 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1">
        <Skeleton className="h-6 w-10" />
        <Skeleton className="mt-1.5 h-2.5 w-20" />
      </div>
    </div>
  );
}

function SectionHeadingSkeleton({ className, titleWidth = 'w-56' }: { className?: string; titleWidth?: string }) {
  return (
    <div className={className}>
      <Skeleton className="h-2.5 w-24" />
      {/* text-3xl / sm:text-4xl → 36px / 40px line boxes. */}
      <div className="mt-3 flex h-9 items-center sm:h-10">
        <Skeleton className={cn('h-7 max-w-full sm:h-8', titleWidth)} />
      </div>
    </div>
  );
}

function CurriculumSeriesSkeleton({ open, index }: { open: boolean; index: number }) {
  return (
    <div className={cn('overflow-hidden rounded-xl border bg-card', open ? 'border-border shadow-sm' : 'border-border/70 shadow-xs')}>
      <div className="flex items-center gap-4 px-4 py-4 sm:px-5">
        <Skeleton className={cn('size-10 shrink-0 rounded-full', open && 'bg-primary/25')} />
        <div className="min-w-0 flex-1">
          <div className="flex h-7 items-center">
            <Skeleton className={cn('h-4', ['w-1/2', 'w-2/5', 'w-3/5'][index % 3])} />
          </div>
          <Skeleton className="mt-0.5 h-2.5 w-28" />
        </div>
        <Skeleton className="hidden h-2.5 w-16 sm:block" />
        <Skeleton className="size-4 rounded" shimmer={false} />
      </div>
      {open && (
        <div className="divide-y divide-border/50 border-t border-border/60">
          <Repeat count={3}>
            {(i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                <Skeleton className="size-8 shrink-0 rounded-full" />
                <Skeleton className={cn('h-3', ['w-1/2', 'w-3/5', 'w-2/5'][i % 3])} />
                <Skeleton className="ms-auto h-2.5 w-10" />
              </div>
            )}
          </Repeat>
        </div>
      )}
    </div>
  );
}

function SideCardSkeleton({ lines = 2 }: { lines?: number }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-6 shadow-xs">
      <div className="flex items-center gap-3">
        <Skeleton className="size-9 rounded-full" />
        <Skeleton className="h-4 w-28" />
      </div>
      <div className="mt-4 space-y-3">
        <Repeat count={lines}>{(i) => <Skeleton key={i} className={cn('h-3', i === lines - 1 ? 'w-2/3' : 'w-full')} />}</Repeat>
      </div>
    </div>
  );
}

/** `courses/[slug]/course-detail-client.tsx`: hero, overview with brief card, curriculum. */
export function CourseDetailSkeleton() {
  return (
    <SkeletonRegion>
      <div className="min-h-screen bg-background">
        <section className="relative isolate overflow-hidden border-b border-border/70">
          <div className="container relative mx-auto px-4 pt-6 sm:px-6 lg:px-8">
            <div className="flex h-5 items-center gap-2">
              <Skeleton className="size-4 rounded" shimmer={false} />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
          <div className="container relative mx-auto grid gap-12 px-4 pb-14 pt-10 sm:px-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(26rem,1.05fr)] lg:items-center lg:gap-14 lg:px-8 lg:pb-20 lg:pt-14">
            <div className="min-w-0">
              <div className="mb-6 flex flex-wrap items-center gap-3">
                <Skeleton className="h-9 w-56 max-w-full rounded-full" />
                <Skeleton className="h-2.5 w-24" />
              </div>
              {/* text-4xl/5xl/6xl at leading-[1.05], two lines. */}
              <div className="space-y-2">
                <Skeleton className="h-9 w-11/12 sm:h-11 lg:h-14" />
                <Skeleton className="h-9 w-3/5 sm:h-11 lg:h-14" />
              </div>
              <div className="mt-5 max-w-2xl space-y-3 py-1">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3 border-y border-border/70 py-4">
                <HeroStatSkeleton width="w-24" />
                <HeroStatSkeleton width="w-20" />
                <HeroStatSkeleton width="w-24" />
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Skeleton className="h-12 w-full rounded-full bg-primary/25 sm:w-64" />
                <Skeleton className="h-12 w-36 rounded-full border border-border bg-card" />
              </div>
              <LanguageLineSkeleton className="mt-6" />
            </div>
            <div className="relative mx-auto w-full max-w-2xl lg:max-w-none">
              <Skeleton className="aspect-video w-full rounded-2xl border border-border/70 shadow-xl" />
              <div className="mt-3 flex items-center justify-between px-1">
                <Skeleton className="h-2.5 w-24" />
                <Skeleton className="h-2.5 w-20" />
              </div>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-16">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <Skeleton className="h-2.5 w-28" />
                <Skeleton className="h-[22px] w-28 rounded-full" />
              </div>
              <div className="mt-4 space-y-2">
                <Skeleton className="h-8 w-4/5" />
              </div>
              <div className="mt-5 max-w-prose space-y-5 py-2">
                <Repeat count={4}>{(i) => <Skeleton key={i} className={cn('h-3.5', i === 3 ? 'w-1/2' : 'w-full')} />}</Repeat>
              </div>
              <div className="mt-10 grid gap-3 sm:grid-cols-3">
                <StatTileSkeleton />
                <StatTileSkeleton />
                <StatTileSkeleton />
              </div>
            </div>
            <div className="h-fit overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
              <div className="border-b border-border/60 bg-muted/40 px-6 py-5">
                <Skeleton className="h-2.5 w-24" />
                <div className="mt-3 flex items-end justify-between gap-3">
                  <Skeleton className="h-8 w-32" />
                  <Skeleton className="h-[22px] w-20 rounded-full" />
                </div>
              </div>
              <div className="space-y-4 p-6">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <Skeleton className="h-2.5 w-12" />
                    <Skeleton className="h-2.5 w-20" />
                  </div>
                  <DifficultyBarSkeleton />
                </div>
                <Repeat count={2}>
                  {(i) => (
                    <div key={i} className="flex items-center justify-between gap-3 border-t border-border/60 pt-4">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  )}
                </Repeat>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-border/70 bg-muted/30">
          <div className="container mx-auto px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <SectionHeadingSkeleton titleWidth="w-48" />
              <Skeleton className="h-3 w-40" />
            </div>
            <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-12">
              <div className="min-w-0 space-y-3">
                <Repeat count={4}>{(i) => <CurriculumSeriesSkeleton key={i} open={i === 0} index={i} />}</Repeat>
              </div>
              <div className="space-y-4 lg:pt-1">
                <SideCardSkeleton lines={2} />
                <SideCardSkeleton lines={4} />
              </div>
            </div>
          </div>
        </section>
      </div>
    </SkeletonRegion>
  );
}

/* ── /courses/[slug]/lessons/[lessonSlug] ────────────────────────────────── */

/**
 * The body `LessonPlayer` renders inside the lesson page's container: video,
 * header, content, completion bar, and the curriculum + resources rail.
 */
export function LessonPlayerBodySkeleton() {
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_19rem] xl:gap-14">
      <div className="min-w-0 space-y-8">
        <Skeleton className="aspect-video w-full rounded-2xl" />
        <div className="mx-auto max-w-3xl">
          <Skeleton className="mb-3 h-2.5 w-28" />
          <div className="flex flex-wrap items-start justify-between gap-4">
            {/* text-3xl / sm:text-4xl at leading-tight → 37.5px / 45px. */}
            <div className="flex h-[38px] min-w-0 flex-1 items-center sm:h-[45px]">
              <Skeleton className="h-7 w-3/4 sm:h-8" />
            </div>
            <Skeleton className="mt-1 h-[22px] w-14 rounded-full" />
          </div>
          <div className="mt-4 space-y-4 py-1.5">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-1/2" />
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Skeleton className="h-9 w-36 rounded-full" />
            <LanguageLineSkeleton />
          </div>
        </div>
        <div className="mx-auto max-w-3xl space-y-8">
          <div className="space-y-[18px] py-2">
            <Repeat count={5}>{(i) => <Skeleton key={i} className={cn('h-3.5', i === 4 ? 'w-2/5' : 'w-full')} />}</Repeat>
          </div>
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-xs">
            <Skeleton className="h-10 w-40 rounded-full bg-primary/25" />
            <div className="ms-auto flex items-center gap-2">
              <Skeleton className="h-9 w-28 rounded-full" />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-xs">
          <div className="flex items-baseline justify-between gap-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-2.5 w-8" />
          </div>
          <Skeleton className="mt-3 h-1 w-full rounded-full" shimmer={false} />
          <div className="mt-4">
            <Repeat count={6}>
              {(i) => (
                <div key={i} className="flex items-center gap-3 py-2 pe-2 ps-1">
                  <Skeleton className="size-[1.875rem] shrink-0 rounded-full" />
                  <Skeleton className={cn('h-3', ['w-3/4', 'w-1/2', 'w-2/3'][i % 3])} />
                </div>
              )}
            </Repeat>
          </div>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-xs">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-2 h-2.5 w-40" />
          <Skeleton className="mt-3 h-12 w-full rounded-lg" />
        </div>
        <Skeleton className="mx-auto h-9 w-full rounded-full" />
      </div>
    </div>
  );
}

/** `courses/[slug]/lessons/[lessonSlug]/page.tsx`: back bar plus the player. */
export function LessonPageSkeleton() {
  return (
    <SkeletonRegion>
      <div className="min-h-screen bg-background">
        <div className="border-b border-border/60">
          <div className="container mx-auto px-4 py-3">
            <div className="flex h-7 items-center gap-1.5">
              <Skeleton className="size-4 rounded" shimmer={false} />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
        </div>
        <div className="container mx-auto px-4 py-8 lg:py-10">
          <LessonPlayerBodySkeleton />
        </div>
      </div>
    </SkeletonRegion>
  );
}

/* ── /academy/[slug] ─────────────────────────────────────────────────────── */

function AcademyStatSkeleton({ inverse = false }: { inverse?: boolean }) {
  const tone = inverse ? 'bg-white/15' : undefined;
  return (
    <div className="flex items-center gap-3">
      <Skeleton className={cn('size-9 shrink-0 rounded-full', tone)} />
      <div className="min-w-0 space-y-1.5">
        <Skeleton className={cn('h-5 w-10', tone)} />
        <Skeleton className={cn('h-2.5 w-16', tone)} />
      </div>
    </div>
  );
}

function AcademyCourseCardSkeleton({ index }: { index: number }) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xs">
      <Skeleton className="m-2 mb-0 aspect-[16/9] rounded-xl" />
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex h-7 flex-1 items-center">
            <Skeleton className={cn('h-5', ['w-3/4', 'w-2/3'][index % 2])} />
          </div>
          <Skeleton className="size-8 shrink-0 rounded-full" />
        </div>
        <div className="mt-2 space-y-3 py-1.5">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <div className="mt-auto flex items-center gap-4 border-t border-border/60 pt-4">
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="h-2.5 w-12" />
          <Skeleton className="ms-auto h-2.5 w-16" />
        </div>
        <Skeleton className="mt-3 h-2.5 w-24" />
      </div>
    </div>
  );
}

/** `app/(main)/academy/[slug]/page.tsx`: dark hero, overview + glance card, course grid. */
export function AcademyDetailSkeleton() {
  return (
    <SkeletonRegion>
      <div className="min-h-screen bg-background">
        <section className="relative isolate min-h-[620px] overflow-hidden border-b border-border/70 bg-neutral-950 lg:min-h-[680px]">
          <div className="relative mx-auto flex min-h-[620px] max-w-container-max flex-col px-margin-mobile pb-12 pt-5 md:px-margin-desktop md:pb-16 lg:min-h-[680px]">
            <div className="flex h-7 items-center gap-2">
              <Skeleton className="size-4 rounded bg-white/15" shimmer={false} />
              <Skeleton className="h-3 w-32 bg-white/15" />
            </div>
            <div className="grid flex-1 items-end gap-10 pt-16 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-16">
              <div className="min-w-0">
                <div className="mb-5 flex flex-wrap items-center gap-3">
                  <Skeleton className="h-7 w-24 rounded-full bg-white/20" />
                  <Skeleton className="h-2.5 w-20 bg-white/10" />
                </div>
                <div className="space-y-3">
                  <Skeleton className="h-9 w-11/12 bg-white/15 sm:h-12 lg:h-16" />
                  <Skeleton className="h-9 w-1/2 bg-white/15 sm:h-12 lg:h-16" />
                </div>
                <div className="mt-5 max-w-2xl space-y-3 py-1">
                  <Skeleton className="h-4 w-full bg-white/10" />
                  <Skeleton className="h-4 w-2/3 bg-white/10" />
                </div>
                <div className="mt-8 grid max-w-xl grid-cols-2 gap-x-6 gap-y-4 border-y border-white/15 py-5 sm:grid-cols-3">
                  <AcademyStatSkeleton inverse />
                  <AcademyStatSkeleton inverse />
                  <AcademyStatSkeleton inverse />
                </div>
                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <Skeleton className="h-12 w-44 rounded-full bg-white/20" />
                </div>
              </div>
              <div className="relative justify-self-start lg:justify-self-end">
                <div className="w-60 rounded-2xl border border-white/15 bg-white/10 p-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-14 shrink-0 rounded-xl bg-white/15" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-5 w-20 rounded-full bg-white/15" />
                      <Skeleton className="h-3 w-28 bg-white/15" />
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-white/15 pt-3">
                    <Skeleton className="h-2.5 w-14 bg-white/10" />
                    <Skeleton className="h-2.5 w-16 bg-white/10" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-container-max px-margin-mobile py-16 md:px-margin-desktop md:py-24">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-14">
            <div className="min-w-0">
              <Skeleton className="h-2.5 w-32" />
              <Skeleton className="mt-4 h-8 w-3/4" />
              <div className="mt-5 max-w-prose space-y-5 py-2">
                <Repeat count={4}>{(i) => <Skeleton key={i} className={cn('h-3.5', i === 3 ? 'w-1/2' : 'w-full')} />}</Repeat>
              </div>
              <div className="mt-8 flex items-center gap-3">
                <Skeleton className="h-1 w-14 rounded-full" shimmer={false} />
                <Skeleton className="h-2.5 w-24" />
              </div>
            </div>
            <div className="h-fit overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
              <div className="border-b border-border/60 bg-muted/40 px-6 py-5">
                <Skeleton className="h-2.5 w-24" />
                <div className="mt-3 flex items-center gap-3">
                  <Skeleton className="h-1 w-10 rounded-full" shimmer={false} />
                  <Skeleton className="h-2.5 w-16" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-5 p-6">
                <Repeat count={4}>{(i) => <AcademyStatSkeleton key={i} />}</Repeat>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-border/70 bg-muted/30">
          <div className="mx-auto max-w-container-max px-margin-mobile py-16 md:px-margin-desktop md:py-24">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <SectionHeadingSkeleton titleWidth="w-56" />
              <div className="w-full max-w-sm space-y-3">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              <Repeat count={4}>{(i) => <AcademyCourseCardSkeleton key={i} index={i} />}</Repeat>
            </div>
          </div>
        </section>
      </div>
    </SkeletonRegion>
  );
}

/* ── /learning ───────────────────────────────────────────────────────────── */

function LearningStatSkeleton() {
  return (
    <div className="h-full rounded-xl border border-border/70 bg-card shadow-xs">
      <div className="flex flex-col gap-4 p-5">
        <Skeleton className="size-9 shrink-0 rounded-full" />
        <div className="min-w-0">
          <Skeleton className="h-[30px] w-10" />
          <Skeleton className="mt-2 h-2.5 w-20" />
        </div>
      </div>
    </div>
  );
}

function LearningCourseSkeleton({ index }: { index: number }) {
  return (
    <div className="h-full overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xs">
      <Skeleton className="m-2 mb-0 aspect-video rounded-xl" />
      <div className="p-5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex h-[25px] items-center">
              <Skeleton className={cn('h-4', ['w-4/5', 'w-2/3', 'w-3/4'][index % 3])} />
            </div>
            <Skeleton className="mt-2 h-2.5 w-28" />
          </div>
          <Skeleton className="size-11 shrink-0 rounded-full" />
        </div>
        <Skeleton className="mt-3 h-2 w-full rounded-full" shimmer={false} />
        <Skeleton className="mt-4 h-9 w-full rounded-full" />
      </div>
    </div>
  );
}

/**
 * What `/learning` shows under its header while enrolments load: the KPI row,
 * the continue card, the "All" heading and the course grid.
 */
export function LearningContentSkeleton({ courses: fixed }: { courses?: number } = {}) {
  const remembered = useRememberedListCount('public-learning', 3, 12);
  const courses = fixed ?? remembered;
  if (courses === 0) return <EmptyStateSkeleton descriptionLines={1} action="md" />;
  return (
    <>
      <div className="mb-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Repeat count={4}>{(i) => <LearningStatSkeleton key={i} />}</Repeat>
      </div>
      <div className="mb-12 rounded-2xl border border-border/70 bg-card shadow-sm">
        <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:p-7">
          <Skeleton className="size-14 shrink-0 rounded-full bg-primary/25" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="mt-2.5 h-6 w-2/3" />
            <div className="mt-3 flex items-center gap-3">
              <Skeleton className="h-1.5 w-full max-w-xs rounded-full" shimmer={false} />
              <Skeleton className="h-2.5 w-8" />
            </div>
          </div>
          <Skeleton className="h-10 w-32 shrink-0 rounded-full bg-primary/25" />
        </div>
      </div>
      <div className="mb-5 flex h-8 items-center gap-2">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-3 w-8" />
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Repeat count={courses}>{(i) => <LearningCourseSkeleton key={i} index={i} />}</Repeat>
      </div>
    </>
  );
}

/** `app/(main)/learning/page.tsx`. */
export function LearningPageSkeleton() {
  return (
    <SkeletonRegion>
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
        <PublicPageHeaderSkeleton
          className="mb-10 border-b border-border/70 pb-8"
          titleWidth="w-56 sm:w-72"
          leadLines={1}
          leadClassName="mt-3 max-w-2xl"
        />
        <LearningContentSkeleton />
      </div>
    </SkeletonRegion>
  );
}

/* ── /account ────────────────────────────────────────────────────────────── */

/** The enrolled-courses list on `/account`, for its own loading branch. */
export function EnrollmentListSkeleton({ rows: fixed }: { rows?: number }) {
  const remembered = useRememberedListCount('public-account-enrollments', 2, 20);
  const rows = fixed ?? remembered;
  if (rows === 0) return <AccountEmptyBoxSkeleton action />;
  return (
    <div className="space-y-3">
      <Repeat count={rows}>{(i) => <EnrollmentRowSkeleton key={i} index={i} />}</Repeat>
    </div>
  );
}

/**
 * The dashed empty box `/account` shows for no enrolments (with a browse button) and
 * `CertificateList` shows for no certificates (one 19.5px line, no button).
 */
function AccountEmptyBoxSkeleton({ action = false }: { action?: boolean }) {
  return (
    <div className="rounded-2xl border border-dashed border-border px-8 py-14 text-center">
      <Skeleton className="mx-auto mb-4 size-12 rounded-full" />
      <div className={cn('flex h-7 items-center justify-center', action && 'mb-1')}>
        <Skeleton className="h-4 w-48" />
      </div>
      {action ? (
        <>
          <div className="mb-6 flex h-5 items-center justify-center">
            <Skeleton className="h-3 w-72 max-w-full" />
          </div>
          <Skeleton className="mx-auto h-10 w-40 rounded-full" />
        </>
      ) : (
        <div className="mt-1 flex h-[19.5px] items-center justify-center">
          <Skeleton className="h-2.5 w-72 max-w-full" />
        </div>
      )}
    </div>
  );
}

/** `CertificateList` on `/account`: remembered rows, or its empty box. */
function AccountCertificatesSkeleton() {
  const rows = useRememberedListCount('public-account-certificates', 2, 20);
  return rows === 0 ? <AccountEmptyBoxSkeleton /> : <CertificateListSkeleton rows={rows} />;
}

function AccountSectionHeading({ width }: { width: string }) {
  return (
    <div className="mb-5 flex h-8 items-center gap-2.5">
      <Skeleton className="size-5 rounded" shimmer={false} />
      <Skeleton className={cn('h-5', width)} />
    </div>
  );
}

/** `app/(main)/(academy)/account/page.tsx`: the learner dashboard. */
export function AccountPageSkeleton() {
  return (
    <SkeletonRegion>
      <div className="container mx-auto max-w-5xl px-4 py-12 md:py-16">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4 border-b border-border/70 pb-8">
          <div className="flex h-10 items-center sm:h-12">
            <Skeleton className="h-8 w-48 sm:h-10 sm:w-64" />
          </div>
          <Skeleton className="h-9 w-40 rounded-full border border-border bg-card" />
        </div>
        <div className="space-y-12">
          <section>
            <AccountSectionHeading width="w-44" />
            <EnrollmentListSkeleton />
          </section>
          <section>
            <AccountSectionHeading width="w-36" />
            <AccountCertificatesSkeleton />
          </section>
        </div>
      </div>
    </SkeletonRegion>
  );
}

/* ── /events/[slug] ──────────────────────────────────────────────────────── */

/** `app/(main)/events/[slug]/page.tsx`: back link, media + title, details aside. */
export function EventDetailSkeleton() {
  return (
    <SkeletonRegion>
      <div className="container mx-auto max-w-5xl px-4 py-10 md:py-14">
        <div className="mb-6 flex h-9 items-center gap-1.5">
          <Skeleton className="size-4 rounded" shimmer={false} />
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="grid gap-10 lg:grid-cols-3 lg:gap-12">
          <div className="space-y-8 lg:col-span-2">
            <Skeleton className="aspect-video w-full rounded-2xl border border-border/70" />
            <div className="flex items-start gap-5">
              <div className="hidden w-20 shrink-0 flex-col items-center overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm sm:flex">
                <div className="flex h-7 w-full items-center justify-center bg-primary/10">
                  <Skeleton className="h-2.5 w-8" />
                </div>
                <Skeleton className="mt-2 h-9 w-10" />
                <Skeleton className="mb-2 mt-1.5 h-2.5 w-8" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Skeleton className="h-[22px] w-20 rounded-full" />
                  <Skeleton className="h-[22px] w-16 rounded-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-8 w-11/12 md:h-9" />
                  <Skeleton className="h-8 w-1/2 md:h-9" />
                </div>
              </div>
            </div>
            <div className="max-w-prose space-y-[15px] border-t border-border/60 pt-8">
              <Repeat count={5}>{(i) => <Skeleton key={i} className={cn('h-3', i === 4 ? 'w-2/5' : 'w-full')} />}</Repeat>
            </div>
          </div>
          <div>
            <div className="space-y-5 rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
              <Skeleton className="h-5 w-24" />
              <div className="space-y-4">
                <Repeat count={3}>
                  {(i) => (
                    <div key={i} className="flex items-start gap-3">
                      <Skeleton className="size-8 shrink-0 rounded-full" />
                      <div className="flex-1 space-y-2 pt-1">
                        <Skeleton className={cn('h-3', ['w-4/5', 'w-1/2', 'w-2/3'][i])} />
                        <Skeleton className="h-3 w-1/3" />
                      </div>
                    </div>
                  )}
                </Repeat>
              </div>
              <div className="border-t border-border/60 pt-5">
                <Skeleton className="h-11 w-full rounded-md bg-primary/25" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </SkeletonRegion>
  );
}

/* ── /verify ─────────────────────────────────────────────────────────────── */

/** `app/(main)/verify/page.tsx`: badge, serif title, body, number form. */
export function VerifyIndexSkeleton() {
  return (
    <SkeletonRegion>
      <div className="container mx-auto max-w-xl px-4 pb-24 pt-16 md:pt-24">
        <Skeleton className="mb-6 size-14 rounded-full" />
        <div className="flex h-10 items-center">
          <Skeleton className="h-8 w-3/4" />
        </div>
        <div className="mb-8 mt-4 space-y-3.5 py-1">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-2/3" />
        </div>
        <div className="flex gap-1.5 rounded-xl border border-border bg-card p-1.5 shadow-sm">
          <div className="flex h-9 flex-1 items-center px-3">
            <Skeleton className="h-3 w-36" />
          </div>
          <Skeleton className="h-9 w-24 shrink-0 rounded-lg bg-primary/25" />
        </div>
      </div>
    </SkeletonRegion>
  );
}

/** `app/(main)/verify/[number]/page.tsx`: back link and the result card. */
export function VerifyResultSkeleton() {
  return (
    <SkeletonRegion>
      <div className="container mx-auto max-w-xl px-4 pb-24 pt-16 md:pt-20">
        <div className="flex h-5 items-center gap-1.5">
          <Skeleton className="h-3 w-3" shimmer={false} />
          <Skeleton className="h-3 w-32" />
        </div>
        <div className="mt-6 rounded-3xl border border-border/70 bg-card px-8 py-12 text-center shadow-sm">
          <Skeleton className="mx-auto mb-6 size-16 rounded-full" />
          <div className="flex h-9 items-center justify-center">
            <Skeleton className="h-7 w-56 max-w-full" />
          </div>
          <Skeleton className="mx-auto mt-3 h-6 w-40 rounded-md" />
          <Skeleton className="mx-auto mt-6 h-6 w-48 max-w-full" />
          <Skeleton className="mx-auto mt-1.5 h-3 w-36" />
          <Skeleton className="mx-auto mt-3 h-2.5 w-28" />
        </div>
      </div>
    </SkeletonRegion>
  );
}
