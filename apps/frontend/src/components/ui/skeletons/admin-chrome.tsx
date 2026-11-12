'use client';

import type { CSSProperties, ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Repeat } from './region';

/* -----------------------------------------------------------------------------
 * Replicas of the admin chrome in components/admin/admin-chrome.tsx and
 * admin-ui.tsx. Every container here copies the real component's classes
 * (margins, paddings, heights per breakpoint), and only the *content* is
 * swapped for bars — so when the page arrives, nothing moves.
 *
 * Keep these in step with the originals: if a real component's spacing
 * changes, change the replica in the same commit.
 * --------------------------------------------------------------------------- */

/** One control in the command bar's action zone. */
export type BarActionShape =
  /** `BarIconButton`: 40px square on a phone, 36px from `sm`. */
  | 'icon'
  /** `BarButton`: icon-only on a phone, icon + label from `sm`. */
  | 'button'
  /** A custom-width control (range pickers, segmented toggles). */
  | { className: string };

/**
 * `AdminCommandBar`: the sticky, full-bleed bar fused with the rail.
 *
 * `crumbs` are Tailwind width classes for each breadcrumb segment (the last is
 * the current page). `primary` is the width class of the clay CTA, or false.
 */
export function CommandBarSkeleton({
  crumbs = ['w-36', 'w-20'],
  count = false,
  live = true,
  search = false,
  actions = [],
  primary = false,
  themeToggle = true,
}: {
  crumbs?: string[];
  count?: boolean;
  live?: boolean;
  search?: boolean;
  actions?: BarActionShape[];
  primary?: string | false;
  themeToggle?: boolean;
}) {
  return (
    <header className="sticky top-0 z-30 -mx-4 -mt-4 border-b border-border/70 bg-background/90 backdrop-blur-xl sm:-mx-6 sm:-mt-6 lg:-me-8 lg:-ms-20 lg:-mt-8 lg:bg-background/80">
      <div className="flex w-full flex-col gap-2 px-4 py-3 sm:px-6 lg:h-16 lg:flex-row lg:items-center lg:gap-4 lg:py-0 lg:pe-8 lg:ps-20">
        <div className="flex min-w-0 shrink items-center gap-2 overflow-hidden">
          {/* text-13 at line-height 1.4, with the links' min-h-6 → a 24px row. */}
          <div className="flex h-6 min-w-0 items-center gap-1.5">
            {crumbs.map((w, i) => (
              <span key={i} className="flex shrink-0 items-center gap-1.5">
                {i > 0 && <span className="size-3.5 shrink-0" aria-hidden="true" />}
                <Skeleton className={cn('h-3', w, i < crumbs.length - 1 && 'opacity-70')} />
              </span>
            ))}
            {count && <Skeleton className="ms-1 hidden h-[18px] w-8 rounded-full md:block" />}
          </div>
          {live && (
            <>
              <span className="hidden h-4 w-px bg-border/80 sm:block" aria-hidden="true" />
              <span className="hidden items-center gap-1.5 sm:flex">
                <span className="size-1.5 rounded-full bg-muted-foreground/30" />
                <Skeleton className="h-2.5 w-8" />
              </span>
            </>
          )}
        </div>

        {search && (
          <div className="w-full min-w-0 lg:flex-1 lg:px-4">
            <Skeleton className="mx-auto h-9 w-full max-w-md rounded-lg border border-border/80 bg-card/70" />
          </div>
        )}

        {(actions.length > 0 || primary || themeToggle) && (
          <div className="-mx-4 flex w-full min-w-0 shrink-0 items-center justify-end gap-2 overflow-hidden px-4 pb-1 sm:mx-0 sm:w-auto sm:px-0 sm:pb-0 lg:ms-auto">
            {themeToggle && <BarControl shape="icon" />}
            {actions.map((shape, i) => (
              <BarControl key={i} shape={shape} />
            ))}
            {actions.length > 0 && primary && (
              <span className="hidden h-5 w-px bg-border/80 sm:block" aria-hidden="true" />
            )}
            {primary && <Skeleton className={cn('h-10 shrink-0 rounded-lg bg-primary/25 sm:h-9', primary)} />}
          </div>
        )}
      </div>
    </header>
  );
}

