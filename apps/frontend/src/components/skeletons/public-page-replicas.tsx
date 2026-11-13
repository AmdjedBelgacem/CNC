'use client';

import type { CSSProperties, ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Repeat, SkeletonRegion } from '@/components/ui/skeletons/region';
import { EmptyStateSkeleton } from '@/components/ui/skeletons/public';
import { useRememberedListCount } from '@/lib/admin-shape-memory';
import { cn } from '@/lib/utils';

/* -----------------------------------------------------------------------------
 * Replicas of public pages that previously shared a generic skeleton.
 *
 * Each one copies its page's section sequence, containers and paddings, and
 * gives every text run a line box of the real line-height, so the document is
 * the same height before and after the page arrives. Heights were taken from
 * the live pages at 1440px wide (the shape the builder layouts render today).
 *
 * Data-sized lists read the number of rows the page last rendered from
 * `useRememberedListCount`; the page records it with `rememberListCount` under
 * the same `public-*` key. At 0 the page's own empty state is drawn instead.
 * --------------------------------------------------------------------------- */

/** One line box of a fixed line-height with a bar inside it. */
function Line({
  height,
  width = 'w-full',
  bar = 'h-3',
  className,
  center = false,
}: {
  height: number | string;
  width?: string;
  bar?: string;
  className?: string;
  center?: boolean;
}) {
  const style: CSSProperties = { height: typeof height === 'number' ? `${height}px` : height };
  return (
    <div className={cn('flex items-center', center && 'justify-center', className)} style={style}>
      <Skeleton className={cn(bar, width, 'max-w-full')} />
    </div>
  );
}

/** A run of `lines` line boxes, the last one ragged. */
function Lines({
  lines,
  lineHeight,
  bar = 'h-3',
  center = false,
  className,
  last = 'w-3/5',
}: {
  lines: number;
  lineHeight: number;
  bar?: string;
  center?: boolean;
  className?: string;
  last?: string;
}) {
  return (
    <div className={className}>
      <Repeat count={lines}>
        {(i) => (
          <Line
            key={i}
            height={lineHeight}
            bar={bar}
            center={center}
            width={i === lines - 1 && lines > 1 ? last : 'w-full'}
          />
        )}
      </Repeat>
    </div>
  );
}

const W = ['w-2/5', 'w-1/2', 'w-1/3', 'w-3/5', 'w-1/4'];

/* ══════════════════════════════════════════════════════════════════════════
 * Legal documents — privacy, terms, refunds (inside `LegalDocument`)
 * ══════════════════════════════════════════════════════════════════════════ */

/** A paragraph count of 30.6px lines; `b` marks a bullet line (8px below instead of 16px). */
type LegalParagraph = number | `b${number}`;
interface LegalSection {
  /** Heading width in px at desktop. */
  heading: number;
  paragraphs: LegalParagraph[];
}

/**
 * `seedLegalLayout` inside `LegalDocument`: a 768px column (pt-16, pb-24), a 58.8px
 * serif title, a 20px "last updated" line, then ruled h2 clauses (pt-10, 35.75px line)
 * over 17px/1.8 paragraphs. Block margins collapse exactly as the real blocks' do.
 */
function LegalDocumentSkeleton({ title, sections }: { title: number; sections: LegalSection[] }) {
  return (
    <SkeletonRegion>
      <div className="relative isolate">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] ambient-wash opacity-70 [mask-image:linear-gradient(to_bottom,black,transparent)]"
        />
        <section className="container mx-auto max-w-[768px] px-4 pb-24 pt-16">
          <div className="flex h-[58.8px] items-center">
            <Skeleton className="h-10 max-w-full" style={{ width: title }} />
          </div>
          <div className="mb-10 mt-4 flex h-5 items-center">
            <Skeleton className="h-3 w-40" />
          </div>
          {sections.map((section, s) => (
            <div key={s}>
              <div className="mb-4 mt-12 border-t border-border/70 pt-10">
                <div className="flex h-[35.75px] items-center">
                  <Skeleton className="h-6 max-w-full" style={{ width: section.heading }} />
                </div>
              </div>
              {section.paragraphs.map((p, i) => {
                const bullet = typeof p === 'string';
                const lines = bullet ? Number(p.slice(1)) : p;
                return (
                  <div key={i} className={bullet ? 'mb-2' : 'mb-4'}>
                    <Lines lines={lines} lineHeight={30.6} bar="h-3.5" last={bullet ? 'w-2/3' : 'w-3/5'} />
                  </div>
                );
              })}
            </div>
          ))}
        </section>
      </div>
    </SkeletonRegion>
  );
}

/** `app/(main)/privacy/page.tsx`. */
export function PrivacyPageSkeleton() {
  return (
    <LegalDocumentSkeleton
      title={300}
      sections={[
        { heading: 259, paragraphs: [2, 3] },
        { heading: 338, paragraphs: [1, 'b1', 'b1', 'b1', 'b1', 'b1'] },
        { heading: 143, paragraphs: [2] },
        { heading: 166, paragraphs: [3] },
        { heading: 129, paragraphs: [2] },
        { heading: 92, paragraphs: [2] },
        { heading: 86, paragraphs: [1] },
      ]}
    />
  );
}

/** `app/(main)/terms/page.tsx`. */
export function TermsPageSkeleton() {
  return (
    <LegalDocumentSkeleton
      title={362}
      sections={[
        { heading: 128, paragraphs: [2] },
        { heading: 103, paragraphs: [2] },
        { heading: 89, paragraphs: [2] },
        { heading: 151, paragraphs: [2] },
        { heading: 231, paragraphs: [2] },
        { heading: 243, paragraphs: [2] },
        { heading: 139, paragraphs: [2] },
        { heading: 86, paragraphs: [1] },
      ]}
    />
  );
}

