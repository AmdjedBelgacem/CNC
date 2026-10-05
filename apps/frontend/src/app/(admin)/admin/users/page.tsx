'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  CalendarDays,
  Eye,
  GraduationCap,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toast';
import {
  AdminCommandBar,
  AdminKpiCard,
  AdminPageHeader,
  BarIconButton,
} from '@/components/admin/admin-chrome';
import {
  Avatar,
  EmptyState,
  ErrorBanner,
  FilterChip,
  Pagination,
  PillTabs,
  SkeletonRows,
  StatusPill,
  TableCard,
  Toolbar,
  type Tone,
} from '@/components/admin/admin-ui';
import { LearnerDrawer } from './learner-drawer';
import type { AdminUserRow } from './users-shared';

const PER_PAGE = 12;

/* Status vocabulary shared by the table, the filter tabs and the KPI row so a
 * learner never appears as "Pending" in one place and "pending_verification" in
 * another. */
type StatusKey = 'active' | 'suspended' | 'pending_verification' | 'deleted';
const STATUS_TONE: Record<StatusKey, Tone> = {
  active: 'emerald',
  suspended: 'rose',
  pending_verification: 'amber',
  deleted: 'slate',
};
const STATUS_FALLBACK_LABEL: Record<StatusKey, string> = {
  active: 'Active',
  suspended: 'Suspended',
  pending_verification: 'Pending',
  deleted: 'Deleted',
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
  const days = Math.floor(hours / 24);
  if (days < 30) return t('daysAgo', { n: days });
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export default function AdminUsersPage() {
  const router = useRouter();
  const params = useSearchParams();
  const tAdmin = useTranslations('admin');
  const tCommon = useTranslations('common');
  const q = params.get('q') ?? '';
  const status = params.get('status') ?? '';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const focusId = params.get('focus');

  const [rows, setRows] = useState<AdminUserRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState<Record<string, number> | null>(null);
  const [facetTotal, setFacetTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qInput, setQInput] = useState(q);

  const tStatus = (key: string) => {
    const k = key as StatusKey;
    return tAdmin(`status.${k}`, { default: STATUS_FALLBACK_LABEL[k] ?? key });
  };

  const push = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === '') next.delete(k);
        else next.set(k, v);
      }
      // Any filter change invalidates the current page number.
      if (!('page' in patch)) next.delete('page');
      const qs = next.toString();
      router.replace(qs ? `/admin/users?${qs}` : '/admin/users');
    },
    [params, router],
  );

  // Debounced search: the URL is the source of truth, the input is just local UI.
  useEffect(() => {
    if (qInput === q) return;
    const timer = setTimeout(() => push({ q: qInput || null }), 300);
    return () => clearTimeout(timer);
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
        // Server-computed across the whole filtered set, not just this page.
        setFacets(data?.facets && typeof data.facets === 'object' ? data.facets : null);
        setFacetTotal(Number(data?.facetTotal ?? data?.total ?? 0));
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : tAdmin('drawer.failedToLoad', { default: 'Failed to load' }),
        );
        setRows(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [page, q, status, from, to],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const hasFilters = Boolean(q || status || from || to);
  const countOf = (key: StatusKey) => facets?.[key] ?? 0;

  const statusTabs = useMemo(
    () => [
      { key: '', label: tCommon('all'), count: facetTotal || undefined },
      { key: 'active', label: tStatus('active'), count: countOf('active') },
      { key: 'suspended', label: tStatus('suspended'), count: countOf('suspended') },
      {
        key: 'pending_verification',
        label: tStatus('pending_verification'),
        count: countOf('pending_verification'),
      },
      { key: 'deleted', label: tStatus('deleted'), count: countOf('deleted') },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [facets, facetTotal, tCommon],
  );

  const clearAll = useCallback(() => {
    setQInput('');
    router.replace('/admin/users');
  }, [router]);

  return (
    <div className="w-full">
      <AdminCommandBar
        trail={[{ label: 'Baroot CNC Solutions' }, { label: tAdmin('learners') }]}
        count={loading ? null : total}
        live={tAdmin('live', { default: 'Live' })}
        search={{
          value: qInput,
          onChange: setQInput,
          placeholder: tAdmin('learnerAccess.searchPlaceholder', {
            default: 'Search by name or email…',
          }),
          ariaLabel: tAdmin('learnerAccess.searchAriaLabel', { default: 'Search learners' }),
        }}
        actions={
          <BarIconButton
            title={tAdmin('learnerAccess.refreshLearners', { default: 'Refresh learners' })}
            spinning={loading || refreshing}
            onClick={() => load(true)}
          >
            <RefreshCw className="size-4" />
          </BarIconButton>
        }
      />

      <div className="mx-auto w-full max-w-[1500px] space-y-6 pt-6">
        <AdminPageHeader
          title={tAdmin('learners')}
          description={tAdmin('learnerAccess.description', {
            default:
              'Every student on your platform — progress, certificates and account health in one place.',
          })}
          badge={
            <span className="inline-flex items-center gap-2 self-start rounded-full border border-success/30 bg-success/10 px-3 py-1.5 text-xs font-semibold text-success md:self-auto">
              <ShieldCheck className="size-4" />
              {tAdmin('learnerAccess.tenantSafeBadge', { default: 'Tenant-safe · Live status' })}
            </span>
          }
        />

        {/* Headline numbers come from the server facets, so they reflect every
            matching learner rather than the twelve rows on screen. */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AdminKpiCard
            icon={GraduationCap}
            label={tAdmin('learnerAccess.totalLearners', { default: 'Total learners' })}
            value={loading ? '—' : String(facetTotal || total)}
            sub={tAdmin('learnerAccess.shownCount', {
              count: rows?.length ?? 0,
              default: '{count, plural, one {# shown} other {# shown}}',
            })}
            tone="blue"
          />
          <AdminKpiCard
            icon={UserCheck}
            label={tStatus('active')}
            value={loading ? '—' : String(countOf('active'))}
            sub={tAdmin('learnerAccess.inGoodStanding', { default: 'In good standing' })}
            tone="emerald"
          />
          <AdminKpiCard
            icon={CalendarDays}
            label={tStatus('pending_verification')}
            value={loading ? '—' : String(countOf('pending_verification'))}
            sub={tAdmin('learnerAccess.awaitingVerification', { default: 'Awaiting verification' })}
            tone="amber"
          />
          <AdminKpiCard
            icon={UserX}
            label={tStatus('suspended')}
            value={loading ? '—' : String(countOf('suspended'))}
            sub={tAdmin('learnerAccess.needsReview', { default: 'Needs review' })}
            tone="rose"
          />
        </div>

        {error && (
          <ErrorBanner
            message={error}
            onRetry={() => load()}
            retryLabel={tCommon('retry')}
          />
        )}

        <Toolbar>
          <PillTabs value={status} onChange={(k) => push({ status: k || null })} options={statusTabs} />

          <div className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 py-1 shadow-xs">
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => push({ from: e.target.value || null })}
              aria-label={tAdmin('learnerAccess.fromDate', { default: 'From date' })}
              className="bg-transparent text-xs outline-none [color-scheme:light] dark:[color-scheme:dark]"
            />
            <span className="text-xs text-muted-foreground" aria-hidden="true">
              –
            </span>
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => push({ to: e.target.value || null })}
              aria-label={tAdmin('learnerAccess.toDate', { default: 'To date' })}
              className="bg-transparent text-xs outline-none [color-scheme:light] dark:[color-scheme:dark]"
            />
          </div>

          {/* Show what is actually filtering, with a one-click way to undo it. */}
          <div className="ms-auto flex flex-wrap items-center justify-end gap-1.5">
            {q && (
              <FilterChip
                label={tAdmin('learnerAccess.filterSearch', { q, default: 'Search: {q}' })}
                onClear={() => {
                  setQInput('');
                  push({ q: null });
                }}
              />
            )}
            {status && (
              <FilterChip
                tone={STATUS_TONE[status as StatusKey] ?? 'blue'}
                label={tStatus(status)}
                onClear={() => push({ status: null })}
              />
            )}
            {(from || to) && (
              <FilterChip
                tone="cyan"
                label={`${from || '…'} → ${to || '…'}`}
                onClear={() => push({ from: null, to: null })}
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
          </div>
        </Toolbar>

        {loading ? (
          <TableCard>
            <SkeletonRows rows={6} columns={3} />
          </TableCard>
        ) : !rows || rows.length === 0 ? (
          <TableCard>
            <EmptyState
              icon={GraduationCap}
              tone={hasFilters ? 'amber' : 'blue'}
              title={
                hasFilters
                  ? tAdmin('learnerAccess.noLearnersMatch', { default: 'No learners match your filters' })
                  : tAdmin('learnerAccess.noLearnersYet', { default: 'No learners yet' })
              }
              body={
                hasFilters
                  ? tAdmin('learnerAccess.noLearnersMatchHint', {
                      default: 'Try adjusting your search, status or date range.',
                    })
                  : tAdmin('learnerAccess.noLearnersYetHint', {
                      default: 'Learners will appear here once they sign up and enroll.',
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
                    {tAdmin('learnerAccess.clearFilters', { default: 'Clear filters' })}
                  </button>
                ) : undefined
              }
            />
          </TableCard>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-start">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <th scope="col" className="px-6 py-3.5 text-start font-semibold">
                      {tAdmin('learnerAccess.colLearner', { default: 'Learner' })}
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-start font-semibold">
                      {tAdmin('access.colStatus', { default: 'Status' })}
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-start font-semibold">
                      {tAdmin('learnerAccess.colMemberSince', { default: 'Member since' })}
                    </th>
                    <th scope="col" className="py-3.5 pe-6 ps-4 text-end font-semibold">
                      {tAdmin('access.colActions', { default: 'Actions' })}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-13">
                  {rows.map((u) => {
                    const key = (u.accountStatus in STATUS_TONE
                      ? u.accountStatus
                      : 'active') as StatusKey;
                    const selected = focusId === u.id;
                    return (
                      <tr
                        key={u.id}
                        onClick={() => push({ focus: u.id })}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            push({ focus: u.id });
                          }
                        }}
                        className={cn(
                          'group cursor-pointer transition-colors duration-150 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none',
                          selected && 'bg-primary/[0.04]',
                        )}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3.5">
                            <Avatar name={u.name} email={u.email} src={u.avatarUrl} />
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-foreground transition group-hover:text-primary">
                                {u.name || u.email.split('@')[0]}
                              </p>
                              <p className="truncate text-xs font-normal text-muted-foreground">
                                {u.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <StatusPill
                            label={tStatus(u.accountStatus)}
                            tone={STATUS_TONE[key] ?? 'slate'}
                            pulse={u.accountStatus === 'active'}
                          />
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-medium text-foreground">
                            {new Date(u.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </p>
                          <p className="text-2xs text-muted-foreground">
                            {timeAgo(u.createdAt, tCommon)}
                          </p>
                        </td>
                        <td className="py-4 pe-6 ps-4 text-end">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              push({ focus: u.id });
                            }}
                            title={tAdmin('learnerAccess.openProfile', { default: 'Open learner profile' })}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-transparent px-2.5 py-1.5 text-xs font-semibold text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:border-border hover:bg-background hover:text-foreground focus-visible:opacity-100"
                          >
                            <Eye className="size-3.5" />
                            {tAdmin('learnerAccess.view', { default: 'View' })}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col items-center justify-between gap-3 border-t border-border bg-muted/40 px-6 py-3.5 text-xs font-medium text-muted-foreground sm:flex-row">
              <span>
                {tAdmin('learnerAccess.showingOf', {
                  from: (page - 1) * PER_PAGE + 1,
                  to: Math.min(total, page * PER_PAGE),
                  total,
                  default: 'Showing {from}–{to} of {total} learners',
                })}
              </span>
              <Pagination
                page={page}
                totalPages={pages}
                total={total}
                onPrev={() => push({ page: String(page - 1) })}
                onNext={() => push({ page: String(page + 1) })}
              />
            </div>
          </div>
        )}
      </div>

      {focusId && (
        <LearnerDrawer
          userId={focusId}
          onClose={() => push({ focus: null })}
          onChanged={(msg) => {
            toast({ type: 'ok', title: msg });
            void load(true);
          }}
        />
      )}
    </div>
  );
}
