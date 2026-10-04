'use client';

import * as React from 'react';
import {
  LoadingShell,
  Skeleton,
  SkeletonArticle,
  SkeletonCard,
  SkeletonCircle,
  SkeletonCourseCard,
  SkeletonEvent,
  SkeletonField,
  SkeletonHeading,
  SkeletonInput,
  SkeletonList,
  SkeletonProducts,
  SkeletonSplit,
  SkeletonStat,
  SkeletonStats,
  SkeletonTable,
  SkeletonText,
} from '@/components/ui/skeleton';
import { Stagger, StaggerItem } from '@/components/ui/motion';
import { cn } from '@/lib/utils';

/**
 * ROUTE SKELETONS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * One composition per screen shape, so each `loading.tsx` is a single line and
 * every placeholder mirrors the layout of the page it stands in for.
 *
 * These compose the primitives in `components/ui/skeleton` rather than writing
 * their own markup. An earlier draft inlined ~700 lines of hand-rolled card,
 * table and list shapes here — which meant the kit's `SkeletonCard` /
 * `SkeletonTable` / `SkeletonList` had no callers at all, and any change to a
 * card's spacing had to be made twice. Everything below is now assembled from
 * the kit.
 *
 * Client components: `Stagger` needs framer-motion, and `loading.tsx` renders
 * inside the app's provider tree.
 */

/* ═══════════════════════════════════════════════════════════════════════════
 * Shared sub-shapes
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Body copy with a ragged last line. */
function BodyCopy({
  lines = 3,
  lastLineWidth = 0.6,
}: {
  lines?: number;
  lastLineWidth?: number;
}) {
  return <SkeletonText lines={lines} lastLineWidth={lastLineWidth} />;
}

/** Two ghost buttons, right-aligned, sized like the real form actions. */
function FormActions() {
  return (
    <div className="flex justify-end gap-3 border-t border-border pt-5">
      <Skeleton className="h-9 w-24 rounded-md" />
      <Skeleton className="h-9 w-24 rounded-md" />
    </div>
  );
}

/** A labelled input, optionally with helper text — mirrors the real field. */
function Field({ help = false, textarea = false }: { help?: boolean; textarea?: boolean }) {
  return (
    <div className="space-y-2">
      <Skeleton className="h-3 w-28" />
      <SkeletonInput rows={textarea ? 3 : 1} />
      {help && <Skeleton className="h-2.5 w-52" />}
    </div>
  );
}

/** Heading + body + actions, the shape of most settings and editor screens. */
function FormPanel({ fields = 5 }: { fields?: number }) {
  return (
    <div className="space-y-6 rounded-xl border border-border bg-card p-6">
      {Array.from({ length: fields }).map((_, i) => (
        <Field key={i} help={i % 3 === 0} textarea={i % 4 === 3} />
      ))}
      <FormActions />
    </div>
  );
}

/** An order-summary sidebar: line items, a total, then a primary button. */
function SummaryAside({ action = true }: { action?: boolean }) {
  return (
    <aside className="space-y-4 rounded-xl border border-border bg-card p-6">
      <Skeleton className="h-4 w-28" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-14" />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-border pt-4">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-5 w-24" />
      </div>
      {action && <Skeleton className="h-11 w-full rounded-md" />}
    </aside>
  );
}

/** A row of rounded filter chips. */
function ChipRow({ count = 5, width = 'w-24' }: { count?: number; width?: string }) {
  return (
    <div className="flex gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={`h-8 ${width} rounded-full`} />
      ))}
    </div>
  );
}

