'use client';
import { useId, type CSSProperties, type ReactNode } from 'react';
import { m } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Inbox,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { ease, spring } from '@/lib/motion';

/* Shared content primitives — Ivory & Clay: card surfaces on hairlines, soft
 * /10 tints for tone, sentence-case labels, spring-sliding active indicators.
 * Page chrome (command bar, title, KPIs) lives in ./admin-chrome.
 * These are the atoms every admin list/dashboard composes so analytics, users
 * and staff read as one product rather than three screens. */

/* ------------------------------------------------------------------ *
 * Tone system — one vocabulary for color across the whole admin.
 * ------------------------------------------------------------------ */
export type Tone = 'blue' | 'purple' | 'emerald' | 'cyan' | 'amber' | 'rose' | 'slate';

const TONE_PILL: Record<Tone, string> = {
  blue: 'border-primary/15 bg-primary/10 text-primary',
  purple: 'border-accent/15 bg-accent/10 text-accent',
  emerald: 'border-success/15 bg-success/10 text-success',
  cyan: 'border-info/15 bg-info/10 text-info',
  amber: 'border-warning/20 bg-warning/10 text-warning',
  rose: 'border-destructive/15 bg-destructive/10 text-destructive',
  slate: 'border-border/70 bg-muted/70 text-muted-foreground',
};

const TONE_SOLID: Record<Tone, string> = {
  blue: 'border-transparent bg-primary/10 text-primary',
  purple: 'border-transparent bg-accent/10 text-accent',
  emerald: 'border-transparent bg-success/10 text-success',
  cyan: 'border-transparent bg-info/10 text-info',
  amber: 'border-transparent bg-warning/10 text-warning',
  rose: 'border-transparent bg-destructive/10 text-destructive',
  slate: 'border-transparent bg-muted text-muted-foreground',
};

const TONE_DOT: Record<Tone, string> = {
  blue: 'bg-primary',
  purple: 'bg-accent',
  emerald: 'bg-success',
  cyan: 'bg-info',
  amber: 'bg-warning',
  rose: 'bg-destructive',
  slate: 'bg-muted-foreground',
};

const TONE_ICON: Record<Tone, string> = {
  blue: 'text-primary',
  purple: 'text-accent',
  emerald: 'text-success',
  cyan: 'text-info',
  amber: 'text-warning',
  rose: 'text-destructive',
  slate: 'text-muted-foreground',
};

/* ------------------------------------------------------------------ *
 * Toolbar shell
 * ------------------------------------------------------------------ */
export function Toolbar({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-card p-2 shadow-xs [&>*]:min-w-0">
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Tabs — pill style with optional count badges
 * ------------------------------------------------------------------ */
export function PillTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: ReactNode; count?: number }[];
  value: T;
  onChange: (k: T) => void;
}) {
  // One indicator per instance: two PillTabs on a page must not share a layoutId.
  const indicatorId = `pill-tabs-${useId()}`;
  return (
    <div
      role="tablist"
      className="no-scrollbar flex w-full items-center gap-0.5 overflow-x-auto overscroll-x-contain rounded-xl bg-muted/70 p-1"
    >
      {options.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.key)}
            className={cn(
              'relative inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]',
              active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {active && (
              <m.span
                layoutId={indicatorId}
                aria-hidden="true"
                className="absolute inset-0 rounded-lg border border-border/60 bg-card shadow-xs"
                transition={spring.smooth}
              />
            )}
            <span className="relative">{o.label}</span>
            {typeof o.count === 'number' && (
              <span
                className={cn(
                  'relative rounded-full px-1.5 py-px text-2xs font-medium tabular-nums transition-colors',
                  active ? 'bg-primary/10 text-primary' : 'bg-foreground/[0.06] text-muted-foreground',
                )}
              >
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Controls
 * ------------------------------------------------------------------ */
export function Select({
  value,
  onChange,
  label,
  children,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className={cn(
        'h-10 w-full min-w-0 rounded-lg border border-border/80 bg-card px-3 text-13 text-foreground shadow-xs outline-none transition-[border-color,box-shadow] duration-150 sm:h-9 sm:w-auto',
        'hover:border-border-strong focus:border-primary/50 focus:ring-[3px] focus:ring-primary/15',
        className,
      )}
    >
      {children}
    </select>
  );
}

/** A compact icon-only toggle group (view switchers, density, etc.). */
export function SegmentedIconToggle<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { key: T; icon: LucideIcon; label: string }[];
  label: string;
}) {
  const indicatorId = `segmented-${useId()}`;
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex h-10 w-full items-center justify-between gap-0.5 rounded-lg border border-border/70 bg-muted/60 p-0.5 sm:h-auto sm:w-auto sm:justify-start"
    >
      {options.map((o) => {
        const active = value === o.key;
        const Icon = o.icon;
        return (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={o.label}
            title={o.label}
            onClick={() => onChange(o.key)}
            className={cn(
              'relative rounded-md p-1.5 outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring',
              active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {active && (
              <m.span
                layoutId={indicatorId}
                aria-hidden="true"
                className="absolute inset-0 rounded-md bg-card shadow-xs ring-1 ring-border/60"
                transition={spring.smooth}
              />
            )}
            <Icon className="relative size-4" />
          </button>
        );
      })}
    </div>
  );
}

/** A removable filter chip. */
export function FilterChip({
  label,
  onClear,
  tone = 'blue',
}: {
  label: ReactNode;
  onClear: () => void;
  tone?: Tone;
}) {
  return (
    <m.span
      layout
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={spring.snappy}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border py-1 pe-1 ps-2.5 text-xs font-medium',
        TONE_PILL[tone],
      )}
    >
      {label}
      <button
        type="button"
        onClick={onClear}
        aria-label="Remove filter"
        className="grid size-4 place-items-center rounded-full transition-colors hover:bg-foreground/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-current"
      >
        <svg viewBox="0 0 12 12" className="size-2.5" aria-hidden="true">
          <path
            d="M2 2l8 8M10 2l-8 8"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </m.span>
  );
}

/* ------------------------------------------------------------------ *
 * Data display atoms
 * ------------------------------------------------------------------ */

/** Unified status badge. Replaces per-screen hand-rolled pill styling. */
export function StatusPill({
  label,
  tone = 'slate',
  dot = true,
  pulse = false,
  icon: Icon,
  className,
}: {
  label: ReactNode;
  tone?: Tone;
  dot?: boolean;
  pulse?: boolean;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium',
        TONE_PILL[tone],
        className,
      )}
    >
      {Icon ? (
        <Icon className="size-3" />
      ) : dot ? (
        <span
          className={cn(
            'size-1.5 rounded-full',
            TONE_DOT[tone],
            pulse && 'animate-pulse',
          )}
        />
      ) : null}
      {label}
    </span>
  );
}

