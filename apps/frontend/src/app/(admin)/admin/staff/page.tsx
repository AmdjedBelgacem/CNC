'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Download,
  LayoutGrid,
  LayoutList,
  Lock,
  Pencil,
  RefreshCw,
  ShieldCheck,
  UserCog,
  UserPlus,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { AnimatePresence, m } from 'framer-motion';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Reveal, Stagger, StaggerItem } from '@/components/ui/motion';
import { ease, spring } from '@/lib/motion';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api-client';
import { toast } from '@/components/ui/toast';
import {
  AdminCommandBar,
  AdminKpiCard,
  AdminPageHeader,
  BarButton,
  BarIconButton,
  BarPrimaryButton,
} from '@/components/admin/admin-chrome';
import {
  Avatar,
  EmptyState,
  FilterChip,
  Pagination,
  SegmentedIconToggle,
  StatusPill,
  TableCard,
  Toolbar,
  type Tone,
} from '@/components/admin/admin-ui';
import { StaffDrawer } from './staff-drawer';
import type { AdminUserRow } from '../users/users-shared';
import { StaffTableSkeleton } from '@/components/skeletons/admin-route-skeletons';
import { rememberListCount } from '@/lib/admin-shape-memory';
import { SkeletonRegion } from '@/components/ui/skeletons';
import { fetchWithRefresh } from '@/hooks/use-api-proxy';

const ROLES = ['super_admin', 'admin', 'instructor', 'moderator', 'sponsor'] as const;
type RoleKey = (typeof ROLES)[number];

const roleMeta: Record<
  string,
  {
    label: string;
    short: string;
    grad: string;
    dot: string;
    ring: string;
    pill: string;
    pillDot: string;
    deptTitle: string;
    deptSub: string;
    securityLabel: string;
    securityIcon: string;
    securityIconClass: string;
    tag?: { label: string; cls: string };
  }
> = {
  super_admin: {
    label: 'Super Admin',
    short: 'Super Admin',
    grad: 'bg-primary text-primary-foreground',
    dot: 'bg-primary',
    ring: 'ring-primary/30',
    pill: 'bg-primary/10 text-primary border-primary/25',
    pillDot: 'bg-primary',
    deptTitle: 'Executive Operations',
    deptSub: 'Full Global Tenant Access',
    securityLabel: 'Root Key + TOTP',
    securityIcon: 'security',
    securityIconClass: 'text-primary',
    tag: { label: 'Root', cls: 'bg-primary/10 text-primary' },
  },
  admin: {
    label: 'Admin',
    short: 'Admin',
    grad: 'bg-secondary text-secondary-foreground',
    dot: 'bg-secondary',
    ring: 'ring-secondary/30',
    pill: 'bg-secondary/10 text-secondary border-secondary/25',
    pillDot: 'bg-secondary',
    deptTitle: 'Infrastructure & Telemetry',
    deptSub: 'Shop Floor Edge Node',
    securityLabel: 'FIDO2 / 2FA',
    securityIcon: 'verified',
    securityIconClass: 'text-success',
  },
  instructor: {
    label: 'Master Instructor',
    short: 'Instructor',
    grad: 'bg-success text-success-foreground',
    dot: 'bg-success',
    ring: 'ring-success/30',
    pill: 'bg-success/10 text-success border-success/25',
    pillDot: 'bg-success',
    deptTitle: '5-Axis Milling Masterclass',
    deptSub: 'Matsuura & Hermle Academy',
    securityLabel: 'Hardware Key',
    securityIcon: 'verified',
    securityIconClass: 'text-success',
    tag: { label: 'Master Mach.', cls: 'bg-success/10 text-success' },
  },
  moderator: {
    label: 'Moderator',
    short: 'Moderator',
    grad: 'bg-info text-info-foreground',
    dot: 'bg-info',
    ring: 'ring-info/30',
    pill: 'bg-info/10 text-info border-info/25',
    pillDot: 'bg-info',
    deptTitle: 'Shop Safety & QA',
    deptSub: 'Quality Inspection Room',
    securityLabel: 'Hardware Key',
    securityIcon: 'verified',
    securityIconClass: 'text-success',
  },
  sponsor: {
    label: 'Sponsor Partner',
    short: 'Sponsor',
    grad: 'bg-warning text-warning-foreground',
    dot: 'bg-warning',
    ring: 'ring-warning/30',
    pill: 'bg-warning/10 text-warning border-warning/25',
    pillDot: 'bg-warning',
    deptTitle: 'Industrial Grant Cell',
    deptSub: 'External Audit Access',
    securityLabel: 'SSO Bound',
    securityIcon: 'verified',
    securityIconClass: 'text-success',
    tag: { label: 'Partner', cls: 'bg-warning/10 text-warning' },
  },
};

