'use client';

import type { ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { CommandBarSkeleton, type BarActionShape } from './admin-chrome';
import { Repeat, SkeletonRegion } from './region';

/* -----------------------------------------------------------------------------
 * Replica of the editor kit (components/admin/editor/editor-kit.tsx):
 * `EditorHeader`, `EditorLayout` (rail · form · aside, three columns from xl),
 * `EditorRail`, `EditorSection` and `AsideCard`. Products, courses and
 * academies all edit through that shell, so one replica serves all three.
 * --------------------------------------------------------------------------- */

/** One row inside an `EditorSection`. */
export type EditorRowShape =
  /** `BilingualField`, single line: English and Arabic side by side from md. */
  | 'bilingual'
  /** `BilingualField`, multiline. */
  | 'bilingual-area'
  /** A plain single-language field. */
  | 'field'
  /** `FieldGrid cols={2}` / `cols={3}`. */
  | 'grid2'
  | 'grid3'
  /** An image / hero / gallery block. */
  | 'media'
  /** A list of draggable rows (curriculum, roster). */
  | 'list';

export interface EditorSectionShape {
  rows: EditorRowShape[];
  /** Whether the header carries a hint on the trailing side. */
  hint?: boolean;
}

function FieldLabel() {
  return (
    <div className="flex h-[18px] items-center">
      <Skeleton className="h-2.5 w-24" />
    </div>
  );
}

function EditorRow({ shape }: { shape: EditorRowShape }) {
  switch (shape) {
    case 'bilingual':
    case 'bilingual-area': {
      const control = shape === 'bilingual' ? 'h-11' : 'h-[6.5rem]';
      return (
        <div className="space-y-1.5">
          <FieldLabel />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Skeleton className={cn('w-full rounded-lg', control)} />
            <Skeleton className={cn('w-full rounded-lg', control)} />
          </div>
        </div>
      );
    }
    case 'grid2':
    case 'grid3':
      return (
        <div className={cn('grid grid-cols-1 gap-4', shape === 'grid2' ? 'sm:grid-cols-2' : 'sm:grid-cols-3')}>
          <Repeat count={shape === 'grid2' ? 2 : 3}>
            {(i) => (
              <div key={i} className="space-y-1.5">
                <FieldLabel />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            )}
          </Repeat>
        </div>
      );
    case 'media':
      return <Skeleton className="aspect-[21/9] w-full rounded-xl" />;
    case 'list':
      return (
        <div className="space-y-2">
          <Repeat count={3}>
            {(i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-border/70 px-3 py-3">
                <Skeleton className="size-4 shrink-0 rounded" shimmer={false} />
                <Skeleton className={cn('h-3', ['w-1/2', 'w-2/5', 'w-3/5'][i % 3])} />
                <Skeleton className="ms-auto h-5 w-14 rounded-full" />
              </div>
            )}
          </Repeat>
        </div>
      );
    default:
      return (
        <div className="space-y-1.5">
          <FieldLabel />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      );
  }
}

/** `EditorSection`: a card with a serif heading and a column of rows. */
export function EditorSectionSkeleton({ section }: { section: EditorSectionShape }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-xs sm:p-6">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        {/* 1.375rem leading-tight → ~28px. */}
        <div className="flex h-7 items-center">
          <Skeleton className="h-5 w-40" />
        </div>
        {section.hint && <Skeleton className="h-2.5 w-36" />}
      </div>
      <div className="flex flex-col gap-5">
        {section.rows.map((row, i) => (
          <EditorRow key={i} shape={row} />
        ))}
      </div>
    </div>
  );
}

/** `EditorHeader`: status chip + save line, serif title, subtitle, actions. */
export function EditorHeaderSkeleton({
  bilingual = true,
  extraActions = 0,
  preview = true,
  review = true,
}: {
  bilingual?: boolean;
  /** Number of extra rounded secondary buttons (e.g. Save, Preview as learner). */
  extraActions?: number;
  preview?: boolean;
  review?: boolean;
}) {
  return (
    <div className="mx-auto flex w-full max-w-[90rem] flex-wrap items-center gap-4 px-0 pb-5 pt-6 sm:px-1">
      <div className="flex min-w-0 flex-[999_1_26rem] flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <Skeleton className="h-[22px] w-16 rounded-full" />
          <Skeleton className="h-2.5 w-24" />
        </div>
        {/* 1.75rem / 2rem at leading-tight. */}
        <div className="flex h-[35px] items-center sm:h-10">
          <Skeleton className="h-7 w-3/4 max-w-md sm:h-8" />
        </div>
        <div className="flex h-[18px] items-center">
          <Skeleton className="h-2.5 w-64 max-w-full" />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {bilingual && <Skeleton className="h-[38px] w-[13.5rem] rounded-full border border-border/70" />}
        <Repeat count={extraActions}>
          {(i) => <Skeleton key={i} className="h-10 w-24 rounded-full border border-border-strong bg-card" />}
        </Repeat>
        {preview && <Skeleton className="h-10 w-28 rounded-full border border-border-strong bg-card" />}
        {review && <Skeleton className="h-10 w-40 rounded-full bg-primary/25" />}
      </div>
    </div>
  );
}

