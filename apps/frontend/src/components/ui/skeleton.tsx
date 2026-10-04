import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SKELETON KIT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Loading placeholders for every surface in the product.
 *
 * Design rules, all of which exist to keep the placeholder from *jumping* when
 * the real content replaces it:
 *
 *  1. **Mirror the real layout.** A skeleton that doesn't match the shape of the
 *     content it stands in for causes a reflow on arrival, which is worse than
 *     showing nothing at all. Every composition here is built from the same
 *     spacing and radius tokens as the components it previews.
 *
 *  2. **Shimmer, never pulse.** `animate-pulse` fades the whole block in and out,
 *     which reads as a blinking light. The sweep leaves the fill at a constant
 *     value, so the page doesn't strobe while you read it.
 *
 *  3. **The sweep is a child element, not a background.** The base colour then
 *     still resolves through `bg-muted` from the theme in both light and dark,
 *     and the highlight inherits `foreground` so it stays visible on any tenant
 *     accent colour.
 *
 *  4. **Resist the urge to add delays.** Loading states are not content. A
 *     staggered "wave" makes the wait feel longer and draws the eye to bars that
 *     contain no information. Static placeholder, immediate paint.
 */

/* ── Primitives ──────────────────────────────────────────────────────────── */

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** How long one sweep takes, in seconds. */
  speed?: number;
  /** Distance between the start of one sweep and the next. */
  interval?: number;
  /** Set false for elements that sit on a busy background, where the sweep
   *  would be lost and the block would read as a solid colour. */
  shimmer?: boolean;
}

/**
 * The base placeholder. Every other skeleton in this file composes from it.
 *
 * `aria-hidden` because a skeleton carries no information — the accessible
 * loading state lives on the wrapping region via `role="status"` + `aria-label`
 * (see `LoadingShell`).
 */
export function Skeleton({ className, speed = 1.6, interval = 1.6, shimmer = true, style, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={cn('relative overflow-hidden rounded-md bg-muted', className)}
      style={style}
      {...props}
    >
      {shimmer && (
        <div
          className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-foreground/10 to-transparent"
          style={{ animationDuration: `${speed}s`, animationDelay: `${-interval}s` }}
        />
      )}
    </div>
  );
}

/** Square or circular image/avatar placeholder. */
export function SkeletonCircle({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <Skeleton className={cn('size-10 rounded-full', className)} {...props} />;
}

/**
 * A paragraph of text.
 *
 * The last line is short by default because real paragraphs end raggedly — a
 * full-width final line is the clearest tell that a placeholder is synthetic.
 *
 * `lineHeight` sets the *rhythm* (the gap between lines, i.e. how tall the
 * rendered text block will be), not the bar height. Bars stay a fixed 11px:
 * a bar as tall as its line box reads as a divider, not as text.
 */
export function SkeletonText({
  lines = 3,
  className,
  /** Fraction of full width for the final line, 0–1. */
  lastLineWidth = 0.6,
  /** Rendered line-height in px — drives the gap, and so the block's total height. */
  lineHeight = 20,
}: {
  lines?: number;
  className?: string;
  lastLineWidth?: number;
  lineHeight?: number;
}) {
  const gap = Math.max(6, Math.round(lineHeight * 0.5));
  return (
    <div className={cn('flex w-full flex-col', className)} style={{ gap }}>
      {Array.from({ length: Math.max(lines, 1) }).map((_, i) => {
        const isLast = i === lines - 1;
        return (
          <Skeleton
            key={i}
            className="h-[11px]"
            style={{ width: isLast ? `${lastLineWidth * 100}%` : '100%' }}
          />
        );
      })}
    </div>
  );
}

/** A button-shaped placeholder, sized to the real button variants. */
/** A text input / textarea placeholder. */
export function SkeletonInput({ className, rows }: { className?: string; rows?: number }) {
  if (rows && rows > 1) {
    return <Skeleton className={cn('h-24 w-full', className)} />;
  }
  return <Skeleton className={cn('h-10 w-full', className)} />;
}

/** A stacked label + input pair. */
export function SkeletonField({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      <Skeleton className="h-3 w-24" />
      <SkeletonInput />
    </div>
  );
}

/**
 * A title / body block used at the top of most pages.
 *
 * `eyebrow` covers breadcrumbs and section kickers; `title` the h1.
 */
export function SkeletonHeading({
  className,
  eyebrow = true,
  lines = 2,
  titleWidth = '55%',
}: {
  className?: string;
  eyebrow?: boolean;
  lines?: number;
  titleWidth?: string;
}) {
  return (
    <div className={cn('space-y-3', className)}>
      {eyebrow && <Skeleton className="h-3 w-32" />}
      <div className="space-y-2.5">
        {Array.from({ length: Math.max(lines, 1) }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-7"
            style={{ width: i === 0 ? titleWidth : i === 1 ? `${Math.round(parseFloat(titleWidth) * 0.6)}%` : '100%' }}
          />
        ))}
      </div>
    </div>
  );
}

