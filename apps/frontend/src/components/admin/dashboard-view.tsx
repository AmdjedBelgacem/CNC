'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Users,
  GraduationCap,
  DollarSign,
  LayoutTemplate,
  Palette,
  BarChart2,
  Award,
  Settings,
  ArrowUpRight,
  AlertCircle,
  FileEdit,
  UserX,
  TrendingDown,
  CheckCircle2,
  Plus,
  TrendingUp,
  BookOpen,
  UserPlus,
  RefreshCw,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import {
  AdminCommandBar,
  AdminKpiCard,
  AdminPageHeader,
  BarIconButton,
  BarPrimaryButton,
} from './admin-chrome';
import { TableCard, EmptyState } from './admin-ui';

interface DeltaValue {
  value: number;
  delta: number | null;
}
interface OverviewData {
  users?: DeltaValue;
  activeUsers?: DeltaValue;
  enrollments?: DeltaValue;
  revenue?: { cents: number; delta: number | null };
}
interface AdminStats {
  recentUsers: { id: string; name: string | null; email: string; createdAt: string }[];
}
interface PulseData {
  draftCourses: number;
  zeroEnrollmentCourses: number;
  suspendedUsers: number;
  ordersSilent30d: boolean;
  recentEnrollments: {
    id: string;
    userName: string | null;
    userEmail: string;
    courseTitle: string;
    startedAt: string;
  }[];
}

const QUICK_LINKS_KEYS = [
  {
    href: '/admin/builder',
    key: 'builder',
    desc: 'Edit homepage sections',
    icon: LayoutTemplate,
    roles: ['super_admin', 'admin', 'instructor'],
  },
  {
    href: '/admin/theme',
    key: 'theme',
    desc: 'Colors & typography',
    icon: Palette,
    roles: ['super_admin', 'admin'],
  },
  {
    href: '/admin/analytics',
    key: 'analytics',
    desc: 'Trends & top courses',
    icon: BarChart2,
    roles: ['super_admin', 'admin'],
  },
  {
    href: '/admin/users',
    key: 'users',
    desc: 'Roles & sessions',
    icon: Users,
    roles: ['super_admin', 'admin'],
  },
  {
    href: '/admin/certificates',
    key: 'certificates',
    desc: 'Issued certificates',
    icon: Award,
    roles: ['super_admin', 'admin'],
  },
  {
    href: '/admin/settings',
    key: 'settings',
    desc: 'Tenant configuration',
    icon: Settings,
    roles: ['super_admin', 'admin'],
  },
];

/* Tone tiles mirror AdminKpiCard's palette so quick-links read as one system. */
const TILE: Record<string, string> = {
  blue: 'border-blue-100 bg-blue-50 text-blue-600 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-300',
  emerald:
    'border-emerald-100 bg-emerald-50 text-emerald-600 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300',
  cyan: 'border-cyan-100 bg-cyan-50 text-cyan-600 dark:border-cyan-900/40 dark:bg-cyan-950/40 dark:text-cyan-300',
  amber:
    'border-amber-100 bg-amber-50 text-amber-600 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-300',
  violet:
    'border-violet-100 bg-violet-50 text-violet-600 dark:border-violet-900/40 dark:bg-violet-950/40 dark:text-violet-300',
  rose: 'border-rose-100 bg-rose-50 text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300',
  slate:
    'border-border bg-muted text-muted-foreground dark:border-white/10 dark:bg-white/10 dark:text-slate-300',
};
const QUICK_TONES = ['blue', 'violet', 'cyan', 'emerald', 'amber', 'slate'];

function initials(name: string | null, email: string) {
  const source = name?.trim() || email;
  return source
    .split(/[\s@._]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}
function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function DeltaChip({ delta }: { delta: number | null }) {
  if (delta === null || delta === undefined || Number.isNaN(delta)) return null;
  const positive = delta >= 0;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
        positive
          ? 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300'
          : 'bg-rose-500/10 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300',
      )}
    >
      <TrendingUp className={cn('h-3 w-3', !positive && 'rotate-180')} /> {positive ? '+' : ''}
      {delta.toFixed(1)}%
    </span>
  );
}