/** Tab-like pills, used on profile and CMS pages. */
function TabRow({ count = 4 }: { count?: number }) {
  return (
    <div className="flex gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-28 rounded-lg" />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Public / marketing
 * ═══════════════════════════════════════════════════════════════════════════ */

export function LandingSkeleton() {
  return (
    <LoadingShell label="Loading" containerClassName="py-0">
      <section className="mx-auto flex max-w-3xl flex-col items-center gap-5 py-20 text-center">
        <Skeleton className="h-6 w-44 rounded-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-4/5" />
        <div className="w-full max-w-xl">
          <BodyCopy lines={2} />
        </div>
        <div className="mt-3 flex gap-3">
          <Skeleton className="h-11 w-40 rounded-md" />
          <Skeleton className="h-11 w-32 rounded-md" />
        </div>
      </section>
      <section className="py-14">
        <SkeletonHeading className="mb-8" titleWidth="42%" />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} lines={2} />
          ))}
        </div>
      </section>
    </LoadingShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Detail pages — breadcrumbs, hero, body, optional sidebar
 * ═══════════════════════════════════════════════════════════════════════════ */

export function DetailPageSkeleton({
  breadcrumbs = true,
  withSidebar = false,
}: {
  breadcrumbs?: boolean;
  withSidebar?: boolean;
}) {
  return (
    <LoadingShell label="Loading">
      <div className="space-y-8">
        {breadcrumbs && (
          <div className="flex items-center gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-3" style={{ width: i === 2 ? 72 : 48 }} />
            ))}
          </div>
        )}

        <div className={cn('grid gap-10', withSidebar && 'lg:grid-cols-[minmax(0,1fr)_20rem]')}>
          <div className="space-y-6">
            <Skeleton className="aspect-[21/9] w-full rounded-xl" />
            <SkeletonHeading lines={2} titleWidth="62%" />
            {/* Body paragraphs cascade in. `whileInView` fires immediately here
                because the block is on screen, so this reads as the copy
                settling rather than the page hanging. */}
            <Stagger gap={0.05}>
              {Array.from({ length: 4 }).map((_, i) => (
                <StaggerItem key={i}>
                  <BodyCopy lines={3} />
                </StaggerItem>
              ))}
            </Stagger>
          </div>

          {withSidebar && (
            <aside className="space-y-5">
              <SkeletonStat />
              <SkeletonCard media={false} lines={3} />
              <SkeletonCard media={false} lines={2} />
            </aside>
          )}
        </div>
      </div>
    </LoadingShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Index pages
 * ═══════════════════════════════════════════════════════════════════════════ */

export function GridIndexSkeleton({ cards = 6, title = '60%' }: { cards?: number; title?: string }) {
  return (
    <LoadingShell label="Loading">
      <div className="space-y-8">
        <SkeletonHeading titleWidth={title} />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: cards }).map((_, i) => (
            <SkeletonCard key={i} lines={3} />
          ))}
        </div>
      </div>
    </LoadingShell>
  );
}

export function ListIndexSkeleton({
  rows = 5,
  avatars = false,
}: {
  rows?: number;
  avatars?: boolean;
}) {
  return (
    <LoadingShell label="Loading">
      <div className="space-y-8">
        <SkeletonHeading lines={1} titleWidth="38%" />
        <SkeletonList count={rows} avatar={avatars} lines={2} />
      </div>
    </LoadingShell>
  );
}

