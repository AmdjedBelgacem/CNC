'use client';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { LucideIcon } from 'lucide-react';
import { useLocale } from 'next-intl';
import { formatDate } from '@/lib/format';
import { m } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ease } from '@/lib/motion';
import { PanelCard, Skeleton } from './admin-ui';

/* Reusable chart atoms for the analytics dashboard.
 * The dashboard renders four near-identical trend panels; extracting them here
 * keeps the axis, grid, tooltip and empty-state behaviour in one place. */

export type TrendPoint = { date: string; count?: number; cents?: number };

/* Token colours. The plain aliases (`--primary`, …) are complete `rgb()` values,
 * so they are used as-is — wrapping them in `hsl()` produced an invalid colour
 * and every series fell back to black. */
const CHART_COLORS: Record<string, string> = {
  primary: 'var(--primary)',
  success: 'var(--success)',
  info: 'var(--info)',
  warning: 'var(--warning)',
  accent: 'var(--accent)',
};

/** Shared tooltip so every chart in the dashboard feels identical. */
function ChartTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: { value?: number | string; name?: string }[];
  label?: string;
  formatter: (v: number) => string;
}) {
  const locale = useLocale();
  if (!active || !payload?.length) return null;
  const d = label ? new Date(label) : null;
  return (
    <div className="rounded-lg border border-border/80 bg-popover px-3 py-2 text-xs shadow-lg">
      {d && !Number.isNaN(d.getTime()) && (
        <p className="mb-1 font-medium text-muted-foreground">
          {formatDate(d, locale, { month: 'short', day: 'numeric' })}
        </p>
      )}
      {payload.map((p, i) => (
        <p key={i} className="text-muted-foreground">
          <span className="font-medium tabular-nums text-popover-foreground">
            {formatter(Number(p.value ?? 0))}
          </span>{' '}
          {p.name}
        </p>
      ))}
    </div>
  );
}

/**
 * A single trend panel: header, area chart, and a graceful empty state.
 *
 * `valueKey` selects the numeric field (revenue uses cents, the rest count).
 */
export function TrendChart({
  title,
  description,
  icon: Icon,
  data,
  valueKey = 'count',
  color = 'primary',
  formatValue,
  unitLabel,
  emptyMessage,
  compareSuffix,
  height = 260,
  loading,
  footer,
}: {
  title: string;
  description?: string;
  icon: LucideIcon;
  data: TrendPoint[];
  valueKey?: 'count' | 'cents';
  color?: keyof typeof CHART_COLORS;
  formatValue?: (v: number) => string;
  unitLabel: string;
  emptyMessage: string;
  compareSuffix?: string;
  height?: number;
  loading?: boolean;
  footer?: React.ReactNode;
}) {
  const locale = useLocale();
  const stroke = CHART_COLORS[color] ?? CHART_COLORS.primary;
  const gradId = `grad-${color}-${valueKey}`;
  const fmt = formatValue ?? ((v: number) => v.toLocaleString(locale));
  const hasData = data.length > 0;

  return (
    <PanelCard
      title={
        <span className="flex items-center gap-2">
          <Icon className="size-4 shrink-0 text-muted-foreground" />
          {title}
        </span>
      }
      description={description}
    >
      {loading ? (
        <div className="flex h-[260px] items-end gap-2">
          {[40, 62, 48, 78, 55, 88, 70, 58].map((h, i) => (
            <Skeleton key={i} className="flex-1 rounded-t-md" style={{ height: `${h}%` }} />
          ))}
        </div>
      ) : !hasData ? (
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, ease: ease.emerge }}
          className="flex h-[260px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border/70 bg-surface-sunken/30 text-center"
        >
          <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground/70">
            <Icon className="size-5" />
          </span>
          <p className="max-w-xs text-sm text-muted-foreground">{emptyMessage}</p>
        </m.div>
      ) : (
        <m.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: ease.emerge }}
        >
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={stroke} stopOpacity={0.18} />
                  <stop offset="95%" stopColor={stroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" strokeOpacity={0.8} vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => formatDate(v, locale, { month: 'short', day: 'numeric' })}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                minTickGap={24}
              />
              <YAxis
                tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                width={52}
                tickFormatter={(v) => (valueKey === 'cents' ? `$${Math.round(v / 100)}` : String(v))}
              />
              <Tooltip
                cursor={{ stroke: 'var(--border-strong)', strokeDasharray: '3 3' }}
                content={
                  <ChartTooltip formatter={(v) => (valueKey === 'cents' ? fmt(v) : fmt(v))} />
                }
              />
              <Area
                type="monotone"
                dataKey={valueKey}
                name={unitLabel}
                stroke={stroke}
                strokeWidth={1.75}
                fill={`url(#${gradId})`}
                dot={false}
                animationDuration={900}
                animationEasing="ease-out"
                activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--card)' }}
              />
            </AreaChart>
          </ResponsiveContainer>
          {footer && <div className="mt-3">{footer}</div>}
          {compareSuffix && (
            <p className="mt-2 text-center text-xs text-muted-foreground">{compareSuffix}</p>
          )}
        </m.div>
      )}
    </PanelCard>
  );
}

/**
 * A ranked list with an inline progress bar — used for top courses/products.
 * `progress` derives the bar width relative to the top item.
 */
export function RankedListItem({
  rank,
  title,
  value,
  sub,
  progress,
  progressTone = 'primary',
  href,
  thumbnail,
}: {
  rank: number;
  title: string;
  value: string;
  sub?: string;
  progress?: number;
  progressTone?: 'primary' | 'success' | 'warning' | 'accent';
  href?: string;
  thumbnail?: React.ReactNode;
}) {
  const barColor =
    progressTone === 'success'
      ? 'bg-success'
      : progressTone === 'warning'
        ? 'bg-warning'
        : progressTone === 'accent'
          ? 'bg-accent'
          : 'bg-primary';
  const body = (
    <>
      <span
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-full font-display text-sm font-medium tabular-nums',
          rank === 1
            ? 'bg-primary/10 text-primary'
            : rank === 2
              ? 'bg-secondary/10 text-secondary dark:bg-foreground/10 dark:text-foreground'
              : 'bg-muted text-muted-foreground',
        )}
      >
        {rank}
      </span>
      {thumbnail}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{title}</p>
        {typeof progress === 'number' && (
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
            <m.div
              className={cn('h-full rounded-full opacity-70', barColor)}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, Math.max(2, progress))}%` }}
              transition={{ duration: 0.7, delay: Math.min(rank * 0.05, 0.4), ease: ease.emerge }}
            />
          </div>
        )}
        {sub && <p className="mt-1 truncate text-xs text-muted-foreground">{sub}</p>}
      </div>
      <div className="shrink-0 text-end">
        <p className="text-sm font-medium tabular-nums text-foreground">{value}</p>
      </div>
    </>
  );
  const cls =
    'group flex items-center gap-3 rounded-lg border border-transparent p-3 transition-colors duration-150 hover:border-border/70 hover:bg-muted/40 focus-visible:border-primary/50 focus-visible:outline-none';
  return href ? (
    <li>
      <a href={href} className={cls}>
        {body}
      </a>
    </li>
  ) : (
    <li className={cls}>{body}</li>
  );
}
