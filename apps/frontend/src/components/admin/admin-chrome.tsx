'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronRight, Moon, Search, Sun, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/providers/theme-provider';

/* -----------------------------------------------------------------------------
 * Admin chrome — the standard shell for every admin page.
 * Rhythm: 64px command bar, 36px controls, 8px action gaps, 16px icons,
 * 12px radii, 13px labels. Theme tokens only; accent reserved for one CTA.
 * --------------------------------------------------------------------------- */

export interface CommandBarSearch {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}

export interface TrailItem {
  label: string;
  href?: string;
}

const FUSED_BAR =
  'sticky top-0 z-30 -mx-4 -mt-4 border-b border-border/80 bg-background/85 shadow-none backdrop-blur-xl transition-shadow duration-300 sm:-mx-6 sm:-mt-6 lg:-ms-20 lg:-me-8 lg:-mt-8';

/** Secondary icon-only control for the command bar (h-9, 12px radius). */
export function BarIconButton({
  children,
  onClick,
  title,
  ariaLabel,
  disabled,
  spinning,
}: {
  children: ReactNode;
  onClick: () => void;
  title: string;
  ariaLabel?: string;
  disabled?: boolean;
  spinning?: boolean;
}) {
  // 36px hit area with a 16px glyph — the icon is no longer edge-to-edge.
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={ariaLabel ?? title}
      disabled={disabled}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition hover:bg-muted hover:text-foreground active:scale-95 disabled:opacity-50 [&_svg]:size-4"
    >
      <span className={cn('flex', spinning && 'animate-spin')}>{children}</span>
    </button>
  );
}

/** Secondary text control for the command bar (h-9, label hides on xs). */
export function BarButton({
  children,
  icon,
  onClick,
  title,
  disabled,
}: {
  children: ReactNode;
  icon?: ReactNode;
  onClick: () => void;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-13 font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground active:scale-[0.98] disabled:opacity-50"
    >
      {icon}
      <span className="hidden sm:inline">{children}</span>
    </button>
  );
}

/** The single primary CTA of the command bar. Accent lives here only. */
export function BarPrimaryButton({
  children,
  icon,
  onClick,
  disabled,
}: {
  children: ReactNode;
  icon?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-primary px-3.5 text-13 font-semibold text-primary-foreground shadow-xs transition hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50"
    >
      {icon}
      {children}
    </button>
  );
}

