'use client';

/**
 * Presentational pieces for the admin overview.
 *
 * Kept apart from the data layer so the layout can be reworked without touching
 * fetching, and so every piece is individually checkable.
 *
 * Two rules this file exists to enforce:
 *  - Numbers and dates are formatted through the active locale, never a hardcoded
 *    `en-US`. A Saudi merchant reading USD and Gregorian-American dates is wrong
 *    on every screen, and it is the kind of wrong nobody reports because the digits
 *    look fine.
 *  - Nothing reads the clock during render. `Date.now()` in a render body makes
 *    the server and the client disagree, which React reports as a hydration
 *    mismatch and refuses to patch.
 */

import { useEffect, useId, useState, type ReactNode } from 'react';
import { useLocale } from 'next-intl';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

/* -------------------------------------------------------------------------- */
/* Formatting                                                                 */
/* -------------------------------------------------------------------------- */

/** The storefront settles in SAR; USD here would contradict every invoice. */
export const PLATFORM_CURRENCY = 'SAR';

export function useFormats() {
  const locale = useLocale();
  return {
    locale,
    currency: (cents: number, code: string = PLATFORM_CURRENCY) =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: code,
        maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
      }).format(cents / 100),
    count: (value: number) => new Intl.NumberFormat(locale).format(value),
    percent: (value: number) =>
      new Intl.NumberFormat(locale, { maximumFractionDigits: 1, minimumFractionDigits: 0 }).format(
        value,
      ) + '%',
    date: (iso: string) =>
      new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(
        new Date(iso),
      ),
    shortDate: (iso: string) =>
      new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(new Date(iso)),
  };
}

/**
 * Relative time, computed from an injected `now`.
 *
 * The caller supplies `now` from state that starts null and is filled in an
 * effect, so the first paint (server and client alike) agrees.
 */
export function relativeFrom(iso: string, now: number | null, labels: {
  justNow: string;
  minutes: (n: number) => string;
  hours: (n: number) => string;
  days: (n: number) => string;
}): string {
  if (now === null) return labels.justNow;
  const diff = now - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return labels.justNow;
  if (mins < 60) return labels.minutes(mins);
  const hours = Math.floor(mins / 60);
  if (hours < 24) return labels.hours(hours);
  return labels.days(Math.floor(hours / 24));
}

/** Puts "now" into state after mount, so SSR and hydration cannot disagree. */
export function useMountedNow() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/* -------------------------------------------------------------------------- */
/* Sparkline                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Inline trend line.
 *
 * Purely presentational: it takes the numbers the API already computes
 * (`sparkline` on every overview metric) and draws them. No library, no axes, no
 * interaction — it exists to give each number a shape at a glance.
 */
export function Sparkline({
  points,
  tone = 'primary',
  className,
  label,
}: {
  points: number[];
  tone?: 'primary' | 'success' | 'warning' | 'muted';
  className?: string;
  label?: string;
}) {
  const gradientId = useId();
  const width = 100;
  const height = 28;

  if (!points || points.length < 2) {
    return <div className={cn('h-7', className)} aria-hidden="true" />;
  }

  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;
  const step = width / (points.length - 1);
  const coords = points.map((value, index) => {
    const x = index * step;
    const y = height - ((value - min) / span) * (height - 4) - 2;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const stroke = {
    primary: 'var(--primary)',
    success: 'var(--success)',
    warning: 'var(--warning)',
    muted: 'var(--muted-foreground)',
  }[tone];
  const last = coords[coords.length - 1]!.split(',');

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn('h-7 w-full', className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.24" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${coords.join(' ')} ${width},${height}`} fill={`url(#${gradientId})`} />
      <polyline
        points={coords.join(' ')}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={last[0]} cy={last[1]} r="1.8" fill={stroke} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Delta                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Change against the previous window.
 *
 * `null` means "no comparison is possible" (the previous window was zero and this
 * one is not), which is a different statement from "no change" — so it renders
 * nothing rather than a misleading 0%.
 */
export function DeltaBadge({
  delta,
  labels,
}: {
  delta: number | null | undefined;
  labels: { up: string; down: string; flat: string };
}) {
  if (delta === null || delta === undefined || Number.isNaN(delta)) return null;
  const positive = delta >= 0;
  const Icon = positive ? ArrowUpRight : delta < 0 ? ArrowDownRight : Minus;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-2xs font-semibold tabular-nums',
        positive
          ? 'bg-success/10 text-success'
          : delta < 0
            ? 'bg-destructive/10 text-destructive'
            : 'bg-muted text-muted-foreground',
      )}
      title={positive ? labels.up : labels.down}
    >
      {/* The glyph is a value, not a reading direction, so it is never mirrored. */}
      <Icon className="size-3" aria-hidden="true" />
      {positive ? '+' : ''}
      {delta.toFixed(1)}%
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Surfaces                                                                   */
/* -------------------------------------------------------------------------- */

export function Panel({
  title,
  subtitle,
  action,
  children,
  className,
  bodyClassName,
  tone = 'default',
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  tone?: 'default' | 'attention' | 'flat';
}) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-xl border bg-card',
        tone === 'attention' ? 'border-warning/30' : 'border-border',
        className,
      )}
    >
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <div className="min-w-0">
            {title && (
              <h2 className="truncate text-13 font-semibold tracking-tight text-foreground">{title}</h2>
            )}
            {subtitle && (
              <p className="mt-0.5 truncate text-2xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={cn('p-4 sm:p-5', bodyClassName)}>{children}</div>
    </section>
  );
}

/**
 * A horizontal proportion bar.
 *
 * Preferred over a donut here because the three categories are parts of one
 * whole and read fine in a legend — a donut needs a radial legend and breaks the
 * moment a segment is a few percent wide.
 */
export function SegmentedBar({
  segments,
  className,
}: {
  segments: Array<{ value: number; color: string; label: string }>;
  className?: string;
}) {
  const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0);
  return (
    <div className={cn('flex h-2.5 w-full overflow-hidden rounded-full bg-muted', className)}>
      {total === 0 ? null : (
        segments.map((segment) =>
          segment.value > 0 ? (
            <div
              key={segment.label}
              className="h-full transition-[width] duration-500"
              style={{
                width: `${(segment.value / total) * 100}%`,
                backgroundColor: segment.color,
              }}
              title={`${segment.label}: ${segment.value}`}
            />
          ) : null,
        )
      )}
    </div>
  );
}

/** Vertical bars for a daily series. Rendered as a flex row of columns. */
export function SeriesBars({
  points,
  tone = 'primary',
  className,
  height = 96,
}: {
  points: Array<{ label: string; value: number }>;
  tone?: 'primary' | 'success';
  className?: string;
  height?: number;
}) {
  const max = Math.max(1, ...points.map((point) => point.value));
  const barColor = tone === 'success' ? 'var(--success)' : 'var(--primary)';
  return (
    <div className={cn('flex items-end gap-[2px]', className)} style={{ height }}>
      {points.map((point, index) => (
        <div
          key={`${point.label}-${index}`}
          className="group relative flex-1 rounded-t-[2px] transition-opacity hover:opacity-80"
          style={{
            height: `${Math.max(2, (point.value / max) * 100)}%`,
            backgroundColor: barColor,
            opacity: point.value === 0 ? 0.15 : 0.85,
          }}
          title={`${point.label}: ${point.value}`}
        />
      ))}
    </div>
  );
}

/** Third copy of this component used to live here. See admin-ui.tsx — now one. */
export { Skeleton } from '@/components/ui/skeleton';