function BarControl({ shape }: { shape: BarActionShape }) {
  const base = 'h-10 shrink-0 rounded-lg border border-border/80 bg-card sm:h-9';
  if (shape === 'icon') return <Skeleton className={cn(base, 'w-10 sm:w-9')} />;
  if (shape === 'button') return <Skeleton className={cn(base, 'w-10 sm:w-24')} />;
  return <Skeleton className={cn(base, shape.className)} />;
}

/**
 * `AdminPageHeader`: serif title, optional description, optional badge.
 *
 * The title box is the real line box (28px × 1.15, 34px × 1.15 from `sm`) so the
 * description lands where the real one will.
 */
export function PageHeaderSkeleton({
  titleWidth = 'w-44 sm:w-64',
  description = true,
  badge,
  className,
}: {
  titleWidth?: string;
  description?: boolean;
  /** Width/height classes of the trailing badge slot, if the page has one. */
  badge?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-start justify-between gap-4 pb-1 pt-2 md:flex-row md:items-end',
        className,
      )}
    >
      <div className="w-full min-w-0 md:w-auto md:flex-1">
        <div className="flex h-8 items-center sm:h-[39px]">
          <Skeleton className={cn('h-6 sm:h-7', titleWidth)} />
        </div>
        {description && (
          <div className="mt-2 max-w-2xl space-y-[11px] py-[5px]">
            <Skeleton className="h-3 w-full max-w-xl" />
            <Skeleton className="h-3 w-2/3 sm:hidden" />
          </div>
        )}
      </div>
      {badge && <Skeleton className={cn('shrink-0', badge)} />}
    </div>
  );
}

/** `AdminKpiCard`: label, serif value, sub line, tone tile, optional sparkline. */
export function KpiCardSkeleton({ sub = true, sparkline = false }: { sub?: boolean; sparkline?: boolean }) {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-border/70 bg-card p-4 shadow-xs sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex h-4 items-center">
            <Skeleton className="h-2.5 w-24" />
          </div>
          <div className="mt-2.5 flex h-[26px] items-center sm:h-[30px]">
            <Skeleton className="h-6 w-20 sm:h-7" />
          </div>
          {sub && (
            <div className="mt-1.5 flex h-4 items-center">
              <Skeleton className="h-2.5 w-32" />
            </div>
          )}
        </div>
        <Skeleton className="size-9 shrink-0 rounded-lg" />
      </div>
      {sparkline && <Skeleton className="mt-4 h-9 w-full" />}
    </div>
  );
}

/** A row of `AdminKpiCard`s in the grid every list page uses. */
export function KpiGridSkeleton({
  count = 4,
  className = 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4',
  sub = true,
  sparkline = false,
}: {
  count?: number;
  className?: string;
  sub?: boolean;
  sparkline?: boolean;
}) {
  return (
    <div className={className}>
      <Repeat count={count}>{(i) => <KpiCardSkeleton key={i} sub={sub} sparkline={sparkline} />}</Repeat>
    </div>
  );
}

/**
 * The hairline KPI strip used by the catalogue lists (products, courses,
 * academies): four cells, an icon tile, a label over a serif number.
 */