export function TableIndexSkeleton({
  rows = 6,
  columns = ['2fr', '1fr', '1fr', '120px'],
}: {
  rows?: number;
  columns?: string[];
}) {
  return (
    <LoadingShell label="Loading">
      <div className="space-y-8">
        <SkeletonHeading lines={1} titleWidth="32%" />
        <SkeletonTable rows={rows} columns={columns} />
      </div>
    </LoadingShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Auth — the layout already renders the card, so this is frameless
 * ═══════════════════════════════════════════════════════════════════════════ */

export function AuthSkeleton({ fields = 2, note }: { fields?: number; note?: boolean }) {
  // No card, no gutters, no centring: `(auth)/layout.tsx` renders a bordered
  // panel with its own p-8 inside a min-h-screen flex container. Anything added
  // here nests a second card inside the first.
  return (
    <div role="status" aria-busy="true" aria-live="polite" aria-label="Loading">
      <span className="sr-only">Loading</span>
      <div className="mx-auto flex min-h-[520px] max-w-md flex-col justify-center py-4">
        <div className="mb-8 text-center">
          <Skeleton className="mx-auto mb-4 size-12 rounded-xl" />
          <Skeleton className="mx-auto h-6 w-52" />
        </div>
        <div className="space-y-5">
          {Array.from({ length: fields }).map((_, i) => (
            <SkeletonField key={i} className="space-y-2" />
          ))}
          <Skeleton className="h-10 w-full rounded-md" />
          {note && <Skeleton className="mx-auto h-3 w-44" />}
        </div>
      </div>
    </div>
  );
}

/** Verification / callback pages: a spinner-free "working on it" card. */
export function VerifyingSkeleton() {
  // Frameless for the same reason as AuthSkeleton — the auth layout owns it.
  return (
    <div role="status" aria-busy="true" aria-live="polite" aria-label="Verifying">
      <span className="sr-only">Verifying</span>
      <div className="mx-auto flex min-h-[520px] max-w-md flex-col items-center justify-center space-y-5 py-4 text-center">
        <SkeletonCircle className="size-12" />
        <Skeleton className="h-5 w-56" />
        <div className="w-full max-w-xs">
          <BodyCopy lines={2} />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Account / settings
 * ═══════════════════════════════════════════════════════════════════════════ */

export function SettingsSkeleton({ fields = 5 }: { fields?: number }) {
  return (
    <LoadingShell label="Loading">
      <SkeletonSplit
        content={
          <div className="space-y-8">
            <SkeletonHeading lines={1} titleWidth="34%" />
            <FormPanel fields={fields} />
          </div>
        }
      />
    </LoadingShell>
  );
}

export function FormPageSkeleton({ fields = 5 }: { fields?: number }) {
  return (
    <LoadingShell label="Loading">
      <div className="mx-auto max-w-3xl space-y-8">
        <SkeletonHeading lines={1} titleWidth="30%" />
        <FormPanel fields={fields} />
      </div>
    </LoadingShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Store
 * ═══════════════════════════════════════════════════════════════════════════ */

export function StoreSkeleton() {
  return (
    <LoadingShell label="Loading" containerClassName="mx-auto max-w-7xl">
      <div className="space-y-8">
        <SkeletonHeading titleWidth="46%" />
        <SkeletonProducts count={8} />
      </div>
    </LoadingShell>
  );
}

export function CartSkeleton() {
  return (
    <LoadingShell label="Loading">
      <div className="space-y-8">
        <SkeletonHeading lines={1} titleWidth="26%" />
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <SkeletonList count={3} avatar lines={2} trailing={false} />
          <SummaryAside />
        </div>
      </div>
    </LoadingShell>
  );
}

export function CheckoutSkeleton() {
  return (
    <LoadingShell label="Loading">
      <div className="mx-auto max-w-5xl space-y-8">
        <SkeletonHeading lines={1} titleWidth="30%" />
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-6">
            <div className="space-y-4 rounded-xl border border-border bg-card p-6">
              <Skeleton className="h-4 w-40" />
              <div className="space-y-4">
                <Field />
                <Field />
              </div>
            </div>
            <div className="space-y-4 rounded-xl border border-border bg-card p-6">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-24 w-full rounded-md" />
            </div>
          </div>
          <aside className="space-y-4 rounded-xl border border-border bg-card p-6">
            <Skeleton className="h-4 w-28" />
            <SkeletonList count={2} avatar lines={1} trailing={false} />
            <Skeleton className="h-11 w-full rounded-md" />
          </aside>
        </div>
      </div>
    </LoadingShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Social
 * ═══════════════════════════════════════════════════════════════════════════ */

export function FeedSkeleton() {
  return (
    <LoadingShell label="Loading" containerClassName="mx-auto max-w-6xl">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <div className="flex gap-3 rounded-xl border border-border bg-card p-5">
            <SkeletonCircle className="size-10 shrink-0" />
            <Skeleton className="h-10 flex-1 rounded-md" />
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonArticle key={i} />
          ))}
        </div>
        <aside className="hidden space-y-4 lg:block">
          <SkeletonCard media={false} lines={3} />
          <SkeletonCard media={false} lines={5} />
        </aside>
      </div>
    </LoadingShell>
  );
}

export function NotificationListSkeleton() {
  return (
    <LoadingShell label="Loading">
      <div className="mx-auto max-w-3xl space-y-8">
        <SkeletonHeading lines={1} titleWidth="30%" />
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-start gap-4 p-4">
              <SkeletonCircle className="size-9 shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-2.5 w-12 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </LoadingShell>
  );
}

export function ProfileSkeleton() {
  return (
    <LoadingShell label="Loading">
      <div className="space-y-8">
        <Skeleton className="h-32 w-full rounded-xl" />
        {/* Overlapping identity block: the avatar hangs below the cover by half
            its height, which is what the real profile does. */}
        <div className="-mt-10 flex items-end gap-4 px-2">
          <SkeletonCircle className="size-24 border-4 border-background" />
          <div className="flex-1 space-y-2 pb-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-3 w-64" />
          </div>
          <Skeleton className="mb-2 h-9 w-28 rounded-md" />
        </div>
        <TabRow />
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-3 rounded-xl border border-border bg-card p-5">
                <div className="flex items-center gap-3">
                  <SkeletonCircle className="size-9" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-2.5 w-16" />
                  </div>
                </div>
                <BodyCopy lines={2} />
              </div>
            ))}
          </div>
          <aside className="space-y-4">
            <SkeletonCard media={false} lines={2} />
            <SkeletonCard media={false} lines={4} />
          </aside>
        </div>
      </div>
    </LoadingShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Events / learning / courses
 * ═══════════════════════════════════════════════════════════════════════════ */

export function EventsSkeleton() {
  return (
    <LoadingShell label="Loading">
      <div className="space-y-8">
        <SkeletonHeading titleWidth="40%" />
        <ChipRow count={5} />
        <SkeletonList count={5} avatar lines={2} trailing={false} />
      </div>
    </LoadingShell>
  );
}

export function LearningSkeleton() {
  return (
    <LoadingShell label="Loading" containerClassName="mx-auto max-w-6xl">
      <div className="space-y-8">
        <SkeletonHeading titleWidth="44%" />
        <SkeletonStats count={3} />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} lines={2} footer />
          ))}
        </div>
      </div>
    </LoadingShell>
  );
}

