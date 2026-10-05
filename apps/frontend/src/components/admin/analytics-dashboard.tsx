'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import {
  Activity as ActivityIcon,
  AlertCircle,
  Award,
  Building2,
  Clock,
  DollarSign,
  Download,
  FileEdit,
  GraduationCap,
  Percent,
  Package,
  RefreshCw,
  ShieldCheck,
  Trophy,
  UserPlus,
  Users,
  UserX,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getImageSrc } from '@/lib/images';
import { formatMinorUnits } from '@/lib/money';
import { DEFAULT_CURRENCY, type CurrencyCode } from '@titan/shared';
import { useAuthStore } from '@/stores/auth-store';
import {
  AdminCommandBar,
  AdminKpiCard,
  AdminPageHeader,
  BarButton,
  BarIconButton,
} from './admin-chrome';
import {
  ErrorBanner,
  PanelCard,
  PillTabs,
  Select,
  Skeleton,
  SkeletonPanel,
  SkeletonRows,
  StatusPill,
  TONE_ICON,
  type Tone,
} from './admin-ui';
import { RankedListItem, TrendChart, type TrendPoint } from './analytics-charts';

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
  signups: TrendPoint[];
  enrollments: TrendPoint[];
  activeUsers: TrendPoint[];
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
type ActivityFeed = {
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

const RANGES: RangeKey[] = ['7d', '30d', '90d', '12m'];
const RANGE_LABEL_KEY: Record<RangeKey, string> = {
  '7d': 'range7d',
  '30d': 'range30d',
  '90d': 'range90d',
  '12m': 'range12m',
};

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

/** Delta badge for a KPI. `null` means "no comparable prior period". */
function DeltaBadge({ delta }: { delta: number | null }) {
  const t = useTranslations('analytics');
  if (delta === null || delta === undefined) {
    return <span className="text-2xs text-muted-foreground">{t('vsPrevShort', { default: '— vs prev' })}</span>;
  }
  const pos = delta >= 0;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-2xs font-bold tabular-nums',
        pos ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive',
      )}
    >
      <svg viewBox="0 0 10 10" className={cn('size-2.5', !pos && 'rotate-180')} fill="currentColor" aria-hidden="true">
        {pos ? <path d="M5 1l4 6H1z" /> : <path d="M5 9L1 3h8z" />}
      </svg>
      {pos ? '+' : ''}
      {delta.toFixed(1)}%
    </span>
  );
}