export function StatStripSkeleton({
  cells = 4,
  rounded = 'rounded-2xl',
  grid = 'grid grid-cols-2 divide-x divide-border/70 sm:grid-cols-4 rtl:divide-x-reverse',
  icon = 'size-10 rounded-xl',
}: {
  cells?: number;
  /** The section's radius (courses and certificates use rounded-xl). */
  rounded?: string;
  /** The `<dl>` grid classes, copied from the page. */
  grid?: string;
  /** The icon tile's size and radius. */
  icon?: string;
}) {
  return (
    <section className={cn('overflow-hidden border border-border/70 bg-card shadow-xs', rounded)}>
      <div className={grid}>
        <Repeat count={cells}>
          {(i) => (
            <div key={i} className="flex items-center gap-3.5 px-5 py-5">
              <Skeleton className={cn('shrink-0', icon)} />
              <div className="flex min-w-0 flex-col gap-1.5">
                <div className="flex h-4 items-center">
                  <Skeleton className="h-2.5 w-14" />
                </div>
                <Skeleton className="h-6 w-10" />
              </div>
            </div>
          )}
        </Repeat>
      </div>
    </section>
  );
}

/** `Toolbar`: the bordered filter row. */
export function ToolbarSkeleton({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex w-full flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-card p-2 shadow-xs [&>*]:min-w-0',
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * `PillTabs`. `tabs` are label widths in px; the first renders as the active
 * tab. Counts add the small badge the real tabs show.
 */
export function PillTabsSkeleton({ tabs = [28, 40, 56, 52], counts = true }: { tabs?: number[]; counts?: boolean }) {
  return (
    <div className="flex w-full items-center gap-0.5 overflow-hidden rounded-xl bg-muted/70 p-1">
      {tabs.map((w, i) => (
        <span
          key={i}
          className={cn(
            'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-3',
            i === 0 && 'border border-border/60 bg-card shadow-xs',
          )}
        >
          <Skeleton className="h-2.5" style={{ width: w }} />
          {counts && <Skeleton className="h-3.5 w-5 rounded-full" />}
        </span>
      ))}
    </div>
  );
}

/** `Select` from admin-ui: full width on a phone, auto from `sm`. */
export function SelectSkeleton({ className = 'sm:w-36' }: { className?: string }) {
  return <Skeleton className={cn('h-10 w-full rounded-lg border border-border/80 bg-card sm:h-9', className)} />;
}

/** `SegmentedIconToggle` with `n` icons (grid/list switchers). */
export function SegmentedToggleSkeleton({ options = 2 }: { options?: number }) {
  return (
    <div className="flex h-10 w-full items-center justify-between gap-0.5 rounded-lg border border-border/70 bg-muted/60 p-0.5 sm:h-auto sm:w-auto sm:justify-start">
      <Repeat count={options}>
        {(i) => (
          <span key={i} className={cn('rounded-md p-1.5', i === 0 && 'bg-card shadow-xs ring-1 ring-border/60')}>
            <Skeleton className="size-4 rounded" shimmer={false} />
          </span>
        )}
      </Repeat>
    </div>
  );
}

/* ── Tables ──────────────────────────────────────────────────────────────── */

/** What one table column holds, so the bar takes the real cell's shape. */
export type CellShape =
  /** Avatar + name over email. */
  | 'person'
  /** Square tile + title over a mono slug. */
  | 'tile'
  /** One line of text. */
  | 'text'
  /** Two lines of text. */
  | 'text2'
  /** A rounded status pill. */
  | 'pill'
  /** A right-aligned number. */
  | 'num'
  /** One or two trailing action buttons. */
  | 'actions'
  /** A short date / time stamp. */
  | 'date';

export interface ColumnSpec {
  cell: CellShape;
  /** Flex basis: a number is a grow factor, a string a fixed CSS width. */
  size?: number | string;
  /** Hide the column below a breakpoint, as the real table does. */
  hideBelow?: 'sm' | 'md' | 'lg' | 'xl';
  /** Header label width in px; 0 for an unlabelled column. */
  header?: number;
}

const HIDE: Record<NonNullable<ColumnSpec['hideBelow']>, string> = {
  sm: 'hidden sm:flex',
  md: 'hidden md:flex',
  lg: 'hidden lg:flex',
  xl: 'hidden xl:flex',
};

function columnStyle(size: ColumnSpec['size']): CSSProperties {
  if (typeof size === 'string') return { flex: `0 0 ${size}` };
  return { flex: `${size ?? 1} 1 0%` };
}

function Cell({ shape, row }: { shape: CellShape; row: number }) {
  // Vary widths by row so the column reads as real, ragged data.
  const ragged = ['w-2/3', 'w-1/2', 'w-3/5', 'w-2/5', 'w-3/4', 'w-1/2'][row % 6];
  switch (shape) {
    case 'person':
    case 'tile':
      return (
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Skeleton className={cn('size-10 shrink-0', shape === 'person' ? 'rounded-full' : 'rounded-xl')} />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className={cn('h-3', ragged)} />
            <Skeleton className="h-2.5 w-2/5" />
          </div>
        </div>
      );
    case 'text2':
      return (
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className={cn('h-3', ragged)} />
          <Skeleton className="h-2.5 w-1/3" />
        </div>
      );
    case 'pill':
      return <Skeleton className="h-[22px] w-20 rounded-full" />;
    case 'num':
      return <Skeleton className="ms-auto h-3 w-14" />;
    case 'date':
      return <Skeleton className="h-3 w-20" />;
    case 'actions':
      return (
        <div className="ms-auto flex items-center gap-1.5">
          <Skeleton className="size-8 rounded-lg" />
          <Skeleton className="hidden h-8 w-20 rounded-lg sm:block" />
        </div>
      );
    default:
      return <Skeleton className={cn('h-3', ragged)} />;
  }
}

/**
 * A table inside `TableCard`: header labels, then rows whose cells take the
 * real cells' shapes. Columns are flex tracks rather than a grid template, so
 * hiding a column at a breakpoint never leaves an empty track behind.
 */
export function TableCardSkeleton({
  columns,
  rows = 8,
  header = true,
  footer = false,
  rowClassName = 'px-4 py-3.5 sm:px-5',
  className,
}: {
  columns: ColumnSpec[];
  rows?: number;
  header?: boolean;
  footer?: boolean;
  rowClassName?: string;
  className?: string;
}) {
  return (
    <div className={cn('overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs', className)}>
      {header && (
        <div className="flex items-center gap-4 border-b border-border/70 bg-surface-sunken/40 px-4 py-2.5 sm:px-5">
          {columns.map((c, i) => (
            <div
              key={i}
              className={cn('flex h-4 min-w-0 items-center', c.hideBelow && HIDE[c.hideBelow])}
              style={columnStyle(c.size)}
            >
              {(c.header ?? 48) > 0 && (
                <Skeleton
                  className={cn('h-2.5', (c.cell === 'num' || c.cell === 'actions') && 'ms-auto')}
                  style={{ width: c.header ?? 48 }}
                  shimmer={false}
                />
              )}
            </div>
          ))}
        </div>
      )}
      <div className="divide-y divide-border/60">
        <Repeat count={rows}>
          {(r) => (
            <div key={r} className={cn('flex items-center gap-4', rowClassName)}>
              {columns.map((c, i) => (
                <div
                  key={i}
                  className={cn('flex min-w-0 items-center', c.hideBelow && HIDE[c.hideBelow])}
                  style={columnStyle(c.size)}
                >
                  <Cell shape={c.cell} row={r} />
                </div>
              ))}
            </div>
          )}
        </Repeat>
      </div>
      {footer && <PaginationFooterSkeleton />}
    </div>
  );
}

/** `Pagination` as it sits in a `TableCard` footer. */
export function PaginationFooterSkeleton({ bordered = true }: { bordered?: boolean }) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5',
        bordered && 'border-t border-border/70 bg-surface-sunken/30',
      )}
    >
      <div className="flex h-4 items-center">
        <Skeleton className="h-2.5 w-40" />
      </div>
      <div className="flex w-full items-center gap-2 sm:w-auto">
        <Skeleton className="h-10 flex-1 rounded-lg sm:h-9 sm:w-20 sm:flex-none" />
        <Skeleton className="h-10 flex-1 rounded-lg sm:h-9 sm:w-20 sm:flex-none" />
      </div>
    </div>
  );
}

