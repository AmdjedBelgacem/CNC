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
  'sticky top-0 z-30 -mx-4 -mt-4 border-b border-border/80 bg-background/85 shadow-none backdrop-blur-xl transition-shadow duration-300 sm:-mx-6 sm:-mt-6 lg:-ml-20 lg:-mr-8 lg:-mt-8';

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
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={ariaLabel ?? title}
      disabled={disabled}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition hover:bg-muted hover:text-foreground active:scale-95 disabled:opacity-50"
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
      className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-border bg-background px-3 text-[13px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground active:scale-[0.98] disabled:opacity-50"
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
      className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 text-[13px] font-semibold text-white shadow-sm shadow-blue-600/25 transition hover:bg-blue-700 hover:shadow-md hover:shadow-blue-600/25 active:scale-[0.98] disabled:opacity-50"
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
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
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
      <div className="flex w-full flex-col gap-2.5 px-4 py-3 sm:px-6 lg:h-16 lg:flex-row lg:items-center lg:gap-4 lg:py-0 lg:pl-20 lg:pr-8">
        <div className="flex min-w-0 shrink-0 items-center gap-2">
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-[13px]">
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
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
              </span>
            ))}
            <span className="truncate font-semibold tracking-tight text-foreground">
              {current?.label}
            </span>
            {count !== undefined && count !== null && (
              <span className="ml-1 hidden shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground md:inline-block">
                {count}
              </span>
            )}
          </nav>
          {live !== false && (
            <>
              <span className="hidden h-4 w-px bg-border sm:block" aria-hidden="true" />
              <span className="hidden items-center gap-1.5 sm:flex" title="Sync status">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
                <span className="text-xs font-medium text-muted-foreground">{live}</span>
              </span>
            </>
          )}
        </div>

        {search && (
          <div className="w-full min-w-0 lg:flex-1 lg:px-4">
            <div className="relative mx-auto w-full max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={searchRef}
                value={search.value}
                onChange={(e) => search.onChange(e.target.value)}
                placeholder={search.placeholder ?? 'Search…'}
                aria-label={search.ariaLabel ?? 'Search'}
                className="h-9 w-full rounded-xl border border-border bg-muted/50 pl-9 pr-12 text-[13px] text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-blue-500/60 focus:bg-background focus:ring-4 focus:ring-blue-500/10"
              />
              <div className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center">
                {search.value ? (
                  <button
                    type="button"
                    onClick={() => search.onChange('')}
                    aria-label="Clear search"
                    className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <kbd className="rounded-md border border-border bg-background px-1.5 py-0.5 font-sans text-[11px] font-medium text-muted-foreground">
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
  description?: string;
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
  blue: 'border-blue-100 bg-blue-50 text-blue-600 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-300',
  purple:
    'border-purple-100 bg-purple-50 text-purple-600 dark:border-purple-900/40 dark:bg-purple-950/40 dark:text-purple-300',
  emerald:
    'border-emerald-100 bg-emerald-50 text-emerald-600 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300',
  cyan: 'border-cyan-100 bg-cyan-50 text-cyan-600 dark:border-cyan-900/40 dark:bg-cyan-950/40 dark:text-cyan-300',
  amber:
    'border-amber-100 bg-amber-50 text-amber-600 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-300',
  rose: 'border-rose-100 bg-rose-50 text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300',
};

/** Standard KPI card: uppercase label, display value, meta row, tone icon tile. */
export function AdminKpiCard({
  icon: Icon,
  label,
  value,
  meta,
  sub,
  tone = 'blue',
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  meta?: ReactNode;
  sub?: string;
  tone?: keyof typeof KPI_TONES | string;
}) {
  return (
    <div className="group flex items-center justify-between rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className="mt-1.5 flex flex-wrap items-baseline gap-2">
          <span className="font-display text-2xl font-bold tracking-tight text-foreground">
            {value}
          </span>
          {meta}
        </div>
        {sub && <p className="mt-1 truncate text-[11px] text-muted-foreground">{sub}</p>}
      </div>
      <div
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-transform group-hover:scale-110',
          KPI_TONES[tone] ?? KPI_TONES.blue,
        )}
      >
        <Icon className="h-[22px] w-[22px]" />
      </div>
    </div>
  );
}
