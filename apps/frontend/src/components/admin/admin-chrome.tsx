'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronRight, Moon, Search, Sun, X, type LucideIcon } from 'lucide-react';
import { AnimatePresence, m } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ease, spring } from '@/lib/motion';
import { useTheme } from '@/components/providers/theme-provider';
import { AnimatedNumber } from '@/components/ui/motion';

/* -----------------------------------------------------------------------------
 * Admin chrome — the standard shell for every admin page.
 * Ivory & Clay: a quiet translucent top bar on the ivory page, hairline
 * borders, serif page titles, sans controls. 64px bar, 36–40px controls,
 * 16px icons. Theme tokens only; clay reserved for the one primary CTA.
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
  'sticky top-0 z-30 -mx-4 -mt-4 border-b border-border/70 bg-background/90 shadow-none backdrop-blur-xl backdrop-saturate-150 transition-shadow duration-300 sm:-mx-6 sm:-mt-6 lg:-ms-20 lg:-me-8 lg:-mt-8 lg:bg-background/80';

const BAR_SECONDARY =
  'flex h-10 shrink-0 items-center rounded-lg border border-border/80 bg-card text-muted-foreground shadow-xs outline-none transition-[background-color,border-color,color,transform] duration-150 hover:border-border-strong hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 sm:h-9';

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
      className={cn(BAR_SECONDARY, 'w-10 justify-center sm:w-9 [&_svg]:size-4')}
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
      className={cn(BAR_SECONDARY, 'gap-1.5 px-3 text-13 font-medium')}
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
      className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 text-13 font-medium text-primary-foreground shadow-sm outline-none transition-[background-color,box-shadow,transform] duration-150 hover:bg-primary/90 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 sm:h-9"
    >
      {icon}
      {children}
    </button>
  );
}

/** Sun/moon switch wired to the app color mode (persisted to localStorage). */
export function ThemeToggle() {
  const t = useTranslations('ui.adminChrome');
  const { colorMode, toggleColorMode } = useTheme();
  const dark = colorMode === 'dark';
  return (
    <BarIconButton
      title={dark ? t('switchToLight') : t('switchToDark')}
      ariaLabel={dark ? t('switchToLight') : t('switchToDark')}
      onClick={toggleColorMode}
    >
      <AnimatePresence mode="wait" initial={false}>
        <m.span
          key={dark ? 'sun' : 'moon'}
          className="flex"
          initial={{ opacity: 0, rotate: -60, scale: 0.6 }}
          animate={{ opacity: 1, rotate: 0, scale: 1, transition: spring.snappy }}
          exit={{ opacity: 0, rotate: 60, scale: 0.6, transition: { duration: 0.12, ease: ease.exit } }}
        >
          {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </m.span>
      </AnimatePresence>
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
  live,
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
  const t = useTranslations('ui.adminChrome');
  const tc = useTranslations('common');
  const liveLabel = live ?? t('live');
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
    <header className={cn(FUSED_BAR, scrolled && 'shadow-md')}>
      <div className="flex w-full flex-col gap-2 px-4 py-3 sm:px-6 lg:h-16 lg:flex-row lg:items-center lg:gap-4 lg:py-0 lg:ps-20 lg:pe-8">
        <div className="no-scrollbar flex min-w-0 shrink items-center gap-2 overflow-x-auto">
          <nav
            aria-label={t('breadcrumb')}
            className="flex min-w-max items-center gap-1.5 whitespace-nowrap text-13"
          >
            {context.map((item) => (
              <span key={item.label} className="flex shrink-0 items-center gap-1.5">
                {item.href ? (
                  <a
                    href={item.href}
                    className="inline-flex min-h-6 items-center rounded-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {item.label}
                  </a>
                ) : (
                  <span className="font-medium text-muted-foreground">{item.label}</span>
                )}
                <ChevronRight className="flip-rtl size-3.5 text-muted-foreground/40" />
              </span>
            ))}
            <span className="truncate font-medium text-foreground">
              {current?.label}
            </span>
            {count !== undefined && count !== null && (
              <span className="ms-1 hidden shrink-0 rounded-full bg-foreground/[0.06] px-2 py-0.5 text-2xs font-medium tabular-nums text-muted-foreground md:inline-block">
                <AnimatedNumber value={count} animateOnChange durationSeconds={0.6} />
              </span>
            )}
          </nav>
          {live !== false && (
            <>
              <span className="hidden h-4 w-px bg-border/80 sm:block" aria-hidden="true" />
              <span className="hidden items-center gap-1.5 sm:flex" title={t('syncStatus')}>
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
                </span>
                <span className="text-xs font-medium text-muted-foreground">{liveLabel}</span>
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
                placeholder={search.placeholder ?? t('searchPlaceholder')}
                aria-label={search.ariaLabel ?? tc('search')}
                className="h-9 w-full rounded-lg border border-border/80 bg-card/70 ps-9 pe-12 text-13 text-foreground shadow-xs outline-none transition-[background-color,border-color,box-shadow] duration-150 placeholder:text-muted-foreground/70 hover:border-border-strong focus:border-primary/50 focus:bg-card focus:ring-[3px] focus:ring-primary/15"
              />
              <div className="absolute end-2.5 top-1/2 flex -translate-y-1/2 items-center">
                <AnimatePresence mode="wait" initial={false}>
                  {search.value ? (
                    <m.button
                      key="clear"
                      type="button"
                      onClick={() => search.onChange('')}
                      aria-label={t('clearSearch')}
                      initial={{ opacity: 0, scale: 0.7 }}
                      animate={{ opacity: 1, scale: 1, transition: spring.snappy }}
                      exit={{ opacity: 0, scale: 0.7, transition: { duration: 0.1 } }}
                      className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </m.button>
                  ) : (
                    <m.kbd
                      key="kbd"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, transition: { duration: 0.1 } }}
                      className="rounded-md border border-border/80 bg-card px-1.5 py-0.5 font-mono text-2xs font-medium text-muted-foreground"
                    >
                      /
                    </m.kbd>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        )}

        {(actions || primary || themeToggle) && (
          <div className="no-scrollbar -mx-4 flex w-full min-w-0 shrink-0 items-center justify-end gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:w-auto sm:px-0 sm:pb-0 lg:ms-auto">
            {themeToggle && <ThemeToggle />}
            {actions}
            {actions && primary && (
              <span className="hidden h-5 w-px bg-border/80 sm:block" aria-hidden="true" />
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
    <m.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: ease.emerge }}
      className="flex flex-col items-start justify-between gap-4 pb-1 pt-2 md:flex-row md:items-end"
    >
      <div className="w-full min-w-0 md:w-auto">
        <h1 className="text-balance font-display text-[28px] font-medium leading-[1.15] tracking-[-0.022em] text-foreground sm:text-[34px]">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-pretty text-sm font-normal leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {badge ? <div className="w-full md:w-auto">{badge}</div> : null}
    </m.div>
  );
}

const KPI_TONES: Record<string, string> = {
  blue: 'bg-primary/10 text-primary',
  purple: 'bg-accent/10 text-accent',
  emerald: 'bg-success/10 text-success',
  cyan: 'bg-info/10 text-info',
  amber: 'bg-warning/10 text-warning',
  rose: 'bg-destructive/10 text-destructive',
  slate: 'bg-muted text-muted-foreground',
};

/**
 * Standard KPI card: quiet sans label, serif value, optional trend + sparkline,
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
    <div className="group flex flex-col justify-between rounded-xl border border-border/70 bg-card p-4 shadow-xs transition-[border-color,box-shadow] duration-200 hover:border-border hover:shadow-md sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
          <div className="mt-2.5 flex flex-wrap items-baseline gap-2">
            <span className="font-display text-[26px] font-medium leading-none tracking-[-0.022em] text-foreground sm:text-[30px]">
              {typeof value === 'number' ? <AnimatedNumber value={value} animateOnChange /> : value}
            </span>
            {meta}
            {/* `meta` (e.g. a delta badge) already carries the direction. */}
            {!meta && typeof trendUp === 'boolean' && (
              <TrendIndicator up={trendUp} />
            )}
          </div>
          {sub && <p className="mt-1.5 truncate text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-105',
            KPI_TONES[tone] ?? KPI_TONES.blue,
          )}
        >
          <Icon className="size-[18px]" />
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
        'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium',
        up ? 'bg-success/10' : 'bg-destructive/10',
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
  // Plain aliases are full `rgb(...)` colours — `hsl(var(--success))` resolved to
  // nothing and the sparkline drew invisibly.
  const stroke = positive ? 'var(--success)' : 'var(--destructive)';
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      className={cn('w-full', className)}
    >
      <m.polygon
        points={`0,${h} ${points.join(' ')} ${w},${h}`}
        fill={stroke}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.1 }}
        transition={{ duration: 0.6, delay: 0.3, ease: ease.emerge }}
      />
      <m.polyline
        points={points.join(' ')}
        fill="none"
        stroke={stroke}
        strokeWidth={1.75}
        // Opacity, not pathLength: dash-based drawing breaks under
        // `non-scaling-stroke`, which this stretched viewBox depends on.
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, ease: ease.emerge }}
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
        'grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border/70 bg-border/60 sm:grid-cols-3',
        className,
      )}
    >
      {items.map((it) => (
        <div key={it.label} className="bg-card px-4 py-3">
          <dt className="truncate text-xs font-medium text-muted-foreground">{it.label}</dt>
          <dd
            className={cn(
              'mt-1 font-display text-xl font-medium tracking-[-0.015em] tabular-nums',
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