/* ── Panels ──────────────────────────────────────────────────────────────── */

/**
 * The header-and-body card shared by the dashboard's `Panel` and admin-ui's
 * `PanelCard`. `variant` picks the header padding of each.
 */
export function PanelSkeleton({
  titleWidth = 'w-32',
  subtitle = true,
  action,
  variant = 'panel',
  tone = 'default',
  bodyClassName = 'p-4 sm:p-5',
  className,
  children,
}: {
  titleWidth?: string;
  subtitle?: boolean;
  /** Width class of the header action (a link or count), if any. */
  action?: string;
  variant?: 'panel' | 'card';
  tone?: 'default' | 'attention';
  bodyClassName?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-xl border bg-card shadow-xs',
        tone === 'attention' ? 'border-warning/25' : 'border-border/70',
        className,
      )}
    >
      <div
        className={cn(
          'flex justify-between gap-3 border-b border-border/60 px-4 sm:px-5',
          variant === 'panel' ? 'items-center py-3.5' : 'items-start gap-4 py-4',
        )}
      >
        <div className="min-w-0 flex-1">
          {/* font-display text-base / 1.0625rem, leading-snug → ~24px. */}
          <div className="flex h-6 items-center">
            <Skeleton className={cn('h-3.5', titleWidth)} />
          </div>
          {subtitle && (
            <div className={cn('flex h-4 items-center', variant === 'panel' ? 'mt-0.5' : 'mt-1')}>
              <Skeleton className="h-2.5 w-48 max-w-full" />
            </div>
          )}
        </div>
        {action && <Skeleton className={cn('h-4 shrink-0', action)} />}
      </div>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