/** `EditorRail`: section buttons (a scrolling row on a phone) and the readiness card. */
export function EditorRailSkeleton({ sections = 6, readiness = true }: { sections?: number; readiness?: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="min-w-0">
        <div className="mb-2 hidden h-4 items-center px-3 lg:flex">
          <Skeleton className="h-2 w-16" />
        </div>
        <div className="-mx-1 flex gap-1 overflow-hidden px-1 pb-1 lg:mx-0 lg:flex-col lg:px-0 lg:pb-0">
          <Repeat count={sections}>
            {(i) => (
              <div
                key={i}
                className={cn(
                  'flex min-h-10 shrink-0 items-center gap-2.5 rounded-xl border px-3 lg:w-full',
                  i === 0 ? 'border-border/80 bg-card shadow-xs' : 'border-transparent',
                )}
              >
                <span className="size-2 shrink-0 rounded-full bg-border-strong" />
                <Skeleton className={cn('h-2.5', ['w-16', 'w-20', 'w-14', 'w-24', 'w-12', 'w-20'][i % 6])} />
              </div>
            )}
          </Repeat>
        </div>
      </div>
      {readiness && (
        <div className="hidden flex-col gap-2.5 rounded-2xl border border-border/70 bg-card p-4 shadow-xs lg:flex">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-12" />
          </div>
          <Skeleton className="h-1.5 w-full rounded-full" shimmer={false} />
          <Skeleton className="h-2.5 w-full" />
          <Skeleton className="h-2.5 w-2/3" />
        </div>
      )}
    </div>
  );
}

/** `AsideCard`: eyebrow row, then content. */
export function AsideCardSkeleton({ children, eyebrow = true }: { children: ReactNode; eyebrow?: boolean }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-xs">
      {eyebrow && (
        <div className="flex h-5 items-center justify-between gap-2">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-2.5 w-12" />
        </div>
      )}
      {children}
    </div>
  );
}

/** The "how it will look" card in the aside: media, title, two lines. */
export function AsidePreviewSkeleton({ media = 'aspect-[16/10]' }: { media?: string }) {
  return (
    <AsideCardSkeleton>
      <div className="overflow-hidden rounded-xl border border-border/70">
        <Skeleton className={cn('w-full rounded-none', media)} />
        <div className="space-y-2 p-3">
          <Skeleton className="h-3.5 w-3/4" />
          <Skeleton className="h-2.5 w-full" />
          <Skeleton className="h-2.5 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-3 w-20" />
    </AsideCardSkeleton>
  );
}

/** The "before you publish" checklist card. */
export function AsideChecksSkeleton({ checks = 5 }: { checks?: number }) {
  return (
    <AsideCardSkeleton>
      <div className="flex flex-col gap-1">
        <Repeat count={checks}>
          {(i) => (
            <div key={i} className="flex min-h-9 items-center gap-2.5 px-1.5 py-1.5">
              <Skeleton className="size-5 shrink-0 rounded-full" />
              <Skeleton className={cn('h-3', ['w-2/3', 'w-1/2', 'w-3/5', 'w-2/5', 'w-1/2'][i % 5])} />
            </div>
          )}
        </Repeat>
      </div>
    </AsideCardSkeleton>
  );
}

/**
 * The whole editor page: command bar, header, and the three-column body.
 * Grid classes are copied from `EditorLayout` so the columns land in place.
 */
export function EditorShellSkeleton({
  crumbs = ['w-20', 'w-40'],
  barActions = ['button'],
  live = false,
  header,
  railSections = 6,
  sections,
  aside = true,
  checks = 5,
}: {
  crumbs?: string[];
  barActions?: BarActionShape[];
  live?: boolean;
  header?: Parameters<typeof EditorHeaderSkeleton>[0];
  railSections?: number;
  sections: EditorSectionShape[];
  aside?: boolean;
  checks?: number;
}) {
  return (
    <SkeletonRegion>
      <div className="w-full">
        <CommandBarSkeleton crumbs={crumbs} live={live} actions={barActions} />
        <EditorHeaderSkeleton {...header} />
        <div
          className={cn(
            'mx-auto grid w-full max-w-[90rem] grid-cols-1 gap-6 pb-28 lg:grid-cols-[13.5rem_minmax(0,1fr)]',
            aside && 'xl:grid-cols-[13rem_minmax(0,1fr)_19rem] 2xl:grid-cols-[13.5rem_minmax(0,1fr)_21rem]',
          )}
        >
          <div className="min-w-0 lg:row-span-2">
            <EditorRailSkeleton sections={railSections} />
          </div>
          <div className="flex min-w-0 flex-col gap-5">
            {sections.map((s, i) => (
              <EditorSectionSkeleton key={i} section={s} />
            ))}
          </div>
          {aside && (
            <div className="min-w-0 lg:col-start-2 xl:col-start-3 xl:row-start-1">
              <div className="flex flex-col gap-4">
                <AsidePreviewSkeleton />
                <AsideChecksSkeleton checks={checks} />
              </div>
            </div>
          )}
        </div>
      </div>
    </SkeletonRegion>
  );
}