/** Deterministic hue from a string, so a given person always looks the same. */
function hueFromString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) % 360;
  return h;
}

/** User avatar: soft tinted initials, deterministic per identity. */
export function Avatar({
  name,
  email,
  src,
  size = 'md',
  className,
}: {
  name?: string | null;
  email?: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const identity = (name || email || '?').trim();
  const initials = identity
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
  const dims =
    size === 'sm' ? 'size-8 text-2xs rounded-full' : size === 'lg' ? 'size-14 text-base rounded-full' : 'size-10 text-xs rounded-full';
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className={cn('shrink-0 object-cover', dims, className)}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 select-none items-center justify-center font-semibold tracking-wide ring-1 ring-inset ring-foreground/[0.04]',
        // Categorical, deliberately muted: a soft tint of the identity hue with
        // a deeper ink in light mode and a pale one in dark.
        '[background-color:hsl(var(--avatar-h)_32%_50%/0.14)] [color:hsl(var(--avatar-h)_38%_32%)] dark:[color:hsl(var(--avatar-h)_45%_78%)]',
        dims,
        className,
      )}
      style={
        // Tailwind tokens only cover fixed hues; a deterministic inline hue keeps
        // a large directory visually scannable without a palette per user.
        { '--avatar-h': hueFromString(identity) } as CSSProperties
      }
    >
      {initials || '?'}
    </span>
  );
}

/** Square tinted icon tile used in KPIs and list rows. */
export function IconTile({
  icon: Icon,
  tone = 'blue',
  className,
}: {
  icon: LucideIcon;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-xl border',
        TONE_SOLID[tone],
        className,
      )}
    >
      <Icon className="size-[18px]" />
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Loading
 *
 * These are thin admin-specific compositions over the canonical skeleton kit in
 * components/ui/skeleton. They used to be independent `animate-pulse`
 * implementations, which meant the admin had a different loading language from
 * the rest of the product — and a third copy in dashboard-parts. All of it now
 * resolves to the one shimmer-based kit, so a table on /admin/users and a table
 * on the public side load identically.
 * ------------------------------------------------------------------ */

/** Re-exported so the 19 files importing from this module keep working. */
export { Skeleton };

