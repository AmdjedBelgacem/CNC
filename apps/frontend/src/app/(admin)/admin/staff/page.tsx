'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Plus, RefreshCw, ShieldCheck } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toast';
import {
  AdminCommandBar,
  BarButton,
  BarIconButton,
  BarPrimaryButton,
} from '@/components/admin/admin-chrome';
import { StaffDrawer } from './staff-drawer';
import type { AdminUserRow } from '../users/users-shared';
import { userInitials as initials } from '../users/users-shared';

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
    grad: 'bg-gradient-to-br from-purple-600 via-fuchsia-600 to-pink-600 shadow-purple-500/20',
    dot: 'bg-purple-500',
    ring: 'ring-purple-200',
    pill: 'bg-purple-50 text-purple-700 border-purple-200/80',
    pillDot: 'bg-purple-600',
    deptTitle: 'Executive Operations',
    deptSub: 'Full Global Tenant Access',
    securityLabel: 'Root Key + TOTP',
    securityIcon: 'security',
    securityIconClass: 'text-purple-600',
    tag: { label: 'Root', cls: 'bg-purple-100 text-purple-800' },
  },
  admin: {
    label: 'Admin',
    short: 'Admin',
    grad: 'bg-gradient-to-br from-blue-600 to-indigo-700 shadow-blue-500/20',
    dot: 'bg-blue-500',
    ring: 'ring-blue-200',
    pill: 'bg-blue-50 text-blue-700 border-blue-200/80',
    pillDot: 'bg-blue-600',
    deptTitle: 'Infrastructure & Telemetry',
    deptSub: 'Shop Floor Edge Node',
    securityLabel: 'FIDO2 / 2FA',
    securityIcon: 'verified',
    securityIconClass: 'text-emerald-600',
  },
  instructor: {
    label: 'Master Instructor',
    short: 'Instructor',
    grad: 'bg-gradient-to-br from-emerald-500 to-green-600 shadow-emerald-500/20',
    dot: 'bg-emerald-500',
    ring: 'ring-emerald-200',
    pill: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    pillDot: 'bg-emerald-600',
    deptTitle: '5-Axis Milling Masterclass',
    deptSub: 'Matsuura & Hermle Academy',
    securityLabel: 'Hardware Key',
    securityIcon: 'verified',
    securityIconClass: 'text-emerald-600',
    tag: { label: 'Master Mach.', cls: 'bg-emerald-100 text-emerald-800' },
  },
  moderator: {
    label: 'Moderator',
    short: 'Moderator',
    grad: 'bg-gradient-to-br from-teal-500 to-cyan-600 shadow-cyan-500/20',
    dot: 'bg-cyan-500',
    ring: 'ring-cyan-200',
    pill: 'bg-cyan-50 text-cyan-700 border-cyan-200/80',
    pillDot: 'bg-cyan-600',
    deptTitle: 'Shop Safety & QA',
    deptSub: 'Quality Inspection Room',
    securityLabel: 'Hardware Key',
    securityIcon: 'verified',
    securityIconClass: 'text-emerald-600',
  },
  sponsor: {
    label: 'Sponsor Partner',
    short: 'Sponsor',
    grad: 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-orange-500/20',
    dot: 'bg-amber-500',
    ring: 'ring-amber-200',
    pill: 'bg-amber-50 text-amber-700 border-amber-200/80',
    pillDot: 'bg-amber-600',
    deptTitle: 'Industrial Grant Cell',
    deptSub: 'External Audit Access',
    securityLabel: 'SSO Bound',
    securityIcon: 'verified',
    securityIconClass: 'text-emerald-600',
    tag: { label: 'Partner', cls: 'bg-amber-100 text-amber-800' },
  },
};

