'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { GraduationCap, Shield, UserCheck, UserX, Eye, Calendar, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toast';
import {
  AdminCommandBar,
  BarIconButton,
  AdminKpiCard,
  AdminPageHeader,
} from '@/components/admin/admin-chrome';
import { LearnerDrawer } from './learner-drawer';
import type { AdminUserRow } from './users-shared';
import { userInitials as initials } from './users-shared';
import { Toolbar, PillTabs, TableCard, Pagination, EmptyState } from '@/components/admin/admin-ui';
const PER_PAGE = 12;
const statusMeta: Record<string, { pill: string; dot: string; label: string }> = {
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
  if (diff < 60_000) return 'just now';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}
export default function AdminUsersPage() {
  const router = useRouter();
  const params = useSearchParams();
  const q = params.get('q') ?? '';
  const status = params.get('status') ?? '';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const focusId = params.get('focus');
  const [rows, setRows] = useState<AdminUserRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qInput, setQInput] = useState(q);
  const push = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === '') next.delete(k);
        else next.set(k, v);
      }
      if (!('page' in patch)) next.delete('page');
      router.replace(`/admin/users?${next.toString()}`);
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
      setError(null);
      try {
        const query = new URLSearchParams({ page: String(page), limit: String(PER_PAGE) });
        if (q) query.set('search', q);
        if (status) query.set('status', status);
        if (from) query.set('from', from);
        if (to) query.set('to', to);
        const res = await fetch(`/api/proxy/admin/users/learners?${query.toString()}`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json();
        setRows(Array.isArray(data?.items) ? data.items : []);
        setTotal(Number(data?.total ?? 0));
      } catch (e: any) {
        setError(e?.message || 'Failed to load');
        setRows(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, q, status, from, to],
  );
  useEffect(() => {
    load();
  }, [load]);
  const stats = useMemo(() => {
    const all = rows ?? [];
    return {
      total,
      active: all.filter((u) => u.accountStatus === 'active').length,
      suspended: all.filter((u) => u.accountStatus === 'suspended').length,
      pending: all.filter((u) => u.accountStatus === 'pending_verification').length,
    };
  }, [rows, total]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const hasFilters = Boolean(q || status || from || to);
  return (
    <div className="w-full">
      <AdminCommandBar
        trail={[{ label: 'Titans of CNC' }, { label: 'Learners' }]}
        count={loading ? null : total}
        live="Live"
        search={{
          value: qInput,
          onChange: setQInput,
          placeholder: 'Search by name or email…',
          ariaLabel: 'Search learners',
        }}
        actions={
          <BarIconButton
            title="Refresh learners"
            spinning={loading || refreshing}
            onClick={() => load(true)}
          >
            <RefreshCw className="h-4 w-4" />
          </BarIconButton>
        }
      />

      <div className="mx-auto w-full max-w-[1500px] space-y-6 pt-6">
        <AdminPageHeader
          title="Learners"
          description="Every student on your platform — progress, certificates and account health in one place."
          badge={
            <span className="flex items-center gap-2 self-start rounded-full border border-emerald-200/80 bg-emerald-50/80 px-3 py-1.5 text-xs font-medium text-emerald-800 shadow-sm md:self-auto dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200">
              <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Tenant-safe · Live status
            </span>
          }
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AdminKpiCard
            icon={GraduationCap}
            label="Total learners"
            value={loading ? '—' : String(total)}
            sub={`${rows?.length ?? 0} shown`}
            tone="blue"
          />
          <AdminKpiCard
            icon={UserCheck}
            label="Active"
            value={String(stats.active)}
            sub="In good standing"
            tone="emerald"
          />
          <AdminKpiCard
            icon={Calendar}
            label="Pending"
            value={String(stats.pending)}
            sub="Awaiting verification"
            tone="amber"
          />
          <AdminKpiCard
            icon={UserX}
            label="Suspended"
            value={String(stats.suspended)}
            sub="Needs review"
            tone="rose"
          />
        </div>
        {error && (
          <div className="flex items-center justify-between rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3">
            <span className="text-sm font-medium text-red-600 dark:text-red-400">{error}</span>
            <button
              onClick={() => load()}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        )}
        <Toolbar>
          <PillTabs
            value={status}
            onChange={(k) => push({ status: k || null })}
            options={[
              { key: '', label: 'All' },
              { key: 'active', label: 'Active' },
              { key: 'suspended', label: 'Suspended' },
              { key: 'pending_verification', label: 'Pending' },
              { key: 'deleted', label: 'Deleted' },
            ]}
          />{' '}
          <div className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-2 py-1">
            {' '}
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => push({ from: e.target.value || null })}
              aria-label="From date"
              className="bg-transparent text-xs outline-none [color-scheme:light] dark:[color-scheme:dark]"
            />{' '}
            <span className="text-xs text-muted-foreground">–</span>{' '}
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => push({ to: e.target.value || null })}
              aria-label="To date"
              className="bg-transparent text-xs outline-none [color-scheme:light] dark:[color-scheme:dark]"
            />{' '}
          </div>{' '}
          <div className="ml-auto flex items-center gap-2">
            {hasFilters && (
              <button
                onClick={() => {
                  setQInput('');
                  router.replace('/admin/users');
                }}
                className="h-9 rounded-xl bg-blue-600 px-3.5 text-xs font-bold text-white shadow-sm shadow-blue-600/25 transition hover:bg-blue-700 active:scale-[0.98]"
              >
                Clear
              </button>
            )}
          </div>
        </Toolbar>
        {loading ? (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="border-b border-border bg-muted/40 px-6 py-3.5">
              <div className="h-3 w-48 animate-pulse rounded bg-muted" />
            </div>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="flex items-center gap-4 border-b border-border px-6 py-4 last:border-0"
              >
                <div className="h-10 w-10 animate-pulse rounded-xl bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-1/3 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-1/4 animate-pulse rounded bg-muted/60" />
                </div>
                <div className="hidden h-6 w-20 animate-pulse rounded-full bg-muted sm:block" />
              </div>
            ))}
          </div>
        ) : !rows || rows.length === 0 ? (
          <TableCard>
            {' '}
            <EmptyState
              icon={GraduationCap}
              title={hasFilters ? 'No learners match your filters' : 'No learners yet'}
              body={
                hasFilters
                  ? 'Try adjusting your search, status or date range.'
                  : 'Learners will appear here once they sign up and enroll.'
              }
              action={
                hasFilters ? (
                  <button
                    onClick={() => {
                      setQInput('');
                      router.replace('/admin/users');
                    }}
                    className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold shadow-sm hover:bg-muted"
                  >
                    Clear filters
                  </button>
                ) : undefined
              }
            />{' '}
          </TableCard>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="px-6 py-3.5 font-semibold">Learner</th>
                    <th className="px-4 py-3.5 font-semibold">Status</th>
                    <th className="px-4 py-3.5 font-semibold">Member since</th>
                    <th className="py-3.5 pl-4 pr-6 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-[13px]">
                  {rows.map((u) => {
                    const st = statusMeta[u.accountStatus] ?? statusMeta.active!;
                    const selected = focusId === u.id;
                    return (
                      <tr
                        key={u.id}
                        onClick={() => push({ focus: u.id })}
                        className={cn(
                          'group cursor-pointer transition-colors duration-150 hover:bg-muted/50',
                          selected && 'bg-blue-500/[0.04]',
                        )}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3.5">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-foreground text-xs font-semibold text-background">
                              {initials(u.name, u.email)}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-foreground transition group-hover:text-blue-600">
                                {u.name || u.email.split('@')[0]}
                              </p>
                              <p className="truncate text-xs font-normal text-muted-foreground">
                                {u.email}
                              </p>
                            </div>
                          </div>
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
                          <p className="font-medium text-foreground">
                            {new Date(u.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {timeAgo(u.createdAt)}
                          </p>
                        </td>
                        <td className="py-4 pl-4 pr-6 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              push({ focus: u.id });
                            }}
                            title="Open learner profile"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-transparent px-2.5 py-1.5 text-xs font-semibold text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:border-border hover:bg-background hover:text-foreground focus-visible:opacity-100"
                          >
                            <Eye className="h-3.5 w-3.5" /> View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!loading && rows && rows.length > 0 && (
              <div className="flex flex-col items-center justify-between gap-3 border-t border-border bg-muted/40 px-6 py-3.5 text-xs font-medium text-muted-foreground sm:flex-row">
                <span>
                  Showing{' '}
                  <strong className="font-semibold text-foreground">
                    {(page - 1) * PER_PAGE + 1}–{Math.min(total, page * PER_PAGE)}
                  </strong>{' '}
                  of <strong className="font-semibold text-foreground">{total}</strong> learners
                </span>
                <Pagination
                  page={page}
                  totalPages={pages}
                  total={total}
                  onPrev={() => push({ page: String(page - 1) })}
                  onNext={() => push({ page: String(page + 1) })}
                />
              </div>
            )}
          </div>
        )}
      </div>
      {focusId && (
        <LearnerDrawer
          userId={focusId}
          onClose={() => push({ focus: null })}
          onChanged={(msg) => {
            toast({ type: 'ok', title: msg });
            load(true);
          }}
        />
      )}
    </div>
  );
}
