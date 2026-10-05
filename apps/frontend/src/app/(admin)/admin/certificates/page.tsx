'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Award,
  BadgeCheck,
  CalendarClock,
  GraduationCap,
  LayoutGrid,
  LayoutList,
  Palette,
  Pencil,
  Plus,
  RefreshCw,
  ShieldOff,
  Download,
  Wand2,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import {
  AdminCommandBar,
  AdminPageHeader,
  BarIconButton,
  BarPrimaryButton,
} from '@/components/admin/admin-chrome';
import {
  Avatar,
  EmptyState,
  ErrorBanner,
  FilterChip,
  Pagination,
  PillTabs,
  SegmentedIconToggle,
  Select,
  StatusPill,
  Toolbar,
  type Tone,
} from '@/components/admin/admin-ui';
import { CertificateDetailDialog, type CertificateRow } from './certificate-detail';
import { IssueCertificateSheet } from './issue-sheet';
import { TemplatesTab } from './templates-tab';

/* A certificate is a document, so it is presented as one: a small credential
 * tile carrying the certificate number, with the learner, course and validity
 * window as supporting detail. With nothing issued yet, the empty state does the
 * real work — it explains how issuance actually happens rather than just
 * reporting an absence. */

type Status = 'active' | 'revoked' | 'expired';

export function certStatus(c: Pick<CertificateRow, 'revokedAt' | 'expiresAt'>): Status {
  if (c.revokedAt) return 'revoked';
  if (c.expiresAt && new Date(c.expiresAt).getTime() <= Date.now()) return 'expired';
  return 'active';
}

const STATUS_TONE: Record<Status, Tone> = {
  active: 'emerald',
  revoked: 'rose',
  expired: 'amber',
};

const STATUS_LABEL_KEYS: Record<Status, string> = {
  active: 'active',
  revoked: 'revoked',
  expired: 'expired',
};

const STATUS_LABEL_DEFAULTS: Record<Status, string> = {
  active: 'Active',
  revoked: 'Revoked',
  expired: 'Expired',
};

/** Certificates expiring within 30 days are worth surfacing before they lapse. */
const EXPIRY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