/** Rows of a divided list inside a panel: leading circle, two lines, trailing stamp. */
export function PanelListSkeleton({
  rows = 4,
  lead = 'circle',
  trailing = 'w-10',
  rowClassName = 'px-4 py-3 sm:px-5',
}: {
  rows?: number;
  lead?: 'circle' | 'square' | 'index' | false;
  trailing?: string | false;
  rowClassName?: string;
}) {
  return (
    <div className="divide-y divide-border/60">
      <Repeat count={rows}>
        {(i) => (
          <div key={i} className={cn('flex items-center gap-3', rowClassName)}>
            {lead === 'circle' && <Skeleton className="size-8 shrink-0 rounded-full" />}
            {lead === 'square' && <Skeleton className="size-8 shrink-0 rounded-lg" />}
            {lead === 'index' && <Skeleton className="h-3.5 w-3 shrink-0" />}
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className={cn('h-3', ['w-3/5', 'w-1/2', 'w-2/3', 'w-2/5'][i % 4])} />
              <Skeleton className="h-2.5 w-2/5" />
            </div>
            {trailing && <Skeleton className={cn('h-2.5 shrink-0', trailing)} />}
          </div>
        )}
      </Repeat>
    </div>
  );
}

/** A labelled field as admin-form renders it: 13px label over a 40px control. */
export function FieldSkeleton({
  label = 'w-28',
  control = 'h-10',
  hint = false,
  className,
}: {
  label?: string;
  control?: string;
  hint?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex h-[18px] items-center">
        <Skeleton className={cn('h-2.5', label)} />
      </div>
      <Skeleton className={cn('w-full rounded-lg', control)} />
      {hint && <Skeleton className="h-2.5 w-52 max-w-full" />}
    </div>
  );
}

/* ── Forms (components/admin/admin-form.tsx, form-page.tsx) ──────────────── */

/** A row inside a `FormSection` body. */
export type FormRowShape = 'field' | 'area' | 'grid2' | 'grid3' | 'switch' | 'color';

