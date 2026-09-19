'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import Link from 'next/link';
import {
  Users,
  GraduationCap,
  DollarSign,
  UserPlus,
  TrendingUp,
  Award,
  Clock,
  RefreshCw,
  Building2,
  Trophy,
  Package,
  Percent,
  ChevronRight,
  AlertCircle,
  FileEdit,
  UserX,
  TrendingDown,
  Download,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { AdminCommandBar, BarButton, BarIconButton, AdminPageHeader } from './admin-chrome';
type RangeKey = '7d' | '30d' | '90d' | '12m';
type Kpi = { value: number; delta: number | null; sparkline: number[] };
type Overview = {
  range: string;
  compare: string;
  updatedAt: string;
  users: Kpi;
  activeUsers: Kpi;
  signups: Kpi;
  enrollments: Kpi;
  revenue: { cents: number; delta: number | null; sparkline: number[] };
  conversion: Kpi;
  coursesPublished: number;
  upcomingEvents: number;
};
type Trends = {
  signups: { date: string; count: number }[];
  enrollments: { date: string; count: number }[];
  activeUsers: { date: string; count: number }[];
  revenue: { date: string; cents: number }[];
};
type Breakdowns = {
  topCoursesByEnrollment: { id: string; title: string; slug?: string; enrollments: number }[];
  topCoursesByCompletion: {
    id: string;
    title: string;
    slug: string;
    total: number;
    completed: number;
    rate: number;
  }[];
  topProductsByRevenue: {
    id: string;
    title: string;
    slug: string;
    thumbnailUrl: string | null;
    units: number;
    revenueCents: number;
  }[];
  updatedAt: string;
  range: string;
};
type Insights = {
  range: string;
  updatedAt: string;
  zeroEnrollmentCourses: { count: number; sample: { id: string; title: string; slug: string }[] };
  draftCourses: { count: number; sample: { id: string; title: string; slug: string }[] };
  failedPayments: {
    count: number;
    sample: { id: string; total: number; status: string; createdAt: string }[];
  };
  suspendedUsers: number;
  ordersSilent30d: boolean;
};
type Activity = {
  items: {
    id: string;
    type: 'signup' | 'enrollment' | 'payment_confirmed' | 'payment_failed';
    title: string;
    subtitle: string;
    at: string;
    href: string;
    meta?: string;
  }[];
  updatedAt: string;
  range: string;
};
function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  if (!data || data.length < 2 || data.every((v) => v === 0))
    return (
      <div className="h-[28px] w-[80px] opacity-30 flex items-center justify-center text-[10px] text-muted-foreground">
        no data
      </div>
    );
  const w = 80,
    h = 28;
  const min = Math.min(...data),
    max = Math.max(...data),
    range = max - min || 1;
  const d = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 6) - 3}`)
    .join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      {' '}
      <polyline
        fill="none"
        stroke={positive ? 'rgb(16 185 129)' : 'rgb(239 68 68)'}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={d}
        opacity={0.9}
      />{' '}
      <polyline
        fill={positive ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)'}
        stroke="none"
        points={`${d} ${w},${h} 0,${h}`}
      />{' '}
    </svg>
  );
}
function DeltaChip({ delta }: { delta: number | null }) {
  if (delta === null || delta === undefined)
    return <span className="text-[11px] text-muted-foreground">— vs prev</span>;
  const pos = delta >= 0;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold',
        pos
          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100'
          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
      )}
    >
      {' '}
      <TrendingUp className={cn('h-3 w-3', !pos && 'rotate-180')} /> {pos ? '+' : ''}
      {delta.toFixed(1)}%{' '}
    </span>
  );
}
function downloadCsv(filename: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map((r) => r.map(esc).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
function formatCurrency(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}
export function AnalyticsDashboardView({ title }: { title: string }) {
  const user = useAuthStore((s) => s.user);
  const role = user?.role ?? '';
  const isSuperAdmin = role === 'super_admin';
  const [overview, setOverview] = useState<Overview | null>(null);
  const [trends, setTrends] = useState<Trends | null>(null);
  const [breakdowns, setBreakdowns] = useState<Breakdowns | null>(null);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<RangeKey>('30d');
  const [compare, setCompare] = useState(true);
  const [tenantId, setTenantId] = useState<string>('');
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const fetchData = async (r: RangeKey, tid: string) => {
    const isInitial = !overview;
    if (isInitial) setLoading(true);
    else setIsFetching(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ range: r });
      if (compare) qs.set('compare', 'prev');
      if (tid) qs.set('tenantId', tid);
      const q = qs.toString();
      const [overviewRes, trendsRes, breakdownsRes, insightsRes, activityRes] = await Promise.all([
        fetch(`/api/proxy/admin/analytics/overview?${q}`, { credentials: 'include' }),
        fetch(`/api/proxy/admin/analytics/trends?${q}`, { credentials: 'include' }),
        fetch(`/api/proxy/admin/analytics/breakdowns?${q}`, { credentials: 'include' }),
        fetch(`/api/proxy/admin/analytics/insights?${q}`, { credentials: 'include' }),
        fetch(`/api/proxy/admin/analytics/activity?${q}`, { credentials: 'include' }),
      ]);
      if (!overviewRes.ok) throw new Error(`Overview ${overviewRes.status}`);
      if (!trendsRes.ok) throw new Error(`Trends ${trendsRes.status}`);
      const [o, t] = await Promise.all([overviewRes.json(), trendsRes.json()]);
      setOverview(o);
      setTrends(t);
      if (breakdownsRes.ok) {
        setBreakdowns(await breakdownsRes.json());
      } else {
        setBreakdowns({
          topCoursesByEnrollment: [],
          topCoursesByCompletion: [],
          topProductsByRevenue: [],
          updatedAt: new Date().toISOString(),
          range: r,
        });
      }
      if (insightsRes.ok) setInsights(await insightsRes.json());
      else
        setInsights({
          range: r,
          updatedAt: new Date().toISOString(),
          zeroEnrollmentCourses: { count: 0, sample: [] },
          draftCourses: { count: 0, sample: [] },
          failedPayments: { count: 0, sample: [] },
          suspendedUsers: 0,
          ordersSilent30d: false,
        });
      if (activityRes.ok) setActivity(await activityRes.json());
      else setActivity({ items: [], updatedAt: new Date().toISOString(), range: r });
    } catch (e: any) {
      setError(e?.message || 'Failed to load analytics');
    } finally {
      if (isInitial) setLoading(false);
      setIsFetching(false);
    }
  };
  useEffect(() => {
    fetchData(range, tenantId);
  }, [range, tenantId, compare]);
  const lastUpdated = useMemo(() => {
    if (!overview?.updatedAt) return null;
    const d = new Date(overview.updatedAt);
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }, [overview?.updatedAt, now]);
  const kpis = useMemo(() => {
    if (!overview) return [];
    return [
      {
        key: 'totalUsers',
        label: 'Total Users',
        value: overview.users.value.toLocaleString(),
        delta: overview.users.delta,
        sparkline: overview.users.sparkline,
        icon: Users,
        desc: 'All time',
      },
      {
        key: 'activeUsers',
        label: 'Active Users',
        value: overview.activeUsers.value.toLocaleString(),
        delta: overview.activeUsers.delta,
        sparkline: overview.activeUsers.sparkline,
        icon: GraduationCap,
        desc: 'Completed a lesson',
      },
      {
        key: 'signups',
        label: 'Signups',
        value: overview.signups.value.toLocaleString(),
        delta: overview.signups.delta,
        sparkline: overview.signups.sparkline,
        icon: UserPlus,
        desc: 'New accounts',
      },
      {
        key: 'enrollments',
        label: 'Enrollments',
        value: overview.enrollments.value.toLocaleString(),
        delta: overview.enrollments.delta,
        sparkline: overview.enrollments.sparkline,
        icon: GraduationCap,
        desc: 'Started',
      },
      {
        key: 'revenue',
        label: 'Revenue',
        value: formatCurrency(overview.revenue.cents),
        delta: overview.revenue.delta,
        sparkline: overview.revenue.sparkline,
        icon: DollarSign,
        desc: 'Confirmed orders',
      },
      {
        key: 'conversion',
        label: 'Completion Rate',
        value: `${overview.conversion.value.toFixed(1)}%`,
        delta: overview.conversion.delta,
        sparkline: overview.conversion.sparkline,
        icon: Award,
        desc: 'Completed / enrolled',
      },
    ];
  }, [overview]);
  const handleExport = () => {
    if (!overview || !trends) return;
    const meta = [
      `Generated ${new Date().toISOString()}`,
      `Range ${overview.range} ${compare ? 'vs prev' : ''}`,
      `Tenant ${tenantId || 'current'}`,
      `UpdatedAt ${overview.updatedAt}`,
    ];
    const rows: (string | number)[][] = [
      ['Analytics Export', ...meta],
      ['Metric', 'Current', 'Delta %', 'Range', 'Tenant', 'UpdatedAt'],
      [
        'Total Users',
        overview.users.value,
        overview.users.delta ?? '',
        overview.range,
        tenantId || 'current',
        overview.updatedAt,
      ],
      [
        'Active Users',
        overview.activeUsers.value,
        overview.activeUsers.delta ?? '',
        overview.range,
        tenantId || 'current',
        overview.updatedAt,
      ],
      [
        'Signups',
        overview.signups.value,
        overview.signups.delta ?? '',
        overview.range,
        tenantId || 'current',
        overview.updatedAt,
      ],
      [
        'Enrollments',
        overview.enrollments.value,
        overview.enrollments.delta ?? '',
        overview.range,
        tenantId || 'current',
        overview.updatedAt,
      ],
      [
        'Revenue cents',
        overview.revenue.cents,
        overview.revenue.delta ?? '',
        overview.range,
        tenantId || 'current',
        overview.updatedAt,
      ],
      [
        'Conversion %',
        overview.conversion.value,
        overview.conversion.delta ?? '',
        overview.range,
        tenantId || 'current',
        overview.updatedAt,
      ],
      [],
      ['Trends - Signups', 'date', 'count'],
      ...trends.signups.map((p) => ['signups', p.date, p.count] as (string | number)[]),
      ['Trends - Enrollments', 'date', 'count'],
      ...trends.enrollments.map((p) => ['enrollments', p.date, p.count] as (string | number)[]),
      ['Trends - ActiveUsers', 'date', 'count'],
      ...trends.activeUsers.map((p) => ['activeUsers', p.date, p.count] as (string | number)[]),
      ['Trends - Revenue', 'date', 'cents'],
      ...trends.revenue.map((p) => ['revenue', p.date, p.cents] as (string | number)[]),
    ];
    if (breakdowns) {
      rows.push(
        [],
        ['Breakdown - Top Courses by Enrollment', 'title', 'enrollments'],
        ...breakdowns.topCoursesByEnrollment.map(
          (c) => [c.title, c.enrollments] as (string | number)[],
        ),
      );
      rows.push(
        [],
        ['Breakdown - Top Courses by Completion', 'title', 'rate %', 'completed/total'],
        ...breakdowns.topCoursesByCompletion.map(
          (c) => [c.title, c.rate, `${c.completed}/${c.total}`] as (string | number)[],
        ),
      );
      rows.push(
        [],
        ['Breakdown - Top Products by Revenue', 'title', 'revenue_cents', 'units'],
        ...breakdowns.topProductsByRevenue.map(
          (p) => [p.title, p.revenueCents, p.units] as (string | number)[],
        ),
      );
    }
    if (insights) {
      rows.push(
        [],
        ['Insights'],
        [
          'Zero-enrollment courses',
          insights.zeroEnrollmentCourses.count,
          ...insights.zeroEnrollmentCourses.sample.map((c) => c.title),
        ],
        [
          'Draft courses',
          insights.draftCourses.count,
          ...insights.draftCourses.sample.map((c) => c.title),
        ],
        ['Failed payments', insights.failedPayments.count],
        ['Suspended users', insights.suspendedUsers],
        ['Orders silent 30d', insights.ordersSilent30d ? 'true' : 'false'],
      );
    }
    if (activity) {
      rows.push(
        [],
        ['Activity', 'type', 'title', 'at'],
        ...activity.items.map((a) => [a.type, a.title, a.at] as (string | number)[]),
      );
    }
    downloadCsv(`analytics-${range}-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };
  if (loading) {
    return (
      <div className="space-y-4">
        {' '}
        <div className="h-[104px] animate-pulse rounded-xl bg-gray-200" />{' '}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {' '}
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}{' '}
        </div>{' '}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {' '}
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />
          ))}{' '}
        </div>{' '}
        <div className="grid gap-6 lg:grid-cols-2">
          {' '}
          <div className="h-[360px] animate-pulse rounded-xl bg-muted" />{' '}
          <div className="h-[360px] animate-pulse rounded-xl bg-muted" />{' '}
        </div>{' '}
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-8 text-center">
        {' '}
        <p className="text-sm font-semibold text-destructive">Failed to load analytics</p>{' '}
        <p className="max-w-md text-xs text-muted-foreground">{error}</p>{' '}
        <Button variant="outline" size="sm" onClick={() => fetchData(range, tenantId)}>
          <RefreshCw className="mr-2 h-3 w-3" /> Retry
        </Button>{' '}
      </div>
    );
  }
  const hasRevenue = overview ? overview.revenue.cents > 0 : false;
  return (
    <div className="w-full">
      <AdminCommandBar
        trail={[{ label: 'Titans of CNC' }, { label: title }]}
        live={lastUpdated ? `Updated ${lastUpdated}` : 'Live'}
        actions={
          <>
            <BarButton
              icon={<Download className="h-4 w-4" />}
              disabled={!overview || isFetching}
              onClick={handleExport}
            >
              Export CSV
            </BarButton>
            <BarIconButton
              title="Refresh analytics"
              spinning={isFetching}
              onClick={() => fetchData(range, tenantId)}
            >
              <RefreshCw className="h-4 w-4" />
            </BarIconButton>
          </>
        }
      />

      <div className="mx-auto w-full max-w-[1500px] space-y-6 pt-6">
        <AdminPageHeader
          title={title}
          description="Growth, revenue and learning health across your academy."
          badge={
            <span className="flex items-center gap-2 self-start rounded-full border border-emerald-200/80 bg-emerald-50/80 px-3 py-1.5 text-xs font-medium text-emerald-800 shadow-sm md:self-auto dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200">
              <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              {isFetching ? 'Updating…' : 'Tenant-isolated · Admin only'}
            </span>
          }
        />
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-2.5">
          <div className="flex rounded-xl bg-muted p-1">
            {(['7d', '30d', '90d', '12m'] as RangeKey[]).map((k) => (
              <button
                key={k}
                onClick={() => setRange(k)}
                disabled={isFetching}
                className={cn(
                  'rounded-lg px-3.5 py-1.5 text-xs font-semibold transition disabled:opacity-50',
                  range === k
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {k}
              </button>
            ))}
          </div>
          <label
            className={cn(
              'flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-border bg-background px-3 text-xs font-semibold text-muted-foreground transition hover:text-foreground',
              isFetching && 'opacity-60',
            )}
          >
            <input
              type="checkbox"
              checked={compare}
              onChange={(e) => setCompare(e.target.checked)}
              disabled={isFetching}
              className="h-3 w-3 accent-blue-600"
            />
            Compare to previous
          </label>
          {isSuperAdmin && (
            <div className="flex h-9 items-center gap-1.5 rounded-xl border border-border bg-background px-2.5 text-muted-foreground">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value.trim())}
                placeholder="tenantId (super_admin)"
                className="w-40 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground/60"
                disabled={isFetching}
              />
            </div>
          )}
          <span className="ml-auto hidden items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex">
            {' '}
            Range {range} {compare ? 'vs prev' : 'no compare'} · Cached 5m{' '}
          </span>{' '}
        </div>{' '}
        <div
          className={cn(
            'space-y-4',
            isFetching && 'opacity-60 transition-opacity pointer-events-none',
          )}
        >
          {' '}
          {/* KPI Grid — 6 */}{' '}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {' '}
            {kpis.map(({ key, label, value, delta, sparkline, icon: Icon, desc }) => {
              const pos = delta === null ? true : delta >= 0;
              const isRevenue = key === 'revenue';
              const isEmpty = key === 'revenue' ? !hasRevenue : false;
              return (
                <div
                  key={key}
                  className="rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {label}
                      </p>
                      <p className="font-display text-2xl font-bold leading-none tracking-tight text-foreground">
                        {isEmpty ? '—' : value}
                      </p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                      {isRevenue && isEmpty ? (
                        <p className="text-xs text-muted-foreground">
                          No confirmed orders in range
                        </p>
                      ) : (
                        <DeltaChip delta={delta} />
                      )}{' '}
                    </div>{' '}
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>{' '}
                  <div className="mt-3 flex justify-end">
                    {' '}
                    <Sparkline data={sparkline} positive={pos} />{' '}
                  </div>{' '}
                </div>
              );
            })}{' '}
          </div>{' '}
          {/* Trends */}{' '}
          <div className="grid gap-6 lg:grid-cols-2">
            {' '}
            {/* Signups */}{' '}
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              {' '}
              <div className="border-b border-border px-6 py-4">
                {' '}
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <UserPlus className="h-4 w-4 text-primary" /> Signups Over Time
                </h3>{' '}
                <p className="text-xs text-muted-foreground">
                  New accounts per bucket · {range} {compare ? 'vs prev' : ''}
                </p>{' '}
              </div>{' '}
              <div className="p-6">
                {' '}
                {!trends || trends.signups.length === 0 ? (
                  <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                    No signups in this period
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    {' '}
                    <AreaChart data={trends.signups}>
                      {' '}
                      <defs>
                        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>{' '}
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />{' '}
                      <XAxis
                        dataKey="date"
                        tickFormatter={(v) =>
                          new Date(v).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })
                        }
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                      />{' '}
                      <YAxis
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                        allowDecimals={false}
                      />{' '}
                      <Tooltip
                        formatter={
                          ((value: any) => [
                            value != null ? Number(value).toLocaleString() : '0',
                            'Signups',
                          ]) as any
                        }
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />{' '}
                      <Area
                        type="monotone"
                        dataKey="count"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        fill="url(#sg)"
                      />{' '}
                    </AreaChart>{' '}
                  </ResponsiveContainer>
                )}{' '}
              </div>{' '}
            </div>{' '}
            {/* Enrollments */}{' '}
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              {' '}
              <div className="border-b border-border px-6 py-4">
                {' '}
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <GraduationCap className="h-4 w-4 text-primary" /> Enrollments Over Time
                </h3>{' '}
                <p className="text-xs text-muted-foreground">Started enrollments per bucket</p>{' '}
              </div>{' '}
              <div className="p-6">
                {' '}
                {!trends || trends.enrollments.length === 0 ? (
                  <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                    No enrollments in this period
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    {' '}
                    <AreaChart data={trends.enrollments}>
                      {' '}
                      <defs>
                        <linearGradient id="enr" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>{' '}
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />{' '}
                      <XAxis
                        dataKey="date"
                        tickFormatter={(v) =>
                          new Date(v).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })
                        }
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                      />{' '}
                      <YAxis
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                        allowDecimals={false}
                      />{' '}
                      <Tooltip
                        formatter={
                          ((value: any) => [
                            value != null ? Number(value).toLocaleString() : '0',
                            'Enrollments',
                          ]) as any
                        }
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />{' '}
                      <Area
                        type="monotone"
                        dataKey="count"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        fill="url(#enr)"
                      />{' '}
                    </AreaChart>{' '}
                  </ResponsiveContainer>
                )}{' '}
              </div>{' '}
            </div>{' '}
            {/* Active Users */}{' '}
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              {' '}
              <div className="border-b border-border px-6 py-4">
                {' '}
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Users className="h-4 w-4 text-primary" /> Active Users Over Time
                </h3>{' '}
                <p className="text-xs text-muted-foreground">
                  Distinct users completing lessons per bucket
                </p>{' '}
              </div>{' '}
              <div className="p-6">
                {' '}
                {!trends || trends.activeUsers.length === 0 ? (
                  <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                    No active users in this period
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    {' '}
                    <AreaChart data={trends.activeUsers}>
                      {' '}
                      <defs>
                        <linearGradient id="act" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>{' '}
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />{' '}
                      <XAxis
                        dataKey="date"
                        tickFormatter={(v) =>
                          new Date(v).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })
                        }
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                      />{' '}
                      <YAxis
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                        allowDecimals={false}
                      />{' '}
                      <Tooltip
                        formatter={
                          ((value: any) => [
                            value != null ? Number(value).toLocaleString() : '0',
                            'Active',
                          ]) as any
                        }
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />{' '}
                      <Area
                        type="monotone"
                        dataKey="count"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        fill="url(#act)"
                      />{' '}
                    </AreaChart>{' '}
                  </ResponsiveContainer>
                )}{' '}
              </div>{' '}
            </div>{' '}
            {/* Revenue */}{' '}
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              {' '}
              <div className="border-b border-border bg-muted/20 px-6 py-3">
                {' '}
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <DollarSign className="h-4 w-4 text-primary" /> Revenue Over Time
                </h3>{' '}
                <p className="text-xs text-muted-foreground">
                  Confirmed orders only · {hasRevenue ? '' : 'No confirmed orders in range'}
                </p>{' '}
              </div>{' '}
              <div className="p-6">
                {' '}
                {!trends || trends.revenue.length === 0 || !hasRevenue ? (
                  <div className="flex h-[300px] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                    {' '}
                    <DollarSign className="h-8 w-8 opacity-20" /> No revenue in this period{' '}
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    {' '}
                    <AreaChart data={trends.revenue}>
                      {' '}
                      <defs>
                        <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>{' '}
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />{' '}
                      <XAxis
                        dataKey="date"
                        tickFormatter={(v) =>
                          new Date(v).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })
                        }
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                      />{' '}
                      <YAxis
                        tickFormatter={(v) => `$${(v / 100).toFixed(0)}`}
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                      />{' '}
                      <Tooltip
                        formatter={
                          ((value: any) => [
                            new Intl.NumberFormat('en-US', {
                              style: 'currency',
                              currency: 'USD',
                            }).format(Number(value ?? 0) / 100),
                            'Revenue',
                          ]) as any
                        }
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />{' '}
                      <Area
                        type="monotone"
                        dataKey="cents"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        fill="url(#rev)"
                      />{' '}
                    </AreaChart>{' '}
                  </ResponsiveContainer>
                )}{' '}
              </div>{' '}
            </div>{' '}
          </div>{' '}
          {/* Breakdowns */}{' '}
          <div className="grid gap-6 lg:grid-cols-3">
            {' '}
            {/* Top Courses by Enrollment */}{' '}
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              {' '}
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                {' '}
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Trophy className="h-4 w-4 text-primary" /> Top Courses by Enrollment
                </h3>{' '}
                <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {breakdowns?.topCoursesByEnrollment.length ?? 0}
                </span>{' '}
              </div>{' '}
              <div className="p-3">
                {' '}
                {!breakdowns ? (
                  <div className="space-y-2">
                    {' '}
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
                    ))}{' '}
                  </div>
                ) : breakdowns.topCoursesByEnrollment.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                    {' '}
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                      <Trophy className="h-5 w-5 text-muted-foreground/60" />
                    </div>{' '}
                    <p className="text-sm font-medium">No enrollments in this period</p>{' '}
                    <p className="max-w-[20ch] text-xs text-muted-foreground">
                      Courses will appear here once learners enroll.
                    </p>{' '}
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {' '}
                    {breakdowns.topCoursesByEnrollment.map((course, idx) => (
                      <Link
                        key={course.id}
                        href={course.slug ? `/admin/courses/${course.slug}/edit` : '/admin/courses'}
                        className="group flex items-center gap-3 rounded-xl border border-transparent p-3 transition hover:border-border hover:bg-muted/50"
                      >
                        {' '}
                        <span
                          className={cn(
                            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold shadow-sm',
                            idx === 0
                              ? 'bg-amber-500 text-white'
                              : idx === 1
                                ? 'bg-zinc-400 text-white'
                                : idx === 2
                                  ? 'bg-amber-700 text-white'
                                  : 'bg-muted text-muted-foreground',
                          )}
                        >
                          {' '}
                          {idx + 1}{' '}
                        </span>{' '}
                        <div className="min-w-0 flex-1">
                          {' '}
                          <p className="truncate text-sm font-medium">
                            {course.title || 'Untitled course'}
                          </p>{' '}
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-md bg-muted">
                            {' '}
                            <div
                              className="h-full rounded-md bg-primary"
                              style={{
                                width: `${Math.min(100, (course.enrollments / Math.max(1, breakdowns.topCoursesByEnrollment[0]?.enrollments ?? 1)) * 100)}%`,
                              }}
                            />{' '}
                          </div>{' '}
                        </div>{' '}
                        <div className="shrink-0 text-right">
                          {' '}
                          <p className="text-sm font-bold">
                            {course.enrollments.toLocaleString()}
                          </p>{' '}
                          <p className="text-[11px] text-muted-foreground">enrollments</p>{' '}
                        </div>{' '}
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />{' '}
                      </Link>
                    ))}{' '}
                  </ul>
                )}{' '}
              </div>{' '}
            </div>{' '}
            {/* Top Courses by Completion */}{' '}
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              {' '}
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                {' '}
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Percent className="h-4 w-4 text-primary" /> Top Courses by Completion
                </h3>{' '}
                <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {breakdowns?.topCoursesByCompletion.length ?? 0}
                </span>{' '}
              </div>{' '}
              <div className="p-3">
                {' '}
                {!breakdowns ? (
                  <div className="space-y-2">
                    {' '}
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
                    ))}{' '}
                  </div>
                ) : breakdowns.topCoursesByCompletion.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                    {' '}
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                      <Award className="h-5 w-5 text-muted-foreground/60" />
                    </div>{' '}
                    <p className="text-sm font-medium">No completions yet</p>{' '}
                    <p className="max-w-[20ch] text-xs text-muted-foreground">
                      Completion rates appear once courses have enrollments.
                    </p>{' '}
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {' '}
                    {breakdowns.topCoursesByCompletion.map((course, idx) => (
                      <Link
                        key={course.id}
                        href={course.slug ? `/admin/courses/${course.slug}/edit` : '/admin/courses'}
                        className="group flex items-center gap-3 rounded-xl border border-transparent p-3 transition hover:border-border hover:bg-muted/50"
                      >
                        {' '}
                        <span
                          className={cn(
                            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold shadow-sm',
                            idx === 0
                              ? 'bg-emerald-500 text-white'
                              : 'bg-muted text-muted-foreground',
                          )}
                        >
                          {' '}
                          {idx + 1}{' '}
                        </span>{' '}
                        <div className="min-w-0 flex-1">
                          {' '}
                          <p className="truncate text-sm font-medium">
                            {course.title || 'Untitled course'}
                          </p>{' '}
                          <div className="mt-1 flex items-center gap-2">
                            {' '}
                            <div className="h-1.5 flex-1 overflow-hidden rounded-md bg-muted">
                              {' '}
                              <div
                                className="h-full rounded-md bg-emerald-500"
                                style={{ width: `${course.rate}%` }}
                              />{' '}
                            </div>{' '}
                            <span className="text-xs font-medium text-emerald-600">
                              {course.rate.toFixed(1)}%
                            </span>{' '}
                          </div>{' '}
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {course.completed}/{course.total} completed
                          </p>{' '}
                        </div>{' '}
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />{' '}
                      </Link>
                    ))}{' '}
                  </ul>
                )}{' '}
              </div>{' '}
            </div>{' '}
            {/* Top Products by Revenue */}{' '}
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              {' '}
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                {' '}
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Package className="h-4 w-4 text-primary" /> Top Products by Revenue
                </h3>{' '}
                <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {breakdowns?.topProductsByRevenue.length ?? 0}
                </span>{' '}
              </div>{' '}
              <div className="p-3">
                {' '}
                {!breakdowns ? (
                  <div className="space-y-2">
                    {' '}
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
                    ))}{' '}
                  </div>
                ) : breakdowns.topProductsByRevenue.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                    {' '}
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                      <Package className="h-5 w-5 text-muted-foreground/60" />
                    </div>{' '}
                    <p className="text-sm font-medium">No revenue in this period</p>{' '}
                    <p className="max-w-[20ch] text-xs text-muted-foreground">
                      Confirmed orders will appear here.
                    </p>{' '}
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {' '}
                    {breakdowns.topProductsByRevenue.map((product, idx) => (
                      <Link
                        key={product.id}
                        href={product.slug ? `/products/${product.slug}` : '#'}
                        className="group flex items-center gap-3 rounded-xl border border-transparent p-3 transition hover:border-border hover:bg-muted/50"
                      >
                        {' '}
                        <span
                          className={cn(
                            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold shadow-sm',
                            idx === 0
                              ? 'bg-amber-500 text-white'
                              : 'bg-muted text-muted-foreground',
                          )}
                        >
                          {' '}
                          {idx + 1}{' '}
                        </span>{' '}
                        {product.thumbnailUrl ? (
                          <img
                            src={product.thumbnailUrl}
                            alt=""
                            className="h-9 w-9 shrink-0 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                            <Package className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}{' '}
                        <div className="min-w-0 flex-1">
                          {' '}
                          <p className="truncate text-sm font-medium">
                            {product.title || 'Untitled product'}
                          </p>{' '}
                          <p className="text-xs text-muted-foreground">
                            {product.units.toLocaleString()} units ·{' '}
                            {formatCurrency(product.revenueCents)}
                          </p>{' '}
                        </div>{' '}
                        <div className="shrink-0 text-right">
                          {' '}
                          <p className="text-sm font-bold">
                            {formatCurrency(product.revenueCents)}
                          </p>{' '}
                        </div>{' '}
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />{' '}
                      </Link>
                    ))}{' '}
                  </ul>
                )}{' '}
              </div>{' '}
            </div>{' '}
          </div>{' '}
          {/* Insights */}{' '}
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            {' '}
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              {' '}
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <AlertCircle className="h-4 w-4 text-amber-500" /> Actionable Insights
              </h3>{' '}
              <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {insights
                  ? [
                      insights.zeroEnrollmentCourses.count,
                      insights.draftCourses.count,
                      insights.failedPayments.count,
                      insights.suspendedUsers,
                    ].filter(Boolean).length
                  : 0}{' '}
                alerts
              </span>{' '}
            </div>{' '}
            {!insights ? (
              <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
                {' '}
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
                ))}{' '}
              </div>
            ) : (
              <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
                {' '}
                {/* Zero-enrollment */}{' '}
                <Link
                  href="/admin/courses?enrollments=0"
                  className={cn(
                    'group flex flex-col gap-2 rounded-xl border p-4 transition ',
                    insights.zeroEnrollmentCourses.count > 0
                      ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950'
                      : 'border-border bg-background',
                  )}
                >
                  {' '}
                  <span
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg',
                      insights.zeroEnrollmentCourses.count > 0
                        ? 'bg-amber-500 text-white'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {' '}
                    <Trophy className="h-4 w-4" />{' '}
                  </span>{' '}
                  <p className="text-sm font-semibold">Zero-enrollment courses</p>{' '}
                  <p className="text-2xl font-bold">{insights.zeroEnrollmentCourses.count}</p>{' '}
                  <p className="text-xs text-muted-foreground">
                    Published courses with no enrollments
                  </p>{' '}
                  {insights.zeroEnrollmentCourses.sample.length > 0 && (
                    <ul className="mt-1 space-y-1">
                      {' '}
                      {insights.zeroEnrollmentCourses.sample.slice(0, 3).map((c) => (
                        <li key={c.id} className="truncate text-xs text-muted-foreground">
                          · {c.title}
                        </li>
                      ))}{' '}
                    </ul>
                  )}{' '}
                  <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary">
                    View courses <ChevronRight className="h-3 w-3" />
                  </span>{' '}
                </Link>{' '}
                {/* Drafts */}{' '}
                <Link
                  href="/admin/courses?status=draft"
                  className={cn(
                    'group flex flex-col gap-2 rounded-xl border p-4 transition ',
                    insights.draftCourses.count > 0
                      ? 'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950'
                      : 'border-border bg-background',
                  )}
                >
                  {' '}
                  <span
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg',
                      insights.draftCourses.count > 0
                        ? 'bg-blue-500 text-white'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {' '}
                    <FileEdit className="h-4 w-4" />{' '}
                  </span>{' '}
                  <p className="text-sm font-semibold">Drafts awaiting publish</p>{' '}
                  <p className="text-2xl font-bold">{insights.draftCourses.count}</p>{' '}
                  <p className="text-xs text-muted-foreground">
                    Unpublished courses in this tenant
                  </p>{' '}
                  {insights.draftCourses.sample.length > 0 && (
                    <ul className="mt-1 space-y-1">
                      {' '}
                      {insights.draftCourses.sample.slice(0, 3).map((c) => (
                        <li key={c.id} className="truncate text-xs text-muted-foreground">
                          · {c.title}
                        </li>
                      ))}{' '}
                    </ul>
                  )}{' '}
                  <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary">
                    Review drafts <ChevronRight className="h-3 w-3" />
                  </span>{' '}
                </Link>{' '}
                {/* Failed payments */}{' '}
                <Link
                  href="/admin/analytics"
                  className={cn(
                    'group flex flex-col gap-2 rounded-xl border p-4 transition ',
                    insights.failedPayments.count > 0
                      ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950'
                      : 'border-border bg-background',
                  )}
                >
                  {' '}
                  <span
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg',
                      insights.failedPayments.count > 0
                        ? 'bg-red-500 text-white'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {' '}
                    <TrendingDown className="h-4 w-4" />{' '}
                  </span>{' '}
                  <p className="text-sm font-semibold">Failed payments</p>{' '}
                  <p className="text-2xl font-bold">{insights.failedPayments.count}</p>{' '}
                  <p className="text-xs text-muted-foreground">
                    In selected range ·{' '}
                    {insights.failedPayments.count > 0 ? 'Needs attention' : 'No failures'}
                  </p>{' '}
                  {insights.failedPayments.sample.length > 0 && (
                    <ul className="mt-1 space-y-1">
                      {' '}
                      {insights.failedPayments.sample.slice(0, 2).map((o: any) => (
                        <li key={o.id} className="truncate text-xs text-muted-foreground">
                          · {o.status} · {(o.total / 100).toFixed(0)}
                        </li>
                      ))}{' '}
                    </ul>
                  )}{' '}
                  <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary">
                    View orders <ChevronRight className="h-3 w-3" />
                  </span>{' '}
                </Link>{' '}
                {/* Suspended / silent */}{' '}
                <div
                  className={cn(
                    'flex flex-col gap-2 rounded-xl border p-4',
                    insights.suspendedUsers > 0 || insights.ordersSilent30d
                      ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950'
                      : 'border-border bg-background',
                  )}
                >
                  {' '}
                  <span
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg',
                      insights.suspendedUsers > 0
                        ? 'bg-amber-500 text-white'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {' '}
                    <UserX className="h-4 w-4" />{' '}
                  </span>{' '}
                  <p className="text-sm font-semibold">Operational alerts</p>{' '}
                  <p className="text-xs text-muted-foreground">
                    {' '}
                    {insights.suspendedUsers > 0
                      ? `${insights.suspendedUsers} suspended accounts`
                      : 'No suspended accounts'}{' '}
                    {insights.ordersSilent30d ? ' · No confirmed orders in 30d' : ''}{' '}
                  </p>{' '}
                  <Link
                    href="/admin/users?suspended=true"
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary"
                  >
                    Review users <ChevronRight className="h-3 w-3" />
                  </Link>{' '}
                </div>{' '}
              </div>
            )}{' '}
          </div>{' '}
          {/* Activity Feed */}{' '}
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            {' '}
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              {' '}
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Clock className="h-4 w-4 text-primary" /> Recent Activity
              </h3>{' '}
              <span className="text-xs text-muted-foreground">
                {activity ? `${activity.items.length} events` : ''} · {range}
              </span>{' '}
            </div>{' '}
            {!activity ? (
              <div className="space-y-3 p-6">
                {' '}
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-12 animate-pulse rounded-xl bg-muted" />
                ))}{' '}
              </div>
            ) : activity.items.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                {' '}
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                  <Clock className="h-5 w-5 text-muted-foreground/60" />
                </div>{' '}
                <p className="text-sm font-medium">No activity in this period</p>{' '}
                <p className="max-w-[30ch] text-xs text-muted-foreground">
                  Signups, enrollments, and payments will appear here.
                </p>{' '}
              </div>
            ) : (
              <ul className="relative space-y-0 px-6 py-4 before:absolute before:bottom-4 before:left-[35px] before:top-4 before:w-px before:bg-border">
                {' '}
                {activity.items.map((item) => (
                  <li key={item.id} className="relative flex gap-3 py-3 pl-8">
                    {' '}
                    <span
                      className={cn(
                        'absolute left-0 top-4 flex h-2.5 w-2.5 items-center justify-center rounded-full ring-4 ring-background',
                        item.type === 'signup'
                          ? 'bg-blue-500'
                          : item.type === 'enrollment'
                            ? 'bg-emerald-500'
                            : item.type === 'payment_failed'
                              ? 'bg-red-500'
                              : 'bg-amber-500',
                      )}
                    />{' '}
                    <div className="min-w-0 flex-1">
                      {' '}
                      <Link
                        href={item.href}
                        className="group flex items-center gap-1 truncate text-sm hover:underline"
                      >
                        {' '}
                        <span className="font-medium">{item.title}</span>{' '}
                        <ChevronRight className="h-3 w-3 shrink-0 opacity-0 transition group-hover:opacity-100" />{' '}
                      </Link>{' '}
                      <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>{' '}
                    </div>{' '}
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {(() => {
                        const d = new Date(item.at);
                        const diff = Math.floor((Date.now() - d.getTime()) / 60000);
                        if (diff < 1) return 'just now';
                        if (diff < 60) return `${diff}m ago`;
                        const h = Math.floor(diff / 60);
                        if (h < 24) return `${h}h ago`;
                        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                      })()}
                    </span>{' '}
                  </li>
                ))}{' '}
              </ul>
            )}{' '}
          </div>{' '}
          {/* Footer meta */}{' '}
          <div className="flex items-center justify-between rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
            {' '}
            <span className="flex items-center gap-1.5">
              <Clock className="h-3 w-3" /> Last updated {lastUpdated ?? '—'} · Tenant isolated ·
              Admin only
            </span>{' '}
            <span className="hidden sm:inline">
              Range {range} · {compare ? 'Comparing to previous period' : 'No compare'} · Cached 5m
            </span>{' '}
          </div>
        </div>
      </div>
    </div>
  );
}