/** Sun/moon switch wired to the app color mode (persisted to localStorage). */
export function ThemeToggle() {
  const { colorMode, toggleColorMode } = useTheme();
  const dark = colorMode === 'dark';
  return (
    <BarIconButton
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      ariaLabel={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={toggleColorMode}
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </BarIconButton>
  );
}

/**
 * Full-bleed sticky command bar fused with the left rail.
 * Zones: context (breadcrumb + count + live) · center live-filter search ·
 * secondary actions + divider + primary CTA. Includes the theme toggle.
 */
export function AdminCommandBar({
  trail,
  count,
  live = 'Live',
  search,
  actions,
  primary,
  themeToggle = true,
}: {
  trail: TrailItem[];
  count?: number | null;
  live?: string | false;
  search?: CommandBarSearch | null;
  actions?: ReactNode;
  primary?: ReactNode;
  themeToggle?: boolean;
}) {
  const [scrolled, setScrolled] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!search) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      if (
        e.key === '/' &&
        !(t instanceof HTMLInputElement) &&
        !(t instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [search]);

  const current = trail[trail.length - 1];
  const context = trail.slice(0, -1);

  return (
    <header className={cn(FUSED_BAR, scrolled && 'shadow-[0_12px_32px_-16px_rgba(15,23,42,0.25)]')}>
      <div className="flex w-full flex-col gap-2.5 px-4 py-3 sm:px-6 lg:h-16 lg:flex-row lg:items-center lg:gap-4 lg:py-0 lg:ps-20 lg:pe-8">
        <div className="flex min-w-0 shrink-0 items-center gap-2">
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-13">
            {context.map((item) => (
              <span key={item.label} className="flex shrink-0 items-center gap-1.5">
                {item.href ? (
                  <a
                    href={item.href}
                    className="font-medium text-muted-foreground transition hover:text-foreground"
                  >
                    {item.label}
                  </a>
                ) : (
                  <span className="font-medium text-muted-foreground">{item.label}</span>
                )}
                <ChevronRight className="flip-rtl size-3.5 text-muted-foreground/50" />
              </span>
            ))}
            <span className="truncate font-semibold tracking-tight text-foreground">
              {current?.label}
            </span>
            {count !== undefined && count !== null && (
              <span className="ms-1 hidden shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-2xs font-semibold tabular-nums text-muted-foreground md:inline-block">
                {count}
              </span>
            )}
          </nav>
          {live !== false && (
            <>
              <span className="hidden h-4 w-px bg-border sm:block" aria-hidden="true" />
              <span className="hidden items-center gap-1.5 sm:flex" title="Sync status">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
                </span>
                <span className="text-xs font-medium text-muted-foreground">{live}</span>
              </span>
            </>
          )}
        </div>

        {search && (
          <div className="w-full min-w-0 lg:flex-1 lg:px-4">
            <div className="relative mx-auto w-full max-w-md">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={searchRef}
                value={search.value}
                onChange={(e) => search.onChange(e.target.value)}
                placeholder={search.placeholder ?? 'Search…'}
                aria-label={search.ariaLabel ?? 'Search'}
                className="h-9 w-full rounded-md border border-border bg-muted/50 ps-9 pe-12 text-13 text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary/60 focus:bg-background focus:ring-4 focus:ring-primary/10"
              />
              <div className="absolute end-2.5 top-1/2 flex -translate-y-1/2 items-center">
                {search.value ? (
                  <button
                    type="button"
                    onClick={() => search.onChange('')}
                    aria-label="Clear search"
                    className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                ) : (
                  <kbd className="rounded-md border border-border bg-background px-1.5 py-0.5 font-sans text-2xs font-medium text-muted-foreground">
                    /
                  </kbd>
                )}
              </div>
            </div>
          </div>
        )}

        {(actions || primary || themeToggle) && (
          <div className="flex shrink-0 items-center gap-2">
            {themeToggle && <ThemeToggle />}
            {actions}
            {actions && primary && (
              <span className="hidden h-6 w-px bg-border sm:block" aria-hidden="true" />
            )}
            {primary}
          </div>
        )}
      </div>
    </header>
  );
}

/** Standard page title block: serif display title, description, status badge. */
export function AdminPageHeader({
  title,
  description,
  badge,
}: {
  title: string;
  /* ReactNode, not string: callers in RTL locales need to isolate an LTR URL
   * with `dir="ltr"` so the bidi algorithm does not reorder it. */
  description?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-4 pb-1 md:flex-row md:items-end">
      <div>
        <h1 className="font-headline-lg text-[32px] leading-tight tracking-tight text-foreground sm:text-[36px]">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm font-normal leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {badge}
    </div>
  );
}

const KPI_TONES: Record<string, string> = {
  blue: 'border-primary/25 bg-primary/10 text-primary',
  purple: 'border-accent/25 bg-accent/10 text-accent',
  emerald: 'border-success/25 bg-success/10 text-success',
  cyan: 'border-info/25 bg-info/10 text-info',
  amber: 'border-warning/25 bg-warning/10 text-warning',
  rose: 'border-destructive/25 bg-destructive/10 text-destructive',
  slate: 'border-border bg-muted text-muted-foreground',
};

/**
 * Standard KPI card: uppercase label, display value, optional trend + sparkline,
 * and a tone icon tile.
 *
 * The sparkline is drawn inline as an SVG so a KPI can show its own shape without
 * each screen hand-rolling a chart. It is decorative: the value and the delta
 * carry the meaning, so it is hidden from assistive tech.
 */
export function AdminKpiCard({
  icon: Icon,
  label,
  value,
  meta,
  sub,
  tone = 'blue',
  sparkline,
  trendUp,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  meta?: ReactNode;
  sub?: string;
  tone?: keyof typeof KPI_TONES | string;
  sparkline?: number[];
  trendUp?: boolean | null;
}) {
  return (
    <div className="group flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-xs transition-all hover:border-border-strong hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <div className="mt-2 flex flex-wrap items-baseline gap-2">
            <span className="font-display text-[26px] font-bold leading-none tracking-tight text-foreground">
              {value}
            </span>
            {meta}
            {typeof trendUp === 'boolean' && (
              <TrendIndicator up={trendUp} />
            )}
          </div>
          {sub && <p className="mt-1.5 truncate text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-xl border',
            KPI_TONES[tone] ?? KPI_TONES.blue,
          )}
        >
          <Icon className="size-5" />
        </div>
      </div>
      {sparkline && sparkline.length > 1 && (
        <Sparkline
          data={sparkline}
          positive={trendUp !== false}
          className="mt-4 h-9"
        />
      )}
    </div>
  );
}

/** Small up/down arrow used next to a KPI value. */
export function TrendIndicator({
  up,
  label,
}: {
  up: boolean;
  label?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex items-center gap-0.5 text-xs font-bold',
        up ? 'text-success' : 'text-destructive',
      )}
    >
      <svg viewBox="0 0 10 10" className="size-2.5" fill="currentColor">
        {up ? <path d="M5 1l4 6H1z" /> : <path d="M5 9L1 3h8z" />}
      </svg>
      {label}
    </span>
  );
}

/** Minimal inline sparkline (SVG polyline + soft fill). */
export function Sparkline({
  data,
  positive = true,
  className,
}: {
  data: number[];
  positive?: boolean;
  className?: string;
}) {
  if (data.length < 2) return null;
  const w = 100;
  const h = 32;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / span) * (h - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const stroke = positive ? 'hsl(var(--success))' : 'hsl(var(--destructive))';
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      className={cn('w-full', className)}
    >
      <polygon
        points={`0,${h} ${points.join(' ')} ${w},${h}`}
        fill={stroke}
        opacity={0.12}
      />
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/**
 * A row of compact inline stats used at the top of detail panels. Lighter than a
 * KPI card when the numbers are secondary to the primary content.
 */
export function StatRow({
  items,
  className,
}: {
  items: { label: string; value: ReactNode; tone?: string }[];
  className?: string;
}) {
  return (
    <dl
      className={cn(
        'grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3',
        className,
      )}
    >
      {items.map((it) => (
        <div key={it.label} className="bg-card px-4 py-3">
          <dt className="truncate text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
            {it.label}
          </dt>
          <dd
            className={cn(
              'mt-1 font-display text-lg font-bold tracking-tight tabular-nums',
              it.tone ?? 'text-foreground',
            )}
          >
            {it.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