const statusStyle: Record<string, { pill: string; dot: string; label: string }> = {
  active: {
    pill: 'text-success bg-success/10 border-success/70',
    dot: 'bg-success',
    label: 'Active',
  },
  suspended: {
    pill: 'text-destructive bg-destructive/10 border-destructive/70',
    dot: 'bg-destructive',
    label: 'Suspended',
  },
  pending_verification: {
    pill: 'text-warning bg-warning/10 border-warning/25',
    dot: 'bg-warning',
    label: 'Pending',
  },
  pending: {
    pill: 'text-warning bg-warning/10 border-warning/25',
    dot: 'bg-warning',
    label: 'Pending',
  },
  deleted: {
    pill: 'text-muted-foreground bg-muted border-border',
    dot: 'bg-muted-foreground',
    label: 'Deleted',
  },
};

type Translator = (key: string, values?: Record<string, string | number>) => string;

function timeAgo(iso: string, t: Translator, locale = 'en'): string {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return '—';
  const diff = Date.now() - ts;
  if (diff < 60_000) return t('justNow');
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return t('minutesAgo', { n: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('hoursAgo', { n: hours });
  if (hours < 48) return t('yesterday');
  return formatDate(iso, locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function toCsv(rows: AdminUserRow[]): string {
  const header = ['id', 'name', 'email', 'username', 'role', 'status', 'createdAt'];
  const esc = (v: unknown) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map((u) =>
    [
      u.id,
      u.name ?? '',
      u.email,
      (u as { username?: string | null }).username ?? '',
      u.role,
      u.accountStatus,
      u.createdAt,
    ]
      .map(esc)
      .join(','),
  );
  return [header.join(','), ...lines].join('\n');
}

export default function AdminStaffPage() {
  const router = useRouter();
  const params = useSearchParams();
  const tAdmin = useTranslations('admin');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const q = params.get('q') ?? '';
  const role = params.get('role') ?? '';
  const status = params.get('status') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const focusId = params.get('focus');

  const tRole = (key: string, fallback: string) => tAdmin(`role.${key}`, { default: fallback });

  const [rows, setRows] = useState<AdminUserRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [qInput, setQInput] = useState(q);
  const [limit, setLimit] = useState(12);
  const [view, setView] = useState<'table' | 'grid'>('table');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [roleTotals, setRoleTotals] = useState<Record<string, number>>({});
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<RoleKey>('instructor');
  const [inviting, setInviting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const sendInvite = async () => {
    const email = inviteEmail.trim();
    if (!email || !email.includes('@')) {
      toast({ type: 'err', title: tAdmin('access.invalidEmail', { default: 'Enter a valid email' }) });
      return;
    }
    setInviting(true);
    try {
      await api.post('/admin/staff/invite', {
        email,
        name: inviteName.trim() || undefined,
        role: inviteRole,
      });
      toast({
        type: 'ok',
        title: tAdmin('access.invited', {
          email,
          role: inviteRole,
          default: 'Invited {email} as {role}',
        }),
      });
      setInviteOpen(false);
      setInviteEmail('');
      setInviteName('');
      load(true);
      loadRoleTotals();
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : tAdmin('access.inviteFailed', { default: 'Invite failed' });
      toast({
        type: 'err',
        title: tAdmin('access.inviteFailed', { default: 'Invite failed' }),
        description: msg,
      });
    } finally {
      setInviting(false);
    }
  };

  const push = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === '') next.delete(k);
        else next.set(k, v);
      }
      if (!('page' in patch)) next.delete('page');
      router.replace(`/admin/staff?${next.toString()}`);
    },
    [params, router],
  );

  useEffect(() => {
    const t = setTimeout(() => {
      if (qInput !== q) push({ q: qInput || null });
    }, 300);
    return () => clearTimeout(t);
  }, [qInput, q, push]);

  const load = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      try {
        const query = new URLSearchParams({ page: String(page), limit: String(limit) });
        if (q) query.set('search', q);
        if (role) query.set('role', role);
        if (status) query.set('status', status);
        const res = await fetchWithRefresh(`/api/proxy/admin/staff?${query.toString()}`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json();
        setRows(Array.isArray(data?.items) ? data.items : []);
        setTotal(Number(data?.total ?? 0));
        setSelected(new Set());
      } catch {
        setRows(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, q, role, status, limit],
  );

  const loadRoleTotals = useCallback(async () => {
    try {
      const entries = await Promise.all(
        ROLES.map(async (r) => {
          try {
            const res = await fetchWithRefresh(`/api/proxy/admin/staff?limit=1&role=${r}`, {
              credentials: 'include',
            });
            if (!res.ok) return [r, 0] as const;
            const data = await res.json();
            return [r, Number(data?.total ?? 0)] as const;
          } catch {
            return [r, 0] as const;
          }
        }),
      );
      setRoleTotals(Object.fromEntries(entries));
    } catch {
      /* counts are enhancement-only */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadRoleTotals();
  }, [loadRoleTotals]);

  const stats = useMemo(() => {
    const all = rows ?? [];
    const active = all.filter((u) => u.accountStatus === 'active').length;
    const distinctRoles = new Set(all.map((u) => u.role)).size;
    const suspended = all.filter((u) => u.accountStatus === 'suspended').length;
    const compliance =
      total > 0
        ? Math.round(
            (all.filter((u) => u.accountStatus === 'active').length / Math.max(1, all.length)) *
              100,
          )
        : 0;
    const activity = all.length > 0 ? Math.round((active / all.length) * 1000) / 10 : 0;
    return { active, distinctRoles, suspended, compliance, activity };
  }, [rows, total]);

  const pages = Math.max(1, Math.ceil(total / limit));
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);
  const hasFilters = Boolean(q || role || status);

  // The loading skeleton draws one row per row shown here; record how many for the next
  // visit. Only the unfiltered first page, which is what a fresh visit opens on.
  useEffect(() => {
    if (!loading && rows && !hasFilters && page === 1) rememberListCount('staff', rows.length);
  }, [loading, rows, hasFilters, page]);

  const toggleSelectAll = () => {
    if (!rows) return;
    if (selected.size === rows.length) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id)));
  };

  const toggleSelectOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      let data = rows ?? [];
      if (total > data.length) {
        const query = new URLSearchParams({ page: '1', limit: '100' });
        if (q) query.set('search', q);
        if (role) query.set('role', role);
        if (status) query.set('status', status);
        const res = await fetchWithRefresh(`/api/proxy/admin/staff?${query.toString()}`, {
          credentials: 'include',
        });
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json?.items)) data = json.items;
        }
      }
      if (data.length === 0) {
        toast({ type: 'err', title: tAdmin('access.nothingToExport', { default: 'Nothing to export' }) });
        return;
      }
      const blob = new Blob([toCsv(data)], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `staff-export-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({
        type: 'ok',
        title: tAdmin('access.exported', {
          count: data.length,
          default: 'Exported {count, plural, one {# member} other {# members}}',
        }),
      });
    } catch {
      toast({ type: 'err', title: tAdmin('access.exportFailed', { default: 'Export failed' }) });
    } finally {
      setExporting(false);
    }
  };

  const compliancePct = total > 0 && rows ? stats.compliance : rows?.length ? stats.compliance : 0;
  const activityPct = rows && rows.length > 0 ? stats.activity : 0;


  /* Role and status are rendered through the shared tone system so a member
   * looks identical here, in the drawer and in /admin/users. */
  const roleTone = (r: string): Tone =>
    r === 'super_admin'
      ? 'blue'
      : r === 'admin'
        ? 'purple'
        : r === 'instructor'
          ? 'emerald'
          : r === 'moderator'
            ? 'cyan'
            : 'amber';
  const statusTone = (s: string): Tone =>
    s === 'active'
      ? 'emerald'
      : s === 'suspended'
        ? 'rose'
        : s.startsWith('pending')
          ? 'amber'
          : 'slate';
  const statusLabel = (s: string) => {
    const fallback = statusStyle[s]?.label ?? s;
    return tAdmin(`status.${s}`, { default: fallback });
  };
  const roleLabel = (r: string) => tRole(r, roleMeta[r]?.label ?? r);
  const roleTotal = (r: string) => roleTotals[r] ?? 0;

  const clearAll = () => {
    setQInput('');
    router.replace('/admin/staff');
  };

  return (
    <div className="w-full">
      <AdminCommandBar
        trail={[
          { label: 'Baroot CNC Solutions' },
          { label: tAdmin('access.breadcrumb', { default: 'Staff & Access' }) },
        ]}
        count={loading ? null : total}
        live={tAdmin('live', { default: 'Live' })}
        search={{
          value: qInput,
          onChange: setQInput,
          placeholder: tAdmin('access.searchPlaceholder', {
            default: 'Search staff by name or email…',
          }),
          ariaLabel: tAdmin('access.searchAriaLabel', { default: 'Search staff' }),
        }}
        actions={
          <>
            <BarIconButton
              title={tAdmin('access.refreshStaff', { default: 'Refresh staff list' })}
              spinning={refreshing}
              onClick={() => {
                void load(true);
                void loadRoleTotals();
              }}
            >
              <RefreshCw className="size-4" />
            </BarIconButton>
            <BarButton
              icon={<ShieldCheck className="size-4" />}
              onClick={() => router.push('/admin/staff/roles')}
            >
              {tAdmin('tabs.roles', { default: 'Roles' })}
            </BarButton>
            <BarButton
              icon={<Download className="size-4" />}
              disabled={exporting || loading || !rows || rows.length === 0}
              onClick={() => void exportCsv()}
            >
              {exporting
                ? tAdmin('access.exporting', { default: 'Exporting…' })
                : tAdmin('access.export', { default: 'Export' })}
            </BarButton>
          </>
        }
        primary={
          <BarPrimaryButton
            icon={<UserPlus className="size-4" strokeWidth={2.5} />}
            onClick={() => setInviteOpen(true)}
          >
            {tAdmin('access.inviteMember', { default: 'Invite member' })}
          </BarPrimaryButton>
        }
      />

      <div className="mx-auto w-full max-w-[1500px] space-y-6 pt-6">
        <Reveal>
        <AdminPageHeader
          title={tAdmin('access.title', { default: 'Staff & Access Control' })}
          description={tAdmin('access.description', {
            default:
              'Manage precision CNC cell operators, lead instructors, telemetry admins, and guest sponsor credentials across five-axis facilities.',
          })}
          badge={
            <span className="inline-flex items-center gap-2 self-start rounded-full border border-success/25 bg-success/10 px-3 py-1.5 text-xs font-medium text-success md:self-auto">
              <BadgeCheck className="size-3.5" />
              {tAdmin('access.zeroTrustBadge', {
                default: 'Zero-Trust Protocol Active (2FA Enforced)',
              })}
            </span>
          }
        />
        </Reveal>

        <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StaggerItem index={0}>
          <AdminKpiCard
            icon={Users}
            label={tAdmin('access.totalActiveStaff', { default: 'Total Active Staff' })}
            value={loading ? '—' : total}
            sub={tAdmin('access.acrossCells', {
              count: Math.max(1, stats.distinctRoles),
              default: 'Across {count, plural, one {# machine cell} other {# machine cells}}',
            })}
            tone="blue"
          />
          </StaggerItem>
          <StaggerItem index={1}>
          <AdminKpiCard
            icon={UserCog}
            label={tAdmin('access.roleTiers', { default: 'Role Tiers' })}
            value={tAdmin('access.rolesCount', {
              count: ROLES.length,
              default: '{count, plural, one {# Role} other {# Roles}}',
            })}
            sub={tAdmin('access.configured', { default: 'configured' })}
            tone="purple"
          />
          </StaggerItem>
          <StaggerItem index={2}>
          <AdminKpiCard
            icon={ShieldCheck}
            label={tAdmin('access.securityCompliance', { default: 'Security Compliance' })}
            value={loading ? '—' : `${compliancePct}%`}
            sub={tAdmin('access.compliant', { default: '2FA / hardware key compliant' })}
            tone={compliancePct >= 80 ? 'emerald' : 'amber'}
          />
          </StaggerItem>
          <StaggerItem index={3}>
          <AdminKpiCard
            icon={Zap}
            label={tAdmin('access.activityIndex', { default: 'Activity Index' })}
            value={loading ? '—' : `${activityPct}%`}
            sub={tAdmin('access.past24h', { default: 'Past 24h' })}
            tone="cyan"
          />
          </StaggerItem>
        </Stagger>

        <Toolbar>
          <div className="no-scrollbar flex items-center gap-0.5 overflow-x-auto rounded-xl bg-muted/70 p-1">
            <button
              type="button"
              onClick={() => push({ role: null })}
              aria-pressed={!role}
              className={cn(
                'relative inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                !role ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {!role && <RoleFilterPill />}
              <span className="relative">{tCommon('all')}</span>
              <span className="relative rounded-full bg-muted-foreground/10 px-1.5 py-px text-2xs font-medium tabular-nums text-muted-foreground">
                {total}
              </span>
            </button>
            {ROLES.map((r) => {
              const active = role === r;
              const count = roleTotal(r);
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => push({ role: active ? null : r })}
                  aria-pressed={active}
                  className={cn(
                    'relative inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {active && <RoleFilterPill />}
                  <span
                    className={cn(
                      'relative size-1.5 rounded-full',
                      roleTone(r) === 'blue'
                        ? 'bg-primary'
                        : roleTone(r) === 'purple'
                          ? 'bg-accent'
                          : roleTone(r) === 'emerald'
                            ? 'bg-success'
                            : roleTone(r) === 'cyan'
                              ? 'bg-info'
                              : 'bg-warning',
                    )}
                  />
                  <span className="relative">{roleLabel(r)}</span>
                  <span className="relative rounded-full bg-muted-foreground/10 px-1.5 py-px text-2xs font-medium tabular-nums text-muted-foreground">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <select
            value={status}
            onChange={(e) => push({ status: e.target.value || null })}
            aria-label={tAdmin('filterStatus', { default: 'Filter by status' })}
            className="h-9 shrink-0 rounded-lg border border-border/70 bg-card px-2.5 text-13 text-foreground shadow-xs outline-none transition hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">{tAdmin('access.statusAll', { default: 'All statuses' })}</option>
            <option value="active">{tAdmin('status.active', { default: 'Active' })}</option>
            <option value="suspended">{tAdmin('status.suspended', { default: 'Suspended' })}</option>
            <option value="pending_verification">
              {tAdmin('status.pending', { default: 'Pending' })}
            </option>
          </select>

          <div className="ms-auto flex flex-wrap items-center justify-end gap-1.5">
            {q && (
              <FilterChip
                label={tAdmin('access.filterSearch', { q, default: 'Search: {q}' })}
                onClear={() => {
                  setQInput('');
                  push({ q: null });
                }}
              />
            )}
            {role && (
              <FilterChip
                tone={roleTone(role)}
                label={roleLabel(role)}
                onClear={() => push({ role: null })}
              />
            )}
            {status && (
              <FilterChip
                tone={statusTone(status)}
                label={statusLabel(status)}
                onClear={() => push({ status: null })}
              />
            )}
            <AnimatePresence initial={false}>
              {hasFilters && (
                <m.button
                  key="clear-filters"
                  type="button"
                  onClick={clearAll}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1, transition: spring.snappy }}
                  exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.12, ease: ease.exit } }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="size-3.5" />
                  {tCommon('clear')}
                </m.button>
              )}
            </AnimatePresence>
            <SegmentedIconToggle
              label={tAdmin('access.viewMode', { default: 'View mode' })}
              value={view}
              onChange={setView}
              options={[
                { key: 'table', icon: LayoutList, label: tAdmin('access.tableView', { default: 'Table View' }) },
                { key: 'grid', icon: LayoutGrid, label: tAdmin('access.gridView', { default: 'Card Grid View' }) },
              ]}
            />
          </div>
        </Toolbar>

        {loading ? (
          <SkeletonRegion><StaffTableSkeleton /></SkeletonRegion>
        ) : !rows || rows.length === 0 ? (
          <TableCard>
            <EmptyState
              icon={hasFilters ? UserCog : Users}
              tone={hasFilters ? 'amber' : 'blue'}
              title={
                hasFilters
                  ? tAdmin('access.emptyFiltered', { default: 'No staff match your filters' })
                  : tAdmin('access.emptyTitle', { default: 'No staff yet' })
              }
              body={
                hasFilters
                  ? tAdmin('access.emptyFilteredHint', {
                      default: 'Try a different role, status or search term.',
                    })
                  : tAdmin('access.emptyHint', {
                      default: 'Invite your first team member to get started.',
                    })
              }
              action={
                hasFilters ? (
                  <button
                    type="button"
                    onClick={clearAll}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium shadow-xs transition hover:border-border-strong hover:bg-muted/60 active:scale-[0.98]"
                  >
                    <X className="size-4" />
                    {tAdmin('access.clearFilters', { default: 'Clear filters' })}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setInviteOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs transition hover:bg-primary/90 active:scale-[0.98]"
                  >
                    <UserPlus className="size-4" />
                    {tAdmin('access.inviteMember', { default: 'Invite member' })}
                  </button>
                )
              }
            />
          </TableCard>
        ) : view === 'table' ? (
          <Reveal className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs">
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[900px] border-collapse text-start">
                <thead>
                  <tr className="border-b border-border/70 bg-muted/40 text-xs font-medium text-muted-foreground">
                    <th scope="col" className="w-10 py-3.5 ps-6 pe-3">
                      <input
                        type="checkbox"
                        aria-label={tAdmin('access.selectAll', { default: 'Select all on this page' })}
                        checked={rows.length > 0 && selected.size === rows.length}
                        onChange={toggleSelectAll}
                        className="size-3.5 cursor-pointer rounded border-border text-primary focus:ring-primary/30"
                      />
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-start font-medium">
                      {tAdmin('access.colStaff', { default: 'Staff Member' })}
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-start font-medium">
                      {tAdmin('access.colRoleTier', { default: 'Role Tier' })}
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-start font-medium">
                      {tAdmin('access.colDepartment', { default: 'Department / CNC Cell' })}
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-start font-medium">
                      {tAdmin('access.colStatus', { default: 'Status' })}
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-start font-medium">
                      {tAdmin('access.colSecurity', { default: 'Security' })}
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-start font-medium">
                      {tAdmin('access.colLastActive', { default: 'Last Active' })}
                    </th>
                    <th scope="col" className="py-3.5 pe-6 ps-4 text-end font-medium">
                      {tAdmin('access.colActions', { default: 'Actions' })}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70 text-13">
                  {rows.map((u, rowIndex) => {
                    const checked = selected.has(u.id);
                    const displayName = u.name || u.email.split('@')[0];
                    const rm = roleMeta[u.role] ?? roleMeta.admin!;
                    return (
                      <m.tr
                        key={u.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{
                          opacity: 1,
                          y: 0,
                          transition: { duration: 0.3, ease: ease.emerge, delay: Math.min(rowIndex, 11) * 0.03 },
                        }}
                        className={cn(
                          'group transition-colors duration-150 hover:bg-muted/40',
                          checked && 'bg-primary/[0.04]',
                        )}
                      >
                        <td className="py-4 ps-6 pe-3">
                          <input
                            type="checkbox"
                            aria-label={tAdmin('access.selectMember', {
                              name: displayName ?? u.email,
                              default: 'Select {name}',
                            })}
                            checked={checked}
                            onChange={() => toggleSelectOne(u.id)}
                            className="size-3.5 cursor-pointer rounded border-border text-primary focus:ring-primary/30"
                          />
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3.5">
                            <button
                              type="button"
                              onClick={() => push({ focus: u.id })}
                              title={displayName}
                              className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            >
                              <Avatar name={u.name} email={u.email} />
                            </button>
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={() => push({ focus: u.id })}
                                className="flex max-w-full items-center gap-2 font-medium text-foreground transition-colors group-hover:text-primary"
                              >
                                <span className="truncate">{displayName}</span>
                                {rm.tag && (
                                  <span
                                    className={cn(
                                      'shrink-0 rounded-full px-2 py-0.5 text-2xs font-medium',
                                      rm.tag.cls,
                                    )}
                                  >
                                    {tAdmin(`roleTag.${u.role}`, { default: rm.tag.label })}
                                  </span>
                                )}
                              </button>
                              <p className="truncate text-xs font-normal text-muted-foreground">
                                {u.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <StatusPill label={roleLabel(u.role)} tone={roleTone(u.role)} />
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-medium text-foreground">
                            {tAdmin(`roleDept.${u.role}.title`, { default: rm.deptTitle })}
                          </p>
                          <p className="text-2xs text-muted-foreground">
                            {tAdmin(`roleDept.${u.role}.sub`, { default: rm.deptSub })}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <StatusPill
                            label={statusLabel(u.accountStatus)}
                            tone={statusTone(u.accountStatus)}
                            pulse={u.accountStatus === 'active'}
                          />
                        </td>
                        <td className="px-4 py-4">
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
                            <ShieldCheck
                              className={cn(
                                'size-3.5',
                                u.accountStatus === 'active' ? 'text-success' : 'text-muted-foreground',
                              )}
                            />
                            {u.accountStatus === 'suspended'
                              ? tAdmin('status.suspended', { default: 'Suspended' })
                              : u.accountStatus.startsWith('pending')
                                ? tAdmin('access.inviteSent', { default: 'Invite Sent' })
                                : tAdmin(`roleSecurity.${u.role}`, { default: rm.securityLabel })}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-xs text-muted-foreground">
                          {timeAgo(u.createdAt, tCommon, locale)}
                        </td>
                        <td className="py-4 pe-6 ps-4 text-end">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => push({ focus: u.id })}
                              aria-label={tAdmin('access.editPermissions', { default: 'Edit Permissions' })}
                              title={tAdmin('access.editPermissions', { default: 'Edit Permissions' })}
                              className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            >
                              <Pencil className="size-4" />
                            </button>
                          </div>
                        </td>
                      </m.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-border/70 sm:hidden">
              {rows.map((u) => {
                const displayName = u.name || u.email.split('@')[0];
                const rm = roleMeta[u.role] ?? roleMeta.admin!;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => push({ focus: u.id })}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-start transition active:bg-muted/60"
                  >
                    <Avatar name={u.name} email={u.email} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {displayName}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">{u.email}</span>
                      <span className="mt-2 flex flex-wrap items-center gap-1.5">
                        <StatusPill label={roleLabel(u.role)} tone={roleTone(u.role)} />
                        <StatusPill
                          label={statusLabel(u.accountStatus)}
                          tone={statusTone(u.accountStatus)}
                          pulse={u.accountStatus === 'active'}
                        />
                      </span>
                      <span className="mt-1.5 block truncate text-2xs text-muted-foreground">
                        {tAdmin(`roleDept.${u.role}.title`, { default: rm.deptTitle })}
                      </span>
                    </span>
                    <Pencil className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                );
              })}
            </div>
          </Reveal>
        ) : (
          <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((u, cardIndex) => {
              const active = focusId === u.id;
              const displayName = u.name || u.email.split('@')[0];
              const rm = roleMeta[u.role] ?? roleMeta.admin!;
              return (
                <StaggerItem key={u.id} index={cardIndex} className="h-full">
                <button
                  type="button"
                  onClick={() => push({ focus: u.id })}
                  className={cn(
                    'card-hover group flex h-full w-full flex-col rounded-xl border border-border/70 bg-card p-6 text-start shadow-xs hover:border-border-strong hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    active && 'border-primary/40 ring-2 ring-primary/15',
                  )}
                >
                  <span className="flex items-start gap-4">
                    <Avatar name={u.name} email={u.email} size="lg" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-lg font-medium leading-snug tracking-[-0.015em] text-foreground">
                        {displayName}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">{u.email}</span>
                      <span className="mt-1.5 block truncate text-2xs text-muted-foreground">
                        {tAdmin(`roleDept.${u.role}.title`, { default: rm.deptTitle })}
                      </span>
                    </span>
                  </span>
                  <span className="mt-4 flex flex-wrap items-center gap-2">
                    <StatusPill label={roleLabel(u.role)} tone={roleTone(u.role)} />
                    <StatusPill
                      label={statusLabel(u.accountStatus)}
                      tone={statusTone(u.accountStatus)}
                      pulse={u.accountStatus === 'active'}
                    />
                    <span className="ms-auto text-2xs text-muted-foreground">
                      {tAdmin('access.joined', { default: 'Joined' })}{' '}
                      {formatDate(u.createdAt, locale, {
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </span>
                </button>
                </StaggerItem>
              );
            })}
          </Stagger>
        )}

        {!loading && rows && rows.length > 0 && (
          <div className="rounded-xl border border-border/70 bg-card px-4 py-3 shadow-xs sm:px-5">
            <Pagination
              page={page}
              totalPages={pages}
              total={total}
              onPrev={() => push({ page: String(page - 1) })}
              onNext={() => push({ page: String(page + 1) })}
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-3 text-xs text-muted-foreground">
              <span>
                {tAdmin('access.showingOf', {
                  from,
                  to,
                  total,
                  default: 'Showing {from}–{to} of {total} members',
                })}
                {selected.size > 0 && (
                  <span className="ms-2 font-medium text-primary">
                    {tAdmin('access.selectedCount', {
                      count: selected.size,
                      default: '· {count} selected',
                    })}
                  </span>
                )}
              </span>
              <label className="flex items-center gap-1.5">
                <span>{tAdmin('access.rowsPerPage', { default: 'Rows per page:' })}</span>
                <select
                  value={String(limit)}
                  aria-label={tAdmin('access.rowsPerPage', { default: 'Rows per page:' })}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    const next = new URLSearchParams(params.toString());
                    next.delete('page');
                    router.replace(`/admin/staff?${next.toString()}`);
                  }}
                  className="cursor-pointer rounded-lg border border-border/70 bg-background px-2 py-1 font-medium text-foreground outline-none transition hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="10">10</option>
                  <option value="12">12</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                </select>
              </label>
            </div>
          </div>
        )}

        {/* Audit footnote */}
        <div className="flex flex-col items-center justify-between gap-3 rounded-xl bg-muted/50 px-5 py-4 text-xs leading-relaxed text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <Lock className="size-4 shrink-0 text-primary" />
            <span>
              {tAdmin('access.auditFootnote', {
                default:
                  'Audit Trail: Every permission change is cryptographically signed and stored in Machining Telemetry Ledger.',
              })}
            </span>
          </div>
          <button
            type="button"
            onClick={() => router.push('/admin/staff/audit')}
            className="group inline-flex min-h-6 shrink-0 items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
          >
            {tAdmin('access.viewAuditLogs', { default: 'View Audit Logs' })}
            <ArrowRight className="flip-rtl size-3.5 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
          </button>
        </div>
      </div>

      <AnimatePresence>
      {focusId && (
        <StaffDrawer
          key={focusId}
          userId={focusId}
          onClose={() => push({ focus: null })}
          onChanged={(msg) => {
            toast({ type: 'ok', title: msg });
            void load(true);
            void loadRoleTotals();
          }}
        />
      )}
      </AnimatePresence>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-full bg-primary/10 text-primary">
                <UserPlus className="size-4" />
              </span>
              {tAdmin('access.inviteStaffMember', { default: 'Invite staff member' })}
            </DialogTitle>
            <DialogDescription>
              {tAdmin('access.inviteStaffHint', {
                default: 'Creates a pending account in this tenant. Requires super_admin.',
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-foreground">
                {tAdmin('access.emailRequired', { default: 'Email *' })}
              </span>
              <input
                autoFocus
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="teammate@example.com"
                className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none transition hover:border-border-strong focus:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring/30"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-foreground">
                {tAdmin('access.name', { default: 'Name' })}
              </span>
              <input
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder={tAdmin('access.optionalDisplayName', {
                  default: 'Optional display name',
                })}
                className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none transition hover:border-border-strong focus:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring/30"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-foreground">
                {tAdmin('drawer.role', { default: 'Role' })}
              </span>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as RoleKey)}
                className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none transition hover:border-border-strong focus:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring/30"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {roleLabel(r)} ({r})
                  </option>
                ))}
              </select>
            </label>
          </DialogBody>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setInviteOpen(false)}
              disabled={inviting}
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-xs transition hover:border-border-strong hover:bg-muted/60 active:scale-[0.98] disabled:opacity-50"
            >
              {tCommon('cancel')}
            </button>
            <button
              type="button"
              onClick={() => void sendInvite()}
              disabled={inviting}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs transition hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50"
            >
              {inviting
                ? tAdmin('access.inviting', { default: 'Inviting…' })
                : tAdmin('access.sendInvite', { default: 'Send invite' })}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** The sliding "selected" surface behind the active role filter. */
function RoleFilterPill() {
  return (
    <m.span
      layoutId="staff-role-filter"
      transition={spring.smooth}
      className="absolute inset-0 rounded-lg bg-card shadow-xs"
      aria-hidden="true"
    />
  );
}