/** `app/(main)/refunds/page.tsx`. */
export function RefundsPageSkeleton() {
  return (
    <LegalDocumentSkeleton
      title={301}
      sections={[
        { heading: 469, paragraphs: [3, 2] },
        { heading: 196, paragraphs: [2] },
        { heading: 100, paragraphs: [2] },
        { heading: 172, paragraphs: [2] },
        { heading: 122, paragraphs: [6] },
        { heading: 86, paragraphs: [1] },
      ]}
    />
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * /edu-purchases — the same seed, rendered bare (no `LegalDocument` frame)
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * `app/(main)/edu-purchases/page.tsx`: `BlockRenderer` without the legal frame, so the
 * blocks keep their own type scale — a 51.84px title, a 16px date line, unruled 32px
 * h2s and 26px body lines.
 */
export function EduPurchasesPageSkeleton() {
  const sections: Array<{ heading: number; paragraphs: LegalParagraph[] }> = [
    { heading: 182, paragraphs: [3] },
    { heading: 155, paragraphs: ['b1', 'b1', 'b1'] },
    { heading: 234, paragraphs: [2] },
    { heading: 283, paragraphs: [2] },
    { heading: 297, paragraphs: [1] },
  ];
  return (
    <SkeletonRegion>
      <section className="container mx-auto max-w-[768px] px-4 pb-24 pt-16">
        <div className="flex h-[51.84px] items-center">
          <Skeleton className="h-9 w-[90%]" />
        </div>
        <div className="mb-10 flex h-4 items-center">
          <Skeleton className="h-2.5 w-32" />
        </div>
        {sections.map((section, s) => (
          <div key={s}>
            <div className="mb-4 mt-12 flex h-8 items-center">
              <Skeleton className="h-6 max-w-full" style={{ width: section.heading }} />
            </div>
            {section.paragraphs.map((p, i) => {
              const bullet = typeof p === 'string';
              const lines = bullet ? Number(p.slice(1)) : p;
              return (
                <div key={i} className={bullet ? 'mb-2' : 'mb-4'}>
                  <Lines lines={lines} lineHeight={26} bar="h-3" last={bullet ? 'w-2/3' : 'w-3/5'} />
                </div>
              );
            })}
          </div>
        ))}
      </section>
    </SkeletonRegion>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * /about — builder layout + the repository-managed facts island
 * ══════════════════════════════════════════════════════════════════════════ */

/** `app/(main)/about/page.tsx`: story band, intro, DNA, stats, journey, badges, facts. */
export function AboutPageSkeleton() {
  return (
    <SkeletonRegion>
      {/* Story band: 96px padding, 51.84px title, three 28.8px lead lines. */}
      <section className="overflow-hidden border-b bg-surface-sunken/60 py-24">
        <div className="container mx-auto px-4 text-center">
          <Line height={51.84} bar="h-9" width="w-48" center className="mb-4" />
          <Lines lines={3} lineHeight={28.8} bar="h-3.5" center className="mx-auto max-w-[672px]" />
        </div>
      </section>
      {/* Intro: four 26px lines in a 768px column. */}
      <section className="overflow-hidden bg-secondary/10 py-16">
        <div className="container mx-auto px-4">
          <Lines lines={4} lineHeight={26} center className="mx-auto max-w-[768px]" />
        </div>
      </section>
      {/* DNA: heading, three cards. */}
      <section className="overflow-hidden py-20">
        <div className="container mx-auto px-4">
          <Line height={51.84} bar="h-9" width="w-44" center className="mb-12" />
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <Repeat count={3}>
              {(i) => (
                <div key={i} className="rounded-xl border border-border bg-surface-container-low p-8 text-center">
                  <Skeleton className="mx-auto mb-4 size-12 rounded-lg" />
                  <Line height={28} bar="h-4" width="w-3/5" center className="mb-2" />
                  <Lines lines={3} lineHeight={16} bar="h-2.5" center />
                </div>
              )}
            </Repeat>
          </div>
        </div>
      </section>
      {/* Stats band: four icon / value / label columns. */}
      <section className="overflow-hidden bg-secondary/10 py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <Repeat count={4}>
              {(i) => (
                <div key={i} className="flex flex-col items-center">
                  <Skeleton className="mb-2 size-10 rounded-full" />
                  <Line height={44} bar="h-8" width={['w-20', 'w-28', 'w-40', 'w-36'][i]} center />
                  <Line height={16} bar="h-2.5" width="w-28" center />
                </div>
              )}
            </Repeat>
          </div>
        </div>
      </section>
      {/* Journey: heading, six timeline entries on a ruled spine. */}
      <section className="overflow-hidden py-20">
        <div className="container mx-auto max-w-3xl px-4">
          <Line height={51.84} bar="h-9" width="w-56" center className="mb-12" />
          <div className="relative border-s-2 border-primary/30 ps-8">
            <Repeat count={6}>
              {(i) => (
                <div key={i}>
                  <Line height={28} bar="h-4" width={['w-40', 'w-48', 'w-44', 'w-40', 'w-36', 'w-36'][i]} className="mt-1" />
                  <Line height={16} bar="h-2.5" width="w-2/3" className="mt-1" />
                </div>
              )}
            </Repeat>
          </div>
        </div>
      </section>
      {/* Trust badges. */}
      <section className="overflow-hidden border-t bg-secondary/10 py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <Repeat count={4}>
              {(i) => (
                <div key={i} className="flex flex-col items-center">
                  <Skeleton className="mb-3 size-12 rounded-full" />
                  <Line height={20} bar="h-3" width="w-32" center />
                  <Lines lines={i === 1 ? 2 : 1} lineHeight={16} bar="h-2.5" center className="mt-1 w-full" />
                </div>
              )}
            </Repeat>
          </div>
        </div>
      </section>
      {/* Facts island: heading, lead, four ruled facts, footer note. */}
      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6 md:py-28 lg:px-8">
        <Line height={36} bar="h-6" width="w-80" />
        <Lines lines={2} lineHeight={24} className="mt-3" />
        <div className="mt-12 flex flex-col gap-8">
          <Repeat count={4}>
            {(i) => (
              <div key={i} className="border-b border-border pb-6 last:border-b-0">
                <Line height={28} bar="h-4" width={['w-64', 'w-48', 'w-56', 'w-52'][i]} />
                <Lines lines={i < 2 ? 4 : 3} lineHeight={28} className="mt-2" />
              </div>
            )}
          </Repeat>
        </div>
        <Lines lines={2} lineHeight={20} bar="h-3" className="mt-8" last="w-2/5" />
      </section>
    </SkeletonRegion>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * / — the builder homepage
 * ══════════════════════════════════════════════════════════════════════════ */

/** The eyebrow / heading / lead block the card-grid and CTA islands open with. */
function IslandHeadSkeleton({ titleHeight, leadLines, leadHeight }: { titleHeight: number; leadLines: number; leadHeight: number }) {
  return (
    <div>
      <Line height={20} bar="h-2.5" width="w-24" />
      <Line height={titleHeight} bar="h-7" width="w-3/4" className="mt-3" />
      <Lines lines={leadLines} lineHeight={leadHeight} className="mt-3" />
    </div>
  );
}

/**
 * `app/(public)/page.tsx` → `HomeBuilder` over the default homepage layout: hero with
 * console card, four offer cards, the three-step card grid, the closing CTA band, the
 * FAQ island, the newsletter card and the guides island. Zero-count stat tiles are
 * hidden on the live page, so the hero shows a single stat.
 */
export function HomePageSkeleton() {
  return (
    <SkeletonRegion>
      {/* Hero: 88 / 72 padding, two columns (copy 585px, console 460px). */}
      <section className="overflow-hidden pb-[72px] pt-[88px]">
        <div className="mx-auto grid w-full max-w-[1272px] gap-14 px-4 md:grid-cols-2">
          <div className="flex flex-col items-start gap-6">
            <Skeleton className="h-[34px] w-60 rounded-full" />
            <div className="w-full">
              <Lines lines={3} lineHeight={78} bar="h-14" last="w-2/5" />
            </div>
            <Lines lines={3} lineHeight={28.8} bar="h-3.5" className="w-full" />
            <div className="flex flex-wrap gap-3">
              <Skeleton className="h-12 w-52 rounded-lg bg-primary/25" />
              <Skeleton className="h-[50px] w-44 rounded-lg" />
            </div>
            <div className="mt-2 pt-6">
              <Line height={18} bar="h-2.5" width="w-24" />
              <Line height={31} bar="h-6" width="w-20" />
            </div>
          </div>
          <div className="relative h-[460px]">
            <Skeleton className="h-[390px] w-full max-w-[494px] rounded-2xl" />
            <Skeleton className="absolute bottom-0 end-0 h-[118px] w-[260px] rounded-2xl" />
          </div>
        </div>
      </section>

      {/* Offers: 96px padding, a 213px header, four 372px cards. */}
      <section className="overflow-hidden py-24">
        <div className="mx-auto w-full max-w-[1272px] px-4">
          <div className="max-w-[760px] space-y-4">
            <Skeleton className="h-5 w-60 rounded-full" />
            <Lines lines={2} lineHeight={52} bar="h-9" last="w-1/2" />
            <Lines lines={2} lineHeight={28.8} bar="h-3.5" />
          </div>
          <div className="mt-12 grid gap-5 px-0 sm:grid-cols-2 lg:grid-cols-4 lg:px-6">
            <Repeat count={4}>
              {(i) => (
                <div key={i} className="flex h-[372px] flex-col gap-3.5 rounded-2xl border border-border/70 bg-card p-7">
                  <Skeleton className="size-11 rounded-xl" />
                  <Line height={18} bar="h-2.5" width="w-24" />
                  <Lines lines={2} lineHeight={27.5} bar="h-4" />
                  <Lines lines={5} lineHeight={24} />
                  <Line height={21} bar="h-3" width="w-28" />
                </div>
              )}
            </Repeat>
          </div>
        </div>
      </section>

      {/* Card grid island: three numbered steps. */}
      <section className="border-y border-border/70 bg-surface-sunken/50 px-margin-mobile pb-24 pt-20 md:px-margin-desktop">
        <div className="mx-auto max-w-container-max py-20 md:py-28">
          <div className="mb-10 max-w-2xl md:mb-12">
            <IslandHeadSkeleton titleHeight={44} leadLines={1} leadHeight={28} />
          </div>
          <div className="grid gap-5 md:grid-cols-3 md:gap-6">
            <Repeat count={3}>
              {(i) => (
                <div key={i} className="rounded-2xl border border-border/70 bg-card p-7">
                  <Skeleton className="mb-5 size-11 rounded-xl" />
                  <Line height={28} bar="h-4" width="w-1/2" />
                  <Lines lines={2} lineHeight={22.75} className="mt-2" />
                </div>
              )}
            </Repeat>
          </div>
        </div>
      </section>

      {/* Closing CTA band. */}
      <section className="border-t border-border px-margin-mobile pb-20 pt-16 md:px-margin-desktop">
        <div className="mx-auto flex max-w-container-max flex-col items-start justify-between gap-8 rounded-3xl border border-border/70 bg-card px-6 py-10 sm:px-10 md:flex-row md:items-center md:px-14 md:py-14">
          <div className="w-full max-w-xl">
            <IslandHeadSkeleton titleHeight={44} leadLines={2} leadHeight={26} />
          </div>
          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-11 w-44 rounded-lg bg-primary/25" />
            <Skeleton className="h-11 w-48 rounded-lg" />
          </div>
        </div>
      </section>

      {/* FAQ island: heading column + seven questions, the first open. */}
      <section className="mx-auto grid max-w-[1240px] gap-10 px-4 py-20 sm:px-6 md:grid-cols-[1fr_2fr] md:gap-12 md:py-28 lg:px-8">
        <div className="flex flex-col gap-3">
          <Lines lines={3} lineHeight={40} bar="h-7" last="w-1/2" />
          <Line height={28} width="w-4/5" />
        </div>
        <div className="flex flex-col">
          <Repeat count={7}>
            {(i) => (
              <div key={i} className="border-b border-border/70 py-5">
                <div className="flex min-h-11 items-center justify-between gap-4">
                  <Skeleton className={cn('h-4', W[i % W.length])} />
                  <Skeleton className="size-8 shrink-0 rounded-full" />
                </div>
                {i === 0 ? <Lines lines={3} lineHeight={28} className="mt-3" /> : null}
              </div>
            )}
          </Repeat>
        </div>
      </section>

      {/* Newsletter card. */}
      <section className="relative overflow-hidden py-20">
        <div className="mx-auto max-w-container-max px-margin-mobile md:px-margin-desktop">
          <div className="relative overflow-hidden rounded-3xl border border-border/70 bg-card p-8 sm:p-14 md:p-16">
            <div className="max-w-2xl">
              <Skeleton className="mb-6 h-[26px] w-36 rounded-full" />
              <Lines lines={2} lineHeight={48} bar="h-8" className="mb-5" last="w-1/2" />
              <Lines lines={2} lineHeight={28} className="mb-8" />
              <Skeleton className="h-[58px] w-full max-w-md rounded-xl" />
              <Line height={16} bar="h-2.5" width="w-64" className="mt-4" />
            </div>
          </div>
        </div>
      </section>

      {/* Guides island. */}
      <section className="mx-auto max-w-5xl px-4 pb-24 pt-8 sm:px-6 md:pb-32 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-border/70 bg-card px-6 py-12 sm:px-12 md:py-14">
          <Line height={40} bar="h-7" width="w-2/3" />
          <Lines lines={2} lineHeight={28} className="mt-4 max-w-2xl" />
          <div className="mt-8 flex flex-wrap gap-2.5">
            {[138, 147, 126, 178].map((w) => (
              <Skeleton key={w} className="h-10 rounded-full" style={{ width: w }} />
            ))}
          </div>
        </div>
      </section>
    </SkeletonRegion>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * /feed — builder layout around the live wire
 * ══════════════════════════════════════════════════════════════════════════ */

/** `components/feed/post-card.tsx`: vote rail, author row, three lines, actions. */
function PostCardSkeleton({ index }: { index: number }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card px-4 py-5 shadow-xs sm:px-5">
      <div className="flex gap-3 sm:gap-4">
        <Skeleton className="h-[92px] w-9 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex items-center gap-2.5">
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-2.5 w-20" />
            </div>
          </div>
          <Lines lines={index % 2 === 0 ? 3 : 2} lineHeight={24} className="mb-3" />
          <div className="flex h-8 items-center gap-2">
            <Skeleton className="h-6 w-14 rounded-full" />
            <Skeleton className="h-6 w-14 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** `app/(main)/(social)/feed/page.tsx` over the default feed layout. */
export function FeedPageSkeleton() {
  const posts = useRememberedListCount('public-feed', 5, 20);
  return (
    <SkeletonRegion>
      {/* Hero: badge row, two-line title, lead, four counters, two actions. */}
      <section className="relative overflow-hidden pb-12 pt-16">
        <div className="relative mx-auto max-w-container-max px-margin-mobile pb-14 pt-16 md:px-margin-desktop md:pb-20 md:pt-24">
          <div className="flex items-center gap-3">
            <Skeleton className="h-[34px] w-40 rounded-full" />
            <Skeleton className="h-3 w-36" />
          </div>
          <Lines lines={2} lineHeight={60} bar="h-12" className="mt-7 max-w-3xl" last="w-1/2" />
          <Lines lines={3} lineHeight={28} className="mt-6 max-w-xl" />
          <div className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border/70 bg-border/70 md:grid-cols-4">
            <Repeat count={4}>
              {(i) => (
                <div key={i} className="bg-card px-5 py-4">
                  <Line height={16} bar="h-2.5" width="w-20" />
                  <Line height={32} bar="h-6" width="w-12" className="mt-1.5" />
                </div>
              )}
            </Repeat>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Skeleton className="h-11 w-48 rounded-lg bg-primary/25" />
            <Skeleton className="h-11 w-36 rounded-lg" />
          </div>
        </div>
      </section>
      {/* Topics island. */}
      <section className="border-b border-border/70 bg-surface-sunken/40 px-margin-mobile py-16 md:px-margin-desktop md:py-20">
        <div className="mx-auto max-w-container-max">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <Line height={16} bar="h-2.5" width="w-32" />
              <Line height={36} bar="h-6" width="w-72" className="mt-2" />
            </div>
            <Lines lines={2} lineHeight={20} className="w-96 max-w-full" />
          </div>
          <Skeleton className="h-[102px] w-full rounded-xl" />
        </div>
      </section>
      {/* Live wire + side rail. */}
      <section className="mx-auto max-w-container-max px-margin-mobile py-16 md:px-margin-desktop md:py-24">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start xl:gap-12">
          <div className="min-w-0">
            <div className="mb-6 max-w-2xl">
              <Line height={16} bar="h-2.5" width="w-16" />
              <Line height={40} bar="h-7" width="w-72" className="mt-2" />
              <Line height={25.6} width="w-4/5" />
            </div>
            <div className="w-full overflow-hidden rounded-2xl border border-border/70 bg-surface-sunken/40 shadow-xs">
              <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border/60 bg-card px-4 pb-4 pt-5 md:px-6">
                <div>
                  <Line height={16} bar="h-2.5" width="w-36" />
                  <Line height={32} bar="h-6" width="w-32" className="mt-1" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-[34px] w-[199px] rounded-full" />
                  <Skeleton className="h-[34px] w-[194px] rounded-full" />
                </div>
              </div>
              <div className="space-y-4 p-4 md:p-6">
                <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-card p-3 shadow-xs sm:p-4">
                  <Skeleton className="size-9 shrink-0 rounded-full" />
                  <Skeleton className="h-[38px] flex-1 rounded-full" />
                  <Skeleton className="h-9 w-[125px] shrink-0 rounded-lg" />
                </div>
                <div className="flex items-center justify-between gap-2 px-1">
                  <Line height={16} bar="h-2.5" width="w-44" />
                  <Line height={16} bar="h-2.5" width="w-14" />
                </div>
                {posts === 0 ? (
                  <EmptyStateSkeleton descriptionLines={1} action="sm" />
                ) : (
                  <div className="space-y-4">
                    <Repeat count={posts}>{(i) => <PostCardSkeleton key={i} index={i} />}</Repeat>
                  </div>
                )}
              </div>
            </div>
          </div>
          <aside className="space-y-4">
            <div className="rounded-xl border border-border/70 bg-card p-5 shadow-xs">
              <Line height={28} bar="h-4" width="w-32" />
              <div className="mt-3 divide-y divide-border/60">
                <Repeat count={4}>
                  {(i) => (
                    <div key={i} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-5 w-6" />
                    </div>
                  )}
                </Repeat>
              </div>
            </div>
            <div className="rounded-xl border border-border/70 bg-card p-5 shadow-xs">
              <Line height={28} bar="h-4" width="w-28" />
              <div className="mt-3 space-y-0.5">
                <Repeat count={4}>{(i) => <Line key={i} height={36} width={W[i]} />}</Repeat>
              </div>
            </div>
          </aside>
        </div>
      </section>
      {/* How it works (card grid island). */}
      <section className="border-y border-border/70 bg-surface-sunken/50 px-margin-mobile pb-20 pt-16 md:px-margin-desktop">
        <div className="mx-auto max-w-container-max py-20 md:py-28">
          <div className="mb-10 max-w-2xl md:mb-12">
            <IslandHeadSkeleton titleHeight={44} leadLines={1} leadHeight={28} />
          </div>
          <div className="grid gap-5 md:grid-cols-3 md:gap-6">
            <Repeat count={3}>
              {(i) => (
                <div key={i} className="rounded-2xl border border-border/70 bg-card p-7">
                  <Skeleton className="mb-5 size-11 rounded-xl" />
                  <Line height={28} bar="h-4" width="w-1/2" />
                  <Lines lines={2} lineHeight={22.75} className="mt-2" />
                </div>
              )}
            </Repeat>
          </div>
        </div>
      </section>
      {/* Closing CTA. */}
      <section className="px-margin-mobile pb-20 pt-16 md:px-margin-desktop">
        <div className="mx-auto flex max-w-container-max flex-col items-start justify-between gap-8 rounded-3xl border border-border/70 bg-card px-6 py-10 sm:px-10 md:flex-row md:items-center md:px-14 md:py-14">
          <div className="w-full max-w-xl">
            <IslandHeadSkeleton titleHeight={44} leadLines={2} leadHeight={26} />
          </div>
          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-11 w-40 rounded-lg bg-primary/25" />
            <Skeleton className="h-11 w-48 rounded-lg" />
          </div>
        </div>
      </section>
    </SkeletonRegion>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * /groups
 * ══════════════════════════════════════════════════════════════════════════ */

/** `components/groups/group-card.tsx`: 128px cover, title, two lines, meta, footer. */
function GroupCardSkeleton({ index }: { index: number }) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs">
      <Skeleton className="h-32 w-full rounded-none" />
      <div className="flex flex-1 flex-col p-5">
        <Line height={27.5} bar="h-4" width={['w-2/3', 'w-1/2', 'w-3/5'][index % 3]} />
        <Lines lines={2} lineHeight={22.75} className="mt-1.5" />
        <div className="mb-4 mt-4 flex gap-4">
          <Line height={20} width="w-24" />
          <Line height={20} width="w-28" />
        </div>
        <div className="mt-auto border-t border-border/60 pt-3">
          <Line height={20} width="w-28" />
        </div>
      </div>
    </div>
  );
}

/** The card grid alone, for the page's own loading branch (remembered count by default). */
export function GroupGridSkeleton({ count }: { count?: number }) {
  const remembered = useRememberedListCount('public-groups', 6, 12);
  const n = Math.max(1, count ?? remembered);
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
      <Repeat count={n}>{(i) => <GroupCardSkeleton key={i} index={i} />}</Repeat>
    </div>
  );
}

/** `app/(main)/groups/page.tsx`: hero, map, search + academy filter, card grid. */
export function GroupsPageSkeleton() {
  const groups = useRememberedListCount('public-groups', 6, 12);
  return (
    <SkeletonRegion>
      <section className="relative isolate overflow-hidden border-b border-border/70 py-20 md:py-28">
        <div className="container mx-auto px-4 text-center">
          <Line height={48} bar="h-9" width="w-72" center className="mx-auto mb-4" />
          <Lines lines={2} lineHeight={29.25} bar="h-3.5" center className="mx-auto mb-8 max-w-2xl" />
          <div className="flex items-center justify-center gap-3">
            <Skeleton className="h-10 w-36 rounded-lg bg-primary/25" />
            <Skeleton className="h-10 w-28 rounded-lg" />
          </div>
        </div>
      </section>
      <section className="border-b border-border/70 py-10">
        <div className="container mx-auto px-4">
          <div className="overflow-hidden rounded-2xl border border-border/70 shadow-xs">
            <Skeleton className="h-80 w-full rounded-none" />
          </div>
        </div>
      </section>
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
            <Skeleton className="h-10 flex-1 rounded-lg" />
            <Skeleton className="h-10 rounded-lg sm:w-56" />
          </div>
          <div className="mb-8 flex gap-2 pb-2">
            <Skeleton className="h-[34px] w-12 rounded-full" />
          </div>
          {groups === 0 ? (
            <EmptyStateSkeleton descriptionLines={1} action="md" />
          ) : (
            <>
              <Line height={20} width="w-32" className="mb-4" />
              <GroupGridSkeleton count={groups} />
              {groups >= 12 ? (
                <div className="mt-8 flex items-center justify-center gap-4">
                  <Skeleton className="h-9 w-20 rounded-lg" />
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-9 w-16 rounded-lg" />
                </div>
              ) : null}
            </>
          )}
        </div>
      </section>
    </SkeletonRegion>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * /tags
 * ══════════════════════════════════════════════════════════════════════════ */

/** `components/feed/tag-views.tsx` `TagIndex`: heading, search, three-column tag grid. */
export function TagIndexPageSkeleton() {
  const tags = useRememberedListCount('public-tags', 9, 60);
  return (
    <SkeletonRegion>
      <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-10 md:py-14">
        <div className="space-y-3">
          <div className="flex h-9 items-center md:h-10">
            <Skeleton className="h-7 w-32 md:h-8" />
          </div>
          <Line height={22.75} width="w-72" />
        </div>
        <Skeleton className="h-10 max-w-sm rounded-lg" />
        {tags === 0 ? (
          <EmptyStateSkeleton descriptionLines={1} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Repeat count={tags}>
              {(i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card px-4 py-3 shadow-xs"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Skeleton className="size-7 shrink-0 rounded-full" />
                    <div>
                      <Line height={20} width={['w-20', 'w-28', 'w-24'][i % 3]} />
                      <Line height={14.85} bar="h-2" width="w-16" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-8 rounded-full" />
                </div>
              )}
            </Repeat>
          </div>
        )}
      </div>
    </SkeletonRegion>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * /titan-tv
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * The series rows under the Titan TV hero, or its empty box at zero. Shared by the route skeleton
 * and the page's own loading branch, which used to draw three fixed rows over an empty library.
 */
export function TitanTvSeriesSkeleton() {
  const series = useRememberedListCount('public-titan-tv', 2, 8);
  if (series === 0) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-20 text-center">
        <Skeleton className="mb-5 size-14 rounded-full" />
        <Line height={28} bar="h-4" width="w-40" center />
        <Line height={20} width="w-72" center className="mt-2" />
      </div>
    );
  }
  return (
    <div className="space-y-20">
      <Repeat count={series}>
        {(i) => (
          <div key={i}>
            <div className="mb-1 flex h-8 items-center md:h-9">
              <Skeleton className={cn('h-6', ['w-64', 'w-56', 'w-72'][i % 3])} />
            </div>
            <Line height={22.75} width="w-96" className="mb-6" />
            <div className="-mx-4 flex gap-5 overflow-hidden px-4 pb-4 pt-1">
              <Repeat count={5}>
                {(j) => (
                  <div key={j} className="w-72 shrink-0">
                    <Skeleton className="aspect-video w-full rounded-2xl" />
                    <Line height={22} bar="h-3.5" width="w-4/5" className="mt-3" />
                  </div>
                )}
              </Repeat>
            </div>
          </div>
        )}
      </Repeat>
    </div>
  );
}

/** `app/(main)/titan-tv/page.tsx`: hero, then a row of videos per series. */
export function TitanTvPageSkeleton() {
  return (
    <SkeletonRegion>
      <section className="relative isolate overflow-hidden border-b border-border/70 py-20 md:py-28">
        <div className="container mx-auto px-4 text-center">
          <Skeleton className="mx-auto mb-6 h-[34px] w-28 rounded-full" />
          <div className="mx-auto flex h-10 max-w-3xl items-center justify-center sm:h-12 md:h-[60px]">
            <Skeleton className="h-8 w-2/3 sm:h-10 md:h-12" />
          </div>
          <Lines lines={2} lineHeight={29.25} bar="h-3.5" center className="mx-auto mt-5 max-w-2xl" />
        </div>
      </section>
      <section className="py-20">
        <div className="container mx-auto px-4">
          <TitanTvSeriesSkeleton />
        </div>
      </section>
    </SkeletonRegion>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * /search (no query: hero + discover panels)
 * ══════════════════════════════════════════════════════════════════════════ */

/** `app/search/page.tsx` before a query is typed. */
export function SearchPageSkeleton() {
  return (
    <SkeletonRegion className="min-h-[calc(100dvh-4rem)] bg-background">
      <section className="relative overflow-hidden border-b border-border/70">
        <div className="relative mx-auto max-w-4xl px-4 py-14 text-center sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="flex items-center justify-center gap-2">
            <Skeleton className="h-[26px] w-36 rounded-full" />
            <Skeleton className="hidden h-3 w-56 sm:block" />
          </div>
          <div className="mx-auto mt-6 max-w-3xl">
            <Lines lines={2} lineHeight={58.8} bar="h-10" center className="w-full" last="w-1/2" />
            <Line height={24} width="w-4/5" center className="mx-auto mt-4 max-w-2xl" />
          </div>
          <Skeleton className="mx-auto mt-9 h-16 max-w-2xl rounded-2xl" />
          <div className="mt-6 flex items-center justify-center gap-2">
            <Skeleton className="h-3 w-5" />
            {[53, 76, 86].map((w) => (
              <Skeleton key={w} className="h-[30px] rounded-full" style={{ width: w }} />
            ))}
          </div>
        </div>
      </section>
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-16">
        <div className="grid gap-5 md:grid-cols-[1.15fr_.85fr]">
          <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-xs sm:p-8">
            <Skeleton className="size-11 rounded-full" />
            <Line height={32} bar="h-6" width="w-48" className="mt-6" />
            <Line height={24} width="w-4/5" className="mt-2" />
            <div className="mt-7 grid gap-2 sm:grid-cols-2">
              <Repeat count={4}>{(i) => <Skeleton key={i} className="h-[46px] rounded-xl" />}</Repeat>
            </div>
          </div>
          <div className="rounded-2xl border border-border/70 bg-surface-sunken/50 p-6 sm:p-8">
            <Line height={20} bar="h-2.5" width="w-28" />
            <div className="mt-6 space-y-5">
              <Repeat count={3}>
                {(i) => (
                  <div key={i} className="flex gap-4">
                    <Skeleton className="size-6 shrink-0 rounded-full" />
                    <div className="flex-1">
                      <Line height={20} width="w-32" />
                      <Lines lines={2} lineHeight={20} bar="h-2.5" className="mt-1" />
                    </div>
                  </div>
                )}
              </Repeat>
            </div>
          </div>
        </div>
      </div>
    </SkeletonRegion>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * /cart and /checkout
 * ══════════════════════════════════════════════════════════════════════════ */

/** `components/store/checkout-stepper.tsx`, three steps. */
function StepperSkeleton() {
  return (
    <div className="mb-10 flex items-center gap-3">
      <Repeat count={3}>
        {(i) => (
          <div key={i} className="flex flex-1 items-center gap-3">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <Skeleton className="h-3 w-20" />
            {i < 2 ? <Skeleton className="h-px flex-1" shimmer={false} /> : null}
          </div>
        )}
      </Repeat>
    </div>
  );
}

function StoreHeaderSkeleton() {
  return (
    <div className="mb-10">
      <Line height={20} bar="h-2.5" width="w-16" />
      <div className="mt-3 flex h-10 items-center md:h-11">
        <Skeleton className="h-8 w-56" />
      </div>
      <Line height={22.5} width="w-24" className="mt-2" />
    </div>
  );
}

/** `app/(main)/(store)/cart/page.tsx`: the empty state, or the line items and summary. */
export function CartPageSkeleton() {
  const lines = useRememberedListCount('public-cart', 0, 12);
  if (lines === 0) {
    return (
      <SkeletonRegion>
        <div className="container mx-auto px-4 py-24 md:py-32">
          <EmptyStateSkeleton descriptionLines={1} action="md" />
        </div>
      </SkeletonRegion>
    );
  }
  return (
    <SkeletonRegion>
      <div className="container mx-auto px-4 py-12 md:py-16">
        <StepperSkeleton />
        <StoreHeaderSkeleton />
        <div className="grid gap-8 lg:grid-cols-3 lg:gap-10">
          <div className="space-y-3 lg:col-span-2">
            <Repeat count={lines}>
              {(i) => (
                <div key={i} className="rounded-2xl border border-border/70 bg-card shadow-xs">
                  <div className="flex flex-wrap items-center gap-4 p-4 sm:flex-nowrap sm:p-5">
                    <Skeleton className="aspect-square w-20 shrink-0 rounded-xl" />
                    <div className="min-w-0 flex-1">
                      <Line height={28} bar="h-4" width={W[i % W.length]} />
                      <Line height={20} width="w-16" className="mt-0.5" />
                    </div>
                    <Skeleton className="h-9 w-[104px] rounded-full" />
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="size-7 rounded-full" />
                  </div>
                </div>
              )}
            </Repeat>
          </div>
          <div className="space-y-4 rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
            <Line height={16} bar="h-2.5" width="w-16" />
            <Line height={32} bar="h-6" width="w-40" />
            <div className="space-y-3">
              <Line height={20} width="w-full" />
              <Line height={20} width="w-full" />
              <div className="border-t border-border/70 pt-4">
                <Line height={32} bar="h-6" width="w-full" />
              </div>
            </div>
            <Skeleton className="h-11 w-full rounded-lg bg-primary/25" />
          </div>
        </div>
      </div>
    </SkeletonRegion>
  );
}

/**
 * `app/(main)/(store)/checkout/page.tsx`. An empty cart renders the checkout's own empty
 * state (no redirect); otherwise stepper, header, payment panel and order summary.
 */
export function CheckoutPageSkeleton() {
  const lines = useRememberedListCount('public-cart', 0, 12);
  if (lines === 0) {
    return (
      <SkeletonRegion>
        <div className="container mx-auto px-4 py-24">
          <EmptyStateSkeleton descriptionLines={1} action="md" />
        </div>
      </SkeletonRegion>
    );
  }
  return (
    <SkeletonRegion>
      <div className="container mx-auto px-4 py-12 md:py-16">
        <StepperSkeleton />
        <StoreHeaderSkeleton />
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10">
          <Skeleton className="h-[420px] w-full rounded-2xl" />
          <div className="space-y-4 rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
            <Line height={28} bar="h-4" width="w-32" />
            <Repeat count={lines}>
              {(i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <Skeleton className={cn('h-3', W[i % W.length])} />
                  <Skeleton className="h-3 w-14" />
                </div>
              )}
            </Repeat>
            <div className="border-t border-border/70 pt-4">
              <Line height={32} bar="h-6" />
            </div>
          </div>
        </div>
      </div>
    </SkeletonRegion>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * /account/security
 * ══════════════════════════════════════════════════════════════════════════ */

function SecurityCardSkeleton({ children, titleWidth }: { children: ReactNode; titleWidth: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card shadow-xs">
      {/* CardHeader p-6 gap-1.5: 28px title + 22.75px description. */}
      <div className="flex flex-col gap-1.5 p-6">
        <Line height={28} bar="h-4" width={titleWidth} />
        <Line height={22.75} width="w-3/4" />
      </div>
      <div className="p-6 pt-0">{children}</div>
    </div>
  );
}

function PasswordFieldSkeleton() {
  return (
    <div className="space-y-2">
      <Line height={17} width="w-28" />
      <Skeleton className="h-10 w-full rounded-lg" />
    </div>
  );
}

/** `app/(main)/(academy)/account/security/page.tsx`: four cards, the last one data-sized. */
export function AccountSecurityPageSkeleton() {
  const sessions = useRememberedListCount('public-account-sessions', 3, 40);
  return (
    <SkeletonRegion>
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-12 md:py-16">
        <div>
          <Line height={40} bar="h-8" width="w-64" />
          <Line height={24} width="w-80" className="mt-2" />
        </div>
        <SecurityCardSkeleton titleWidth="w-40">
          <div className="space-y-4">
            <PasswordFieldSkeleton />
            <PasswordFieldSkeleton />
            <PasswordFieldSkeleton />
            <Skeleton className="h-10 w-36 rounded-lg bg-primary/25" />
          </div>
        </SecurityCardSkeleton>
        <SecurityCardSkeleton titleWidth="w-36">
          <div className="space-y-4">
            <PasswordFieldSkeleton />
            <PasswordFieldSkeleton />
            <Skeleton className="h-10 w-40 rounded-lg bg-primary/25" />
          </div>
        </SecurityCardSkeleton>
        <SecurityCardSkeleton titleWidth="w-52">
          <Skeleton className="h-10 w-48 rounded-lg bg-primary/25" />
        </SecurityCardSkeleton>
        <SecurityCardSkeleton titleWidth="w-36">
          <div className="space-y-4">
            {sessions === 0 ? (
              <Line height={20} width="w-48" />
            ) : (
              <div className="space-y-3">
                <Repeat count={sessions}>
                  {(i) => (
                    <div key={i} className="flex h-[70px] items-center justify-between rounded-xl border border-border/70 p-3.5">
                      <div className="space-y-1">
                        <Line height={20} width={['w-56', 'w-48', 'w-52'][i % 3]} />
                        <Line height={16} bar="h-2.5" width="w-40" />
                      </div>
                      {i > 0 ? <Skeleton className="h-9 w-20 rounded-lg" /> : null}
                    </div>
                  )}
                </Repeat>
              </div>
            )}
            <Skeleton className="h-px w-full" shimmer={false} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Line height={20} width="w-40" />
                <Line height={16} bar="h-2.5" width="w-44" />
              </div>
              <Skeleton className="h-9 w-24 rounded-lg" />
            </div>
          </div>
        </SecurityCardSkeleton>
      </div>
    </SkeletonRegion>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * /u/[username]
 * ══════════════════════════════════════════════════════════════════════════ */

/** `app/(main)/(academy)/u/[username]/page.tsx`: cover, identity, stats, tabs, portfolio. */
export function ProfilePageSkeleton() {
  const projects = useRememberedListCount('public-profile-portfolio', 0, 12);
  return (
    <SkeletonRegion className="min-h-screen bg-background">
      <Skeleton className="h-48 w-full rounded-none sm:h-56 md:h-72" />
      <div className="relative z-10 mx-auto -mt-14 max-w-5xl px-4">
        <div className="mb-6 flex flex-col items-start gap-4 sm:flex-row sm:items-end">
          <Skeleton className="size-28 shrink-0 rounded-full border-4 border-background" />
          <div className="min-w-0 flex-1">
            <div className="flex h-9 items-center sm:h-10">
              <Skeleton className="h-7 w-56 sm:h-8" />
            </div>
            <Line height={20} width="w-28" className="mt-2" />
          </div>
          <div className="mt-4 flex items-center gap-2 sm:mt-0">
            <Skeleton className="h-10 w-28 rounded-full bg-primary/25" />
            <Skeleton className="h-10 w-28 rounded-full" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border/70 bg-border/70 shadow-xs sm:grid-cols-5">
          <Repeat count={5}>
            {(i) => (
              <div key={i} className="bg-card px-4 py-4">
                <Line height={32} bar="h-6" width="w-10" />
                <Line height={16} bar="h-2.5" width="w-20" className="mt-1" />
              </div>
            )}
          </Repeat>
        </div>
        <div className="mb-8 mt-10 flex gap-1 border-b border-border/70">
          <Repeat count={2}>
            {(i) => (
              <div key={i} className="flex items-center gap-2 px-4 py-3">
                <Skeleton className="size-4 rounded" shimmer={false} />
                <Skeleton className="h-3 w-16" />
              </div>
            )}
          </Repeat>
        </div>
        {projects === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-16 text-center">
            <Skeleton className="mx-auto mb-3 size-12 rounded-full" />
            <Line height={20} width="w-48" center />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 pb-12 sm:grid-cols-2 lg:grid-cols-3">
            <Repeat count={projects}>
              {(i) => (
                <div key={i} className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xs">
                  <Skeleton className="aspect-video w-full rounded-none" />
                  <div className="p-5">
                    <Line height={28} bar="h-4" width={W[i % W.length]} className="mb-1" />
                    <Lines lines={2} lineHeight={20} className="mb-3" />
                    <Line height={16} bar="h-2.5" width="w-24" />
                  </div>
                </div>
              )}
            </Repeat>
          </div>
        )}
      </div>
    </SkeletonRegion>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * In-page loading states
 *
 * Pages that fetch in the browser render their shell at once and show these while their data
 * arrives. They used to show a line of "loading…" text, so the page jumped when the data came.
 * ══════════════════════════════════════════════════════════════════════════ */

/** Active sessions on /account/security: one 70px row per session the page last listed. */
export function SessionRowsLoading() {
  const rows = useRememberedListCount('public-account-sessions', 3, 30);
  return (
    <SkeletonRegion>
      {rows === 0 ? (
        <Line height={20} width="w-56" />
      ) : (
        <div className="space-y-3">
          <Repeat count={rows}>
            {(i) => (
              <div key={i} className="flex h-[70px] items-center justify-between rounded-xl border border-border/70 p-3.5">
                <div className="space-y-1">
                  <Line height={20} width={['w-40', 'w-32', 'w-44'][i % 3]} />
                  <Line height={16} bar="h-2" width="w-36" />
                </div>
                {i > 0 && <Skeleton className="h-8 w-16 rounded-lg" />}
              </div>
            )}
          </Repeat>
        </div>
      )}
    </SkeletonRegion>
  );
}

/** Portfolio on /settings/profile: its dashed empty box at zero, else that many cards. */
export function PortfolioLoading() {
  const items = useRememberedListCount('settings-portfolio', 0, 24);
  return (
    <SkeletonRegion>
      {items === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-8 py-12 text-center">
          <Skeleton className="mx-auto size-12 rounded-full" />
          <Line height={24} width="w-40" center className="mt-3" />
          <Line height={16} bar="h-2" width="w-56" center />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Repeat count={items}>
            {(i) => (
              <div key={i} className="rounded-xl border border-border/70 bg-card p-4 shadow-xs">
                <Line height={20} width={['w-40', 'w-32', 'w-48'][i % 3]} />
                <Skeleton className="mt-3 h-28 w-full rounded-lg" />
                <Line height={19.5} bar="h-2" width="w-4/5" className="mt-2" />
              </div>
            )}
          </Repeat>
        </div>
      )}
    </SkeletonRegion>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * Text-matched lines
 *
 * The replicas below size their text runs with the page's own type classes instead of a
 * measured pixel height: each line holds a no-break space, so the browser gives it exactly the
 * line box the real copy gets (font, size, leading and all), and a bar is laid over it.
 * ══════════════════════════════════════════════════════════════════════════ */

const NBSP = ' ';

/** `lines` line boxes of the type set by `className` (put the copy's own text classes there). */
function TextLines({
  className,
  lines = 1,
  width = 'w-1/2',
  last = 'w-3/5',
  bar = 'h-3',
  center = false,
}: {
  className?: string;
  lines?: number;
  width?: string;
  last?: string;
  bar?: string;
  center?: boolean;
}) {
  return (
    <div className={className}>
      <Repeat count={lines}>
        {(i) => (
          <div key={i} className="relative">
            {NBSP}
            <div className={cn('absolute inset-0 flex items-center', center && 'justify-center')}>
              <Skeleton className={cn(bar, 'max-w-full', i === lines - 1 && lines > 1 ? last : width)} />
            </div>
          </div>
        )}
      </Repeat>
    </div>
  );
}

/** An inline run of text (inside a legend, a tab, a button): a no-break space under a bar. */
function InlineText({ width, bar = 'h-3' }: { width: number; bar?: string }) {
  return (
    <span className="relative inline-block align-baseline" style={{ width }}>
      {NBSP}
      <span className={cn('absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-md bg-muted/80', bar)} />
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * /account/partner
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * `app/(main)/(academy)/account/partner/page.tsx`: heading, then the dashed "No applications
 * yet." box at zero or one card per application. The trailing empty div stands in for the
 * page's always-rendered (and at zero, empty) list, which still takes its `space-y-6` gap.
 */
export function AccountPartnerPageSkeleton() {
  const items = useRememberedListCount('public-account-partner', 0, 20);
  return (
    <SkeletonRegion>
      <div className="mx-auto max-w-3xl space-y-6 px-6 py-12 md:py-16">
        <TextLines
          className="font-display text-3xl font-medium tracking-[-0.02em] sm:text-4xl"
          bar="h-7"
          width="w-80"
        />
        {items === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-6 py-10">
            <TextLines width="w-40" center />
          </div>
        ) : null}
        <div className="space-y-3">
          <Repeat count={items}>
            {(i) => (
              <div key={i} className="rounded-xl border border-border/70 bg-card p-5 shadow-xs">
                <div className="flex items-center justify-between gap-3">
                  <TextLines className="flex-1 font-display text-lg font-medium" bar="h-4" width={W[i % W.length]} />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <TextLines className="mt-1 text-xs" bar="h-2.5" width="w-44" />
              </div>
            )}
          </Repeat>
        </div>
      </div>
    </SkeletonRegion>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * /groups/mine and /groups/new
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * The body of `/groups/mine` under its header: the `EmptyState` at zero, else one `GroupCard`
 * with its role badge and View / Leave buttons per group. Also the page's own loading branch.
 */
export function MyGroupsLoading() {
  const groups = useRememberedListCount('public-my-groups', 0, 12);
  if (groups === 0) return <EmptyStateSkeleton descriptionLines={1} action="md" />;
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
      <Repeat count={groups}>
        {(i) => (
          <div key={i} className="flex flex-col gap-3">
            <div className="flex flex-1 flex-col">
              <GroupCardSkeleton index={i} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="me-auto h-[22px] w-16 rounded-full" />
              <Skeleton className="h-9 w-[74px] rounded-lg" />
              <Skeleton className="h-9 w-[78px] rounded-lg" />
            </div>
          </div>
        )}
      </Repeat>
    </div>
  );
}

/** `app/(main)/groups/mine/page.tsx`: title and hint beside two buttons, then the groups. */
export function MyGroupsPageSkeleton() {
  return (
    <SkeletonRegion>
      <div className="container mx-auto px-4 py-10 md:py-14">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <TextLines
              className="font-display text-3xl font-medium tracking-[-0.022em] md:text-4xl"
              bar="h-7"
              width="w-48"
            />
            <TextLines className="mt-2 text-sm leading-relaxed" width="w-60" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32 rounded-lg" />
            <Skeleton className="h-10 w-32 rounded-lg bg-primary/25" />
          </div>
        </div>
        <MyGroupsLoading />
      </div>
    </SkeletonRegion>
  );
}

/** A `Label` + `Input` pair of `GroupForm`, with `hint` lines of `text-xs` help below. */
function GroupFieldSkeleton({ span = false, hint = 0, label = 'w-24', textarea = false }: {
  span?: boolean;
  hint?: number;
  label?: string;
  textarea?: boolean;
}) {
  return (
    <div className={cn('space-y-2', span && 'md:col-span-2')}>
      {/* The label is inline in the real field, so it sits on the parent's line box. */}
      <div className="relative">
        <span className="text-sm font-medium leading-none">{NBSP}</span>
        <div className="absolute inset-0 flex items-center">
          <Skeleton className={cn('h-3', label)} />
        </div>
      </div>
      {/* `Textarea rows={4}`: four 20px lines + py-2 + border. */}
      <Skeleton className={cn('w-full rounded-lg', textarea ? 'h-[98px]' : 'h-10')} />
      {hint > 0 ? <TextLines className="text-xs" lines={hint} bar="h-2.5" width={hint > 1 ? 'w-full' : 'w-2/3'} /> : null}
    </div>
  );
}

/** `app/(main)/groups/new/page.tsx`: `GroupFormShell` around the hint, `GroupForm` and back link. */
export function NewGroupPageSkeleton() {
  return (
    <SkeletonRegion>
      <div className="mx-auto max-w-3xl px-4 py-10 md:py-14">
        <TextLines
          className="mb-8 font-display text-3xl font-medium tracking-[-0.022em] md:text-4xl"
          bar="h-7"
          width="w-56"
        />
        <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-xs sm:p-8">
          <TextLines className="mb-6 text-sm" width="w-4/5" />
          <div className="space-y-6">
            <div className="grid gap-5 md:grid-cols-2">
              <GroupFieldSkeleton span hint={1} label="w-12" />
              <GroupFieldSkeleton span textarea label="w-20" />
              <GroupFieldSkeleton label="w-10" />
              <GroupFieldSkeleton label="w-24" />
              <GroupFieldSkeleton span label="w-16" />
              <GroupFieldSkeleton label="w-36" />
              <GroupFieldSkeleton hint={1} label="w-28" />
              {/* The academy hint wraps to two lines in a half-width column. */}
              <GroupFieldSkeleton hint={2} label="w-16" />
              <GroupFieldSkeleton label="w-28" />
              <fieldset className="space-y-2 rounded-xl border border-border/70 bg-muted/30 p-4 md:col-span-2">
                <legend className="px-1 text-sm font-medium">
                  <InlineText width={176} />
                </legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <GroupFieldSkeleton label="w-16" />
                  <GroupFieldSkeleton label="w-20" />
                </div>
                <TextLines className="text-xs" bar="h-2.5" width="w-4/5" />
              </fieldset>
            </div>
            <div className="flex flex-wrap gap-3 border-t border-border/60 pt-6">
              <Skeleton className="h-10 w-32 rounded-lg bg-primary/25" />
              <Skeleton className="h-10 w-24 rounded-lg" />
            </div>
          </div>
          <TextLines className="mt-6 text-sm" width="w-28" />
        </div>
      </div>
    </SkeletonRegion>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * /notifications
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * The inbox under the tabs: the `EmptyState` at zero, else the notification rows grouped by
 * day as the page last showed them (rows, days, rows with a body line, a "Show more" button).
 */
export function NotificationRowsLoading() {
  const rows = useRememberedListCount('public-notifications', 16, 40);
  const days = Math.min(Math.max(1, useRememberedListCount('public-notification-days', 2, 40)), Math.max(1, rows));
  const bodies = useRememberedListCount('public-notification-bodies', rows, 40);
  const more = useRememberedListCount('public-notifications-more', 0, 1) > 0;
  if (rows === 0) return <EmptyStateSkeleton descriptionLines={2} />;
  const perDay = Array.from({ length: days }, (_, d) => Math.floor(rows / days) + (d < rows % days ? 1 : 0));
  let offset = 0;
  return (
    <div className="space-y-8" aria-hidden="true">
      {perDay.map((count, d) => {
        const start = offset;
        offset += count;
        return (
          <div key={d}>
            <TextLines className="mb-3 px-1 text-xs font-medium" bar="h-2.5" width="w-20" />
            <div className="space-y-2">
              <Repeat count={count}>
                {(i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl border border-border/70 bg-card p-3.5 shadow-xs sm:p-4">
                    <div className="flex min-w-0 flex-1 items-center gap-3.5">
                      <Skeleton className="size-10 shrink-0 rounded-full" />
                      <div className="min-w-0 flex-1">
                        <TextLines className="text-sm" width={W[(start + i) % W.length]} />
                        {start + i < bodies ? (
                          <TextLines className="mt-0.5 text-sm leading-relaxed" width="w-4/5" bar="h-2.5" />
                        ) : null}
                        <TextLines className="mt-1.5 text-xs" width="w-16" bar="h-2" />
                      </div>
                    </div>
                  </div>
                )}
              </Repeat>
            </div>
          </div>
        );
      })}
      {more ? (
        <div className="flex justify-center pt-2">
          <Skeleton className="h-10 w-28 rounded-lg" />
        </div>
      ) : null}
    </div>
  );
}

/** `app/(main)/(social)/notifications/page.tsx`: header, All / Unread tabs, the inbox. */
export function NotificationsPageSkeleton() {
  return (
    <SkeletonRegion>
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:py-14">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <TextLines
              className="font-display text-3xl font-medium tracking-[-0.022em] md:text-4xl"
              bar="h-7"
              width="w-56"
            />
            <TextLines className="mt-2 text-sm" width="w-52" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        {/* `Tabs` is a block around an inline-flex list, so the list sits on a line box. */}
        <div>
          <div className="mb-6 inline-flex items-center gap-1 rounded-xl border border-border/70 bg-muted/70 p-1">
            <span className="inline-flex items-center rounded-lg px-3.5 py-1.5 text-[13px] font-medium">
              <InlineText width={18} />
            </span>
            <span className="inline-flex items-center rounded-lg px-3.5 py-1.5 text-[13px] font-medium">
              <InlineText width={44} />
            </span>
          </div>
        </div>
        <NotificationRowsLoading />
      </div>
    </SkeletonRegion>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * /repair
 * ══════════════════════════════════════════════════════════════════════════ */

/** The shop list column of /repair: its dashed empty box at zero, else that many shop cards. */
export function RepairShopsLoading() {
  const shops = useRememberedListCount('public-repair', 3, 12);
  if (shops === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/60 py-14 text-center" aria-hidden="true">
        <Skeleton className="mx-auto mb-3 size-12 rounded-full" />
        <TextLines className="font-display text-lg font-medium" bar="h-4" width="w-40" center />
      </div>
    );
  }
  return (
    <div className="space-y-3" aria-hidden="true">
      <Repeat count={shops}>
        {(i) => (
          <div key={i} className="rounded-xl border border-border/70 bg-card p-5 shadow-xs">
            <TextLines className="font-display text-base font-medium" bar="h-4" width={W[i % W.length]} />
            <Skeleton className="mt-1.5 h-5 w-24 rounded-full" />
            <TextLines className="mt-3 text-xs" bar="h-2.5" width="w-32" />
            <TextLines className="mt-2 text-xs" bar="h-2.5" width="w-24" />
          </div>
        )}
      </Repeat>
    </div>
  );
}

/** `app/(main)/(social)/repair/page.tsx`: header, category chips + search, list beside the map. */
export function RepairPageSkeleton() {
  return (
    <SkeletonRegion>
      <div className="container mx-auto px-4 py-10 md:py-14">
        <div className="mb-8 max-w-2xl">
          <TextLines
            className="font-display text-3xl font-medium tracking-[-0.022em] md:text-4xl"
            bar="h-7"
            width="w-96"
          />
          <TextLines className="mt-2 leading-relaxed" width="w-64" />
        </div>
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-wrap gap-1.5">
            {[20, 76, 66, 80, 72, 146].map((w) => (
              <div key={w} className="rounded-full border border-border/70 bg-card px-3.5 py-1.5 text-sm font-medium">
                <InlineText width={w} />
              </div>
            ))}
          </div>
          <Skeleton className="h-10 w-full rounded-lg sm:ms-auto sm:w-64" />
        </div>
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="max-h-[70vh] overflow-hidden pe-2 lg:col-span-2">
            <RepairShopsLoading />
          </div>
          <div className="lg:col-span-3">
            <Skeleton className="h-[400px] w-full rounded-2xl lg:h-[70vh]" />
          </div>
        </div>
      </div>
    </SkeletonRegion>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * /sponsors
 * ══════════════════════════════════════════════════════════════════════════ */

/** The sponsor section body: the dashed empty box at zero, else a tier heading over the cards. */
export function SponsorsLoading() {
  const sponsors = useRememberedListCount('public-sponsors', 0, 24);
  if (sponsors === 0) {
    return (
      <div
        className="mx-auto flex max-w-md flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-20 text-center"
        aria-hidden="true"
      >
        <TextLines className="w-full font-display text-xl font-medium" bar="h-5" width="w-40" center />
        <TextLines className="mt-2 w-full text-sm" width="w-64" center />
      </div>
    );
  }
  return (
    <div aria-hidden="true">
      <div className="mb-8 flex items-center gap-3">
        <Skeleton className="size-9 shrink-0 rounded-full" />
        <TextLines className="flex-1 font-display text-2xl font-medium md:text-3xl" bar="h-6" width="w-60" />
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Repeat count={sponsors}>
          {(i) => (
            <div key={i} className="rounded-2xl border border-border/70 bg-card p-6 shadow-xs">
              <div className="mb-5 flex items-start justify-between">
                <Skeleton className="size-14 rounded-xl" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <TextLines className="font-display text-lg font-medium" bar="h-4" width={W[i % W.length]} />
              <TextLines className="mt-1.5 text-sm leading-relaxed" lines={2} />
              <TextLines className="mt-4 text-sm font-medium" width="w-28" />
            </div>
          )}
        </Repeat>
      </div>
    </div>
  );
}

/** `app/(main)/sponsors/page.tsx`: centred hero with the partner button, then the sponsors. */
export function SponsorsPageSkeleton() {
  return (
    <SkeletonRegion>
      <section className="relative isolate overflow-hidden border-b border-border/70 py-20 text-center md:py-28">
        <div className="container mx-auto px-4">
          <TextLines
            className="mx-auto mb-5 max-w-3xl font-display text-4xl font-medium tracking-[-0.025em] sm:text-5xl md:text-6xl"
            bar="h-10 md:h-12"
            width="w-80"
            center
          />
          {/* The subtitle wraps to two lines at the 672px measure. */}
          <TextLines
            className="mx-auto mb-9 max-w-2xl text-lg leading-relaxed"
            lines={2}
            bar="h-3.5"
            width="w-full"
            last="w-1/2"
            center
          />
          <div className="inline-flex h-11 w-48 items-center justify-center rounded-lg bg-primary/25 px-6 text-sm font-medium">
            {NBSP}
          </div>
        </div>
      </section>
      <section className="py-20 md:py-24">
        <div className="container mx-auto px-4">
          <SponsorsLoading />
        </div>
      </section>
    </SkeletonRegion>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * /settings/preferences/notifications
 * ══════════════════════════════════════════════════════════════════════════ */

/** One `SettingsSection` of four `SettingsRow`s with switches. */
function PreferenceChannelSkeleton({ title }: { title: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs">
      <div className="flex items-start gap-3 px-6 pb-4 pt-5">
        <Skeleton className="mt-0.5 size-8 shrink-0 rounded-lg" />
        <TextLines
          className="min-w-0 flex-1 font-display text-lg font-medium leading-snug tracking-[-0.012em]"
          bar="h-4"
          width={title}
        />
      </div>
      <div className="divide-y divide-border/60 border-t border-border/60">
        <Repeat count={4}>
          {(i) => (
            <div key={i} className="flex items-center justify-between gap-4 px-6 py-4">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Skeleton className="size-4 shrink-0 rounded" shimmer={false} />
                <div className="min-w-0 flex-1">
                  <TextLines className="text-sm font-medium" width={['w-16', 'w-20', 'w-24', 'w-20'][i]} />
                  <TextLines className="text-xs leading-relaxed" bar="h-2.5" width={['w-60', 'w-72', 'w-64', 'w-56'][i]} />
                </div>
              </div>
              <Skeleton className="h-6 w-11 shrink-0 rounded-full" />
            </div>
          )}
        </Repeat>
      </div>
    </div>
  );
}

/**
 * `settings/preferences/notifications/page.tsx` inside the settings shell: header, the email
 * and in-app channels (four categories each) and the save bar. Used by the route's loading.tsx
 * and by the page while the auth store hydrates and the preferences load.
 */
export function NotificationPreferencesSkeleton() {
  return (
    <SkeletonRegion>
      <div className="space-y-6">
        <div className="flex items-start gap-4">
          <Skeleton className="mt-0.5 size-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1">
            <TextLines
              className="font-display text-2xl font-medium tracking-[-0.02em] sm:text-[1.75rem]"
              bar="h-6"
              width="w-44"
            />
            <TextLines className="mt-1.5 max-w-2xl text-sm leading-relaxed" width="w-96" />
          </div>
          <Skeleton className="hidden h-9 w-24 shrink-0 rounded-full sm:block" />
        </div>
        <div className="space-y-6">
          <PreferenceChannelSkeleton title="w-44" />
          <PreferenceChannelSkeleton title="w-40" />
        </div>
        <div className="mt-6 flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card px-4 py-3 shadow-lg">
          <TextLines className="flex-1 text-xs" bar="h-2.5" width="w-52" />
          <Skeleton className="h-10 w-40 rounded-full bg-primary/25" />
        </div>
      </div>
    </SkeletonRegion>
  );
}
