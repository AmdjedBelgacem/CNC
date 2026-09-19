'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  RefreshCw,
  Award,
  Eye,
  Plus,
  Palette,
  Filter,
  Calendar,
  Shield,
  Zap,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toast';
import {
  AdminCommandBar,
  BarIconButton,
  BarPrimaryButton,
  AdminPageHeader,
} from '@/components/admin/admin-chrome';
import { CertificateDetailDialog, type CertificateRow } from './certificate-detail';
import { IssueCertificateSheet } from './issue-sheet';
import { TemplatesTab } from './templates-tab';
const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'revoked', label: 'Revoked' },
  { key: 'expired', label: 'Expired' },
] as const;
const PAGE_SIZE = 20;
export function certStatus(
  c: Pick<CertificateRow, 'revokedAt' | 'expiresAt'>,
): 'active' | 'revoked' | 'expired' {
  if (c.revokedAt) return 'revoked';
  if (c.expiresAt && new Date(c.expiresAt).getTime() <= Date.now()) return 'expired';
  return 'active';
}
const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200/70',
  revoked: 'bg-red-50 text-red-700 border-red-200/70',
  expired: 'bg-amber-50 text-amber-700 border-amber-200/70',
};
interface CourseOption {
  id: string;
  title: string;
}
export default function AdminCertificatesPage() {
  const tAdmin = useTranslations('admin');
  const params = useSearchParams();
  const router = useRouter();
  const tab = params.get('tab') === 'templates' ? 'templates' : 'issued';
  const q = params.get('q') ?? '';
  const courseId = params.get('courseId') ?? '';
  const userId = params.get('userId') ?? '';
  const status = params.get('status') ?? '';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const focusId = params.get('focus');
  const [rows, setRows] = useState<CertificateRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qInput, setQInput] = useState(q);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [issueOpen, setIssueOpen] = useState(false);
  const setParam = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === '') next.delete(k);
        else next.set(k, v);
      }
      if (!('page' in patch)) next.delete('page');
      router.replace(`/admin/certificates?${next.toString()}`);
    },
    [params, router],
  );
  const setTab = useCallback(
    (nextTab: 'issued' | 'templates') => {
      const next = new URLSearchParams(params.toString());
      if (nextTab === 'issued') next.delete('tab');
      else next.set('tab', nextTab);
      next.delete('page');
      router.replace(`/admin/certificates?${next.toString()}`);
    },
    [params, router],
  );
  useEffect(() => {
    const t = setTimeout(() => {
      if (qInput !== q) setParam({ q: qInput || null });
    }, 350);
    return () => clearTimeout(t);
  }, [qInput]);
  useEffect(() => {
    fetch('/api/proxy/admin/courses?limit=100', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => setCourses((d?.items ?? []).map((c: any) => ({ id: c.id, title: c.title }))))
      .catch(() => {});
  }, []);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (q) qs.set('q', q);
      if (courseId) qs.set('courseId', courseId);
      if (userId) qs.set('userId', userId);
      if (status) qs.set('status', status);
      if (from) qs.set('from', from);
      if (to) qs.set('to', to);
      const res = await fetch(`/api/proxy/admin/certifications?${qs.toString()}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = await res.json();
      setRows(Array.isArray(data?.items) ? data.items : []);
      setTotal(Number(data?.total ?? 0));
    } catch (e: any) {
      setError(e?.message || 'Failed to load certificates');
      setRows(null);
    } finally {
      setLoading(false);
    }
  }, [page, q, courseId, userId, status, from, to]);
  useEffect(() => {
    if (tab === 'issued') load();
  }, [load, tab]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(q || courseId || userId || status || from || to);
  return (
    <div className="w-full">
      <AdminCommandBar
        trail={[{ label: 'Titans of CNC' }, { label: tAdmin('certificates') }]}
        count={tab === 'issued' && !loading ? total : null}
        live="Live"
        search={
          tab === 'issued'
            ? {
                value: qInput,
                onChange: setQInput,
                placeholder: 'Search user, course or certificate #…',
                ariaLabel: 'Search certificates',
              }
            : null
        }
        actions={
          <BarIconButton title="Refresh certificates" spinning={loading} onClick={load}>
            <RefreshCw className="h-4 w-4" />
          </BarIconButton>
        }
        primary={
          tab === 'issued' ? (
            <BarPrimaryButton
              icon={<Plus className="h-4 w-4" strokeWidth={2.5} />}
              onClick={() => setIssueOpen(true)}
            >
              Issue certificate
            </BarPrimaryButton>
          ) : undefined
        }
      />

      <div className="mx-auto w-full max-w-[1500px] space-y-6 pt-6">
        <AdminPageHeader
          title={tAdmin('certificates')}
          description={
            tab === 'templates'
              ? 'Certificate templates with live preview — variables auto-fill for each learner.'
              : 'Issue, verify, and manage learner certificates. Every action is audited and tenant-isolated.'
          }
          badge={
            <span className="flex items-center gap-2 self-start rounded-full border border-emerald-200/80 bg-emerald-50/80 px-3 py-1.5 text-xs font-medium text-emerald-800 shadow-sm md:self-auto dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200">
              <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Tenant-safe · Auto-issuance
            </span>
          }
        />
        <div className="flex items-center gap-0.5 rounded-lg bg-muted p-1 w-fit">
          {' '}
          <button
            type="button"
            onClick={() => setTab('issued')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-4 py-1.5 text-[13px] font-medium transition',
              tab === 'issued'
                ? 'bg-card shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground dark:hover:text-white',
            )}
          >
            {' '}
            <Award className="h-4 w-4" /> Issued{' '}
            {total > 0 && tab === 'issued' && (
              <span className="ml-1 rounded-md bg-muted px-1.5 py-0.5 text-xs font-semibold text-foreground dark:bg-muted">
                {total}
              </span>
            )}{' '}
          </button>{' '}
          <button
            type="button"
            onClick={() => setTab('templates')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-4 py-1.5 text-[13px] font-medium transition',
              tab === 'templates'
                ? 'bg-card shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground dark:hover:text-white',
            )}
          >
            {' '}
            <Palette className="h-4 w-4" /> Templates{' '}
          </button>{' '}
        </div>{' '}
        {tab === 'templates' ? (
          <TemplatesTab />
        ) : (
          <>
            {' '}
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-2.5">
              <div className="relative">
                <select
                  value={courseId}
                  onChange={(e) => setParam({ courseId: e.target.value || null })}
                  className="h-9 min-w-[160px] appearance-none rounded-xl border border-border bg-background px-3 pr-8 text-[13px] outline-none transition focus:border-blue-500/60 focus:ring-4 focus:ring-blue-500/10"
                >
                  {' '}
                  <option value="">All courses</option>{' '}
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {' '}
                      {c.title}{' '}
                    </option>
                  ))}{' '}
                </select>{' '}
                <Filter className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />{' '}
              </div>{' '}
              <select
                value={status}
                onChange={(e) => setParam({ status: e.target.value || null })}
                className="h-9 rounded-xl border border-border bg-background px-3 text-[13px] capitalize outline-none transition focus:border-blue-500/60 focus:ring-4 focus:ring-blue-500/10"
              >
                {' '}
                {STATUS_TABS.map((t) => (
                  <option key={t.key} value={t.key}>
                    {' '}
                    {t.label === 'All' ? 'All statuses' : t.label}{' '}
                  </option>
                ))}{' '}
              </select>{' '}
              <div className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-2 py-1">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />{' '}
                <input
                  type="date"
                  value={from}
                  max={to || undefined}
                  onChange={(e) => setParam({ from: e.target.value || null })}
                  className="bg-transparent text-sm outline-none"
                />{' '}
                <span className="text-muted-foreground">–</span>{' '}
                <input
                  type="date"
                  value={to}
                  min={from || undefined}
                  onChange={(e) => setParam({ to: e.target.value || null })}
                  className="bg-transparent text-sm outline-none"
                />{' '}
              </div>{' '}
              {hasFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setQInput('');
                    router.replace('/admin/certificates');
                  }}
                  className="h-9 rounded-xl bg-blue-600 px-4 text-sm font-medium text-white shadow-sm shadow-blue-600/25 transition hover:bg-blue-700 active:scale-[0.98]"
                >
                  {' '}
                  Clear{' '}
                </button>
              )}{' '}
            </div>{' '}
            {userId && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs">
                {' '}
                <span className="text-muted-foreground">Filtered by user</span>{' '}
                <code className="rounded-md bg-muted px-2 py-0.5 font-mono text-foreground">
                  {userId.slice(0, 8)}…
                </code>{' '}
                <button
                  type="button"
                  onClick={() => setParam({ userId: null })}
                  className="ml-1 font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  {' '}
                  remove{' '}
                </button>{' '}
              </div>
            )}{' '}
            <div className="flex items-center gap-1.5">
              {' '}
              {STATUS_TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setParam({ status: t.key || null })}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-medium transition active:scale-[0.98]',
                    status === t.key
                      ? 'bg-foreground text-background shadow-sm'
                      : 'border border-border bg-background text-muted-foreground hover:text-foreground',
                  )}
                >
                  {' '}
                  {t.label}{' '}
                </button>
              ))}{' '}
            </div>{' '}
            {error && (
              <div className="flex items-center justify-between rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3">
                <span className="flex items-center gap-2 text-sm font-medium text-red-600 dark:text-red-400">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-red-500/10">
                    !
                  </span>
                  {error}
                </span>
                <button
                  type="button"
                  onClick={load}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                >
                  Retry
                </button>
              </div>
            )}
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-xs uppercase tracking-widest text-muted-foreground">
                    <th className="px-5 py-3 font-semibold">Certificate</th>
                    <th className="px-5 py-3 font-semibold">Learner</th>
                    <th className="px-5 py-3 font-semibold">Course</th>
                    <th className="hidden px-5 py-3 md:table-cell">Issued</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Source</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {loading &&
                    [0, 1, 2, 3, 4].map((i) => (
                      <tr
                        key={`sk-${i}`}
                        className="border-b border-border last:border-0"
                      >
                        <td colSpan={7} className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 animate-pulse rounded-xl bg-muted" />
                            <div className="space-y-2">
                              <div className="h-3.5 w-40 animate-pulse rounded-md bg-muted" />
                              <div className="h-3 w-56 animate-pulse rounded-md bg-muted/70" />
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  {!loading && rows && rows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-16 text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                          <Award className="h-7 w-7" />
                        </div>
                        <p className="mt-3 text-sm font-semibold">No certificates found</p>
                        <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">
                          {status === 'revoked'
                            ? 'Nothing has been revoked — that is good news.'
                            : hasFilters
                              ? 'Try adjusting or clearing your filters.'
                              : 'Certificates appear here when learners complete courses. Issue one manually to get started.'}
                        </p>
                        {!hasFilters && (
                          <button
                            type="button"
                            onClick={() => setIssueOpen(true)}
                            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-blue-600/25 transition hover:bg-blue-700 active:scale-[0.98]"
                          >
                            <Plus className="h-4 w-4" /> Issue first certificate
                          </button>
                        )}
                      </td>
                    </tr>
                  )}
                  {!loading &&
                    rows?.map((c) => {
                      const st = certStatus(c);
                      const src = (c as any).metadata?.source as string | undefined;
                      return (
                        <tr
                          key={c.id}
                          onClick={() => setParam({ focus: c.id })}
                          className={cn(
                            'group cursor-pointer border-b border-border transition last:border-0 hover:bg-muted/50',
                            focusId === c.id && 'bg-blue-500/[0.06]',
                          )}
                        >
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-foreground text-background sm:flex">
                                <Award className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="font-mono text-xs font-semibold tracking-wide transition group-hover:text-blue-600">
                                  {c.certificateNumber}
                                </p>
                                <p className="hidden text-[11px] text-muted-foreground sm:block">
                                  {new Date(c.issuedAt).toLocaleTimeString('en-US', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted font-mono text-xs font-semibold text-foreground">
                                {(c.userName || c.userEmail || '?').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="max-w-[140px] truncate text-sm font-medium leading-tight">
                                  {c.userName || (c.userEmail ?? '').split('@')[0]}
                                </p>
                                <p className="max-w-[160px] truncate text-xs text-muted-foreground">
                                  {c.userEmail}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <div className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 sm:flex">
                                <FileText className="h-3.5 w-3.5" />
                              </div>
                              <span className="block max-w-[180px] truncate text-sm font-medium">
                                {c.courseTitle}
                              </span>
                            </div>
                          </td>
                          <td className="hidden px-5 py-3 md:table-cell">
                            <span className="inline-flex flex-col">
                              <span className="text-sm font-medium">
                                {new Date(c.issuedAt).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(c.issuedAt).toLocaleTimeString('en-US', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <span
                              className={cn(
                                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize',
                                STATUS_STYLES[st],
                              )}
                            >
                              <span
                                className={cn(
                                  'h-1.5 w-1.5 rounded-full bg-current',
                                  st === 'active' && 'animate-pulse',
                                )}
                              />
                              {st}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            {src === 'automatic' ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                                <Zap className="h-3 w-3" /> Automatic
                              </span>
                            ) : src === 'manual' ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold text-foreground">
                                Manual
                              </span>
                            ) : src ? (
                              <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold capitalize text-muted-foreground">
                                {src}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <span className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white transition group-hover:bg-blue-700">
                              <Eye className="h-3.5 w-3.5" /> View
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>{' '}
              {!loading && rows && rows.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/40 px-5 py-3">
                  <p className="text-xs text-muted-foreground">
                    Page <span className="font-semibold text-foreground">{page}</span> of{' '}
                    <span className="font-semibold text-foreground">{totalPages}</span> ·{' '}
                    <span className="font-medium">{total}</span> total
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setParam({ page: String(page - 1) })}
                      className="rounded-lg border border-border bg-background px-3 py-1.5 text-[13px] font-medium text-foreground transition hover:bg-muted disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() => setParam({ page: String(page + 1) })}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-blue-700 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      {focusId && (
        <CertificateDetailDialog
          certificateId={focusId}
          onClose={() => setParam({ focus: null })}
          onChanged={(msg) => {
            toast({ type: 'ok', title: msg });
            load();
          }}
        />
      )}
      <IssueCertificateSheet open={issueOpen} onClose={() => setIssueOpen(false)} onIssued={load} />
    </div>
  );
}