export function CoursesSkeleton() {
  return (
    <LoadingShell label="Loading" containerClassName="mx-auto max-w-7xl">
      <div className="space-y-8">
        <SkeletonHeading titleWidth="38%" />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCourseCard key={i} />
          ))}
        </div>
      </div>
    </LoadingShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Media / map / search
 * ═══════════════════════════════════════════════════════════════════════════ */

export function MediaPageSkeleton() {
  return (
    <LoadingShell label="Loading">
      <div className="space-y-8">
        <SkeletonHeading titleWidth="30%" />
        <Skeleton className="aspect-video w-full rounded-xl" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <SkeletonList count={4} lines={1} trailing={false} />
          <aside className="space-y-4">
            <SkeletonCard media={false} lines={5} />
            <SkeletonCard media={false} lines={2} />
          </aside>
        </div>
      </div>
    </LoadingShell>
  );
}

export function MapPageSkeleton() {
  return (
    <LoadingShell label="Loading">
      <div className="space-y-8">
        <SkeletonHeading titleWidth="36%" />
        <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <SkeletonList count={6} avatar lines={1} />
          <Skeleton className="h-[32rem] w-full rounded-xl" />
        </div>
      </div>
    </LoadingShell>
  );
}

export function SearchSkeleton() {
  return (
    <LoadingShell label="Searching">
      <div className="mx-auto max-w-4xl space-y-8">
        <Skeleton className="h-12 w-full rounded-lg" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-8 w-28 rounded-md" />
        </div>
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <Skeleton className="size-10 shrink-0 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-1/2" />
                <Skeleton className="h-3 w-3/4" />
              </div>
              <Skeleton className="hidden h-6 w-20 rounded-full sm:block" />
            </div>
          ))}
        </div>
      </div>
    </LoadingShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Narrow standalone tasks
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Certificate verification (`/verify`, `/verify/[number]`). */
export function VerifySkeleton() {
  return (
    <LoadingShell label="Loading" containerClassName="mx-auto max-w-xl py-16">
      <div className="space-y-6 text-center">
        <Skeleton className="mx-auto size-12 rounded-xl" />
        <Skeleton className="mx-auto h-6 w-64" />
        <div className="mx-auto w-full max-w-sm">
          <BodyCopy lines={2} />
        </div>
        <Skeleton className="mx-auto h-11 w-40 rounded-md" />
      </div>
    </LoadingShell>
  );
}

