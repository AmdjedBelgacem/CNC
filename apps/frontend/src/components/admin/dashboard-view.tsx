'use client';

/**
 * Admin overview.
 *
 * Redesigned around one question: *what needs a decision, and what changed?*
 *
 * The previous layout was four loose KPI cards, then an "attention" panel that
 * could never populate (it read five fields the `pulse` endpoint does not return),
 * then a donut built from those same missing fields, so it rendered "1 course"
 * forever. Momentum bars were drawn from a single KPI compared against itself,
 * which is not a trend. Currency was formatted as USD on a SAR merchant, and
 * every label was a hardcoded English string on a platform that is now bilingual.
 *
 * What replaced it:
 *  - a composed hero band where the four KPIs are one reading, each with the
 *    sparkline the API already computes and nobody was using;
 *  - an attention rail fed by the real `insights` endpoint, naming the affected
 *    items rather than a bare count;
 *  - daily series drawn from the real `enrollments` / `revenue` endpoints;
 *  - catalogue health as a proportion bar over counts that actually exist;
 *  - SAR, the active locale, and no clock reads during render.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  Award,
  BarChart3,
  BookOpen,
  CircleDollarSign,
  ExternalLink,
  FileEdit,
  LayoutTemplate,
  Palette,
  RefreshCw,
  Settings,
  TrendingDown,
  UserPlus,
  Users,
  UserX,
  type LucideIcon,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { AnimatePresence, m } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ease, spring } from '@/lib/motion';
import { AnimatedNumber, Reveal, Stagger, StaggerItem } from '@/components/ui/motion';
import { useAuthStore } from '@/stores/auth-store';
import { AdminCommandBar, BarIconButton, BarPrimaryButton } from './admin-chrome';
import {
  DeltaBadge,
  Panel,
  PLATFORM_CURRENCY,
  SegmentedBar,
  SeriesBars,
  Skeleton,
  Sparkline,
  relativeFrom,
  useFormats,
  useMountedNow,
} from './dashboard-parts';
import { DashboardKpiStripSkeleton } from '@/components/skeletons/admin-route-skeletons';
import { PanelListSkeleton } from '@/components/ui/skeletons';

/* -------------------------------------------------------------------------- */
/* Data                                                                       */
/* -------------------------------------------------------------------------- */

interface Metric {
  value: number;
  delta: number | null;
  sparkline?: number[];
}

interface Overview {
  range?: string;
  updatedAt?: string;
  users?: Metric;
  activeUsers?: Metric;
  visitors?: Metric;
  enrollments?: Metric;
  revenue?: { cents: number; delta: number | null; sparkline?: number[] };
  coursesPublished?: number;
  upcomingEvents?: number;
  signups?: Metric;
  conversion?: Metric;
}

interface Insights {
  range?: string;
  updatedAt?: string;
  zeroEnrollmentCourses?: { count: number; sample: Array<{ id: string; title: string; slug: string }> };
  draftCourses?: { count: number; sample: Array<{ id: string; title: string; slug: string }> };
  failedPayments?: { count: number; sample?: unknown[] };
  suspendedUsers?: number;
  ordersSilent30d?: boolean;
}

interface StatsRow {
  users?: number;
  courses?: number;
  posts?: number;
  events?: number;
  orders?: number;
  revenue?: string;
  recentUsers?: Array<{ id: string; name: string | null; email: string; createdAt: string }>;
}

interface SeriesPoint {
  date: string;
  count?: number;
  cents?: number;
}

interface TopCourse {
  id: string;
  title: string;
  slug?: string;
  enrollments: number;
}

const RANGES = [
  { key: '7d', days: 7 },
  { key: '30d', days: 30 },
  { key: '90d', days: 90 },
  { key: '12m', days: 365 },
] as const;

type RangeKey = (typeof RANGES)[number]['key'];

/** Only the endpoints that exist; anything else would render a permanent error. */
const getJson = async (url: string) => {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) throw new Error(`${url} → ${response.status}`);
  return response.json() as Promise<unknown>;
};