/** A labelled stat / KPI block. */
export function SkeletonStat({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-3 rounded-xl border border-border bg-card p-5', className)}>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

/** A row of KPI blocks. */
export function SkeletonStats({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-4', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonStat key={i} />
      ))}
    </div>
  );
}

/** A generic content card: media, title, body. */
export function SkeletonCard({
  className,
  media = true,
  lines = 3,
  footer = false,
}: {
  className?: string;
  media?: boolean;
  lines?: number;
  footer?: boolean;
}) {
  return (
    <div className={cn('flex flex-col overflow-hidden rounded-xl border border-border bg-card', className)}>
      {media && <Skeleton className="aspect-video w-full rounded-none" />}
      <div className="flex flex-1 flex-col gap-3 p-5">
        <Skeleton className="h-4 w-3/4" />
        <SkeletonText lines={lines} />
        {footer && (
          <div className="mt-auto flex items-center gap-3 pt-2">
            <SkeletonCircle className="size-8" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-2.5 w-24" />
              <Skeleton className="h-2.5 w-16" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** A grid of content cards. */
/** One item in a list: leading media, title/body, trailing control. */
/**
 * A stack of list items.
 *
 * `avatar`/`trailing`/`dense` mirror the three real list shapes in the product
 * (people, content, and table rows) so one component covers all of them.
 */
export function SkeletonList({
  count = 3,
  className,
  avatar = false,
  lines = 2,
  trailing = true,
}: {
  count?: number;
  className?: string;
  avatar?: boolean;
  lines?: number;
  trailing?: boolean;
}) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonListItem key={i} avatar={avatar} lines={lines} trailing={trailing} />
      ))}
    </div>
  );
}

/**
 * A data table: header row plus body rows.
 *
 * `columns` accepts Tailwind width classes so each column can line up with the
 * real table's header labels. Only the first column renders text placeholders;
 * the rest are short bars, which is what makes a table skeleton read as a table
 * rather than as a stack of cards.
 */
export function SkeletonTable({
  rows = 6,
  columns = ['2fr', '1fr', '1fr', '120px'],
  className,
}: {
  rows?: number;
  columns?: string[];
  className?: string;
}) {
  return (
    <div className={cn('overflow-hidden rounded-xl border border-border bg-card', className)}>
      <div className="flex items-center gap-4 border-b border-border bg-muted/40 px-4 py-3">
        {columns.map((col, i) => (
          <Skeleton key={i} className="h-3" style={{ width: col }} />
        ))}
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 px-4 py-4">
            {columns.map((col, c) => (
              <Skeleton
                key={c}
                className={cn('h-3', c === 0 && 'rounded-md')}
                style={{ width: col }}
                shimmer={c !== 0}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** A chart placeholder: axis labels plus a bar series. */
/** A KPI row plus a chart — the shape of every analytics dashboard. */
/** A form panel: heading, then a stack of labelled fields. */
/** Left rail + content — the admin shell at page level. */
export function SkeletonSplit({
  className,
  railWidth = '16rem',
  content,
}: {
  className?: string;
  railWidth?: string;
  content?: React.ReactNode;
}) {
  return (
    <div className={cn('flex gap-6', className)}>
      <div className="hidden shrink-0 space-y-4 lg:block" style={{ width: railWidth }}>
        <Skeleton className="h-3 w-24" />
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
      <div className="min-w-0 flex-1">{content ?? <SkeletonForm fields={5} />}</div>
    </div>
  );
}

/** A single article / post / comment. */
export function SkeletonArticle({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-xl border border-border bg-card p-5', className)}>
      <div className="mb-4 flex items-center gap-3">
        <SkeletonCircle className="size-10" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-2.5 w-20" />
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <SkeletonText lines={3} lineHeight={20} />
      <div className="mt-5 flex items-center gap-5 border-t border-border pt-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-3" style={{ width: i === 0 ? 64 : 48 }} />
        ))}
      </div>
    </div>
  );
}

/** A feed of articles. */
/** A hero: headline, subcopy, actions. */
/** A centred card for a narrow task: sign in, verify, reset. */
/** A product tile in the store grid. */
/** A row of product tiles. */
export function SkeletonProducts({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('grid gap-5 sm:grid-cols-2 lg:grid-cols-4', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonProduct key={i} />
      ))}
    </div>
  );
}