/** Skeleton rows shaped like an admin table body — mirrors real row rhythm. */
export function SkeletonRows({
  rows = 6,
  columns = 3,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="flex items-center gap-4 border-b border-border/60 px-4 py-4 last:border-0 sm:px-6"
        >
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          {Array.from({ length: Math.max(0, columns - 2) }).map((__, c) => (
            <Skeleton key={c} className="hidden h-6 w-20 rounded-full sm:block" />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Skeleton shaped like a chart panel. */
export function SkeletonPanel({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-xl border border-border/70 bg-card p-5 shadow-xs', className)}>
      <div className="flex items-center gap-2">
        <Skeleton className="size-4 rounded" />
        <Skeleton className="h-3.5 w-32" />
      </div>
      <Skeleton className="mt-2 h-3 w-48" />
      <div className="mt-5 flex h-[220px] items-end gap-2">
        {[40, 62, 48, 78, 55, 88, 70].map((h, i) => (
          <Skeleton key={i} className="flex-1 rounded-t-md" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Table shell
 * ------------------------------------------------------------------ */
export function TableCard({
  header,
  children,
  footer,
  className,
}: {
  header?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs',
        className,
      )}
    >
      {header && (
        <div className="border-b border-border/70 bg-surface-sunken/40 px-4 py-2.5 sm:px-5">
          {/* The header content must be allowed to fill the row. Wrapping it in
              a flex item without min-width collapsed any inner grid, so column
              headings drifted out of line with the body cells below. */}
          <div className="w-full min-w-0 text-xs font-medium text-muted-foreground">
            {header}
          </div>
        </div>
      )}
      {children}
      {footer && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 bg-surface-sunken/30 px-4 py-3 sm:px-5">
          {footer}
        </div>
      )}
    </div>
  );
}

/** Consistent card shell for dashboard panels (charts, insights, lists). */
export function PanelCard({
  title,
  description,
  icon: Icon,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        'flex flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs transition-shadow duration-200 hover:shadow-sm',
        className,
      )}
    >
      <header className="flex items-start justify-between gap-4 border-b border-border/60 px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 font-display text-[1.0625rem] font-medium leading-snug tracking-[-0.015em] text-foreground">
            {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" />}
            <span className="truncate">{title}</span>
          </h3>
          {description && (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      <div className={cn('flex-1 p-4 sm:p-5', bodyClassName)}>{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Pagination
 * ------------------------------------------------------------------ */
export function Pagination({
  page,
  totalPages,
  total,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex w-full flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground">
        Page <span className="font-medium tabular-nums text-foreground">{page}</span> of{' '}
        <span className="font-medium tabular-nums text-foreground">{totalPages}</span> ·{' '}
        <span className="font-medium">{total}</span> total
      </p>
      <div className="flex w-full items-center gap-2 sm:w-auto">
        <button
          type="button"
          disabled={page <= 1}
          onClick={onPrev}
          className="inline-flex h-10 flex-1 items-center justify-center gap-1 rounded-lg border border-border/80 bg-card px-3 text-13 font-medium text-foreground shadow-xs transition hover:border-border-strong hover:bg-muted/60 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 sm:h-9 sm:flex-none"
        >
          <ChevronLeft className="flip-rtl size-4" /> Prev
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={onNext}
          className="inline-flex h-10 flex-1 items-center justify-center gap-1 rounded-lg border border-border/80 bg-card px-3 text-13 font-medium text-foreground shadow-xs transition hover:border-border-strong hover:bg-muted/60 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 sm:h-9 sm:flex-none"
        >
          Next <ChevronRight className="flip-rtl size-4" />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Empty / error states
 * ------------------------------------------------------------------ */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  body,
  action,
  tone = 'slate',
}: {
  icon?: LucideIcon;
  title: string;
  body: string;
  action?: ReactNode;
  tone?: Tone;
}) {
  return (
    <m.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: ease.emerge }}
      className="flex flex-col items-center px-4 py-12 text-center sm:px-6 sm:py-16"
    >
      <div
        className={cn(
          'flex size-12 items-center justify-center rounded-full border',
          TONE_SOLID[tone],
        )}
      >
        <Icon className="size-5" />
      </div>
      <p className="mt-4 text-balance font-display text-lg font-medium tracking-[-0.015em] text-foreground">
        {title}
      </p>
      <p className="mx-auto mt-1 max-w-sm text-13 leading-relaxed text-muted-foreground">
        {body}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </m.div>
  );
}

/* Inline, non-blocking error strip with a retry affordance. */
export function ErrorBanner({
  message,
  onRetry,
  retryLabel,
}: {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <m.div
      role="alert"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: ease.emerge }}
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/20 bg-destructive/[0.06] px-4 py-3"
    >
      <span className="text-13 font-medium text-destructive">{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg border border-destructive/25 bg-card px-3 py-1.5 text-xs font-medium text-destructive transition hover:bg-destructive/10 active:scale-[0.98]"
        >
          {retryLabel ?? 'Retry'}
        </button>
      )}
    </m.div>
  );
}

export { TONE_PILL, TONE_SOLID, TONE_DOT, TONE_ICON };
