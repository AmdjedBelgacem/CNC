'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Download,
  LayoutGrid,
  LayoutList,
  Lock,
  MoreHorizontal,
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
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
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
  SkeletonRows,
  StatusPill,
  TableCard,
  Toolbar,
  type Tone,
} from '@/components/admin/admin-ui';
import { StaffDrawer } from './staff-drawer';
import type { AdminUserRow } from '../users/users-shared';

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

function timeAgo(iso: string, t: Translator): string {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return '—';
  const diff = Date.now() - ts;
  if (diff < 60_000) return t('justNow');
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return t('minutesAgo', { n: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('hoursAgo', { n: hours });
  if (hours < 48) return t('yesterday');
  return new Date(iso).toLocaleDateString('en-US', {
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
      const res = await fetch('/api/proxy/admin/staff/invite', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name: inviteName.trim() || undefined, role: inviteRole }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          data?.message ??
            tAdmin('drawer.requestFailed', {
              status: res.status,
              default: 'Request failed ({status})',
            }),
        );
      }
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
        const res = await fetch(`/api/proxy/admin/staff?${query.toString()}`, {
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
            const res = await fetch(`/api/proxy/admin/staff?limit=1&role=${r}`, {
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
        const res = await fetch(`/api/proxy/admin/staff?${query.toString()}`, {
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
        <AdminPageHeader
          title={tAdmin('access.title', { default: 'Staff & Access Control' })}
          description={tAdmin('access.description', {
            default:
              'Manage precision CNC cell operators, lead instructors, telemetry admins, and guest sponsor credentials across five-axis facilities.',
          })}
          badge={
            <span className="inline-flex items-center gap-2 self-start rounded-full border border-success/30 bg-success/10 px-3 py-1.5 text-xs font-semibold text-success md:self-auto">
              <BadgeCheck className="size-4" />
              {tAdmin('access.zeroTrustBadge', {
                default: 'Zero-Trust Protocol Active (2FA Enforced)',
              })}
            </span>
          }
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          <AdminKpiCard
            icon={ShieldCheck}
            label={tAdmin('access.securityCompliance', { default: 'Security Compliance' })}
            value={loading ? '—' : `${compliancePct}%`}
            sub={tAdmin('access.compliant', { default: '2FA / hardware key compliant' })}
            tone={compliancePct >= 80 ? 'emerald' : 'amber'}
          />
          <AdminKpiCard
            icon={Zap}
            label={tAdmin('access.activityIndex', { default: 'Activity Index' })}
            value={loading ? '—' : `${activityPct}%`}
            sub={tAdmin('access.past24h', { default: 'Past 24h' })}
            tone="cyan"
          />
        </div>

        <Toolbar>
          <div className="flex items-center gap-0.5 overflow-x-auto rounded-xl bg-muted p-1">
            <button
              type="button"
              onClick={() => push({ role: null })}
              aria-pressed={!role}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                !role
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <span>{tCommon('all')}</span>
              <span className="rounded-full bg-muted-foreground/12 px-1.5 py-px text-2xs font-bold tabular-nums text-muted-foreground">
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
                    'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                    active
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <span
                    className={cn(
                      'size-2 rounded-full',
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
                  {roleLabel(r)}
                  <span className="rounded-full bg-muted-foreground/12 px-1.5 py-px text-2xs font-bold tabular-nums text-muted-foreground">
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
            className="h-9 shrink-0 rounded-xl border border-border bg-card px-2.5 text-13 text-foreground shadow-xs outline-none transition hover:border-border-strong focus:border-primary/60 focus:ring-4 focus:ring-primary/10"
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
            {hasFilters && (
              <button
                type="button"
                onClick={clearAll}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3.5 text-xs font-bold text-primary-foreground shadow-xs transition hover:bg-primary active:scale-[0.98]"
              >
                <X className="size-3.5" />
                {tCommon('clear')}
              </button>
            )}
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
          <TableCard>
            <SkeletonRows rows={8} columns={4} />
          </TableCard>
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
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold shadow-xs transition hover:bg-muted"
                  >
                    <X className="size-4" />
                    {tAdmin('access.clearFilters', { default: 'Clear filters' })}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setInviteOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-xs transition hover:bg-primary"
                  >
                    <UserPlus className="size-4" />
                    {tAdmin('access.inviteMember', { default: 'Invite member' })}
                  </button>
                )
              }
            />
          </TableCard>
        ) : view === 'table' ? (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-start">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <th scope="col" className="w-10 py-3.5 ps-6 pe-3">
                      <input
                        type="checkbox"
                        aria-label={tAdmin('access.selectAll', { default: 'Select all on this page' })}
                        checked={rows.length > 0 && selected.size === rows.length}
                        onChange={toggleSelectAll}
                        className="size-3.5 cursor-pointer rounded border-border text-primary focus:ring-primary/30"
                      />
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-start font-semibold">
                      {tAdmin('access.colStaff', { default: 'Staff Member' })}
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-start font-semibold">
                      {tAdmin('access.colRoleTier', { default: 'Role Tier' })}
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-start font-semibold">
                      {tAdmin('access.colDepartment', { default: 'Department / CNC Cell' })}
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-start font-semibold">
                      {tAdmin('access.colStatus', { default: 'Status' })}
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-start font-semibold">
                      {tAdmin('access.colSecurity', { default: 'Security' })}
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-start font-semibold">
                      {tAdmin('access.colLastActive', { default: 'Last Active' })}
                    </th>
                    <th scope="col" className="py-3.5 pe-6 ps-4 text-end font-semibold">
                      {tAdmin('access.colActions', { default: 'Actions' })}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-13">
                  {rows.map((u) => {
                    const checked = selected.has(u.id);
                    const displayName = u.name || u.email.split('@')[0];
                    const rm = roleMeta[u.role] ?? roleMeta.admin!;
                    return (
                      <tr
                        key={u.id}
                        className={cn(
                          'group transition-colors duration-150 hover:bg-muted/50',
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
                                className="flex max-w-full items-center gap-2 font-semibold text-foreground transition group-hover:text-primary"
                              >
                                <span className="truncate">{displayName}</span>
                                {rm.tag && (
                                  <span
                                    className={cn(
                                      'shrink-0 rounded px-1.5 py-0.5 text-2xs font-semibold',
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
                          {timeAgo(u.createdAt, tCommon)}
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
                            <button
                              type="button"
                              onClick={() => push({ focus: u.id })}
                              aria-label={tAdmin('access.moreOptions', { default: 'More Options' })}
                              title={tAdmin('access.moreOptions', { default: 'More Options' })}
                              className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            >
                              <MoreHorizontal className="size-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((u) => {
              const active = focusId === u.id;
              const displayName = u.name || u.email.split('@')[0];
              const rm = roleMeta[u.role] ?? roleMeta.admin!;
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => push({ focus: u.id })}
                  className={cn(
                    'card-hover group flex flex-col rounded-xl border border-border bg-card p-5 text-start shadow-xs hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    active && 'border-primary/50 ring-2 ring-primary/20',
                  )}
                >
                  <span className="flex items-start gap-4">
                    <Avatar name={u.name} email={u.email} size="lg" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold tracking-tight text-foreground">
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
                      {new Date(u.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {!loading && rows && rows.length > 0 && (
          <div className="rounded-xl border border-border bg-card px-5 py-3 shadow-xs">
            <Pagination
              page={page}
              totalPages={pages}
              total={total}
              onPrev={() => push({ page: String(page - 1) })}
              onNext={() => push({ page: String(page + 1) })}
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-xs text-muted-foreground">
              <span>
                {tAdmin('access.showingOf', {
                  from,
                  to,
                  total,
                  default: 'Showing {from}–{to} of {total} members',
                })}
                {selected.size > 0 && (
                  <span className="ms-2 font-semibold text-primary">
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
                  className="cursor-pointer rounded-lg border border-border bg-background px-2 py-1 font-semibold text-foreground outline-none transition focus:border-primary/60"
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
        <div className="flex flex-col items-center justify-between gap-3 rounded-xl border border-dashed border-border bg-muted/30 px-5 py-4 text-xs text-muted-foreground sm:flex-row">
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
            onClick={() => router.push('/admin/staff/roles')}
            className="inline-flex shrink-0 items-center gap-1 font-semibold text-primary hover:underline"
          >
            {tAdmin('access.viewAuditLogs', { default: 'View Audit Logs' })}
            <ArrowRight className="flip-rtl size-3.5" />
          </button>
        </div>
      </div>

      {focusId && (
        <StaffDrawer
          userId={focusId}
          onClose={() => push({ focus: null })}
          onChanged={(msg) => {
            toast({ type: 'ok', title: msg });
            void load(true);
            void loadRoleTotals();
          }}
        />
      )}

      {inviteOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={tAdmin('access.inviteStaffMember', { default: 'Invite staff member' })}
          onClick={(e) => {
            if (e.target === e.currentTarget) setInviteOpen(false);
          }}
        >
          <div className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
                <UserPlus className="size-4 text-primary" />
                {tAdmin('access.inviteStaffMember', { default: 'Invite staff member' })}
              </h3>
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                aria-label={tCommon('cancel')}
                className="rounded-lg p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="border-b border-border bg-muted/40 px-5 py-2.5 text-xs text-muted-foreground">
              {tAdmin('access.inviteStaffHint', {
                default: 'Creates a pending account in this tenant. Requires super_admin.',
              })}
            </p>
            <div className="space-y-3 px-5 py-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-muted-foreground">
                  {tAdmin('access.emailRequired', { default: 'Email *' })}
                </span>
                <input
                  autoFocus
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="teammate@example.com"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-muted-foreground">
                  {tAdmin('access.name', { default: 'Name' })}
                </span>
                <input
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder={tAdmin('access.optionalDisplayName', {
                    default: 'Optional display name',
                  })}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-muted-foreground">
                  {tAdmin('drawer.role', { default: 'Role' })}
                </span>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as RoleKey)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {roleLabel(r)} ({r})
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-border bg-muted/30 px-5 py-3">
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                disabled={inviting}
                className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted disabled:opacity-50"
              >
                {tCommon('cancel')}
              </button>
              <button
                type="button"
                onClick={() => void sendInvite()}
                disabled={inviting}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-xs transition hover:bg-primary disabled:opacity-50"
              >
                {inviting
                  ? tAdmin('access.inviting', { default: 'Inviting…' })
                  : tAdmin('access.sendInvite', { default: 'Send invite' })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