function expiresSoon(c: CertificateRow): boolean {
  if (certStatus(c) !== 'active' || !c.expiresAt) return false;
  const at = new Date(c.expiresAt).getTime();
  return at > Date.now() && at - Date.now() <= EXPIRY_WINDOW_MS;
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface CourseOption {
  id: string;
  title: string;
}

/* ------------------------------------------------------------------ */
/* Credential card                                                     */
/* ------------------------------------------------------------------ */
function CertificateCard({
  cert,
  onOpen,
  t,
}: {
  cert: CertificateRow;
  onOpen: () => void;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
}) {
  const st = certStatus(cert);
  const soon = expiresSoon(cert);
  const [regenerating, setRegenerating] = useState<string | null>(null);

  return (
    <article
      tabIndex={0}
      role="link"
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        'card-hover group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xs',
        'hover:border-border-strong',
        'focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10',
        st === 'revoked' && 'opacity-75',
      )}
    >
      <div className="flex items-start gap-4 p-4">
        {/* A credential tile: bordered, numbered, tinted by status. */}
        <div
          className={cn(
            'flex size-24 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border-2 p-2 text-center sm:size-28',
            st === 'active' && 'border-primary/30 bg-primary/8',
            st === 'revoked' && 'border-destructive/30 bg-destructive/8',
            st === 'expired' && 'border-warning/30 bg-warning/8',
          )}
        >
          <Award
            className={cn(
              'size-6',
              st === 'active' && 'text-primary',
              st === 'revoked' && 'text-destructive',
              st === 'expired' && 'text-warning',
            )}
          />
          <span className="font-mono text-2xs font-bold leading-tight text-foreground">
            {cert.certificateNumber}
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Avatar name={cert.userName} email={cert.userEmail} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {cert.userName || cert.userEmail?.split('@')[0] || t('unknownLearner', { default: 'Unknown learner' })}
                </p>
                <p className="truncate text-2xs text-muted-foreground">{cert.userEmail}</p>
              </div>
            </div>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <StatusPill
              label={t(`status.${STATUS_LABEL_KEYS[st]}`, { default: STATUS_LABEL_DEFAULTS[st] })}
              tone={STATUS_TONE[st]}
              pulse={st === 'active'}
            />
            {soon && (
              <StatusPill
                label={t('expiringSoon', { default: 'Expiring soon' })}
                tone="amber"
                dot={false}
                icon={CalendarClock}
              />
            )}
            {cert.revokedReason && (
              <StatusPill
                label={t('revoked', { default: 'Revoked' })}
                tone="rose"
                dot={false}
                icon={ShieldOff}
              />
            )}
          </div>

          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            <span className="text-foreground">{cert.courseTitle ?? t('unknownCourse', { default: 'Unknown course' })}</span>
          </p>

          <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-3 text-2xs text-muted-foreground">
            <span>
              {t('issued', { default: 'Issued' })} {formatDate(cert.issuedAt)}
            </span>
            {cert.expiresAt && (
              <span>
                {t('expires', { default: 'Expires' })} {formatDate(cert.expiresAt)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-border bg-muted/20 px-4 py-2.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          className="inline-flex flex-1 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted active:scale-[0.98]"
        >
          <Pencil className="size-3.5 text-muted-foreground" />
          {t('open', { default: 'Open' })}
        </button>
        {/* Download goes through the authorized admin route: the stored
            pdfUrl is a presigned capability URL that expires, and a revoked
            certificate must stop yielding a file. */}
        {cert.pdfUrl || cert.pdfStorageKey ? (
          <a
            href={`/api/proxy/admin/certifications/${cert.id}/download`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <Download className="size-3.5" />
            {t('pdf', { default: 'PDF' })}
          </a>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setRegenerating(cert.id);
              void fetch(`/api/proxy/admin/certifications/${cert.id}/regenerate-pdf`, {
                method: 'POST',
                credentials: 'include',
              })
                .then((r) => {
                  if (!r.ok) throw new Error(String(r.status));
                  window.location.reload();
                })
                .catch(() => setRegenerating(null));
            }}
            disabled={regenerating === cert.id}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            {regenerating === cert.id ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Wand2 className="size-3.5" />
            )}
            {t('regenerate', { default: 'Build PDF' })}
          </button>
        )}
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Getting-started panel — shown when nothing has been issued yet     */
/* ------------------------------------------------------------------ */
function GettingStarted({
  onIssue,
  onTemplates,
  t,
}: {
  onIssue: () => void;
  onTemplates: () => void;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
}) {
  const steps = [
    { key: 'enroll', icon: GraduationCap },
    { key: 'complete', icon: BadgeCheck },
    { key: 'issued', icon: Award },
  ];
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
      <div className="flex flex-col items-center px-6 py-12 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10">
          <Award className="size-7 text-primary" />
        </span>
        <h2 className="mt-5 text-lg font-bold tracking-tight text-foreground">
          {t('emptyTitle', { default: 'No certificates issued yet' })}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          {t('emptyBody', {
            default:
              'A certificate is issued automatically when a learner completes a published course. You can also issue one by hand at any time.',
          })}
        </p>

        <ol className="mt-8 flex w-full max-w-2xl flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          {steps.map((s, i) => (
            <li key={s.key} className="flex flex-1 items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/60 text-muted-foreground">
                <s.icon className="size-4" />
              </span>
              <span className="text-start text-xs font-semibold leading-snug text-foreground">
                {t(`step.${s.key}`, { default: s.key })}
              </span>
              {i < steps.length - 1 && (
                <span aria-hidden="true" className="hidden flex-1 border-t border-dashed border-border sm:block" />
              )}
            </li>
          ))}
        </ol>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={onIssue}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-xs transition hover:bg-primary active:scale-[0.98]"
          >
            <Plus className="size-4" />
            {t('issueFirst', { default: 'Issue first certificate' })}
          </button>
          <button
            type="button"
            onClick={onTemplates}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-5 py-2.5 text-sm font-semibold text-foreground shadow-xs transition hover:bg-muted"
          >
            <Palette className="size-4" />
            {t('designTemplate', { default: 'Design a template' })}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function AdminCertificatesPage() {
  const t = useTranslations('admin.certificatesPage');
  const tCommon = useTranslations('common');
  const tAdmin = useTranslations('admin');
  const params = useSearchParams();
  const router = useRouter();

  const tab = params.get('tab') === 'templates' ? 'templates' : 'issued';
  const status = params.get('status') ?? '';
  const courseId = params.get('courseId') ?? '';
  const q = params.get('q') ?? '';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const PAGE_SIZE = 12;

  const [rows, setRows] = useState<CertificateRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState<Record<string, number> | null>(null);
  const [facetTotal, setFacetTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qInput, setQInput] = useState(q);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [issueOpen, setIssueOpen] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(params.get('focus'));
  const [view, setView] = useState<'grid' | 'table'>('grid');

  const setParam = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === '') next.delete(k);
        else next.set(k, v);
      }
      if (!('page' in patch)) next.delete('page');
      const qs = next.toString();
      router.replace(qs ? `/admin/certificates?${qs}` : '/admin/certificates');
    },
    [params, router],
  );

  const setTab = useCallback(
    (next: 'issued' | 'templates') => {
      const url = new URLSearchParams(params.toString());
      if (next === 'issued') url.delete('tab');
      else url.set('tab', next);
      const qs = url.toString();
      router.replace(qs ? `/admin/certificates?${qs}` : '/admin/certificates');
    },
    [params, router],
  );

  useEffect(() => {
    if (qInput === q) return;
    const timer = setTimeout(() => setParam({ q: qInput || null }), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qInput]);

  const load = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
        if (q) qs.set('q', q);
        if (status) qs.set('status', status);
        if (courseId) qs.set('courseId', courseId);
        if (from) qs.set('from', from);
        if (to) qs.set('to', to);
        const res = await fetch(`/api/proxy/admin/certifications?${qs.toString()}`, {
          credentials: 'include',
        });
        if (!res.ok) {
          throw new Error(t('loadFailed', { status: res.status, default: 'Request failed ({status})' }));
        }
        const data = await res.json();
        setRows(Array.isArray(data?.items) ? data.items : []);
        setTotal(Number(data?.total ?? 0));
        setFacets(data?.facets && typeof data.facets === 'object' ? data.facets : null);
        setFacetTotal(Number(data?.facetTotal ?? data?.total ?? 0));
      } catch (e) {
        setError(e instanceof Error ? e.message : t('loadFailedGeneric', { default: 'Failed to load' }));
        setRows(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [page, q, status, courseId, from, to],
  );

  useEffect(() => {
    if (tab !== 'issued') return;
    void load();
  }, [load, tab]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/proxy/admin/courses?limit=200', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data?.items)) {
          setCourses(data.items.map((c: { id: string; title: string }) => ({ id: c.id, title: c.title })));
        }
      } catch {
        // The filter simply stays empty; the list still loads unfiltered.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const countOf = (k: string) => facets?.[k] ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(q || status || courseId || from || to);
  const expiringSoonShown = useMemo(
    () => (rows ?? []).filter(expiresSoon).length,
    [rows],
  );

  const clearAll = () => {
    setQInput('');
    router.replace('/admin/certificates');
  };

  return (
    <div className="w-full">
      <AdminCommandBar
        trail={[{ label: 'Baroot CNC Solutions' }, { label: tAdmin('certificates') }]}
        count={tab === 'issued' && !loading ? total : null}
        live={t('live', { default: 'Live' })}
        search={
          tab === 'issued'
            ? {
                value: qInput,
                onChange: setQInput,
                placeholder: t('searchPlaceholder', { default: 'Search user, course or certificate…' }),
                ariaLabel: t('searchAria', { default: 'Search certificates' }),
              }
            : undefined
        }
        actions={
          tab === 'issued' ? (
            <BarIconButton
              title={t('refresh', { default: 'Refresh certificates' })}
              spinning={loading || refreshing}
              onClick={() => load(true)}
            >
              <RefreshCw className="size-4" />
            </BarIconButton>
          ) : undefined
        }
        primary={
          <BarPrimaryButton icon={<Plus className="size-4" strokeWidth={2.5} />} onClick={() => setIssueOpen(true)}>
            {t('issueCertificate', { default: 'Issue certificate' })}
          </BarPrimaryButton>
        }
      />

      <div className="mx-auto w-full max-w-[1500px] space-y-6 pt-6">
        <AdminPageHeader
          title={tAdmin('certificates', { default: 'Certificates' })}
          description={t('description', {
            default: 'Issue, verify, and manage learner certificates. Every action is audited and tenant-isolated.',
          })}
          badge={
            <span className="inline-flex items-center gap-2 self-start rounded-full border border-success/30 bg-success/10 px-3 py-1.5 text-xs font-semibold text-success md:self-auto">
              <BadgeCheck className="size-4" />
              {t('tenantSafeBadge', { default: 'Tenant-safe · Auto-issuance' })}
            </span>
          }
        />

        <PillTabs
          value={tab}
          onChange={(k) => setTab(k)}
          options={[
            {
              key: 'issued',
              label: t('tabIssued', { default: 'Issued' }),
              count: tab === 'issued' && !loading ? facetTotal || total : undefined,
            },
            { key: 'templates', label: t('tabTemplates', { default: 'Templates' }) },
          ]}
        />

        {tab === 'templates' ? (
          <TemplatesTab />
        ) : (
          <>
            {error && (
              <ErrorBanner message={error} onRetry={() => load()} retryLabel={tCommon('retry', { default: 'Retry' })} />
            )}

            <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
              <dl className="grid grid-cols-2 divide-x divide-border sm:grid-cols-4">
                {[
                  {
                    key: 'issued',
                    icon: Award,
                    label: t('kpiIssued', { default: 'Issued' }),
                    value: facetTotal || total,
                    tone: 'text-foreground' as const,
                  },
                  {
                    key: 'active',
                    icon: BadgeCheck,
                    label: t('kpiActive', { default: 'Active' }),
                    value: countOf('active'),
                    tone: countOf('active') > 0 ? ('text-success' as const) : ('text-foreground' as const),
                  },
                  {
                    key: 'expiring',
                    icon: CalendarClock,
                    label: t('kpiExpiring', { default: 'Expiring soon' }),
                    value: loading ? '—' : expiringSoonShown,
                    tone: expiringSoonShown > 0 ? ('text-warning' as const) : ('text-foreground' as const),
                  },
                  {
                    key: 'revoked',
                    icon: ShieldOff,
                    label: t('kpiRevoked', { default: 'Revoked' }),
                    value: countOf('revoked'),
                    tone: countOf('revoked') > 0 ? ('text-destructive' as const) : ('text-foreground' as const),
                  },
                ].map((s) => (
                  <div key={s.key} className="flex items-center gap-3 px-5 py-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/60 text-muted-foreground">
                      <s.icon className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <dd className={cn('font-display text-xl font-bold leading-none tabular-nums', s.tone)}>
                        {s.value}
                      </dd>
                      <dt className="mt-1 truncate text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {s.label}
                      </dt>
                    </div>
                  </div>
                ))}
              </dl>
            </section>

            {hasFilters && (
              <Toolbar>
                {q && (
                  <FilterChip
                    label={t('filterSearch', { q, default: 'Search: {q}' })}
                    onClear={() => {
                      setQInput('');
                      setParam({ q: null });
                    }}
                  />
                )}
                {status && (
                  <FilterChip
                    tone={STATUS_TONE[status as Status] ?? 'blue'}
                    label={t(`status.${STATUS_LABEL_KEYS[status as Status] ?? status}`, {
                      default: STATUS_LABEL_DEFAULTS[status as Status] ?? status,
                    })}
                    onClear={() => setParam({ status: null })}
                  />
                )}
                {courseId && (
                  <FilterChip
                    tone="cyan"
                    label={courses.find((c) => c.id === courseId)?.title ?? t('courseFilter', { default: 'Course' })}
                    onClear={() => setParam({ courseId: null })}
                  />
                )}
                {(from || to) && (
                  <FilterChip
                    tone="blue"
                    label={`${from || '…'} → ${to || '…'}`}
                    onClear={() => setParam({ from: null, to: null })}
                  />
                )}
                <button
                  type="button"
                  onClick={clearAll}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3.5 text-xs font-bold text-primary-foreground shadow-xs transition hover:bg-primary active:scale-[0.98]"
                >
                  {tCommon('clear', { default: 'Clear' })}
                </button>
              </Toolbar>
            )}

            <Toolbar>
              <PillTabs
                value={status}
                onChange={(k) => setParam({ status: k || null })}
                options={[
                  { key: '', label: tCommon('all', { default: 'All' }), count: facetTotal || undefined },
                  {
                    key: 'active',
                    label: t('status.active', { default: 'Active' }),
                    count: countOf('active'),
                  },
                  {
                    key: 'revoked',
                    label: t('status.revoked', { default: 'Revoked' }),
                    count: countOf('revoked'),
                  },
                  {
                    key: 'expired',
                    label: t('status.expired', { default: 'Expired' }),
                    count: countOf('expired'),
                  },
                ]}
              />

              {courses.length > 0 && (
                <Select
                  value={courseId}
                  onChange={(v) => setParam({ courseId: v || null })}
                  label={t('courseFilter', { default: 'Course' })}
                >
                  <option value="">{t('allCourses', { default: 'All courses' })}</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </Select>
              )}

              <div className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 py-1 shadow-xs">
                <input
                  type="date"
                  value={from}
                  max={to || undefined}
                  onChange={(e) => setParam({ from: e.target.value || null })}
                  aria-label={t('fromDate', { default: 'Issued from' })}
                  className="bg-transparent text-xs outline-none [color-scheme:light] dark:[color-scheme:dark]"
                />
                <span className="text-xs text-muted-foreground" aria-hidden="true">
                  –
                </span>
                <input
                  type="date"
                  value={to}
                  min={from || undefined}
                  onChange={(e) => setParam({ to: e.target.value || null })}
                  aria-label={t('toDate', { default: 'Issued to' })}
                  className="bg-transparent text-xs outline-none [color-scheme:light] dark:[color-scheme:dark]"
                />
              </div>

              <SegmentedIconToggle
                label={t('viewMode', { default: 'View mode' })}
                value={view}
                onChange={setView}
                options={[
                  { key: 'grid', icon: LayoutGrid, label: t('gridView', { default: 'Grid view' }) },
                  { key: 'table', icon: LayoutList, label: t('listView', { default: 'List view' }) },
                ]}
              />
            </Toolbar>

            {loading ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-2xl border border-border bg-card p-4 shadow-xs">
                    <div className="flex gap-4">
                      <Skeleton className="size-24 shrink-0 rounded-xl sm:size-28" />
                      <div className="flex-1 space-y-3">
                        <Skeleton className="h-3.5 w-1/2 rounded" />
                        <Skeleton className="h-5 w-24 rounded-full" />
                        <Skeleton className="h-3 w-3/4 rounded" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : !rows || rows.length === 0 ? (
              hasFilters ? (
                <div className="overflow-hidden rounded-xl border border-border bg-card">
                  <EmptyState
                    icon={Award}
                    tone="amber"
                    title={t('noMatch', { default: 'No certificates match your filters' })}
                    body={t('noMatchHint', { default: 'Try a different course, status or date range.' })}
                    action={
                      <button
                        type="button"
                        onClick={clearAll}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold shadow-xs transition hover:bg-muted"
                      >
                        {t('clearFilters', { default: 'Clear filters' })}
                      </button>
                    }
                  />
                </div>
              ) : (
                <GettingStarted
                  t={t}
                  onIssue={() => setIssueOpen(true)}
                  onTemplates={() => setTab('templates')}
                />
              )
            ) : view === 'grid' ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {rows.map((c) => (
                  <CertificateCard key={c.id} cert={c} onOpen={() => setFocusId(c.id)} t={t} />
                ))}
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] border-collapse text-start">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                        <th scope="col" className="px-6 py-3.5 text-start font-semibold">
                          {t('colCertificate', { default: 'Certificate' })}
                        </th>
                        <th scope="col" className="px-4 py-3.5 text-start font-semibold">
                          {t('colLearner', { default: 'Learner' })}
                        </th>
                        <th scope="col" className="px-4 py-3.5 text-start font-semibold">
                          {t('colCourse', { default: 'Course' })}
                        </th>
                        <th scope="col" className="px-4 py-3.5 text-start font-semibold">
                          {t('colIssued', { default: 'Issued' })}
                        </th>
                        <th scope="col" className="px-4 py-3.5 text-start font-semibold">
                          {t('colStatus', { default: 'Status' })}
                        </th>
                        <th scope="col" className="py-3.5 pe-6 ps-4 text-end font-semibold">
                          {t('colActions', { default: 'Actions' })}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-13">
                      {rows.map((c) => {
                        const st = certStatus(c);
                        return (
                          <tr
                            key={c.id}
                            tabIndex={0}
                            onClick={() => setFocusId(c.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setFocusId(c.id);
                              }
                            }}
                            className="group cursor-pointer transition-colors duration-150 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                          >
                            <td className="px-6 py-3.5">
                              <span className="font-mono text-xs font-semibold text-foreground">
                                {c.certificateNumber}
                              </span>
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex min-w-0 items-center gap-2.5">
                                <Avatar name={c.userName} email={c.userEmail} size="sm" />
                                <div className="min-w-0">
                                  <p className="truncate font-semibold text-foreground transition group-hover:text-primary">
                                    {c.userName || c.userEmail}
                                  </p>
                                  <p className="truncate text-2xs text-muted-foreground">{c.userEmail}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              <p className="line-clamp-1 text-foreground">
                                {c.courseTitle ?? t('unknownCourse', { default: 'Unknown course' })}
                              </p>
                            </td>
                            <td className="px-4 py-3.5 text-xs text-muted-foreground">
                              {formatDate(c.issuedAt)}
                            </td>
                            <td className="px-4 py-3.5">
                              <StatusPill
                                label={t(`status.${STATUS_LABEL_KEYS[st]}`, {
                                  default: STATUS_LABEL_DEFAULTS[st],
                                })}
                                tone={STATUS_TONE[st]}
                                pulse={st === 'active'}
                              />
                            </td>
                            <td className="py-3.5 pe-6 ps-4 text-end">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFocusId(c.id);
                                }}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground shadow-xs transition hover:bg-muted active:scale-[0.98]"
                              >
                                <Pencil className="size-3.5" />
                                {t('open', { default: 'Open' })}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {!loading && rows && rows.length > 0 && (
              <div className="rounded-xl border border-border bg-card px-5 py-3 shadow-xs">
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  total={total}
                  onPrev={() => setParam({ page: String(page - 1) })}
                  onNext={() => setParam({ page: String(page + 1) })}
                />
              </div>
            )}
          </>
        )}
      </div>

      {focusId && (
        <CertificateDetailDialog
          certificateId={focusId}
          onClose={() => setFocusId(null)}
          onChanged={(msg) => {
            toast({ type: 'ok', title: msg });
            void load(true);
          }}
        />
      )}

      <IssueCertificateSheet
        open={issueOpen}
        onClose={() => setIssueOpen(false)}
        onIssued={() => {
          setIssueOpen(false);
          void load(true);
        }}
      />
    </div>
  );
}
