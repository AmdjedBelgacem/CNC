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
import { cn } from '@/lib/utils';
import { PanelCard, Skeleton } from './admin-ui';

/* Reusable chart atoms for the analytics dashboard.
 * The dashboard renders four near-identical trend panels; extracting them here
 * keeps the axis, grid, tooltip and empty-state behaviour in one place. */

export type TrendPoint = { date: string; count?: number; cents?: number };

const CHART_COLORS: Record<string, string> = {
  primary: 'hsl(var(--primary))',
  success: 'hsl(var(--success))',
  info: 'hsl(var(--info))',
  warning: 'hsl(var(--warning))',
  accent: 'hsl(var(--accent))',
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
  if (!active || !payload?.length) return null;
  const d = label ? new Date(label) : null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      {d && !Number.isNaN(d.getTime()) && (
        <p className="mb-1 font-semibold text-popover-foreground">
          {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </p>
      )}
      {payload.map((p, i) => (
        <p key={i} className="text-muted-foreground">
          <span className="font-semibold text-popover-foreground">
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
  const stroke = CHART_COLORS[color] ?? CHART_COLORS.primary;
  const gradId = `grad-${color}-${valueKey}`;
  const fmt = formatValue ?? ((v: number) => v.toLocaleString());
  const hasData = data.length > 0;

  return (
    <PanelCard
      title={
        <span className="flex items-center gap-2">
          <Icon className="size-4 shrink-0 text-primary" />
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
        <div className="flex h-[260px] flex-col items-center justify-center gap-2 text-center">
          <Icon className="size-7 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">{emptyMessage}</p>
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={stroke} stopOpacity={0.28} />
                  <stop offset="95%" stopColor={stroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(v) =>
                  new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                }
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                minTickGap={24}
              />
              <YAxis
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                width={52}
                tickFormatter={(v) => (valueKey === 'cents' ? `$${Math.round(v / 100)}` : String(v))}
              />
              <Tooltip
                cursor={{ stroke: 'hsl(var(--border-strong))' }}
                content={
                  <ChartTooltip formatter={(v) => (valueKey === 'cents' ? fmt(v) : fmt(v))} />
                }
              />
              <Area
                type="monotone"
                dataKey={valueKey}
                name={unitLabel}
                stroke={stroke}
                strokeWidth={2}
                fill={`url(#${gradId})`}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: 'hsl(var(--card))' }}
              />
            </AreaChart>
          </ResponsiveContainer>
          {footer && <div className="mt-3">{footer}</div>}
          {compareSuffix && (
            <p className="mt-2 text-center text-2xs text-muted-foreground">{compareSuffix}</p>
          )}
        </>
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
          'flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold tabular-nums',
          rank === 1
            ? 'bg-warning/15 text-warning'
            : rank === 2
              ? 'bg-muted-foreground/15 text-muted-foreground'
              : 'bg-muted text-muted-foreground',
        )}
      >
        {rank}
      </span>
      {thumbnail}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{title}</p>
        {typeof progress === 'number' && (
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn('h-full rounded-full transition-all', barColor)}
              style={{ width: `${Math.min(100, Math.max(2, progress))}%` }}
            />
          </div>
        )}
        {sub && <p className="mt-1 truncate text-2xs text-muted-foreground">{sub}</p>}
      </div>
      <div className="shrink-0 text-end">
        <p className="text-sm font-bold tabular-nums text-foreground">{value}</p>
      </div>
    </>
  );
  const cls =
    'group flex items-center gap-3 rounded-xl border border-transparent p-3 transition hover:border-border hover:bg-muted/50 focus-visible:border-primary focus-visible:outline-none';
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