/* -------------------------------------------------------------------------- */
/* Small local pieces                                                         */
/* -------------------------------------------------------------------------- */

function initials(name: string | null, email: string) {
  const source = name?.trim() || email;
  return (
    source
      .split(/[\s@._]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join('') || '?'
  );
}

function RangePicker({
  value,
  onChange,
  label,
  labels,
}: {
  value: RangeKey;
  onChange: (next: RangeKey) => void;
  label: string;
  labels: Record<RangeKey, string>;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex h-10 items-center gap-0.5 rounded-lg border border-border/70 bg-muted/60 p-0.5 sm:h-9"
    >
      {RANGES.map((range) => (
        <button
          key={range.key}
          type="button"
          onClick={() => onChange(range.key)}
          aria-pressed={value === range.key}
          className={cn(
            'relative h-full rounded-md px-2.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]',
            value === range.key
              ? 'text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {value === range.key && (
            <m.span
              layoutId="dashboard-range"
              aria-hidden="true"
              className="absolute inset-0 rounded-md bg-card shadow-xs ring-1 ring-border/60"
              transition={spring.smooth}
            />
          )}
          <span className="relative">{labels[range.key]}</span>
        </button>
      ))}
    </div>
  );
}

function KpiCell({
  icon: Icon,
  label,
  sub,
  value,
  amount,
  formatAmount,
  delta,
  sparkline,
  tone,
  href,
  deltaLabels,
  sparkLabel,
  noData,
}: {
  icon: LucideIcon;
  label: string;
  sub: string;
  value: string;
  /** Raw number behind `value`, so it can count up; `value` stays the SSR text. */
  amount?: number;
  formatAmount?: (n: number) => string;
  delta: number | null;
  sparkline?: number[];
  tone: 'primary' | 'success' | 'warning';
  href: string;
  deltaLabels: { up: string; down: string; flat: string };
  sparkLabel: string;
  noData: string;
}) {
  const ring = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
  }[tone];

  return (
    <Link
      href={href}
      className="group relative flex h-full min-w-0 flex-col gap-3 bg-card px-4 py-5 outline-none transition-colors duration-200 hover:bg-surface-raised focus-visible:bg-muted/40 sm:px-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 flex flex-wrap items-baseline gap-2">
            <span className="font-display text-[28px] font-medium leading-none tracking-[-0.022em] text-foreground">
              {typeof amount === 'number' && formatAmount ? (
                <AnimatedNumber value={amount} format={formatAmount} animateOnChange />
              ) : (
                <span className="tabular-nums">{value}</span>
              )}
            </span>
            <DeltaBadge delta={delta} labels={deltaLabels} />
          </p>
          <p className="mt-1.5 truncate text-xs text-muted-foreground">{sub}</p>
        </div>
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-300 group-hover:-translate-y-0.5',
            ring,
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </div>
      {sparkline && sparkline.length > 1 ? (
        <Sparkline
          points={sparkline}
          tone={tone}
          label={sparkLabel}
          className="-mb-1 opacity-70 transition-opacity duration-200 group-hover:opacity-100"
        />
      ) : (
        <div className="h-7" aria-label={noData} />
      )}
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/* View                                                                       */
/* -------------------------------------------------------------------------- */

export function DashboardView() {
  const t = useTranslations('admin.overview');
  const tAdmin = useTranslations('admin');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currency, count, percent, date } = useFormats();
  const now = useMountedNow();

  const user = useAuthStore((state) => state.user);
  const role = user?.role ?? '';
  const tenantSlug =
    user?.tenantRoles?.find((entry) => entry.tenantId === user.tenantId)?.tenantSlug ?? '';
  const isManager = role === 'super_admin' || role === 'admin';

  const initialRange = (searchParams.get('range') as RangeKey | null) ?? '30d';
  const [range, setRange] = useState<RangeKey>(
    RANGES.some((entry) => entry.key === initialRange) ? initialRange : '30d',
  );
  const [overview, setOverview] = useState<Overview | null>(null);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [stats, setStats] = useState<StatsRow | null>(null);
  const [enrollSeries, setEnrollSeries] = useState<SeriesPoint[] | null>(null);
  const [revenueSeries, setRevenueSeries] = useState<SeriesPoint[] | null>(null);
  const [topCourses, setTopCourses] = useState<TopCourse[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState<string[]>([]);

  const load = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setFailed([]);
      const problems: string[] = [];

      // Each panel settles independently: one failing endpoint must not blank the
      // whole overview, it just marks that panel incomplete.
      const settle = async <T,>(
        key: string,
        url: string,
        apply: (value: T) => void,
        fallback: T,
      ) => {
        try {
          apply((await getJson(url)) as T);
        } catch {
          problems.push(key);
          apply(fallback);
        }
      };

      await Promise.all([
        settle<Overview>(
          'overview',
          `/api/proxy/admin/analytics/overview?range=${range}`,
          setOverview,
          {},
        ),
        settle<Insights>(
          'insights',
          `/api/proxy/admin/analytics/insights?range=${range}`,
          setInsights,
          {},
        ),
        settle<StatsRow>('stats', '/api/proxy/admin/stats', setStats, {}),
        settle<SeriesPoint[]>(
          'enrollments',
          `/api/proxy/admin/analytics/enrollments?range=${range}`,
          setEnrollSeries,
          [],
        ),
        settle<SeriesPoint[]>(
          'revenue',
          `/api/proxy/admin/analytics/revenue?range=${range}`,
          setRevenueSeries,
          [],
        ),
        settle<TopCourse[]>(
          'topCourses',
          `/api/proxy/admin/analytics/top-courses?range=${range}`,
          setTopCourses,
          [],
        ),
      ]);

      setFailed(problems);
      setLoading(false);
      setRefreshing(false);
    },
    [range],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const rangeDays = RANGES.find((entry) => entry.key === range)?.days ?? 30;

  const shortcuts = useMemo(
    () =>
      [
        { href: '/admin/courses', key: 'sc_courses', icon: BookOpen, roles: ['super_admin', 'admin', 'instructor'] },
        { href: '/admin/builder', key: 'sc_builder', icon: LayoutTemplate, roles: ['super_admin', 'admin', 'instructor'] },
        { href: '/admin/analytics', key: 'sc_analytics', icon: BarChart3, roles: ['super_admin', 'admin'] },
        { href: '/admin/users', key: 'sc_users', icon: Users, roles: ['super_admin', 'admin'] },
        { href: '/admin/theme', key: 'sc_theme', icon: Palette, roles: ['super_admin', 'admin'] },
        { href: '/admin/certificates', key: 'sc_certificates', icon: Award, roles: ['super_admin', 'admin'] },
        { href: '/admin/settings', key: 'sc_settings', icon: Settings, roles: ['super_admin', 'admin'] },
      ].filter((entry) => entry.roles.includes(role)),
    [role],
  );

  /**
   * The attention rail, built from the `insights` endpoint.
   *
   * Ordered by how much they cost if ignored, and each one names the affected
   * items so it can be acted on without a second trip to a list page.
   */
  const attention = useMemo(() => {
    if (!insights) return [];
    const items: Array<{
      key: string;
      severity: 'high' | 'medium' | 'low';
      icon: LucideIcon;
      count: number;
      text: string;
      href: string;
      samples: string[];
    }> = [];

    const zero = insights.zeroEnrollmentCourses?.count ?? 0;
    if (zero > 0) {
      items.push({
        key: 'zero-enrollment',
        severity: 'high',
        icon: TrendingDown,
        count: zero,
        text: t('itemZeroEnroll', { count: zero }),
        href: '/admin/courses?enrollments=0',
        samples: (insights.zeroEnrollmentCourses?.sample ?? []).map((course) => course.title),
      });
    }

    const drafts = insights.draftCourses?.count ?? 0;
    if (drafts > 0) {
      items.push({
        key: 'drafts',
        severity: 'medium',
        icon: FileEdit,
        count: drafts,
        text: t('itemDrafts', { count: drafts }),
        href: '/admin/courses?status=draft',
        samples: (insights.draftCourses?.sample ?? []).map((course) => course.title),
      });
    }

    const failedPayments = insights.failedPayments?.count ?? 0;
    if (failedPayments > 0) {
      items.push({
        key: 'payments',
        severity: 'high',
        icon: CircleDollarSign,
        count: failedPayments,
        text: t('itemFailedPayments', { count: failedPayments }),
        href: '/admin/finance',
        samples: [],
      });
    }

    const suspended = insights.suspendedUsers ?? 0;
    if (suspended > 0) {
      items.push({
        key: 'suspended',
        severity: 'low',
        icon: UserX,
        count: suspended,
        text: t('itemSuspended', { count: suspended }),
        href: '/admin/users?suspended=true',
        samples: [],
      });
    }

    if (insights.ordersSilent30d) {
      items.push({
        key: 'silent',
        severity: 'medium',
        icon: TrendingDown,
        count: 0,
        text: t('itemSilentOrders'),
        href: '/admin/finance',
        samples: [],
      });
    }

    const rank = { high: 0, medium: 1, low: 2 } as const;
    return items.sort((a, b) => rank[a.severity] - rank[b.severity]);
  }, [insights, t]);

  /**
   * Catalogue health, from counts that exist.
   *
   * `zero` is a subset of published, not a peer of it: a course with no learners
   * is still live. The bar therefore shows published (split into engaged and
   * silent) against drafts.
   */
  const health = useMemo(() => {
    const drafts = insights?.draftCourses?.count ?? 0;
    const zero = insights?.zeroEnrollmentCourses?.count ?? 0;
    const published = overview?.coursesPublished ?? stats?.courses ?? 0;
    const engaged = Math.max(0, published - zero);
    return {
      engaged,
      zero,
      drafts,
      published,
      total: published + drafts,
      share: published + drafts > 0 ? percent((engaged / (published + drafts)) * 100) : null,
    };
  }, [insights, overview, stats, percent]);

  const enrolledSeries = useMemo(
    () =>
      (enrollSeries ?? []).map((point) => ({
        label: date(point.date),
        value: Number(point.count ?? 0),
      })),
    [enrollSeries, date],
  );
  const revenuePoints = useMemo(
    () => (revenueSeries ?? []).map((point) => ({ cents: Number(point.cents ?? 0) })),
    [revenueSeries],
  );
  const revenueDaily = useMemo(
    () =>
      revenuePoints.map((point, index) => ({
        label: date(revenueSeries?.[index]?.date ?? new Date().toISOString()),
        value: point.cents,
      })),
    [revenuePoints, revenueSeries, date],
  );
  const hasSeries = enrolledSeries.some((point) => point.value > 0) || revenueDaily.some((p) => p.value > 0);

  const firstName = user?.name?.trim().split(' ')[0] ?? '';
  const todayLabel = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()),
    [locale],
  );

  const kpis = [
    {
      icon: Users,
      label: t('kpiUsers'),
      sub: t('kpiUsersSub'),
      value: count(overview?.users?.value ?? 0),
      amount: overview?.users?.value ?? 0,
      formatAmount: (n: number) => count(Math.round(n)),
      delta: overview?.users?.delta ?? null,
      sparkline: overview?.users?.sparkline,
      tone: 'primary' as const,
      href: '/admin/users',
      sparkLabel: t('kpiUsers'),
    },
    {
      icon: BookOpen,
      label: t('kpiActive'),
      sub: t('kpiActiveSub'),
      value: count(overview?.activeUsers?.value ?? 0),
      amount: overview?.activeUsers?.value ?? 0,
      formatAmount: (n: number) => count(Math.round(n)),
      delta: overview?.activeUsers?.delta ?? null,
      sparkline: overview?.activeUsers?.sparkline,
      tone: 'success' as const,
      href: '/admin/analytics',
      sparkLabel: t('kpiActive'),
    },
    {
      icon: Users,
      label: t('kpiVisitors'),
      sub: t('kpiVisitorsSub'),
      value: count(overview?.visitors?.value ?? 0),
      amount: overview?.visitors?.value ?? 0,
      formatAmount: (n: number) => count(Math.round(n)),
      delta: overview?.visitors?.delta ?? null,
      sparkline: overview?.visitors?.sparkline,
      tone: 'primary' as const,
      href: '/admin/analytics',
      sparkLabel: t('kpiVisitors'),
    },
    {
      icon: UserPlus,
      label: t('kpiEnrollments'),
      sub: t('kpiEnrollmentsSub'),
      value: count(overview?.enrollments?.value ?? 0),
      amount: overview?.enrollments?.value ?? 0,
      formatAmount: (n: number) => count(Math.round(n)),
      delta: overview?.enrollments?.delta ?? null,
      sparkline: overview?.enrollments?.sparkline,
      tone: 'primary' as const,
      href: '/admin/analytics',
      sparkLabel: t('kpiEnrollments'),
    },
    {
      icon: CircleDollarSign,
      label: t('kpiRevenue'),
      sub: t('kpiRevenueSub'),
      value: currency(overview?.revenue?.cents ?? 0),
      amount: overview?.revenue?.cents ?? 0,
      formatAmount: (n: number) => currency(Math.round(n)),
      delta: overview?.revenue?.delta ?? null,
      sparkline: overview?.revenue?.sparkline,
      tone: 'warning' as const,
      href: '/admin/finance',
      sparkLabel: t('kpiRevenue'),
    },
  ];

  const relativeLabels = useMemo(
    () => ({
      justNow: t('justNow'),
      minutes: (n: number) => t('minutesAgoShort', { n }),
      hours: (n: number) => t('hoursAgoShort', { n }),
      days: (n: number) => t('daysAgoShort', { n }),
    }),
    [t, count],
  );

  return (
    <div className="w-full">
      <AdminCommandBar
        trail={[{ label: 'Baroot CNC Solutions' }, { label: tAdmin('dashboard') }]}
        live={t('live')}
        actions={
          <>
            <RangePicker
              value={range}
              onChange={setRange}
              label={t('range')}
              labels={{
                '7d': t('range7d'),
                '30d': t('range30d'),
                '90d': t('range90d'),
                '12m': t('range12m'),
              }}
            />
            <BarIconButton
              title={t('refresh')}
              ariaLabel={t('refresh')}
              spinning={refreshing}
              onClick={() => void load(true)}
            >
              <RefreshCw className="size-4" />
            </BarIconButton>
          </>
        }
        primary={
          isManager ? (
            <BarPrimaryButton
              icon={<FileEdit className="size-4" strokeWidth={2.25} />}
              onClick={() => router.push('/admin/courses/new')}
            >
              {t('newCourse')}
            </BarPrimaryButton>
          ) : undefined
        }
      />

      <div className="mx-auto w-full max-w-[1560px] space-y-6 pt-6" aria-busy={loading}>
        {loading && (
          <span role="status" className="sr-only">
            {tCommon('loading')}
          </span>
        )}
        {/* Hero band: greeting plus the four numbers as one reading. */}
        <header className="space-y-5">
          <Reveal className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="eyebrow">{t('eyebrow')}</p>
              <h1 className="mt-2 text-balance font-display text-[28px] font-medium leading-[1.15] tracking-[-0.022em] text-foreground sm:text-[36px]">
                {/* Two messages rather than one `select` with two `other`
                    branches: ICU allows a single `other`, and the duplicate threw
                    INVALID_MESSAGE on every dashboard render. Each locale also owns
                    its own separator, so Arabic keeps "، " instead of a hardcoded ", ". */}
                {firstName ? t('heroTitleNamed', { name: firstName }) : t('heroTitle')}
              </h1>
              <p className="mt-2 text-pretty text-sm text-muted-foreground">
                {t('heroSubtitle', {
                  tenant: tenantSlug || 'academy',
                  role: role ? role.replace(/_/g, ' ') : '—',
                  date: todayLabel,
                })}
                {' · '}
                {t('windowLabel', { days: rangeDays })}
                {overview?.updatedAt && now
                  ? ` · ${t('lastUpdated', {
                      time: relativeFrom(overview.updatedAt, now, relativeLabels),
                    })}`
                  : null}
              </p>
            </div>
          </Reveal>

          {/* Hairline-ruled KPI strip: `gap-px` over a border-coloured well draws
              the dividers on every row, however the grid wraps. */}
          <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs">
            {loading ? (
              <DashboardKpiStripSkeleton />
            ) : (
              <Stagger className="grid grid-cols-1 gap-px bg-border/60 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {kpis.map((kpi, index) => (
                  <StaggerItem key={kpi.label} index={index} className="bg-card">
                    <KpiCell
                      {...kpi}
                      deltaLabels={{
                        up: t('vsPreviousUp'),
                        down: t('vsPreviousDown'),
                        flat: t('vsPreviousFlat'),
                      }}
                      noData={t('noData')}
                    />
                  </StaggerItem>
                ))}
              </Stagger>
            )}
          </div>
        </header>

        <AnimatePresence initial={false}>
        {failed.length > 0 && (
          <m.div
            role="status"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto', transition: { duration: 0.3, ease: ease.emerge } }}
            exit={{ opacity: 0, height: 0, transition: { duration: 0.18, ease: ease.exit } }}
            className="overflow-hidden"
          >
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/25 bg-warning/[0.06] px-4 py-3">
            <p className="flex items-center gap-2 text-13 text-foreground">
              <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden="true" />
              {t('errorTitle')}
            </p>
            <button
              type="button"
              onClick={() => void load(true)}
              className="rounded-lg border border-border/80 bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-xs transition hover:bg-muted/60 active:scale-[0.98]"
            >
              {t('errorAction')}
            </button>
          </div>
          </m.div>
        )}
        </AnimatePresence>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-8">
            {/* Attention rail */}
            <Panel
              title={t('attention')}
              subtitle={t('attentionSub')}
              tone="attention"
              action={
                attention.length > 0 ? (
                  <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium tabular-nums text-warning">
                    {count(attention.length)}
                  </span>
                ) : null
              }
              bodyClassName="p-0"
            >
              {loading ? (
                <PanelListSkeleton rows={3} rowClassName="px-4 py-3.5 sm:px-5" trailing="w-10" />
              ) : attention.length === 0 ? (
                <div className="flex items-center gap-3 px-4 py-5 sm:px-5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
                    <BarChart3 className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{t('attentionEmpty')}</p>
                    <p className="text-xs text-muted-foreground">{t('attentionEmptyBody')}</p>
                  </div>
                </div>
              ) : (
                <Stagger as="ul" className="divide-y divide-border/60">
                  {attention.map((item, index) => (
                    <StaggerItem as="li" key={item.key} index={index}>
                      <Link
                        href={item.href}
                        className="group flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40 sm:px-5"
                      >
                        <span
                          className={cn(
                            'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full',
                            item.severity === 'high'
                              ? 'bg-destructive/10 text-destructive'
                              : item.severity === 'medium'
                                ? 'bg-warning/10 text-warning'
                                : 'bg-muted text-muted-foreground',
                          )}
                        >
                          <item.icon className="size-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-snug text-foreground">{item.text}</p>
                          {item.samples.length > 0 && (
                            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                              {item.samples.slice(0, 3).join(' · ')}
                              {item.samples.length > 3
                                ? ` · ${t('sampleMore', { count: item.samples.length - 3 })}`
                                : ''}
                            </p>
                          )}
                        </div>
                        <span className="mt-1 inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
                          {t('fix')}
                          <ExternalLink
                            className="size-3 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                            aria-hidden="true"
                          />
                        </span>
                      </Link>
                    </StaggerItem>
                  ))}
                </Stagger>
              )}
            </Panel>

            {/* Momentum, from the real daily series */}
            <Panel
              title={t('momentum')}
              subtitle={t('momentumSub')}
              action={
                <Link
                  href="/admin/analytics"
                  className="inline-flex min-h-6 items-center gap-1 rounded-sm text-xs font-medium text-primary underline-offset-4 transition hover:underline"
                >
                  {t('fullAnalytics')}
                  <ExternalLink className="size-3" aria-hidden="true" />
                </Link>
              }
            >
              {loading ? (
                <div className="space-y-5">
                  {[0, 1].map((index) => (
                    <div key={index}>
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <Skeleton className="h-2.5 w-20" />
                        <Skeleton className="h-4 w-16" />
                      </div>
                      <Skeleton className="h-24 w-full" />
                    </div>
                  ))}
                </div>
              ) : !hasSeries ? (
                <p className="py-6 text-center text-sm text-muted-foreground">{t('seriesEmpty')}</p>
              ) : (
                <div className="space-y-5">
                  <div>
                    <div className="mb-1.5 flex items-baseline justify-between gap-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        {t('enrollmentsLabel')}
                      </p>
                      <p className="font-display text-base font-medium tabular-nums text-foreground">
                        {count(enrolledSeries.reduce((sum, point) => sum + point.value, 0))}
                      </p>
                    </div>
                    <SeriesBars points={enrolledSeries} />
                  </div>
                  <div>
                    <div className="mb-1.5 flex items-baseline justify-between gap-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        {t('revenueLabel')}
                      </p>
                      <p className="font-display text-base font-medium tabular-nums text-foreground">
                        {currency(revenueDaily.reduce((sum, point) => sum + point.value, 0), PLATFORM_CURRENCY)}
                      </p>
                    </div>
                    <SeriesBars points={revenueDaily} tone="success" />
                  </div>
                </div>
              )}
            </Panel>

            {/* Most enrolled, from the real ranking endpoint */}
            <Panel
              title={t('topCourses')}
              bodyClassName="p-0"
              action={
                isManager ? (
                  <Link
                    href="/admin/courses"
                    className="inline-flex min-h-6 items-center gap-1 rounded-sm text-xs font-medium text-primary underline-offset-4 transition hover:underline"
                  >
                    {t('viewAll')}
                    <ExternalLink className="size-3" aria-hidden="true" />
                  </Link>
                ) : null
              }
            >
              {loading ? (
                <PanelListSkeleton rows={5} lead="index" trailing="w-20" />
              ) : (topCourses ?? []).length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground sm:px-5">
                  {t('topCoursesEmpty')}
                </p>
              ) : (
                <ol className="divide-y divide-border/60">
                  {(topCourses ?? []).slice(0, 6).map((course, index) => {
                    const max = Math.max(1, ...(topCourses ?? []).map((entry) => entry.enrollments));
                    return (
                      <li key={course.id}>
                        <Link
                          href={`/admin/courses/${course.slug ?? course.id}/edit`}
                          className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:px-5"
                        >
                          <span className="w-5 shrink-0 font-display text-sm font-medium tabular-nums text-muted-foreground">
                            {index + 1}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-13 font-medium text-foreground">
                              {course.title}
                            </span>
                            <span className="mt-1.5 block h-1 w-full max-w-40 overflow-hidden rounded-full bg-muted">
                              <m.span
                                className="block h-full rounded-full bg-primary/60"
                                initial={{ width: 0 }}
                                animate={{ width: `${(course.enrollments / max) * 100}%` }}
                                transition={{ duration: 0.7, delay: 0.1 + index * 0.05, ease: ease.emerge }}
                              />
                            </span>
                          </span>
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                            {t('enrollmentCount', { count: course.enrollments })}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              )}
            </Panel>
          </div>

          <div className="space-y-6 lg:col-span-4">
            {/* Catalogue health, over counts that exist */}
            <Panel title={t('health')} subtitle={t('healthSub')}>
              {loading ? (
                <div className="space-y-4">
                  <Skeleton className="h-2 w-full rounded-full" />
                  <div className="space-y-2.5">
                    {[0, 1, 2].map((index) => (
                      <div key={index} className="flex h-5 items-center justify-between gap-2">
                        <Skeleton className="h-2.5 w-24" />
                        <Skeleton className="h-3 w-8" />
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-border/60 pt-3">
                    <Skeleton className="h-2.5 w-2/3" />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <SegmentedBar
                    segments={[
                      { value: health.engaged, color: 'var(--success)', label: t('published') },
                      { value: health.zero, color: 'var(--destructive)', label: t('zeroEnrollment') },
                      { value: health.drafts, color: 'var(--warning)', label: t('drafts') },
                    ]}
                  />
                  <dl className="space-y-2.5">
                    {[
                      { key: 'published', value: health.published, color: 'bg-success' },
                      { key: 'zeroEnrollment', value: health.zero, color: 'bg-destructive' },
                      { key: 'drafts', value: health.drafts, color: 'bg-warning' },
                    ].map((row) => (
                      <div key={row.key} className="flex items-center justify-between gap-2">
                        <dt className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className={cn('size-2 rounded-full', row.color)} aria-hidden="true" />
                          {t(row.key)}
                        </dt>
                        <dd className="text-sm font-medium tabular-nums text-foreground">
                          {count(row.value)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <p className="border-t border-border/60 pt-3 text-xs text-muted-foreground">
                    {health.share
                      ? t('progressShare', { value: health.share, total: count(health.total) })
                      : t('courseCount', { count: health.total })}
                  </p>
                </div>
              )}
            </Panel>

            {/* New accounts */}
            <Panel
              title={t('recentSignups')}
              bodyClassName="p-0"
              action={
                isManager ? (
                  <Link
                    href="/admin/users"
                    className="inline-flex min-h-6 items-center gap-1 rounded-sm text-xs font-medium text-primary underline-offset-4 transition hover:underline"
                  >
                    {t('viewAll')}
                    <ExternalLink className="size-3" aria-hidden="true" />
                  </Link>
                ) : null
              }
            >
              {loading ? (
                <PanelListSkeleton rows={5} trailing="w-10" />
              ) : (stats?.recentUsers ?? []).length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground sm:px-5">
                  {t('noUsersYet')}
                </p>
              ) : (
                <Stagger as="ul" className="divide-y divide-border/60">
                  {(stats?.recentUsers ?? []).slice(0, 5).map((account, index) => (
                    <StaggerItem as="li" key={account.id} index={index}>
                      <Link
                        href={`/admin/users?focus=${account.id}`}
                        className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:px-5"
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-2xs font-semibold text-secondary dark:bg-foreground/10 dark:text-foreground">
                          {initials(account.name, account.email)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-13 font-medium text-foreground">
                            {account.name || account.email.split('@')[0]}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {account.email}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {relativeFrom(account.createdAt, now, relativeLabels)}
                        </span>
                      </Link>
                    </StaggerItem>
                  ))}
                </Stagger>
              )}
            </Panel>

            {/* Shortcuts */}
            <Panel title={t('shortcuts')} subtitle={t('shortcutsSub')} bodyClassName="p-3">
              <nav className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
                {shortcuts.map((shortcut) => (
                  <Link
                    key={shortcut.href}
                    href={shortcut.href}
                    className="group flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-muted/60"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-card text-muted-foreground shadow-xs transition-[border-color,color,transform] duration-200 group-hover:-translate-y-px group-hover:border-primary/30 group-hover:text-primary">
                      <shortcut.icon className="size-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-13 font-medium text-foreground">
                      {t(shortcut.key)}
                    </span>
                    <ExternalLink
                      className="size-3 shrink-0 text-muted-foreground/40 transition group-hover:translate-x-0.5 group-hover:text-primary rtl:group-hover:-translate-x-0.5"
                      aria-hidden="true"
                    />
                  </Link>
                ))}
              </nav>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