function FormRow({ shape }: { shape: FormRowShape }) {
  switch (shape) {
    case 'area':
      return <FieldSkeleton control="h-[5.5rem]" hint />;
    case 'grid2':
    case 'grid3':
      return (
        <div className={cn('grid grid-cols-1 gap-4', shape === 'grid2' ? 'sm:grid-cols-2' : 'sm:grid-cols-3')}>
          <Repeat count={shape === 'grid2' ? 2 : 3}>{(i) => <FieldSkeleton key={i} label="w-20" />}</Repeat>
        </div>
      );
    case 'switch':
      return (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border/70 px-4 py-3">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-2.5 w-2/3" />
          </div>
          <Skeleton className="h-6 w-11 shrink-0 rounded-full" />
        </div>
      );
    case 'color':
      return (
        <div className="space-y-1.5">
          <div className="flex h-[18px] items-center">
            <Skeleton className="h-2.5 w-24" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="size-10 shrink-0 rounded-lg" />
            <Skeleton className="h-10 flex-1 rounded-lg" />
          </div>
        </div>
      );
    default:
      return <FieldSkeleton />;
  }
}

/** `FormSection`: bordered header (icon, serif title, description), padded body. */
export function FormSectionSkeleton({
  rows = ['field', 'area', 'field'],
  description = true,
  actions,
  children,
  bodyClassName = 'p-4 sm:p-5',
}: {
  rows?: FormRowShape[];
  description?: boolean;
  /** Width class of a header action, if the section has one. */
  actions?: string;
  /** Replaces `rows` when the body has a custom shape. */
  children?: ReactNode;
  bodyClassName?: string;
}) {
  return (
    <section className="flex flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-4 sm:px-5">
        <div className="min-w-0 flex-1">
          <div className="flex h-6 items-center gap-2">
            <Skeleton className="size-4 shrink-0 rounded" shimmer={false} />
            <Skeleton className="h-3.5 w-32" />
          </div>
          {description && (
            <div className="mt-1 flex h-[19px] items-center">
              <Skeleton className="h-2.5 w-64 max-w-full" />
            </div>
          )}
        </div>
        {actions && <Skeleton className={cn('h-9 shrink-0 rounded-lg', actions)} />}
      </div>
      <div className={bodyClassName}>
        {children ?? (
          <div className="space-y-5">
            {rows.map((r, i) => (
              <FormRow key={i} shape={r} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/** `SectionNav`: the sticky "on this page" list in a form's aside. */
export function SectionNavSkeleton({ items = 4, className }: { items?: number; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-border/70 bg-card p-2 shadow-xs', className)}>
      <div className="flex h-[30px] items-center px-2.5">
        <Skeleton className="h-2.5 w-16" />
      </div>
      <div className="flex flex-col gap-0.5">
        <Repeat count={items}>
          {(i) => (
            <div key={i} className={cn('flex h-8 items-center gap-2 rounded-lg px-2.5', i === 0 && 'bg-muted')}>
              <Skeleton className="size-3.5 shrink-0 rounded" shimmer={false} />
              <Skeleton className={cn('h-2.5', ['w-20', 'w-16', 'w-24', 'w-14', 'w-20'][i % 5])} />
            </div>
          )}
        </Repeat>
      </div>
    </div>
  );
}

/**
 * `FormLayout`: the form column plus a sticky aside that only appears from xl.
 * `className` takes the same overrides the real layout is given.
 */
export function FormLayoutSkeleton({
  children,
  aside,
  narrow = false,
  className,
}: {
  children: ReactNode;
  aside?: ReactNode;
  narrow?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'mx-auto grid w-full gap-6 pb-28',
        narrow ? 'max-w-3xl' : 'max-w-6xl',
        aside != null && 'xl:grid-cols-[minmax(0,1fr)_17rem] xl:gap-8',
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-6">{children}</div>
      {aside != null && (
        <div className="hidden xl:block">
          <div className="flex flex-col gap-4">{aside}</div>
        </div>
      )}
    </div>
  );
}