/** Offline page: a status card with two actions. */
export function OfflineSkeleton() {
  return (
    <LoadingShell label="Loading" containerClassName="flex min-h-[64vh] items-center justify-center py-12">
      <div className="w-full max-w-md space-y-5 rounded-2xl border border-border bg-card p-8 text-center">
        <SkeletonCircle className="size-14" />
        <Skeleton className="mx-auto h-5 w-52" />
        <div className="mx-auto w-full max-w-xs">
          <BodyCopy lines={2} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      </div>
    </LoadingShell>
  );
}

/** Standalone account overview (`/account`). */
export function AccountOverviewSkeleton() {
  return (
    <LoadingShell label="Loading" containerClassName="mx-auto max-w-4xl py-12">
      <div className="space-y-8">
        <SkeletonHeading lines={1} titleWidth="32%" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
              <SkeletonCircle className="size-10" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-2.5 w-28" />
              </div>
            </div>
          ))}
        </div>
        <SkeletonList count={3} avatar lines={1} />
      </div>
    </LoadingShell>
  );
}

/** Lesson player: video stage then a transcript. */
export function LessonSkeleton() {
  return (
    <LoadingShell label="Loading" containerClassName="py-6">
      <div className="space-y-6">
        <Skeleton className="aspect-video w-full rounded-xl" />
        <div className="mx-auto max-w-3xl space-y-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-6 w-3/4" />
          <Stagger gap={0.05}>
            {Array.from({ length: 3 }).map((_, i) => (
              <StaggerItem key={i}>
                <BodyCopy lines={3} />
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </div>
    </LoadingShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * CMS-rendered pages
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * For routes that resolve a Puck layout and render `<BlockRenderer>`
 * (about, terms, privacy, refunds, edu-purchases, and the `/[slug]` catch-all).
 *
 * Deliberately does *not* try to mirror individual blocks: the layout is
 * tenant-authored, so the only stable thing is "wide media, then a reading
 * column". Inventing a grid here would be wrong on most tenants' pages and
 * would cause exactly the reflow this is meant to prevent.
 */
export function CmsBlockPageSkeleton() {
  return (
    <LoadingShell label="Loading" containerClassName="py-0">
      <div className="border-b border-border bg-muted/30">
        <div className="mx-auto max-w-container-max px-margin-mobile py-20 md:px-margin-desktop">
          <div className="mx-auto max-w-3xl space-y-4 text-center">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mx-auto h-10 w-4/5" />
            <div className="mx-auto w-full max-w-xl">
              <BodyCopy lines={2} />
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-3xl space-y-10 py-14">
        <Stagger gap={0.06}>
          {Array.from({ length: 4 }).map((_, i) => (
            <StaggerItem key={i} className="space-y-3">
              {i % 2 === 0 && <Skeleton className="h-5 w-48" />}
              <BodyCopy lines={3} lastLineWidth={0.6} />
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </LoadingShell>
  );
}

/** Static prose (about/terms fallbacks rendered without a CMS layout). */
export function ProseSkeleton({ paragraphs = 6 }: { paragraphs?: number }) {
  return (
    <LoadingShell label="Loading">
      <div className="mx-auto max-w-3xl space-y-8">
        <SkeletonHeading lines={1} titleWidth="44%" />
        <div className="space-y-8">
          {Array.from({ length: paragraphs }).map((_, i) => (
            <div key={i} className="space-y-2.5">
              <Skeleton className="h-4 w-40" />
              <BodyCopy lines={3} />
            </div>
          ))}
        </div>
      </div>
    </LoadingShell>
  );
}

/** Generic fallback for a CMS route with no dedicated composition. */
export function CmsPageSkeleton() {
  return <CmsBlockPageSkeleton />;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * AI chat — conversation rail + transcript
 * ═══════════════════════════════════════════════════════════════════════════ */

export function ChatSkeleton() {
  return (
    // Full-bleed: AiChatWorkspace is h-[calc(100dvh-4rem)] with its own rail, so
    // page gutters here would inset it inside a second set of gutters.
    <LoadingShell label="Loading" containerClassName="px-0 py-0">
      <div className="flex h-[calc(100dvh-4rem)] w-full">
        <aside className="hidden w-72 shrink-0 flex-col gap-4 border-e border-border p-4 lg:flex">
          <Skeleton className="h-9 w-full rounded-md" />
          <div className="flex-1 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-2.5 w-1/2" />
              </div>
            ))}
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Alternating sides, because an assistant thread does. */}
          <div className="flex-1 space-y-6 overflow-hidden p-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={cn('flex gap-3', i % 2 === 1 && 'flex-row-reverse')}>
                <SkeletonCircle className="size-8 shrink-0" />
                <div className="max-w-[70%] space-y-2">
                  <Skeleton className="h-4 w-full rounded-lg" />
                  <Skeleton className="h-4 w-5/6 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-border p-4">
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </LoadingShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Tags
 * ═══════════════════════════════════════════════════════════════════════════ */

export function TagIndexSkeleton() {
  return (
    <LoadingShell label="Loading" containerClassName="mx-auto max-w-5xl">
      <div className="space-y-8">
        <SkeletonHeading titleWidth="30%" />
        <ChipRow count={12} width="w-28" />
      </div>
    </LoadingShell>
  );
}

export function TagFeedSkeleton() {
  return (
    <LoadingShell label="Loading" containerClassName="mx-auto max-w-3xl">
      <div className="space-y-6">
        <Skeleton className="h-5 w-40" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <SkeletonCircle className="size-9" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-2.5 w-16" />
              </div>
            </div>
            <BodyCopy lines={2} />
          </div>
        ))}
      </div>
    </LoadingShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Admin
 * ═══════════════════════════════════════════════════════════════════════════ */

/** The header every admin index page shares: title block plus two actions. */
function AdminHeader() {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-6 w-56" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-24 rounded-md" />
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>
    </div>
  );
}

/**
 * Admin page shell: `aria-busy` + a single announcement, and no gutters —
 * `(admin)/admin/layout.tsx` already wraps children in a padded `<main>`, so
 * adding padding here would double it.
 */
function AdminFrame({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" aria-label="Loading">
      <span className="sr-only">Loading</span>
      <div className="space-y-6">
        <AdminHeader />
        {children}
      </div>
    </div>
  );
}

export function AdminSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-live="polite" aria-label="Loading admin console">
      <span className="sr-only">Loading admin console</span>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-44" />
          </div>
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
        <SkeletonStats count={4} />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 rounded-xl border border-border bg-card p-5 lg:col-span-2">
            <Skeleton className="h-3.5 w-32" />
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <SkeletonCircle className="size-8" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-2/5" />
                  <Skeleton className="h-2.5 w-1/4" />
                </div>
                <Skeleton className="h-3 w-12" />
              </div>
            ))}
          </div>
          <SkeletonCard media={false} lines={6} />
        </div>
      </div>
    </div>
  );
}

export function AdminTableSkeleton({
  rows = 6,
  columns = ['2fr', '1fr', '1fr', '120px'],
}: {
  rows?: number;
  columns?: string[];
}) {
  return (
    <AdminFrame>
      <SkeletonTable rows={rows} columns={columns} />
    </AdminFrame>
  );
}

export function AdminGridSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <AdminFrame>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: cards }).map((_, i) => (
          <SkeletonCard key={i} lines={2} />
        ))}
      </div>
    </AdminFrame>
  );
}

export function AdminFormSkeleton({ fields = 5 }: { fields?: number }) {
  return (
    <AdminFrame>
      <FormPanel fields={fields} />
    </AdminFrame>
  );
}

/** Re-exported so admin pages can import everything from one place. */
export { SkeletonEvent };