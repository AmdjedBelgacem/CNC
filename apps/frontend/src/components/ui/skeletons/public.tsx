'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Repeat } from './region';

/* -----------------------------------------------------------------------------
 * Replicas of the public-side building blocks: the course card, the academy
 * filter, the learner's enrolment and certificate rows. Each copies the real
 * component's container classes and swaps only the content for bars, so both
 * a route's `loading.tsx` and the component's own client-side loading branch
 * can render the same shape.
 * --------------------------------------------------------------------------- */

/** A `LanguageAvailability` line: icon, label, one or two locale badges. */
export function LanguageLineSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex h-[22px] items-center gap-2', className)}>
      <Skeleton className="size-3.5 rounded" shimmer={false} />
      <Skeleton className="h-2.5 w-14" />
      <Skeleton className="h-[22px] w-16 rounded-full" />
    </div>
  );
}

/** `DifficultyBar` at size sm: five segments, optional trailing label. */
export function DifficultyBarSkeleton({ label = false }: { label?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-1.5 flex-1 gap-0.5">
        <Repeat count={5}>{(i) => <Skeleton key={i} className="h-full flex-1 rounded-full" shimmer={false} />}</Repeat>
      </div>
      {label && <Skeleton className="h-2.5 w-14" />}
    </div>
  );
}

/** `components/academy/course-card.tsx`. */
export function CourseCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xs">
      <Skeleton className="m-2 mb-0 aspect-[16/10] rounded-xl" />
      <div className="flex flex-1 flex-col gap-1.5 px-5 pb-4 pt-5">
        {/* font-display text-xl leading-snug → 27.5px line. */}
        <div className="flex h-7 items-center">
          <Skeleton className={cn('h-5', ['w-4/5', 'w-2/3', 'w-3/4'][index % 3])} />
        </div>
        <div className="space-y-[11px] py-[6px]">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/5" />
        </div>
        <LanguageLineSkeleton className="mt-2" />
      </div>
      <div className="flex flex-col gap-3 border-t border-border/60 px-5 py-4">
        <div className="flex h-4 items-center gap-3">
          <div className="min-w-0 flex-1">
            <DifficultyBarSkeleton label />
          </div>
          <Skeleton className="h-2.5 w-16 shrink-0" />
        </div>
      </div>
    </div>
  );
}

/** The `/courses` grid: same columns and gaps as `CourseGrid`'s list. */
export function CourseGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-x-8 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
      <Repeat count={count}>{(i) => <CourseCardSkeleton key={i} index={i} />}</Repeat>
    </div>
  );
}

/** `components/academy/category-filter.tsx`: a small label over a row of chips. */
export function CourseFilterSkeleton({ chips = [32, 96, 120, 84, 104] }: { chips?: number[] }) {
  return (
    <div className="mb-10">
      <div className="mb-3 flex h-4 items-center gap-2">
        <Skeleton className="size-3.5 rounded" shimmer={false} />
        <Skeleton className="h-2.5 w-24" />
      </div>
      <div className="-mx-1 flex flex-wrap gap-1">
        {chips.map((w, i) => (
          // px-4 py-1.5 text-sm → 32px tall; the first chip is the active one.
          <span
            key={i}
            className={cn('inline-flex h-8 items-center rounded-full px-4', i === 0 && 'bg-foreground/10')}
          >
            <Skeleton className="h-2.5" style={{ width: w }} />
          </span>
        ))}
      </div>
    </div>
  );
}

/** The heading block shared by the catalogue pages: serif h1 + lead paragraph. */
export function PublicPageHeaderSkeleton({
  className = 'mb-10 max-w-3xl',
  titleWidth = 'w-2/3 sm:w-1/2',
  leadLines = 2,
  leadClassName = 'mt-4 max-w-2xl',
}: {
  className?: string;
  titleWidth?: string;
  leadLines?: number;
  leadClassName?: string;
}) {
  return (
    <div className={className}>
      {/* text-4xl / sm:text-5xl at line-height 1 → 40px / 48px line boxes. */}
      <div className="flex h-10 items-center sm:h-12">
        <Skeleton className={cn('h-8 sm:h-10', titleWidth)} />
      </div>
      <div className={cn('space-y-[16px] py-[8px]', leadClassName)}>
        <Repeat count={leadLines}>
          {(i) => <Skeleton key={i} className={cn('h-3.5', i === leadLines - 1 ? 'w-3/5' : 'w-full')} />}
        </Repeat>
      </div>
    </div>
  );
}

/** An enrolment row on `/account`: icon, title, status/difficulty/series meta, CTA. */
export function EnrollmentRowSkeleton({ index = 0 }: { index?: number }) {
  return (
    <div className="flex flex-wrap items-center gap-5 rounded-xl border border-border/70 bg-card p-5 shadow-xs">
      <Skeleton className="size-11 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1">
        <div className="flex h-7 items-center">
          <Skeleton className={cn('h-4', ['w-1/2', 'w-2/5', 'w-3/5'][index % 3])} />
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-3">
          <Skeleton className="h-[19px] w-16 rounded-full" />
          <div className="w-24">
            <DifficultyBarSkeleton />
          </div>
          <Skeleton className="h-2.5 w-20" />
        </div>
      </div>
      <Skeleton className="h-3.5 w-20" />
    </div>
  );
}

/** A certificate row from `components/certificates/certificate-list.tsx`. */
export function CertificateRowSkeleton({ index = 0 }: { index?: number }) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border/70 bg-card p-5 shadow-xs sm:flex-row sm:items-center">
      <Skeleton className="size-11 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1">
        <div className="flex h-7 items-center">
          <Skeleton className={cn('h-4', ['w-1/2', 'w-2/5'][index % 2])} />
        </div>
        <div className="mt-1 flex h-[15px] items-center gap-2">
          <Skeleton className="h-2.5 w-28" />
          <Skeleton className="h-2.5 w-20" />
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Skeleton className="h-8 w-20 rounded-full" />
        <Skeleton className="h-8 w-9 rounded-full sm:w-20" />
        <Skeleton className="h-8 w-24 rounded-full bg-primary/25" />
      </div>
    </div>
  );
}

/** The list wrapper `CertificateList` renders, for its own loading branch. */
export function CertificateListSkeleton({ rows = 2, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-3', className)}>
      <Repeat count={rows}>{(i) => <CertificateRowSkeleton key={i} index={i} />}</Repeat>
    </div>
  );
}
