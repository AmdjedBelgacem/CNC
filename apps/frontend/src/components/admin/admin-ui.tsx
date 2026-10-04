'use client';
import type { ReactNode } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Inbox,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

/* Shared content primitives — token surfaces, 12px radii, 36px controls.
 * Page chrome (command bar, title, KPIs) lives in ./admin-chrome.
 * These are the atoms every admin list/dashboard composes so analytics, users
 * and staff read as one product rather than three screens. */

/* ------------------------------------------------------------------ *
 * Tone system — one vocabulary for color across the whole admin.
 * ------------------------------------------------------------------ */
export type Tone = 'blue' | 'purple' | 'emerald' | 'cyan' | 'amber' | 'rose' | 'slate';

const TONE_PILL: Record<Tone, string> = {
  blue: 'border-primary/25 bg-primary/10 text-primary',
  purple: 'border-accent/25 bg-accent/10 text-accent',
  emerald: 'border-success/30 bg-success/10 text-success',
  cyan: 'border-info/30 bg-info/10 text-info',
  amber: 'border-warning/30 bg-warning/10 text-warning',
  rose: 'border-destructive/30 bg-destructive/10 text-destructive',
  slate: 'border-border bg-muted text-muted-foreground',
};

const TONE_SOLID: Record<Tone, string> = {
  blue: 'bg-primary/10 text-primary',
  purple: 'bg-accent/10 text-accent',
  emerald: 'bg-success/10 text-success',
  cyan: 'bg-info/10 text-info',
  amber: 'bg-warning/10 text-warning',
  rose: 'bg-destructive/10 text-destructive',
  slate: 'bg-muted text-muted-foreground',
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
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2 shadow-xs">
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
  return (
    <div
      role="tablist"
      className="flex items-center gap-0.5 overflow-x-auto rounded-xl bg-muted p-1"
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
              'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition active:scale-[0.98]',
              active
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span>{o.label}</span>
            {typeof o.count === 'number' && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-px text-2xs font-bold tabular-nums',
                  active ? 'bg-primary/12 text-primary' : 'bg-muted-foreground/12 text-muted-foreground',
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
        'h-9 shrink-0 rounded-xl border border-border bg-background px-2.5 text-13 text-foreground shadow-xs outline-none transition',
        'hover:border-border-strong focus:border-primary/60 focus:ring-4 focus:ring-primary/10',
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
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex items-center gap-0.5 rounded-xl border border-border bg-card p-0.5 shadow-xs"
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
              'rounded-lg p-1.5 transition',
              active
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Icon className="size-4" />
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
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-semibold',
        TONE_PILL[tone],
      )}
    >
      {label}
      <button
        type="button"
        onClick={onClear}
        aria-label="Remove filter"
        className="rounded p-0.5 transition hover:bg-foreground/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-current"
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
    </span>
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
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold',
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
    size === 'sm' ? 'size-8 text-2xs rounded-lg' : size === 'lg' ? 'size-14 text-base rounded-2xl' : 'size-10 text-xs rounded-xl';
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
        'flex shrink-0 select-none items-center justify-center font-bold tracking-wide',
        dims,
        className,
      )}
      style={{
        // Tailwind tokens only cover fixed hues; a deterministic inline hue keeps
        // a large directory visually scannable without a palette per user.
        backgroundColor: `hsl(${hueFromString(identity)} 62% 92%)`,
        color: `hsl(${hueFromString(identity)} 55% 32%)`,
      }}
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
        'flex size-11 shrink-0 items-center justify-center rounded-xl border',
        TONE_PILL[tone],
        className,
      )}
    >
      <Icon className="size-5" />
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
          className="flex items-center gap-4 border-b border-border px-6 py-4 last:border-0"
        >
          <Skeleton className="size-10 shrink-0 rounded-xl" />
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
    <div className={cn('rounded-xl border border-border bg-card p-5', className)}>
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
        'overflow-hidden rounded-xl border border-border bg-card shadow-xs',
        className,
      )}
    >
      {header && (
        <div className="border-b border-border bg-muted/40 px-5 py-3">
          {/* The header content must be allowed to fill the row. Wrapping it in
              a flex item without min-width collapsed any inner grid, so column
              headings drifted out of line with the body cells below. */}
          <div className="w-full min-w-0 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
            {header}
          </div>
        </div>
      )}
      {children}
      {footer && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/40 px-5 py-3">
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
        'flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs transition-shadow hover:shadow-sm',
        className,
      )}
    >
      <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            {Icon && <Icon className="size-4 shrink-0 text-primary" />}
            <span className="truncate">{title}</span>
          </h3>
          {description && (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      <div className={cn('flex-1 p-5', bodyClassName)}>{children}</div>
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
    <>
      <p className="text-xs text-muted-foreground">
        Page <span className="font-semibold text-foreground">{page}</span> of{' '}
        <span className="font-semibold text-foreground">{totalPages}</span> ·{' '}
        <span className="font-medium">{total}</span> total
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={onPrev}
          className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-13 font-medium text-foreground shadow-xs transition hover:bg-muted active:scale-[0.98] disabled:opacity-40"
        >
          <ChevronLeft className="flip-rtl size-4" /> Prev
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={onNext}
          className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-13 font-medium text-primary-foreground shadow-xs transition hover:bg-primary active:scale-[0.98] disabled:opacity-40"
        >
          Next <ChevronRight className="flip-rtl size-4" />
        </button>
      </div>
    </>
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
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <div
        className={cn(
          'flex size-12 items-center justify-center rounded-xl border',
          TONE_SOLID[tone],
        )}
      >
        <Icon className="size-6" />
      </div>
      <p className="mt-4 text-sm font-semibold text-foreground">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-13 leading-relaxed text-muted-foreground">
        {body}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
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
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/25 bg-destructive/8 px-4 py-3"
    >
      <span className="text-13 font-medium text-destructive">{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg border border-destructive/30 bg-background px-3 py-1.5 text-xs font-semibold text-destructive transition hover:bg-destructive/10 active:scale-[0.98]"
        >
          {retryLabel ?? 'Retry'}
        </button>
      )}
    </div>
  );
}

export { TONE_PILL, TONE_SOLID, TONE_DOT, TONE_ICON };