/** An event row: date block, title, venue. */
export function SkeletonEvent({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-5 rounded-xl border border-border bg-card p-4', className)}>
      <div className="flex size-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-border bg-muted/50">
        <Skeleton className="h-2.5 w-7" />
        <Skeleton className="h-4 w-7" />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <SkeletonButton size="sm" className="hidden sm:block" />
    </div>
  );
}

/** A list of event rows. */
/** A course card: thumbnail, title, meta, progress. */
export function SkeletonCourseCard({ className }: { className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-xl border border-border bg-card', className)}>
      <Skeleton className="aspect-video w-full rounded-none" />
      <div className="space-y-3 p-5">
        <Skeleton className="h-2.5 w-24 rounded-full" />
        <Skeleton className="h-4 w-4/5" />
        <SkeletonText lines={2} />
        <div className="space-y-2 pt-1">
          <Skeleton className="h-1.5 w-full rounded-full" />
          <div className="flex justify-between">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="h-2.5 w-12" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** A grid of course cards. */
/* ── Internal building blocks ──────────────────────────────────────────────
 * Not exported: each exists to give a composed primitive its shape, and no
 * caller outside this file needs them directly. An earlier draft exported the
 * whole kit speculatively and 17 of those exports had no callers at all. */

function SkeletonListItem({
  className,
  avatar = true,
  lines = 2,
  trailing = true,
}: {
  className?: string;
  avatar?: boolean;
  lines?: number;
  trailing?: boolean;
}) {
  return (
    <div className={cn('flex items-start gap-4 rounded-xl border border-border bg-card p-4', className)}>
      <SkeletonCircle className={cn('shrink-0', avatar ? 'size-10 rounded-full' : 'size-10')} />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3.5 w-1/3" />
        <SkeletonText lines={lines} lineHeight={16} lastLineWidth={0.4} />
      </div>
      {trailing && <Skeleton className="h-8 w-8 shrink-0" />}
    </div>
  );
}

/** A panel of fields with a right-aligned action row. */
function SkeletonForm({ fields = 4 }: { fields?: number }) {
  return (
    <div className="space-y-6 rounded-xl border border-border bg-card p-6">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3 w-28" />
          <SkeletonInput rows={i % 4 === 3 ? 3 : 1} />
          {i % 3 === 0 && <Skeleton className="h-2.5 w-48" />}
        </div>
      ))}
      <div className="flex justify-end gap-3 border-t border-border pt-5">
        <Skeleton className="h-9 w-24 rounded-md" />
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>
    </div>
  );
}

/** A product tile: square image, title, price, add-to-cart. */
function SkeletonProduct() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="space-y-2.5 p-4">
        <Skeleton className="h-2.5 w-16 rounded-full" />
        <Skeleton className="h-4 w-4/5" />
        <SkeletonText lines={1} />
        <div className="flex items-center justify-between pt-1">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-8 w-16 rounded-md" />
        </div>
      </div>
    </div>
  );
}

/** A button-shaped placeholder, sized to the real button variants. */
function SkeletonButton({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <Skeleton
      className={cn(
        'rounded-md',
        size === 'sm' && 'h-9 w-24',
        size === 'md' && 'h-10 w-32',
        size === 'lg' && 'h-11 w-40',
        className,
      )}
    />
  );
}

/* ── Page shells ─────────────────────────────────────────────────────────── */

/**
 * Full-page loading state.
 *
 * This is what `loading.tsx` renders. It owns the accessibility contract — a
 * live region announcing the wait — plus the responsive gutters that every page
 * in `(main)`/`(public)` applies.
 *
 * Two things it deliberately does NOT do, because the layouts already do them:
 *
 *  - **No vertical centring.** `/admin` wraps children in a padded `<main>` and
 *    `(auth)` wraps them in a bordered card; a shell that centred or re-padded
 *    would double the spacing.
 *  - **No fixed max-width.** Pages pick their own (`max-w-3xl` on `/learning`,
 *    `max-w-7xl` on `/courses`), and a shell that guessed would either overflow
 *    narrow pages or leave narrow bars on wide ones. Pass `containerClassName`
 *    to match the route.
 *
 * `label` is announced once when the state appears, which is correct: screen
 * readers fire on change, so a live region per skeleton block would flood the
 * user with the same message a dozen times.
 */
export function LoadingShell({
  label = 'Loading',
  children,
  className,
  containerClassName,
}: {
  label?: string;
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
}) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" aria-label={label} className={cn('w-full', className)}>
      <span className="sr-only">{label}</span>
      <div className={cn('w-full px-4 py-10 sm:px-6 lg:px-8', containerClassName)}>{children}</div>
    </div>
  );
}