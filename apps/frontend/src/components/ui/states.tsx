'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, m } from 'framer-motion';
import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton, SkeletonList } from '@/components/ui/skeleton';
import { PressScale, spring, transition, useHasReducedMotion } from '@/components/ui/motion';

/* ------------------------------------------------------------------ Empty */

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon?: React.ElementType;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  const t = useTranslations('common');
  return (
    <m.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, transition: transition.enter }}
      className={cn(
        'flex flex-col items-center justify-center gap-3 text-center',
        compact ? 'px-4 py-10' : 'px-6 py-16',
        className,
      )}
    >
      {/* The icon settles a beat after the text: leading with the container
          arriving first means the headline never appears over a still-orbiting
          placeholder. */}
      <m.div
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1, transition: { ...spring.snappy, delay: 0.05 } }}
        className="flex size-12 items-center justify-center rounded-lg border border-border bg-muted/60"
      >
        <m.span
          initial={{ rotate: -18, opacity: 0 }}
          animate={{ rotate: 0, opacity: 1, transition: { ...spring.gentle, delay: 0.12 } }}
          className="flex"
        >
          <Icon className="size-5 text-muted-foreground" />
        </m.span>
      </m.div>
      <div className="max-w-sm space-y-1">
        <p className="text-sm font-semibold text-foreground">{title ?? t('empty')}</p>
        {description && (
          <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </m.div>
  );
}

/* ------------------------------------------------------------------ Error */

export function ErrorState({
  title,
  description,
  onRetry,
  className,
  compact,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}) {
  const t = useTranslations('common');
  return (
    <m.div
      role="alert"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, transition: transition.enter }}
      className={cn(
        'flex flex-col items-center justify-center gap-3 text-center',
        compact ? 'px-4 py-10' : 'px-6 py-16',
        className,
      )}
    >
      <m.div
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1, transition: { ...spring.snappy, delay: 0.05 } }}
        className="flex size-12 items-center justify-center rounded-lg border border-destructive/25 bg-destructive/10"
      >
        <IconBurst />
      </m.div>
      <div className="max-w-md space-y-1">
        <p className="text-sm font-semibold text-foreground">{title ?? t('error')}</p>
        {description && (
          <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      {onRetry && (
        <PressScale as="div" className="mt-1">
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="size-4" />
            {t('retry')}
          </Button>
        </PressScale>
      )}
    </m.div>
  );
}

/**
 * A single slow shake on the error icon.
 *
 * `animate-pulse` was the previous cue, which fires forever and reads as a
 * loading spinner for something that has already failed. One short rotation
 * says "attention, then stop" and leaves the text readable.
 */
function IconBurst() {
  const reduce = useHasReducedMotion();
  return (
    <m.span
      className="flex"
      aria-hidden
      animate={reduce ? undefined : { rotate: [0, -9, 7, -4, 0] }}
      transition={{ duration: 0.5, times: [0, 0.25, 0.5, 0.75, 1], ease: 'easeOut' }}
    >
      <AlertTriangle className="size-5 text-destructive" />
    </m.span>
  );
}

/* ---------------------------------------------------------------- Loading */

/**
 * Inline loading state — for a region that loads after the page shell.
 *
 * Route-level waits belong in `loading.tsx`; this is for a panel that fetches
 * on mount, or a tab that swaps its own content.
 *
 * The label is announced once and the skeleton rows are `aria-hidden`, so a
 * screen reader hears "Loading" rather than a run of empty elements.
 */
export function LoadingState({
  label,
  className,
  rows = 3,
  /** Render just the rows, with no label line. */
  bare = false,
}: {
  label?: string;
  className?: string;
  rows?: number;
  bare?: boolean;
}) {
  const t = useTranslations('common');
  const resolved = label ?? t('loading');

  return (
    <div
      className={cn('space-y-3', className)}
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={resolved}
    >
      <span className="sr-only">{resolved}</span>
      {!bare && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <svg
            className="size-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
            style={{ animationDuration: '0.7s' }}
          >
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
            <path
              d="M21 12a9 9 0 0 0-9-9"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
          {resolved}
        </div>
      )}
      <SkeletonList count={rows} />
    </div>
  );
}

/** Bare skeleton rows for a Suspense fallback nested inside a laid-out page. */
export { Skeleton as LoadingRow };

/* ------------------------------------------------------- Combined wrapper */

/**
 * Single render gate for a fetched collection: picks loading, error, empty or
 * children so every screen in the product states its async cases the same way.
 *
 * Crossfades between the two states rather than swapping them, so a refetch
 * doesn't blink the whole region.
 */
export function AsyncState<T>({
  isLoading,
  error,
  data,
  onRetry,
  isEmpty,
  empty,
  loading,
  skeletonRows,
  children,
}: {
  isLoading: boolean;
  error?: Error | string | null;
  data?: T[] | null;
  onRetry?: () => void;
  isEmpty?: (data: T[]) => boolean;
  empty?: React.ReactNode;
  loading?: React.ReactNode;
  skeletonRows?: number;
  children: React.ReactNode;
}) {
  const list = data ?? [];
  const emptyFn = isEmpty ?? ((d: T[]) => d.length === 0);

  // Resolve to a single discriminated value so the outgoing and incoming states
  // can be crossfaded with `mode="wait"` — AnimatePresence needs a changing
  // `key` to know something left.
  const state: 'loading' | 'error' | 'empty' | 'ready' = isLoading
    ? 'loading'
    : error
      ? 'error'
      : emptyFn(list)
        ? 'empty'
        : 'ready';

  return (
    <AnimatePresence mode="wait" initial={false}>
      <m.div
        key={state}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: transition.crossfade }}
        exit={{ opacity: 0, transition: transition.leave }}
      >
        {state === 'loading' && (loading ?? <LoadingState rows={skeletonRows} bare />)}
        {state === 'error' && (
          <ErrorState
            description={typeof error === 'string' ? error : error?.message}
            onRetry={onRetry}
          />
        )}
        {state === 'empty' && (empty ?? <EmptyState />)}
        {state === 'ready' && children}
      </m.div>
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------ Placeholder */

/**
 * A neutral, non-error placeholder block.
 *
 * Used where a region is intentionally inert (a disabled panel, a draft step)
 * and `EmptyState` would over-promise — its icon and copy both read as "nothing
 * is here yet", which is wrong for something the user just chose not to fill in.
 */
export function Placeholder({
  label,
  icon: Icon = Inbox,
  className,
}: {
  label?: string;
  icon?: React.ElementType;
  className?: string;
}) {
  const t = useTranslations('common');
  return (
    <m.div
      initial={{ opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1, transition: transition.enter }}
      className={cn('flex items-center justify-center gap-3 px-4 py-10', className)}
    >
      <Icon className="size-4 text-muted-foreground/70" />
      <p className="text-sm text-muted-foreground">{label ?? t('empty')}</p>
    </m.div>
  );
}

/** One skeleton row, for hand-built placeholders. */
export { Skeleton };