const statusStyle: Record<string, { pill: string; dot: string; label: string }> = {
  active: {
    pill: 'text-emerald-700 bg-emerald-50 border-emerald-200/70',
    dot: 'bg-emerald-500',
    label: 'Active',
  },
  suspended: {
    pill: 'text-red-700 bg-red-50 border-red-200/70',
    dot: 'bg-red-500',
    label: 'Suspended',
  },
  pending_verification: {
    pill: 'text-amber-700 bg-amber-50 border-amber-200/70',
    dot: 'bg-amber-500',
    label: 'Pending',
  },
  pending: {
    pill: 'text-amber-700 bg-amber-50 border-amber-200/70',
    dot: 'bg-amber-500',
    label: 'Pending',
  },
  deleted: {
    pill: 'text-muted-foreground bg-muted border-border',
    dot: 'bg-muted-foreground',
    label: 'Deleted',
  },
};

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const diff = Date.now() - t;
  if (diff < 60_000) return 'Just now';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  if (hours < 48) return 'Yesterday';
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
  const q = params.get('q') ?? '';
  const role = params.get('role') ?? '';
  const status = params.get('status') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const focusId = params.get('focus');

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
      toast({ type: 'err', title: 'Enter a valid email' });
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
      if (!res.ok) throw new Error(data?.message ?? `Request failed (${res.status})`);
      toast({ type: 'ok', title: `Invited ${email} as ${inviteRole}` });
      setInviteOpen(false);
      setInviteEmail('');
      setInviteName('');
      load(true);
      loadRoleTotals();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Invite failed';
      toast({ type: 'err', title: 'Invite failed', description: msg });
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
        toast({ type: 'err', title: 'Nothing to export' });
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
      toast({ type: 'ok', title: `Exported ${data.length} members` });
    } catch {
      toast({ type: 'err', title: 'Export failed' });
    } finally {
      setExporting(false);
    }
  };

  const compliancePct = total > 0 && rows ? stats.compliance : rows?.length ? stats.compliance : 0;
  const activityPct = rows && rows.length > 0 ? stats.activity : 0;

  return (
    <div className="w-full">
      <style>{`
        .staff-scope { background-color: transparent; font-feature-settings: "cv02", "cv03", "cv04", "cv11"; }
        .staff-liquid-panel { background: rgba(255,255,255,0.78); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.85); box-shadow: 0 1px 3px rgba(0,0,0,0.02), 0 10px 28px -6px rgba(15,23,42,0.04), inset 0 1px 0 rgba(255,255,255,0.95); }
        .dark .staff-liquid-panel { background: rgba(29,29,31,0.78); border-color: rgba(56,56,58,0.85); box-shadow: 0 10px 28px -6px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06); }
        .staff-liquid-soft { background: rgba(255,255,255,0.58); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); border: 1px solid rgba(255,255,255,0.65); box-shadow: 0 4px 16px -2px rgba(15,23,42,0.03); }
        .dark .staff-liquid-soft { background: rgba(29,29,31,0.6); border-color: rgba(56,56,58,0.7); }
        .staff-liquid-button { background: rgba(255,255,255,0.75); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(226,232,240,0.8); box-shadow: 0 1px 2px rgba(0,0,0,0.03); transition: all 0.2s cubic-bezier(0.16,1,0.3,1); }
        .dark .staff-liquid-button { background: rgba(44,44,46,0.75); border-color: rgba(56,56,58,0.8); }
        .staff-liquid-button:hover { background: rgba(255,255,255,0.95); border-color: rgba(203,213,225,0.9); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        .dark .staff-liquid-button:hover { background: rgba(56,56,58,0.95); }
        .staff-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
        .staff-scroll::-webkit-scrollbar-track { background: transparent; }
        .staff-scroll::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.3); border-radius: 9999px; }
      `}</style>

      <AdminCommandBar
        trail={[{ label: 'Titans of CNC' }, { label: 'Staff & Access' }]}
        count={loading ? null : total}
        live="Live"
        search={{
          value: qInput,
          onChange: setQInput,
          placeholder: 'Search staff by name or email…',
          ariaLabel: 'Search staff',
        }}
        actions={
          <>
            <BarIconButton
              title="Refresh staff list"
              spinning={refreshing}
              onClick={() => {
                load(true);
                loadRoleTotals();
              }}
            >
              <RefreshCw className="h-4 w-4" />
            </BarIconButton>
            <BarButton
              icon={<ShieldCheck className="h-4 w-4" />}
              onClick={() => router.push('/admin/staff/roles')}
            >
              Roles
            </BarButton>
            <BarButton
              icon={<Download className="h-4 w-4" />}
              disabled={exporting || loading || !rows || rows.length === 0}
              onClick={() => void exportCsv()}
            >
              {exporting ? 'Exporting…' : 'Export'}
            </BarButton>
          </>
        }
        primary={
          <BarPrimaryButton
            icon={<Plus className="h-4 w-4" strokeWidth={2.5} />}
            onClick={() => setInviteOpen(true)}
          >
            Invite member
          </BarPrimaryButton>
        }
      />

      <div className="staff-scope mx-auto w-full max-w-[1500px] space-y-6 pt-6">
        {/* Page title */}
        <div className="flex flex-col justify-between gap-4 pb-1 md:flex-row md:items-end">
          <div>
            <h1 className="font-headline-lg text-[32px] leading-tight tracking-tight text-foreground sm:text-[36px] dark:text-white">
              Staff &amp; Access Control
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm font-normal leading-relaxed text-muted-foreground dark:text-muted-foreground">
              Manage precision CNC cell operators, lead instructors, telemetry admins, and guest
              sponsor credentials across five-axis facilities.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start rounded-full border border-emerald-200/80 bg-emerald-50/80 px-3 py-1.5 text-xs font-medium text-emerald-800 shadow-sm md:self-auto dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200">
            <span className="material-symbols-outlined text-[16px] text-emerald-600 dark:text-emerald-400">
              verified_user
            </span>
            <span>Zero-Trust Protocol Active (2FA Enforced)</span>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="staff-liquid-panel group flex items-center justify-between rounded-2xl p-5 transition-all hover:border-blue-200/80">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Total Active Staff
              </p>
              <div className="mt-1.5 flex items-baseline gap-2">
                <h3 className="font-display text-2xl font-bold text-foreground dark:text-white">
                  {loading ? '—' : total}
                </h3>
                <span className="flex items-center text-xs font-medium text-emerald-600">
                  <span className="material-symbols-outlined text-[14px]">arrow_upward</span>
                  {total > 0 && rows
                    ? `${Math.round((stats.active / Math.max(1, rows.length)) * 100)}% active`
                    : 'capacity'}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Across {Math.max(1, stats.distinctRoles)} machine cells
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600 transition-transform group-hover:scale-110 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-300">
              <span className="material-symbols-outlined text-[22px]">badge</span>
            </div>
          </div>
          <div className="staff-liquid-panel group flex items-center justify-between rounded-2xl p-5 transition-all hover:border-purple-200/80">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Role Tiers
              </p>
              <div className="mt-1.5 flex items-baseline gap-2">
                <h3 className="font-display text-2xl font-bold text-foreground dark:text-white">
                  {loading ? '—' : `${ROLES.length} Roles`}
                </h3>
                <span className="text-xs font-medium text-purple-600">Configured</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">Super Admin, Admin, Instructor...</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-purple-100 bg-purple-50 text-purple-600 transition-transform group-hover:scale-110 dark:border-purple-900/40 dark:bg-purple-950/40 dark:text-purple-300">
              <span className="material-symbols-outlined text-[22px]">admin_panel_settings</span>
            </div>
          </div>
          <div className="staff-liquid-panel group flex items-center justify-between rounded-2xl p-5 transition-all hover:border-emerald-200/80">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Security Compliance
              </p>
              <div className="mt-1.5 flex items-baseline gap-2">
                <h3 className="font-display text-2xl font-bold text-foreground dark:text-white">
                  {loading || !rows || rows.length === 0
                    ? total === 0
                      ? '0%'
                      : '—'
                    : `${compliancePct}%`}
                </h3>
                <span className="text-xs font-medium text-emerald-600">Compliant</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {stats.active} of {rows?.length ?? 0} shown with hardware 2FA
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-600 transition-transform group-hover:scale-110 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300">
              <span className="material-symbols-outlined text-[22px]">shield_lock</span>
            </div>
          </div>
          <div className="staff-liquid-panel group flex items-center justify-between rounded-2xl p-5 transition-all hover:border-cyan-200/80">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Activity Index
              </p>
              <div className="mt-1.5 flex items-baseline gap-2">
                <h3 className="font-display text-2xl font-bold text-foreground dark:text-white">
                  {loading || !rows || rows.length === 0 ? '—' : `${activityPct}%`}
                </h3>
                <span className="text-xs font-medium text-cyan-600">Past 24h</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">All cell keys in rotation</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-100 bg-cyan-50 text-cyan-600 transition-transform group-hover:scale-110 dark:border-cyan-900/40 dark:bg-cyan-950/40 dark:text-cyan-300">
              <span className="material-symbols-outlined text-[22px]">bolt</span>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="staff-liquid-panel flex flex-col items-stretch justify-between gap-3 rounded-2xl p-2.5 xl:flex-row xl:items-center">
          <div className="staff-scroll flex items-center gap-1 overflow-x-auto rounded-xl border border-border/50 bg-muted/70 p-1">
            <button
              type="button"
              onClick={() => push({ role: null })}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs transition-all',
                !role
                  ? 'bg-card font-semibold text-foreground shadow-sm'
                  : 'font-medium text-muted-foreground hover:bg-white/60 hover:text-foreground dark:text-muted-foreground dark:hover:bg-white/10 dark:hover:text-white',
              )}
            >
              <span>All</span>
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-bold text-muted-foreground dark:text-muted-foreground">
                {total}
              </span>
            </button>
            {ROLES.map((r) => {
              const m = roleMeta[r]!;
              const active = role === r;
              const count = roleTotals[r] ?? 0;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => push({ role: active ? null : r })}
                  className={cn(
                    'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-all',
                    active
                      ? 'bg-card font-semibold text-foreground shadow-sm'
                      : 'font-medium text-muted-foreground hover:bg-white/60 hover:text-foreground dark:text-muted-foreground dark:hover:bg-white/10 dark:hover:text-white',
                  )}
                >
                  <span
                    className={cn('h-2 w-2 rounded-full', m.dot, m.ring && `ring-2 ${m.ring}`)}
                  />
                  <span>{m.short}</span>
                  <span className="text-[11px] text-muted-foreground">{count}</span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2.5 xl:flex-nowrap">
            <div className="relative flex-1 sm:w-64">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-muted-foreground">
                search
              </span>
              <input
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                placeholder="Filter by name, email, or cell..."
                className="w-full rounded-xl border border-border bg-white/90 py-1.5 pl-9 pr-3 text-xs transition placeholder:text-muted-foreground focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:text-white"
              />
            </div>
            <div className="relative">
              <select
                value={status}
                onChange={(e) => push({ status: e.target.value || null })}
                className="cursor-pointer appearance-none rounded-xl border border-border bg-white/90 py-1.5 pl-3 pr-8 text-xs font-medium text-foreground focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:text-slate-200"
              >
                <option value="">Status: All ({total})</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="pending_verification">Pending</option>
                <option value="deleted">Deleted</option>
              </select>
              <span className="material-symbols-outlined pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[16px] text-muted-foreground">
                expand_more
              </span>
            </div>
            <div className="flex items-center border border-border/60 bg-muted p-0.5 rounded-xl">
              <button
                type="button"
                onClick={() => setView('table')}
                title="Table View"
                className={cn(
                  'rounded-lg p-1',
                  view === 'table'
                    ? 'bg-card text-blue-600 shadow-sm'
                    : 'text-muted-foreground hover:text-foreground ',
                )}
              >
                <span className="material-symbols-outlined text-[18px]">view_list</span>
              </button>
              <button
                type="button"
                onClick={() => setView('grid')}
                title="Card Grid View"
                className={cn(
                  'rounded-lg p-1',
                  view === 'grid'
                    ? 'bg-card text-blue-600 shadow-sm'
                    : 'text-muted-foreground hover:text-foreground ',
                )}
              >
                <span className="material-symbols-outlined text-[18px]">grid_view</span>
              </button>
            </div>
          </div>
        </div>

        {/* Table / Grid container */}
        <div className="staff-liquid-panel overflow-hidden rounded-2xl border-white/80 shadow-lg shadow-slate-900/[0.03]">
          {loading ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground dark:text-muted-foreground">
                    <th className="w-10 py-3.5 pl-6 pr-3">—</th>
                    <th className="px-4 py-3.5 font-semibold">Staff Member</th>
                    <th className="px-4 py-3.5 font-semibold">Role Tier</th>
                    <th className="px-4 py-3.5 font-semibold">Department / CNC Cell</th>
                    <th className="px-4 py-3.5 font-semibold">Status</th>
                    <th className="px-4 py-3.5 font-semibold">Security</th>
                    <th className="px-4 py-3.5 font-semibold">Last Active</th>
                    <th className="py-3.5 pl-4 pr-6 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <tr key={i}>
                      <td colSpan={8} className="px-6 py-4">
                        <div className="flex items-center gap-3.5">
                          <div className="h-10 w-10 animate-pulse rounded-xl bg-muted" />
                          <div className="flex-1 space-y-2">
                            <div className="h-3.5 w-1/3 animate-pulse rounded bg-muted" />
                            <div className="h-3 w-1/4 animate-pulse rounded bg-muted /60" />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : !rows || rows.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground dark:text-muted-foreground">
                <span className="material-symbols-outlined text-[24px]">group</span>
              </div>
              <p className="mt-4 text-[15px] font-semibold text-foreground dark:text-white">
                {hasFilters ? 'No staff match your filters' : 'Invite your first team member'}
              </p>
              <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
                {hasFilters
                  ? 'Try adjusting your search or clearing the role / status filters.'
                  : 'Admins, instructors and moderators will appear here with their roles and status.'}
              </p>
              <div className="mt-4">
                {hasFilters ? (
                  <button
                    type="button"
                    onClick={() => {
                      setQInput('');
                      router.replace('/admin/staff');
                    }}
                    className="staff-liquid-button rounded-xl px-4 py-2 text-sm font-semibold text-foreground"
                  >
                    Clear filters
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setInviteOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700"
                  >
                    <span className="material-symbols-outlined text-[18px]">person_add</span>
                    Invite member
                  </button>
                )}
              </div>
            </div>
          ) : view === 'table' ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground dark:text-muted-foreground">
                    <th className="w-10 py-3.5 pl-6 pr-3">
                      <input
                        type="checkbox"
                        checked={rows.length > 0 && selected.size === rows.length}
                        onChange={toggleSelectAll}
                        className="cursor-pointer rounded border-border text-blue-600 focus:ring-blue-500/30 focus:ring-offset-0"
                      />
                    </th>
                    <th className="px-4 py-3.5 font-semibold">Staff Member</th>
                    <th className="px-4 py-3.5 font-semibold">Role Tier</th>
                    <th className="px-4 py-3.5 font-semibold">Department / CNC Cell</th>
                    <th className="px-4 py-3.5 font-semibold">Status</th>
                    <th className="px-4 py-3.5 font-semibold">Security</th>
                    <th className="px-4 py-3.5 font-semibold">Last Active</th>
                    <th className="py-3.5 pl-4 pr-6 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-[13px]">
                  {rows.map((u) => {
                    const rm = roleMeta[u.role] ?? roleMeta.admin!;
                    const st = statusStyle[u.accountStatus] ?? statusStyle.active!;
                    const checked = selected.has(u.id);
                    const displayName = u.name || u.email.split('@')[0];
                    return (
                      <tr
                        key={u.id}
                        className="group transition-colors duration-150 hover:bg-blue-50/40 dark:hover:bg-white/5"
                      >
                        <td className="py-4 pl-6 pr-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSelectOne(u.id)}
                            className="cursor-pointer rounded border-border text-blue-600 focus:ring-blue-500/30"
                          />
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3.5">
                            <button
                              type="button"
                              onClick={() => push({ focus: u.id })}
                              className={cn(
                                'flex h-10 w-10 items-center justify-center rounded-xl text-xs font-semibold text-white shadow-sm ring-2 ring-white dark:ring-[#38383A]',
                                rm.grad,
                              )}
                              title={displayName}
                            >
                              {initials(u.name, u.email)}
                            </button>
                            <div>
                              <button
                                type="button"
                                onClick={() => push({ focus: u.id })}
                                className="flex items-center gap-2 font-semibold text-foreground transition group-hover:text-blue-600 hover:text-blue-600 dark:text-white"
                              >
                                {displayName}
                                {rm.tag && (
                                  <span
                                    className={cn(
                                      'rounded px-1.5 py-0.5 text-[10px] font-medium',
                                      rm.tag.cls,
                                    )}
                                  >
                                    {rm.tag.label}
                                  </span>
                                )}
                              </button>
                              <div className="text-xs font-normal text-muted-foreground">{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
                              rm.pill,
                            )}
                          >
                            <span className={cn('h-1.5 w-1.5 rounded-full', rm.pillDot)} />
                            {rm.label}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-medium text-foreground dark:text-slate-200">
                            {rm.deptTitle}
                          </div>
                          <div className="text-[11px] text-muted-foreground">{rm.deptSub}</div>
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                              st.pill,
                            )}
                          >
                            <span
                              className={cn(
                                'h-1.5 w-1.5 rounded-full',
                                st.dot,
                                u.accountStatus === 'active' && 'animate-pulse',
                              )}
                            />
                            {st.label}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1 text-xs font-medium text-foreground dark:text-slate-200">
                            <span
                              className={cn(
                                'material-symbols-outlined text-[16px]',
                                rm.securityIconClass,
                              )}
                            >
                              {rm.securityIcon}
                            </span>
                            <span>
                              {u.accountStatus === 'suspended'
                                ? 'Suspended'
                                : u.accountStatus.startsWith('pending')
                                  ? 'Invite Sent'
                                  : rm.securityLabel}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-xs text-muted-foreground">
                          <span>{timeAgo(u.createdAt)}</span>
                        </td>
                        <td className="py-4 pl-4 pr-6 text-right">
                          <div className="flex items-center justify-end gap-1.5 opacity-80 transition-opacity group-hover:opacity-100">
                            <button
                              type="button"
                              onClick={() => push({ focus: u.id })}
                              className="rounded-lg p-1.5 text-muted-foreground shadow-xs transition hover:bg-white hover:text-blue-600"
                              title="Edit Permissions"
                            >
                              <span className="material-symbols-outlined text-[18px]">edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => push({ focus: u.id })}
                              className="rounded-lg p-1.5 text-muted-foreground shadow-xs transition hover:bg-white hover:text-foreground "
                              title="More Options"
                            >
                              <span className="material-symbols-outlined text-[18px]">
                                more_horiz
                              </span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((u) => {
                const rm = roleMeta[u.role] ?? roleMeta.admin!;
                const st = statusStyle[u.accountStatus] ?? statusStyle.active!;
                const active = focusId === u.id;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => push({ focus: u.id })}
                    className={cn(
                      'staff-liquid-soft group flex flex-col rounded-2xl border p-5 text-left transition duration-200 hover:-translate-y-0.5',
                      active
                        ? 'border-blue-500/50 ring-2 ring-blue-500/20'
                        : 'border-white/70 hover:border-blue-200/80',
                    )}
                  >
                    <span className="flex items-start gap-4">
                      <span
                        className={cn(
                          'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-semibold text-white shadow-sm',
                          rm.grad,
                        )}
                      >
                        {initials(u.name, u.email)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-bold tracking-tight text-foreground dark:text-white">
                          {u.name || u.email.split('@')[0]}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">{u.email}</span>
                      </span>
                      <span className="material-symbols-outlined h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100">
                        visibility
                      </span>
                    </span>
                    <span className="mt-4 flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold',
                          rm.pill,
                        )}
                      >
                        <span className={cn('h-1.5 w-1.5 rounded-full', rm.pillDot)} />
                        {rm.label}
                      </span>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize',
                          st.pill,
                        )}
                      >
                        {st.label}
                      </span>
                      <span className="ml-auto text-[11px] text-muted-foreground">
                        Joined{' '}
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

          {/* Footer / Pagination */}
          {!loading && rows && rows.length > 0 && (
            <div className="flex flex-col items-center justify-between gap-3 border-t border-border bg-muted/40 px-6 py-3.5 text-xs font-medium text-muted-foreground sm:flex-row /60 dark:text-muted-foreground">
              <div className="flex items-center gap-3">
                <span>
                  Showing{' '}
                  <strong className="font-semibold text-foreground dark:text-white">
                    {from}–{to}
                  </strong>{' '}
                  of{' '}
                  <strong className="font-semibold text-foreground dark:text-white">{total}</strong>{' '}
                  members
                  {selected.size > 0 && (
                    <span className="ml-2 text-blue-600">· {selected.size} selected</span>
                  )}
                </span>
                <span className="hidden text-muted-foreground sm:inline dark:text-muted-foreground">|</span>
                <div className="hidden items-center gap-1.5 text-muted-foreground sm:flex">
                  <span>Rows per page:</span>
                  <select
                    value={String(limit)}
                    onChange={(e) => {
                      setLimit(Number(e.target.value));
                      const next = new URLSearchParams(params.toString());
                      next.delete('page');
                      router.replace(`/admin/staff?${next.toString()}`);
                    }}
                    className="cursor-pointer bg-transparent font-semibold text-foreground focus:outline-none dark:text-slate-200"
                  >
                    <option value="10">10</option>
                    <option value="12">12</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => push({ page: String(page - 1) })}
                  className="flex items-center gap-1 rounded-lg border border-border bg-white/80 px-2.5 py-1 text-foreground disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-200"
                >
                  <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                  <span>Prev</span>
                </button>
                <span className="rounded-md border border-blue-100 bg-blue-50 px-3 py-1 font-semibold text-blue-600 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-300">
                  Page {page} of {pages}
                </span>
                <button
                  type="button"
                  disabled={page >= pages}
                  onClick={() => push({ page: String(page + 1) })}
                  className="flex items-center gap-1 rounded-lg border border-border bg-white/80 px-2.5 py-1 text-foreground disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-200"
                >
                  <span>Next</span>
                  <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footnote */}
        <div className="staff-liquid-soft flex flex-col items-center justify-between gap-3 rounded-xl p-4 text-xs text-muted-foreground sm:flex-row dark:text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-blue-600">lock_clock</span>
            <span>
              Audit Trail: Every permission change is cryptographically signed and stored in
              Machining Telemetry Ledger.
            </span>
          </div>
          <button
            type="button"
            onClick={() => router.push('/admin/staff/roles')}
            className="flex items-center gap-1 font-semibold text-blue-600 hover:underline"
          >
            View Audit Logs
            <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
          </button>
        </div>
      </div>

      {focusId && (
        <StaffDrawer
          userId={focusId}
          onClose={() => push({ focus: null })}
          onChanged={(msg) => {
            toast({ type: 'ok', title: msg });
            load(true);
            loadRoleTotals();
          }}
        />
      )}

      {inviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="staff-liquid-panel w-full max-w-md overflow-hidden rounded-2xl shadow-2xl">
            <div className="border-b border-border px-5 py-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-foreground dark:text-white">
                <span className="material-symbols-outlined text-[18px] text-blue-600">
                  person_add
                </span>
                Invite staff member
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Creates a pending account in this tenant. Requires super_admin.
              </p>
            </div>
            <div className="space-y-3 px-5 py-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-muted-foreground">Email *</span>
                <input
                  autoFocus
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="teammate@example.com"
                  className="w-full rounded-xl border border-border bg-white/90 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:text-white"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-muted-foreground">Name</span>
                <input
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Optional display name"
                  className="w-full rounded-xl border border-border bg-white/90 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:text-white"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-muted-foreground">Role</span>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as RoleKey)}
                  className="w-full rounded-xl border border-border bg-white/90 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:text-white"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {roleMeta[r]!.label} ({r})
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                disabled={inviting}
                className="staff-liquid-button rounded-lg px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50 dark:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void sendInvite()}
                disabled={inviting}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-500/30 disabled:opacity-50 hover:bg-blue-700"
              >
                {inviting ? 'Inviting…' : 'Send invite'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