export function AnalyticsDashboardView({ title }: { title: string }) {
  const t = useTranslations('analytics');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const user = useAuthStore((s) => s.user);
  const role = user?.role ?? '';
  const isSuperAdmin = role === 'super_admin';

  const [overview, setOverview] = useState<Overview | null>(null);
  const [trends, setTrends] = useState<Trends | null>(null);
  const [breakdowns, setBreakdowns] = useState<Breakdowns | null>(null);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [activity, setActivity] = useState<ActivityFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<RangeKey>('30d');
  const [compare, setCompare] = useState(true);
  const [tenantId, setTenantId] = useState<string>('');
  const [now, setNow] = useState(new Date());

  // Keeps the "updated N minutes ago" label honest without a full refetch.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const fetchData = useCallback(
    async (r: RangeKey, tid: string, opts?: { silent?: boolean }) => {
      const initial = !overview && !opts?.silent;
      if (initial) setLoading(true);
      else setIsFetching(true);
      setError(null);
      try {
        const qs = new URLSearchParams({ range: r });
        if (compare) qs.set('compare', 'prev');
        if (tid) qs.set('tenantId', tid);
        const q = qs.toString();
        const get = (path: string) =>
          fetch(`/api/proxy/admin/analytics/${path}?${q}`, { credentials: 'include' });

        const [overviewRes, trendsRes, breakdownsRes, insightsRes, activityRes] = await Promise.all([
          get('overview'),
          get('trends'),
          get('breakdowns'),
          get('insights'),
          get('activity'),
        ]);

        if (!overviewRes.ok) throw new Error(`${overviewRes.status}`);
        if (!trendsRes.ok) throw new Error(`${trendsRes.status}`);

        const [o, tr] = await Promise.all([overviewRes.json(), trendsRes.json()]);
        setOverview(o);
        setTrends(tr);

        setBreakdowns(
          breakdownsRes.ok
            ? await breakdownsRes.json()
            : {
                topCoursesByEnrollment: [],
                topCoursesByCompletion: [],
                topProductsByRevenue: [],
                updatedAt: new Date().toISOString(),
                range: r,
              },
        );
        setInsights(
          insightsRes.ok
            ? await insightsRes.json()
            : {
                range: r,
                updatedAt: new Date().toISOString(),
                zeroEnrollmentCourses: { count: 0, sample: [] },
                draftCourses: { count: 0, sample: [] },
                failedPayments: { count: 0, sample: [] },
                suspendedUsers: 0,
                ordersSilent30d: false,
              },
        );
        setActivity(
          activityRes.ok
            ? await activityRes.json()
            : { items: [], updatedAt: new Date().toISOString(), range: r },
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : tCommon('loadFailed', { default: 'Failed to load' }));
      } finally {
        if (initial) setLoading(false);
        setIsFetching(false);
      }
    },
    [compare, overview, tCommon],
  );

  useEffect(() => {
    void fetchData(range, tenantId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, tenantId, compare]);

  const lastUpdated = useMemo(() => {
    if (!overview?.updatedAt) return null;
    const d = new Date(overview.updatedAt);
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diff < 60) return tCommon('justNow', { default: 'Just now' });
    if (diff < 3600) return tCommon('minutesAgo', { n: Math.floor(diff / 60), default: '{n}m ago' });
    return d.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
  }, [overview?.updatedAt, now, locale, tCommon]);

  const money = useCallback(
    (cents: number) => formatMinorUnits(cents, DEFAULT_CURRENCY as CurrencyCode, locale),
    [locale],
  );

  const hasRevenue = !!overview && overview.revenue.cents > 0;

  const kpis = useMemo(() => {
    if (!overview) return [];
    return [
      {
        key: 'totalUsers',
        label: t('totalUsers', { default: 'Total users' }),
        value: overview.users.value.toLocaleString(locale),
        delta: overview.users.delta,
        sparkline: overview.users.sparkline,
        icon: Users,
        sub: t('descAllTime', { default: 'All time' }),
        tone: 'blue' as Tone,
      },
      {
        key: 'activeUsers',
        label: t('activeUsers', { default: 'Active users' }),
        value: overview.activeUsers.value.toLocaleString(locale),
        delta: overview.activeUsers.delta,
        sparkline: overview.activeUsers.sparkline,
        icon: GraduationCap,
        sub: t('descCompletedLesson', { default: 'Completed a lesson' }),
        tone: 'purple' as Tone,
      },
      {
        key: 'signups',
        label: t('kpiSignups', { default: 'Signups' }),
        value: overview.signups.value.toLocaleString(locale),
        delta: overview.signups.delta,
        sparkline: overview.signups.sparkline,
        icon: UserPlus,
        sub: t('descNewAccounts', { default: 'New accounts' }),
        tone: 'cyan' as Tone,
      },
      {
        key: 'enrollments',
        label: t('enrollments', { default: 'Enrollments' }),
        value: overview.enrollments.value.toLocaleString(locale),
        delta: overview.enrollments.delta,
        sparkline: overview.enrollments.sparkline,
        icon: Award,
        sub: t('descStarted', { default: 'Started' }),
        tone: 'emerald' as Tone,
      },
      {
        key: 'revenue',
        label: t('revenue', { default: 'Revenue' }),
        value: hasRevenue ? money(overview.revenue.cents) : '—',
        delta: overview.revenue.delta,
        sparkline: overview.revenue.sparkline,
        icon: DollarSign,
        sub: hasRevenue
          ? t('descConfirmedOrders', { default: 'Confirmed orders' })
          : t('noConfirmedOrdersInRange', { default: 'No confirmed orders in range' }),
        tone: 'amber' as Tone,
      },
      {
        key: 'conversion',
        label: t('completionRate', { default: 'Completion rate' }),
        value: `${overview.conversion.value.toFixed(1)}%`,
        delta: overview.conversion.delta,
        sparkline: overview.conversion.sparkline,
        icon: Percent,
        sub: t('descCompletedEnrolled', { default: 'Completed / enrolled' }),
        tone: 'rose' as Tone,
      },
    ];
  }, [overview, hasRevenue, money, locale, t]);

  const handleExport = useCallback(() => {
    if (!overview || !trends) return;
    const tenant = tenantId || 'current';
    const rows: (string | number)[][] = [
      ['Analytics Export', `Generated ${new Date().toISOString()}`],
      ['Metric', 'Current', 'Delta %', 'Range', 'Tenant', 'UpdatedAt'],
      ['Total Users', overview.users.value, overview.users.delta ?? '', overview.range, tenant, overview.updatedAt],
      ['Active Users', overview.activeUsers.value, overview.activeUsers.delta ?? '', overview.range, tenant, overview.updatedAt],
      ['Signups', overview.signups.value, overview.signups.delta ?? '', overview.range, tenant, overview.updatedAt],
      ['Enrollments', overview.enrollments.value, overview.enrollments.delta ?? '', overview.range, tenant, overview.updatedAt],
      ['Revenue minor units', overview.revenue.cents, overview.revenue.delta ?? '', overview.range, tenant, overview.updatedAt],
      ['Completion %', overview.conversion.value, overview.conversion.delta ?? '', overview.range, tenant, overview.updatedAt],
      [],
      ['Trends - Signups', 'date', 'count'],
      ...trends.signups.map((p) => ['signups', p.date, p.count ?? 0] as (string | number)[]),
      ['Trends - Enrollments', 'date', 'count'],
      ...trends.enrollments.map((p) => ['enrollments', p.date, p.count ?? 0] as (string | number)[]),
      ['Trends - ActiveUsers', 'date', 'count'],
      ...trends.activeUsers.map((p) => ['activeUsers', p.date, p.count ?? 0] as (string | number)[]),
      ['Trends - Revenue', 'date', 'minor units'],
      ...trends.revenue.map((p) => ['revenue', p.date, p.cents] as (string | number)[]),
    ];
    if (breakdowns) {
      rows.push(
        [],
        ['Breakdown - Top Courses by Enrollment', 'title', 'enrollments'],
        ...breakdowns.topCoursesByEnrollment.map((c) => [c.title, c.enrollments] as (string | number)[]),
        [],
        ['Breakdown - Top Courses by Completion', 'title', 'rate %', 'completed/total'],
        ...breakdowns.topCoursesByCompletion.map(
          (c) => [c.title, c.rate, `${c.completed}/${c.total}`] as (string | number)[],
        ),
        [],
        ['Breakdown - Top Products by Revenue', 'title', 'minor units', 'units'],
        ...breakdowns.topProductsByRevenue.map(
          (p) => [p.title, p.revenueCents, p.units] as (string | number)[],
        ),
      );
    }
    if (insights) {
      rows.push(
        [],
        ['Insights'],
        ['Zero-enrollment courses', insights.zeroEnrollmentCourses.count],
        ['Draft courses', insights.draftCourses.count],
        ['Failed payments', insights.failedPayments.count],
        ['Suspended users', insights.suspendedUsers],
        ['Orders silent 30d', insights.ordersSilent30d ? 'true' : 'false'],
      );
    }
    if (activity) {
      rows.push([], ['Activity', 'type', 'title', 'at'], ...activity.items.map((a) => [a.type, a.title, a.at] as (string | number)[]));
    }
    downloadCsv(`analytics-${range}-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }, [overview, trends, breakdowns, insights, activity, tenantId, range]);

  /* ------------------------------- loading ------------------------------- */
  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1500px] space-y-6 pt-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[132px] rounded-xl" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonPanel key={i} />
          ))}
        </div>
      </div>
    );
  }

  /* ------------------------------- render ------------------------------- */
  const compareSuffix = compare
    ? t('vsPrev', { default: 'vs prev' })
    : t('noCompare', { default: 'no compare' });

  const alertCount = insights
    ? [
        insights.zeroEnrollmentCourses.count,
        insights.draftCourses.count,
        insights.failedPayments.count,
        insights.suspendedUsers,
      ].filter(Boolean).length
    : 0;

  const topEnrollments = breakdowns?.topCoursesByEnrollment ?? [];
  const topEnrollMax = Math.max(1, topEnrollments[0]?.enrollments ?? 1);

  return (
    <div className="w-full">
      <AdminCommandBar
        trail={[{ label: 'Baroot CNC Solutions' }, { label: title }]}
        live={
          lastUpdated
            ? t('updatedAt', { time: lastUpdated, default: 'Updated {time}' })
            : t('live', { default: 'Live' })
        }
        actions={
          <>
            <BarButton
              icon={<Download className="size-4" />}
              disabled={!overview || isFetching}
              onClick={handleExport}
            >
              {t('exportCsv', { default: 'Export CSV' })}
            </BarButton>
            <BarIconButton
              title={t('refreshAria', { default: 'Refresh analytics' })}
              spinning={isFetching}
              onClick={() => fetchData(range, tenantId, { silent: true })}
            >
              <RefreshCw className="size-4" />
            </BarIconButton>
          </>
        }
      />

      <div className="mx-auto w-full max-w-[1500px] space-y-6 pt-6">
        <AdminPageHeader
          title={title}
          description={t('pageDescription', {
            default: 'Growth, revenue and learning health across your academy.',
          })}
          badge={
            <span className="inline-flex items-center gap-2 self-start rounded-full border border-success/30 bg-success/10 px-3 py-1.5 text-xs font-semibold text-success md:self-auto">
              <ShieldCheck className="size-4" />
              {isFetching
                ? t('updating', { default: 'Updating…' })
                : t('tenantIsolatedBadge', { default: 'Tenant-isolated · Admin only' })}
            </span>
          }
        />

        {/* Range + compare controls */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2 shadow-xs">
          <PillTabs
            value={range}
            onChange={(k) => setRange(k)}
            options={RANGES.map((k) => ({ key: k, label: t(RANGE_LABEL_KEY[k]) }))}
          />
          <button
            type="button"
            onClick={() => setCompare((c) => !c)}
            aria-pressed={compare}
            className={cn(
              'inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition',
              compare
                ? 'border-primary/30 bg-primary/10 text-primary'
                : 'border-border bg-background text-muted-foreground hover:text-foreground',
            )}
          >
            <span
              className={cn(
                'flex size-3.5 items-center justify-center rounded-[4px] border transition',
                compare ? 'border-primary bg-primary' : 'border-border-strong',
              )}
              aria-hidden="true"
            >
              {compare && (
                <svg viewBox="0 0 10 10" className="size-2.5 text-primary-foreground" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1.5 5l2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
            {t('compareToPrevious', { default: 'Compare to previous' })}
          </button>
          {isSuperAdmin && (
            <div className="flex items-center gap-1.5">
              <Building2 className="ms-1 size-3.5 shrink-0 text-muted-foreground" />
              <Select value={tenantId} onChange={setTenantId} label={t('tenantFilter', { default: 'Filter by tenant' })}>
                <option value="">{t('allTenants', { default: 'All tenants' })}</option>
              </Select>
              <input
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value.trim())}
                placeholder={t('tenantIdPlaceholder', { default: 'tenantId' })}
                aria-label={t('tenantIdPlaceholder', { default: 'tenantId' })}
                className="h-9 w-36 rounded-xl border border-border bg-background px-2.5 text-xs outline-none transition placeholder:text-muted-foreground/60 focus:border-primary/60 focus:ring-4 focus:ring-primary/10"
              />
            </div>
          )}
          <span className="ms-auto hidden text-xs text-muted-foreground sm:inline">
            {t('rangeSummary', {
              range,
              compare: compare ? t('vsPrev', { default: 'vs prev' }) : t('noCompare', { default: 'no compare' }),
              default: 'Range {range} {compare} · Cached 5m',
            })}
          </span>
        </div>

        {error && <ErrorBanner message={error} onRetry={() => fetchData(range, tenantId)} retryLabel={tCommon('retry', { default: 'Retry' })} />}

        <div className={cn('space-y-6 transition-opacity', isFetching && 'pointer-events-none opacity-60')}>
          {/* KPI grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {kpis.map((k) => (
              <AdminKpiCard
                key={k.key}
                icon={k.icon}
                label={k.label}
                value={k.value}
                meta={<DeltaBadge delta={k.delta} />}
                sub={k.sub}
                tone={k.tone}
                sparkline={k.sparkline}
                trendUp={k.delta === null ? null : k.delta >= 0}
              />
            ))}
          </div>

          {/* Trends */}
          <div className="grid gap-6 lg:grid-cols-2">
            <TrendChart
              title={t('signupsOverTime', { default: 'Signups Over Time' })}
              description={t('signupsOverTimeDesc', {
                range,
                compare: compare ? t('vsPrev', { default: 'vs prev' }) : '',
                default: 'New accounts per bucket · {range} {compare}',
              })}
              icon={UserPlus}
              data={trends?.signups ?? []}
              color="primary"
              unitLabel={t('signups', { default: 'Signups' })}
              emptyMessage={t('noSignupsInPeriod', { default: 'No signups in this period' })}
              compareSuffix={compareSuffix}
              loading={isFetching}
            />
            <TrendChart
              title={t('enrollmentsOverTime', { default: 'Enrollments Over Time' })}
              description={t('enrollmentsOverTimeDesc', { default: 'Started enrollments per bucket' })}
              icon={GraduationCap}
              data={trends?.enrollments ?? []}
              color="accent"
              unitLabel={t('enrollments', { default: 'Enrollments' })}
              emptyMessage={t('noEnrollmentsInPeriod', { default: 'No enrollments in this period' })}
              compareSuffix={compareSuffix}
              loading={isFetching}
            />
            <TrendChart
              title={t('activeUsersOverTime', { default: 'Active Users Over Time' })}
              description={t('activeUsersOverTimeDesc', { default: 'Distinct users completing lessons per bucket' })}
              icon={Users}
              data={trends?.activeUsers ?? []}
              color="success"
              unitLabel={t('activeShort', { default: 'Active' })}
              emptyMessage={t('noActiveUsersInPeriod', { default: 'No active users in this period' })}
              compareSuffix={compareSuffix}
              loading={isFetching}
            />
            <TrendChart
              title={t('revenueOverTime', { default: 'Revenue Over Time' })}
              description={t('revenueOverTimeDesc', { default: 'Confirmed orders only' })}
              icon={DollarSign}
              data={trends?.revenue ?? []}
              valueKey="cents"
              color="warning"
              formatValue={money}
              unitLabel={t('revenue', { default: 'Revenue' })}
              emptyMessage={t('noRevenueInPeriod', { default: 'No revenue in this period' })}
              compareSuffix={compareSuffix}
              loading={isFetching}
            />
          </div>

          {/* Top lists */}
          <div className="grid gap-6 lg:grid-cols-2">
            <PanelCard
              title={
                <span className="flex items-center gap-2">
                  <Trophy className="size-4 text-primary" />
                  {t('topByEnrollments', { default: 'Top Courses by Enrollment' })}
                </span>
              }
              action={<StatusPill label={String(topEnrollments.length)} tone="slate" dot={false} />}
              bodyClassName="p-3"
            >
              {isFetching ? (
                <SkeletonRows rows={5} columns={2} />
              ) : topEnrollments.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  {t('noEnrollmentsInPeriod', { default: 'No enrollments in this period' })}
                </p>
              ) : (
                <ul className="space-y-1">
                  {topEnrollments.map((course, i) => (
                    <RankedListItem
                      key={course.id}
                      rank={i + 1}
                      title={course.title || t('untitledCourse', { default: 'Untitled course' })}
                      value={course.enrollments.toLocaleString(locale)}
                      sub={t('enrollmentsLower', { default: 'enrollments' })}
                      progress={(course.enrollments / topEnrollMax) * 100}
                      href={course.slug ? `/admin/courses/${course.slug}/edit` : '/admin/courses'}
                    />
                  ))}
                </ul>
              )}
            </PanelCard>

            <PanelCard
              title={
                <span className="flex items-center gap-2">
                  <Percent className="size-4 text-primary" />
                  {t('topByCompletion', { default: 'Top Courses by Completion' })}
                </span>
              }
              action={
                <StatusPill
                  label={String(breakdowns?.topCoursesByCompletion.length ?? 0)}
                  tone="slate"
                  dot={false}
                />
              }
              bodyClassName="p-3"
            >
              {isFetching ? (
                <SkeletonRows rows={5} columns={2} />
              ) : (breakdowns?.topCoursesByCompletion.length ?? 0) === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <Award className="size-7 text-muted-foreground/40" />
                  <p className="text-sm font-medium text-muted-foreground">
                    {t('noCompletionsYet', { default: 'No completions yet' })}
                  </p>
                  <p className="max-w-[28ch] text-xs text-muted-foreground">
                    {t('completionRatesHint', { default: 'Completion rates appear once courses have enrollments.' })}
                  </p>
                </div>
              ) : (
                <ul className="space-y-1">
                  {breakdowns!.topCoursesByCompletion.map((course, i) => (
                    <RankedListItem
                      key={course.id}
                      rank={i + 1}
                      title={course.title || t('untitledCourse', { default: 'Untitled course' })}
                      value={`${course.rate.toFixed(1)}%`}
                      sub={t('completedOf', {
                        completed: course.completed,
                        total: course.total,
                        default: '{completed}/{total} completed',
                      })}
                      progress={course.rate}
                      progressTone="success"
                      href={course.slug ? `/admin/courses/${course.slug}/edit` : '/admin/courses'}
                    />
                  ))}
                </ul>
              )}
            </PanelCard>

            <PanelCard
              title={
                <span className="flex items-center gap-2">
                  <Package className="size-4 text-primary" />
                  {t('topProductsByRevenue', { default: 'Top Products by Revenue' })}
                </span>
              }
              action={
                <StatusPill
                  label={String(breakdowns?.topProductsByRevenue.length ?? 0)}
                  tone="slate"
                  dot={false}
                />
              }
              bodyClassName="p-3"
            >
              {isFetching ? (
                <SkeletonRows rows={5} columns={2} />
              ) : (breakdowns?.topProductsByRevenue.length ?? 0) === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <Package className="size-7 text-muted-foreground/40" />
                  <p className="text-sm font-medium text-muted-foreground">
                    {t('noRevenueInPeriod', { default: 'No revenue in this period' })}
                  </p>
                  <p className="max-w-[28ch] text-xs text-muted-foreground">
                    {t('confirmedOrdersHint', { default: 'Confirmed orders will appear here.' })}
                  </p>
                </div>
              ) : (
                <ul className="space-y-1">
                  {breakdowns!.topProductsByRevenue.map((product, i) => {
                    const max = Math.max(1, breakdowns!.topProductsByRevenue[0]?.revenueCents ?? 1);
                    return (
                      <RankedListItem
                        key={product.id}
                        rank={i + 1}
                        title={product.title || t('untitledProduct', { default: 'Untitled product' })}
                        value={money(product.revenueCents)}
                        sub={t('unitsSold', { count: product.units, default: '{count, plural, one {# unit} other {# units}}' })}
                        progress={(product.revenueCents / max) * 100}
                        progressTone="accent"
                        href={product.slug ? `/products/${product.slug}` : '#'}
                        thumbnail={
                          product.thumbnailUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={getImageSrc(product.thumbnailUrl, 'product')}
                              alt=""
                              className="size-9 shrink-0 rounded-lg object-cover"
                            />
                          ) : undefined
                        }
                      />
                    );
                  })}
                </ul>
              )}
            </PanelCard>

            {/* Actionable insights */}
            <PanelCard
              title={
                <span className="flex items-center gap-2">
                  <AlertCircle className="size-4 text-warning" />
                  {t('actionableInsights', { default: 'Actionable Insights' })}
                </span>
              }
              action={
                <StatusPill
                  label={t('alertCount', { count: alertCount, default: '{count} alerts' })}
                  tone={alertCount > 0 ? 'amber' : 'emerald'}
                  dot={false}
                />
              }
              bodyClassName="p-4"
            >
              {isFetching ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-28 rounded-xl" />
                  ))}
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <InsightCard
                    icon={Trophy}
                    title={t('zeroEnrollmentCourses', { default: 'Zero-enrollment courses' })}
                    count={insights?.zeroEnrollmentCourses.count ?? 0}
                    description={t('zeroEnrollmentCoursesDesc', { default: 'Published courses with no enrollments' })}
                    active={(insights?.zeroEnrollmentCourses.count ?? 0) > 0}
                    tone="amber"
                    samples={insights?.zeroEnrollmentCourses.sample.map((c) => c.title) ?? []}
                    actionLabel={t('viewCourses', { default: 'View courses' })}
                    href="/admin/courses?enrollments=0"
                  />
                  <InsightCard
                    icon={FileEdit}
                    title={t('draftsAwaitingPublish', { default: 'Drafts awaiting publish' })}
                    count={insights?.draftCourses.count ?? 0}
                    description={t('unpublishedCoursesDesc', { default: 'Unpublished courses in this tenant' })}
                    active={(insights?.draftCourses.count ?? 0) > 0}
                    tone="blue"
                    samples={insights?.draftCourses.sample.map((c) => c.title) ?? []}
                    actionLabel={t('reviewDrafts', { default: 'Review drafts' })}
                    href="/admin/courses?status=draft"
                  />
                  <InsightCard
                    icon={ActivityIcon}
                    title={t('failedPayments', { default: 'Failed payments' })}
                    count={insights?.failedPayments.count ?? 0}
                    description={`${t('inSelectedRange', { default: 'In selected range' })} · ${
                      (insights?.failedPayments.count ?? 0) > 0
                        ? t('needsAttention', { default: 'Needs attention' })
                        : t('noFailures', { default: 'No failures' })
                    }`}
                    active={(insights?.failedPayments.count ?? 0) > 0}
                    tone="rose"
                    samples={insights?.failedPayments.sample.map((o) => `${o.status} · ${money(o.total)}`) ?? []}
                    actionLabel={t('viewOrders', { default: 'View orders' })}
                    href="/admin/finance"
                  />
                  <div
                    className={cn(
                      'flex flex-col gap-2 rounded-xl border p-4',
                      (insights?.suspendedUsers ?? 0) > 0 || insights?.ordersSilent30d
                        ? 'border-warning/30 bg-warning/8'
                        : 'border-border bg-card',
                    )}
                  >
                    <span className={cn('flex size-8 items-center justify-center rounded-lg', TONE_ICON.amber)}>
                      <UserX className="size-4" />
                    </span>
                    <p className="text-sm font-semibold text-foreground">
                      {t('operationalAlerts', { default: 'Operational alerts' })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(insights?.suspendedUsers ?? 0) > 0
                        ? t('suspendedAccounts', {
                            count: insights!.suspendedUsers,
                            default: '{count} suspended accounts',
                          })
                        : t('noSuspendedAccounts', { default: 'No suspended accounts' })}
                      {insights?.ordersSilent30d ? ` · ${t('noOrdersIn30d', { default: 'No confirmed orders in 30d' })}` : ''}
                    </p>
                    <Link
                      href="/admin/users?suspended=true"
                      className="mt-auto inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                    >
                      {t('reviewUsers', { default: 'Review users' })}
                    </Link>
                  </div>
                </div>
              )}
            </PanelCard>
          </div>

          {/* Activity feed */}
          <PanelCard
            title={
              <span className="flex items-center gap-2">
                <Clock className="size-4 text-primary" />
                {t('recentActivity', { default: 'Recent Activity' })}
              </span>
            }
            action={
              <span className="text-xs text-muted-foreground">
                {activity
                  ? t('eventsCount', {
                      count: activity.items.length,
                      default: '{count, plural, one {# event} other {# events}}',
                    })
                  : ''}
                {` · ${range}`}
              </span>
            }
          >
            {isFetching ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 rounded-xl" />
                ))}
              </div>
            ) : (activity?.items.length ?? 0) === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <Clock className="size-7 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">
                  {t('noActivityInPeriod', { default: 'No activity in this period' })}
                </p>
                <p className="max-w-[36ch] text-xs text-muted-foreground">
                  {t('activityEmptyHint', { default: 'Signups, enrollments, and payments will appear here.' })}
                </p>
              </div>
            ) : (
              <ul className="relative space-y-1 before:absolute before:bottom-2 before:start-[7px] before:top-2 before:w-px before:bg-border">
                {activity!.items.map((item) => {
                  const tone: Tone =
                    item.type === 'signup'
                      ? 'blue'
                      : item.type === 'enrollment'
                        ? 'emerald'
                        : item.type === 'payment_failed'
                          ? 'rose'
                          : 'amber';
                  return (
                    <li key={item.id} className="relative flex items-center gap-3 py-2.5 ps-6">
                      <span
                        className={cn(
                          'absolute start-0 top-1/2 size-3.5 -translate-y-1/2 rounded-full border-2 border-card',
                          tone === 'blue'
                            ? 'bg-primary'
                            : tone === 'emerald'
                              ? 'bg-success'
                              : tone === 'rose'
                                ? 'bg-destructive'
                                : 'bg-warning',
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <Link href={item.href} className="group flex items-center gap-1 truncate text-sm text-foreground hover:underline">
                          <span className="truncate font-medium">{item.title}</span>
                        </Link>
                        <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {(() => {
                          const d = new Date(item.at);
                          const diff = Math.floor((Date.now() - d.getTime()) / 60000);
                          if (diff < 1) return tCommon('justNow', { default: 'Just now' });
                          if (diff < 60) return tCommon('minutesAgo', { n: diff, default: '{n}m ago' });
                          const h = Math.floor(diff / 60);
                          if (h < 24) return tCommon('hoursAgo', { n: h, default: '{n}h ago' });
                          return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
                        })()}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </PanelCard>

          {/* Footer meta */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Clock className="size-3.5" />
              {t('lastUpdated', { time: lastUpdated ?? '—', default: 'Last updated {time}' })} ·{' '}
              {t('tenantIsolatedShort', { default: 'Tenant isolated' })} ·{' '}
              {t('adminOnlyShort', { default: 'Admin only' })}
            </span>
            <span className="hidden sm:inline">
              {t('footerRangeSummary', {
                range,
                compare: compare
                  ? t('comparingToPrevious', { default: 'Comparing to previous period' })
                  : t('noCompare', { default: 'No compare' }),
                default: 'Range {range} · {compare} · Cached 5m',
              })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** A single actionable-insight tile. */
function InsightCard({
  icon: Icon,
  title,
  count,
  description,
  active,
  tone,
  samples,
  actionLabel,
  href,
}: {
  icon: LucideIcon;
  title: string;
  count: number;
  description: string;
  active: boolean;
  tone: Tone;
  samples: string[];
  actionLabel: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group flex flex-col gap-2 rounded-xl border p-4 transition hover:shadow-sm',
        active ? cn('border-transparent', TONE_ICON[tone], 'bg-card') : 'border-border bg-card',
        active && tone === 'amber' && 'border-warning/30 bg-warning/8',
        active && tone === 'rose' && 'border-destructive/30 bg-destructive/8',
        active && tone === 'blue' && 'border-primary/30 bg-primary/8',
      )}
    >
      <span className={cn('flex size-8 items-center justify-center rounded-lg', TONE_ICON[tone])}>
        <Icon className="size-4" />
      </span>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="text-2xl font-bold tabular-nums text-foreground">{count}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
      {samples.length > 0 && (
        <ul className="mt-1 space-y-1">
          {samples.slice(0, 3).map((s, i) => (
            <li key={i} className="truncate text-xs text-muted-foreground">
              · {s}
            </li>
          ))}
        </ul>
      )}
      <span className="mt-auto inline-flex items-center gap-1 pt-2 text-xs font-semibold text-primary">
        {actionLabel}
      </span>
    </Link>
  );
}