export function DashboardView() {
  const tAdmin = useTranslations('admin');
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const role = user?.role ?? '';
  const can = (roles: string[]) => roles.includes(role);
  const tenantSlug = user?.tenantRoles?.find((t) => t.tenantId === user.tenantId)?.tenantSlug;
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [pulse, setPulse] = useState<PulseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useMemo(
    () =>
      async (silent = false) => {
        if (silent) setRefreshing(true);
        try {
          const [overviewRes, statsRes, pulseRes] = await Promise.all([
            fetch('/api/proxy/admin/analytics/overview?range=30d', { credentials: 'include' }),
            fetch('/api/proxy/admin/stats', { credentials: 'include' }),
            fetch('/api/proxy/admin/dashboard/pulse', { credentials: 'include' }),
          ]);
          if (overviewRes.ok) setOverview(await overviewRes.json());
          if (statsRes.ok) {
            const statsData = await statsRes.json();
            if (statsData && typeof statsData === 'object' && Array.isArray(statsData.recentUsers))
              setStats(statsData);
          }
          if (pulseRes.ok) setPulse(await pulseRes.json());
        } catch {
          // Widgets fall back to their empty states when a dashboard endpoint fails.
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const formatCurrency = (cents: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
  const today = useMemo(
    () =>
      new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date()),
    [],
  );
  const firstName = user?.name?.trim().split(' ')[0];

  const kpis = useMemo(
    () => [
      {
        label: tAdmin('totalUsers'),
        sub: 'Registered accounts',
        value: (overview?.users?.value ?? 0).toLocaleString(),
        delta: overview?.users?.delta ?? null,
        icon: Users,
        tone: 'blue',
        href: '/admin/users',
      },
      {
        label: tAdmin('activeLearners'),
        sub: 'Completed a lesson',
        value: (overview?.activeUsers?.value ?? 0).toLocaleString(),
        delta: overview?.activeUsers?.delta ?? null,
        icon: GraduationCap,
        tone: 'emerald',
        href: '/admin/analytics',
      },
      {
        label: tAdmin('enrollments'),
        sub: 'Course starts',
        value: (overview?.enrollments?.value ?? 0).toLocaleString(),
        delta: overview?.enrollments?.delta ?? null,
        icon: BookOpen,
        tone: 'cyan',
        href: '/admin/analytics',
      },
      {
        label: tAdmin('revenue'),
        sub: 'Confirmed orders',
        value: formatCurrency(overview?.revenue?.cents ?? 0),
        delta: overview?.revenue?.delta ?? null,
        icon: DollarSign,
        tone: 'amber',
        href: '/admin/analytics',
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [overview, tAdmin],
  );

  type PulseItem = {
    key: string;
    severity: 'high' | 'medium' | 'low';
    icon: typeof FileEdit;
    text: string;
    href: string;
  };
  const pulseItems = useMemo<PulseItem[]>(() => {
    if (!pulse) return [];
    const items: PulseItem[] = [];
    if (pulse.draftCourses > 0)
      items.push({
        key: 'drafts',
        severity: 'medium',
        icon: FileEdit,
        text: `${pulse.draftCourses} draft course${pulse.draftCourses === 1 ? '' : 's'} awaiting publish`,
        href: '/admin/courses?status=draft',
      });
    if (pulse.zeroEnrollmentCourses > 0)
      items.push({
        key: 'zero-enr',
        severity: 'high',
        icon: AlertCircle,
        text: `${pulse.zeroEnrollmentCourses} published course${pulse.zeroEnrollmentCourses === 1 ? ' has' : 's have'} zero enrollments`,
        href: '/admin/courses?enrollments=0',
      });
    if (pulse.suspendedUsers > 0)
      items.push({
        key: 'susp',
        severity: 'low',
        icon: UserX,
        text: `${pulse.suspendedUsers} suspended account${pulse.suspendedUsers === 1 ? '' : 's'} to review`,
        href: '/admin/users?suspended=true',
      });
    if (pulse.ordersSilent30d)
      items.push({
        key: 'silent',
        severity: 'medium',
        icon: TrendingDown,
        text: 'No confirmed orders in the last 30 days',
        href: '/admin/analytics',
      });
    return items;
  }, [pulse]);

  const health = useMemo(() => {
    const draft = pulse?.draftCourses ?? 0;
    const zero = pulse?.zeroEnrollmentCourses ?? 0;
    const total = (overview?.enrollments?.value ?? 0) + draft + zero || 1;
    const published = Math.max(0, total - draft);
    return { draft, zero, published, total };
  }, [pulse, overview]);

  return (
    <div className="w-full">
      <AdminCommandBar
        trail={[{ label: 'Titans of CNC' }, { label: tAdmin('dashboard') }]}
        live="Live"
        actions={
          <>
            <Link
              href="/admin/settings"
              className="hidden h-9 shrink-0 items-center rounded-xl border border-border bg-background px-3 text-[13px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground sm:inline-flex"
            >
              {tenantSlug || 'academy'} · {role || '—'}
            </Link>
            <BarIconButton
              title="Refresh dashboard"
              spinning={refreshing}
              onClick={() => void load(true)}
            >
              <RefreshCw className="h-4 w-4" />
            </BarIconButton>
          </>
        }
        primary={
          can(['super_admin', 'admin']) ? (
            <BarPrimaryButton
              icon={<Plus className="h-4 w-4" strokeWidth={2.5} />}
              onClick={() => router.push('/admin/courses/new')}
            >
              New course
            </BarPrimaryButton>
          ) : undefined
        }
      />

      <div className="mx-auto w-full max-w-[1500px] space-y-6 pt-6">
        <AdminPageHeader
          title={`${tAdmin('welcomeBack')}${firstName ? `, ${firstName}` : ''}`}
          description={`${today} · ${tenantSlug || 'academy'} · ${role ? role.replace('_', ' ') : '—'}`}
          badge={
            <span className="flex items-center gap-2 self-start rounded-full border border-emerald-200/80 bg-emerald-50/80 px-3 py-1.5 text-xs font-medium text-emerald-800 shadow-sm md:self-auto dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              Live · 30-day window
            </span>
          }
        />

        {/* KPI row — identical primitive to Learners / Staff so the surfaces agree. */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {loading
            ? [0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-[104px] animate-pulse rounded-2xl border border-border bg-card"
                />
              ))
            : kpis.map(({ label, sub, value, delta, icon, tone, href }) => (
                <Link key={label} href={href} className="block focus:outline-none">
                  <AdminKpiCard
                    icon={icon}
                    label={label}
                    value={value}
                    meta={<DeltaChip delta={delta} />}
                    sub={sub}
                    tone={tone}
                  />
                </Link>
              ))}
        </div>

        {/* Attention needed */}
        <TableCard
          header={
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 normal-case">
                <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {tAdmin('attentionNeeded')}
                </span>
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
                  {pulseItems.length}
                </span>
              </span>
              <span className="hidden text-[11px] font-medium normal-case tracking-normal text-muted-foreground sm:block">
                Sorted by urgency
              </span>
            </div>
          }
        >
          {!pulseItems.length ? (
            <EmptyState
              icon={CheckCircle2}
              title={tAdmin('allClear')}
              body="No drafts, no zero-enrollment courses, no suspended accounts. Everything looks healthy."
            />
          ) : (
            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
              {pulseItems.map(({ key, severity, icon: Icon, text, href }) => (
                <Link
                  key={key}
                  href={href}
                  className="group flex flex-col gap-3 rounded-xl border border-border bg-background p-4 transition duration-200 hover:-translate-y-0.5 hover:border-blue-500/40 hover:shadow-md"
                >
                  <span
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-xl border transition-transform group-hover:scale-110',
                      severity === 'high'
                        ? TILE.rose
                        : severity === 'medium'
                          ? TILE.amber
                          : TILE.slate,
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="line-clamp-2 min-h-[40px] text-sm font-medium leading-snug text-foreground">
                    {text}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400">
                    Fix
                    <ArrowUpRight className="h-3 w-3 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </TableCard>

        <div className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-8">
            {/* Momentum + course health */}
            <div className="grid gap-6 sm:grid-cols-5">
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:col-span-3">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-[15px] font-semibold tracking-tight text-foreground">
                    30-day momentum
                  </h3>
                  <span className="text-xs text-muted-foreground">vs previous period</span>
                </div>
                <div className="space-y-4">
                  {[
                    { label: 'Users', v: overview?.users?.value ?? 0, d: overview?.users?.delta },
                    {
                      label: 'Enrollments',
                      v: overview?.enrollments?.value ?? 0,
                      d: overview?.enrollments?.delta,
                    },
                    {
                      label: 'Revenue',
                      v: overview?.revenue?.cents ?? 0,
                      d: overview?.revenue?.delta,
                      isCurrency: true,
                    },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-muted-foreground">{row.label}</p>
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400"
                            style={{
                              width: `${Math.min(100, Math.max(8, (row.v / Math.max(1, overview?.users?.value ?? 1)) * 100))}%`,
                            }}
                          />
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold tabular-nums text-foreground">
                          {row.isCurrency
                            ? new Intl.NumberFormat('en-US', {
                                style: 'currency',
                                currency: 'USD',
                              }).format((row.v as number) / 100)
                            : (row.v as number).toLocaleString()}
                        </p>
                        <DeltaChip delta={row.d ?? null} />
                      </div>
                    </div>
                  ))}
                  <p className="border-t border-border pt-3 text-xs text-muted-foreground">
                    Full chart →{' '}
                    <Link href="/admin/analytics" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
                      Analytics
                    </Link>
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:col-span-2">
                <h3 className="mb-4 text-[15px] font-semibold tracking-tight text-foreground">
                  Course health
                </h3>
                <div className="flex flex-col items-center gap-4">
                  <div className="relative flex h-28 w-28 items-center justify-center">
                    <div className="absolute inset-0 rounded-full border-[10px] border-muted" />
                    <div
                      className="absolute inset-0 rounded-full"
                      style={{
                        background: `conic-gradient(rgb(16 185 129) 0 ${(health.published / health.total) * 360}deg, rgb(245 158 11) ${(health.published / health.total) * 360}deg ${((health.published + health.draft) / health.total) * 360}deg, rgb(244 63 94) ${((health.published + health.draft) / health.total) * 360}deg 360deg)`,
                        WebkitMask:
                          'radial-gradient(circle 36px at center, transparent 36px, black 37px)',
                        mask: 'radial-gradient(circle at center, transparent 36px, black 37px)',
                      }}
                    />
                    <div className="text-center">
                      <p className="text-xl font-bold tabular-nums text-foreground">
                        {health.total}
                      </p>
                      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        courses
                      </p>
                    </div>
                  </div>
                  <div className="w-full space-y-2 text-xs">
                    {[
                      { label: 'Published', value: health.published, dot: 'bg-emerald-500' },
                      { label: 'Drafts', value: health.draft, dot: 'bg-amber-500' },
                      { label: 'Zero-enrollment', value: health.zero, dot: 'bg-rose-500' },
                    ].map((r) => (
                      <div key={r.label} className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <span className={cn('h-2 w-2 rounded-full', r.dot)} /> {r.label}
                        </span>
                        <span className="font-semibold tabular-nums text-foreground">
                          {r.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Recent signups */}
            <TableCard
              header={
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 normal-case">
                    <UserPlus className="h-3.5 w-3.5 text-blue-500" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {tAdmin('recentSignups')}
                    </span>
                  </span>
                  {can(['super_admin', 'admin']) && (
                    <Link
                      href="/admin/users"
                      className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-semibold normal-case tracking-normal text-white shadow-sm shadow-blue-600/25 transition hover:bg-blue-700 active:scale-[0.98]"
                    >
                      {tAdmin('viewAll')} <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              }
            >
              {(stats?.recentUsers ?? []).length === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-muted-foreground">
                  {tAdmin('noUsersYet')}
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {stats?.recentUsers.slice(0, 5).map((u) => (
                    <li key={u.id}>
                      <Link
                        href={`/admin/users?focus=${u.id}`}
                        className="group flex items-center gap-3 px-5 py-3 transition hover:bg-muted/50"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-foreground text-xs font-bold text-background">
                          {initials(u.name, u.email)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-foreground transition group-hover:text-blue-600">
                            {u.name || u.email.split('@')[0]}
                          </span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {u.email}
                          </span>
                        </div>
                        <span className="shrink-0 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground">
                          {relativeTime(u.createdAt)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </TableCard>
          </div>

          <div className="space-y-6 lg:col-span-4">
            {can(['super_admin', 'admin']) && (
              <TableCard
                header={
                  <span className="flex items-center gap-2 normal-case">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {tAdmin('recentActivity')}
                    </span>
                    <span className="text-[11px] font-medium normal-case tracking-normal text-muted-foreground">
                      Latest enrollments
                    </span>
                  </span>
                }
              >
                {(pulse?.recentEnrollments ?? []).length === 0 ? (
                  <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                    {tAdmin('noEnrollmentsYet')}
                  </p>
                ) : (
                  <ul className="relative space-y-0 px-5 py-4 before:absolute before:bottom-4 before:left-[27px] before:top-4 before:w-px before:bg-border">
                    {pulse!.recentEnrollments.slice(0, 5).map((e) => (
                      <li key={e.id} className="relative flex gap-3 py-3 pl-6">
                        <span className="absolute left-0 top-[22px] h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm leading-snug text-muted-foreground">
                            <span className="font-semibold text-foreground">
                              {e.userName || e.userEmail.split('@')[0]}
                            </span>{' '}
                            enrolled in{' '}
                            <span className="font-medium text-foreground">{e.courseTitle}</span>
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {relativeTime(e.startedAt)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </TableCard>
            )}

            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-[15px] font-semibold tracking-tight text-foreground">
                  {tAdmin('quickActions')}
                </h3>
                <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Jump to
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {QUICK_LINKS_KEYS.filter((l) => can(l.roles)).map(
                  ({ href, key, desc, icon: Icon }, idx) => (
                    <Link
                      key={href}
                      href={href}
                      className="group flex flex-col gap-2 rounded-xl border border-border bg-background p-4 transition duration-200 hover:-translate-y-0.5 hover:border-blue-500/40 hover:shadow-md"
                    >
                      <span
                        className={cn(
                          'flex h-9 w-9 items-center justify-center rounded-xl border transition-transform group-hover:scale-110',
                          TILE[QUICK_TONES[idx % QUICK_TONES.length] ?? 'blue'],
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="text-sm font-semibold leading-tight text-foreground">
                        {tAdmin(key)}
                      </span>
                      <span className="line-clamp-2 text-xs leading-snug text-muted-foreground">
                        {desc}
                      </span>
                    </Link>
                  ),
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
