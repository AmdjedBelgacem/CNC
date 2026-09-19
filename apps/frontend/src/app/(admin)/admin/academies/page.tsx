'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  RefreshCw,
  Plus,
  Pencil,
  Globe,
  GlobeLock,
  Archive,
  ArchiveRestore,
  MoreHorizontal,
  GraduationCap,
  Layers,
  BookOpen,
  Sparkles,
  BadgeCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toast';
import {
  AdminCommandBar,
  BarButton,
  BarIconButton,
  BarPrimaryButton,
  AdminKpiCard,
  AdminPageHeader,
} from '@/components/admin/admin-chrome';
import { Toolbar, PillTabs, TableCard, Pagination, EmptyState } from '@/components/admin/admin-ui';

interface AcademyRow {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  isPublished: boolean;
  isArchived: boolean;
  updatedAt: string;
  courseCount: number;
}

function statusOf(a: Pick<AcademyRow, 'isPublished' | 'isArchived'>) {
  if (a.isArchived) return 'archived';
  return a.isPublished ? 'published' : 'draft';
}

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-amber-50 text-amber-700 border-amber-200/70',
  published: 'bg-emerald-50 text-emerald-700 border-emerald-200/70',
  archived: 'bg-muted text-muted-foreground border-border',
};

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export default function AdminAcademiesPage() {
  const tAdmin = useTranslations('admin');
  const router = useRouter();
  const params = useSearchParams();
  const status = params.get('status') ?? '';
  const q = params.get('q') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const PAGE_SIZE = 12;
  const [rows, setRows] = useState<AcademyRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qInput, setQInput] = useState(q);
  const [backfillBusy, setBackfillBusy] = useState(false);

  const setParam = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === '') next.delete(k);
        else next.set(k, v);
      }
      if (!('page' in patch)) next.delete('page');
      router.replace(`/admin/academies?${next.toString()}`);
    },
    [params, router],
  );

  useEffect(() => {
    const t = setTimeout(() => {
      if (qInput !== q) setParam({ q: qInput || null });
    }, 350);
    return () => clearTimeout(t);
  }, [qInput]); // eslint-disable-line

  const load = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
        if (status) qs.set('status', status);
        if (q) qs.set('search', q);
        const res = await fetch(`/api/proxy/admin/academies?${qs.toString()}`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const data = await res.json();
        setRows(Array.isArray(data?.items) ? data.items : []);
        setTotal(Number(data?.total ?? 0));
      } catch (e: any) {
        setError(e?.message || 'Failed to load academies');
        setRows(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, status, q],
  );

  useEffect(() => {
    load();
  }, [load]);

  const act = async (
    slug: string,
    action: 'publish' | 'unpublish' | 'archive' | 'restore',
    okMsg: string,
  ) => {
    try {
      const res = await fetch(`/api/proxy/admin/academies/${slug}/${action}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message ?? `Request failed (${res.status})`);
      }
      toast({ type: 'ok', title: okMsg });
      load(true);
    } catch (e: any) {
      toast({ type: 'err', title: 'Action failed', description: e?.message });
    }
  };

  const runBackfill = async () => {
    setBackfillBusy(true);
    try {
      const reportRes = await fetch('/api/proxy/admin/academies/backfill/report', {
        credentials: 'include',
      });
      if (!reportRes.ok) throw new Error(`Report failed (${reportRes.status})`);
      const report = await reportRes.json();
      if (report.duplicateCourseSlugs?.length) {
        const dups = report.duplicateCourseSlugs
          .map((d: { slug: string; count: number }) => `${d.slug} (${d.count})`)
          .join(', ');
        throw new Error(`Duplicate course slugs must be resolved first: ${dups}`);
      }
      const res = await fetch('/api/proxy/admin/academies/backfill/run', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message ?? `Backfill failed (${res.status})`);
      toast({
        type: 'ok',
        title: 'Default academy ready',
        description: `${data.created ? 'Created' : 'Reused'} "${report.proposed.title}" — ${data.assigned} course(s) assigned.`,
      });
      load(true);
    } catch (e: any) {
      toast({ type: 'err', title: 'Backfill failed', description: e?.message });
    } finally {
      setBackfillBusy(false);
    }
  };

  const stats = {
    total,
    published: (rows ?? []).filter((a) => statusOf(a) === 'published').length,
    drafts: (rows ?? []).filter((a) => statusOf(a) === 'draft').length,
    courses: (rows ?? []).reduce((s, a) => s + (a.courseCount ?? 0), 0),
  };
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(status || q);

  return (
    <div className="w-full">
      <AdminCommandBar
        trail={[{ label: 'Titans of CNC' }, { label: tAdmin('academies') }]}
        count={loading ? null : total}
        live="Live"
        search={{
          value: qInput,
          onChange: setQInput,
          placeholder: 'Search by title or slug…',
          ariaLabel: 'Search academies',
        }}
        actions={
          <>
            <BarIconButton
              title="Refresh academies"
              spinning={loading || refreshing}
              onClick={() => load(true)}
            >
              <RefreshCw className="h-4 w-4" />
            </BarIconButton>
            <BarButton
              icon={<Sparkles className={cn('h-4 w-4', backfillBusy && 'animate-pulse')} />}
              disabled={backfillBusy}
              onClick={() => void runBackfill()}
            >
              {backfillBusy ? 'Working…' : 'Default academy'}
            </BarButton>
          </>
        }
        primary={
          <BarPrimaryButton
            icon={<Plus className="h-4 w-4" strokeWidth={2.5} />}
            onClick={() => router.push('/admin/academies/new')}
          >
            New academy
          </BarPrimaryButton>
        }
      />

      <div className="mx-auto w-full max-w-[1500px] space-y-6 pt-6">
        <AdminPageHeader
          title={tAdmin('academies')}
          description="Academies are branded destinations that group your courses into programs — assign courses from here or from Course Studio."
          badge={
            <span className="flex items-center gap-2 self-start rounded-full border border-emerald-200/80 bg-emerald-50/80 px-3 py-1.5 text-xs font-medium text-emerald-800 shadow-sm md:self-auto dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200">
              <BadgeCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Tenant-safe · Instant publish
            </span>
          }
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AdminKpiCard
            icon={Layers}
            label="Total academies"
            value={loading ? '—' : String(total)}
            sub={`${rows?.length ?? 0} shown`}
            tone="blue"
          />
          <AdminKpiCard
            icon={Globe}
            label="Published"
            value={String(stats.published)}
            sub="Live destinations"
            tone="emerald"
          />
          <AdminKpiCard
            icon={Pencil}
            label="Drafts"
            value={String(stats.drafts)}
            sub="Awaiting publish"
            tone="amber"
          />
          <AdminKpiCard
            icon={BookOpen}
            label="Courses placed"
            value={stats.courses.toLocaleString()}
            sub="Across shown"
            tone="cyan"
          />
        </div>
        <Toolbar>
          <PillTabs
            value={status}
            onChange={(k) => setParam({ status: k || null })}
            options={[
              { key: '', label: 'All' },
              { key: 'draft', label: 'Drafts' },
              { key: 'published', label: 'Published' },
              { key: 'archived', label: 'Archived' },
            ]}
          />
          <div className="ml-auto flex items-center gap-2">
            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setQInput('');
                  router.replace('/admin/academies');
                }}
                className="h-9 rounded-xl bg-blue-600 px-3.5 text-xs font-bold text-white shadow-sm shadow-blue-600/25 transition hover:bg-blue-700 active:scale-[0.98]"
              >
                Clear
              </button>
            )}
          </div>
        </Toolbar>
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
              onClick={() => load()}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        )}
        {loading ? (
          <TableCard>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center gap-4 border-b border-border p-4 last:border-0"
              >
                <div className="h-12 w-12 animate-pulse rounded-xl bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-48 animate-pulse rounded-md bg-muted" />
                  <div className="h-3 w-32 animate-pulse rounded-md bg-muted/60" />
                </div>
              </div>
            ))}
          </TableCard>
        ) : !rows || rows.length === 0 ? (
          <TableCard>
            <EmptyState
              icon={GraduationCap}
              title={hasFilters ? 'No academies match your filters' : 'Create your first academy'}
              body={
                hasFilters
                  ? 'Try adjusting or clearing your filters.'
                  : 'Academies group courses into branded programs. Create one, then assign courses to it.'
              }
              action={
                hasFilters ? (
                  <button
                    type="button"
                    onClick={() => {
                      setQInput('');
                      router.replace('/admin/academies');
                    }}
                    className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold shadow-sm hover:bg-muted"
                  >
                    Clear filters
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => router.push('/admin/academies/new')}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-700 active:scale-[0.98]"
                  >
                    <Plus className="h-4 w-4" /> New academy
                  </button>
                )
              }
            />
          </TableCard>
        ) : (
          <TableCard
            header={
              <div className="grid grid-cols-12 items-center gap-2">
                <span className="col-span-4">Academy</span>
                <span className="col-span-2">Status</span>
                <span className="col-span-2 text-right">Courses</span>
                <span className="col-span-2 text-right">Updated</span>
                <span className="col-span-2 text-right">Actions</span>
              </div>
            }
            footer={
              rows.length > 0 ? (
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  total={total}
                  onPrev={() => setParam({ page: String(page - 1) })}
                  onNext={() => setParam({ page: String(page + 1) })}
                />
              ) : undefined
            }
          >
            {rows.map((a) => {
              const st = statusOf(a);
              return (
                <div
                  key={a.id}
                  onClick={() => router.push(`/admin/academies/${a.slug}/edit`)}
                  className="group grid cursor-pointer grid-cols-12 items-center gap-2 border-b border-border px-5 py-3.5 transition last:border-0 hover:bg-muted/50"
                >
                  <span className="col-span-4 flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600 transition group-hover:bg-blue-600 group-hover:text-white dark:text-blue-400">
                      <GraduationCap className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold tracking-tight transition group-hover:text-blue-600">
                        {a.title}
                      </span>
                      <span className="block truncate font-mono text-[11px] text-muted-foreground">
                        /{a.slug}
                      </span>
                    </span>
                  </span>
                  <span className="col-span-2">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize',
                        STATUS_STYLE[st],
                      )}
                    >
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          st === 'published'
                            ? 'bg-emerald-500 animate-pulse'
                            : st === 'draft'
                              ? 'bg-amber-500'
                              : 'bg-muted-foreground',
                        )}
                      />
                      {st}
                    </span>
                  </span>
                  <span className="col-span-2 text-right">
                    <span className="block text-sm font-bold tabular-nums">{a.courseCount}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      course{a.courseCount === 1 ? '' : 's'}
                    </span>
                  </span>
                  <span className="col-span-2 text-right">
                    <span className="block text-[13px] font-medium">
                      {new Date(a.updatedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {timeAgo(a.updatedAt)}
                    </span>
                  </span>
                  <span
                    className="col-span-2 flex justify-end"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <AcademyRowMenu academy={a} onAction={act} />
                    <button
                      type="button"
                      onClick={() => router.push(`/admin/academies/${a.slug}/edit`)}
                      className="ml-1.5 inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm shadow-blue-600/25 transition hover:bg-blue-700 focus-visible:opacity-100 max-lg:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Manage
                    </button>
                  </span>
                </div>
              );
            })}
          </TableCard>
        )}
      </div>
    </div>
  );
}

function AcademyRowMenu({
  academy,
  onAction,
}: {
  academy: AcademyRow;
  onAction: (
    slug: string,
    action: 'publish' | 'unpublish' | 'archive' | 'restore',
    msg: string,
  ) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const st = statusOf(academy);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [open]);
  const items: { label: string; icon: any; danger?: boolean; run: () => Promise<void> }[] = [];
  if (st === 'draft')
    items.push({
      label: 'Publish',
      icon: Globe,
      run: () => onAction(academy.slug, 'publish', 'Academy published'),
    });
  if (st === 'published')
    items.push({
      label: 'Unpublish',
      icon: GlobeLock,
      run: () => onAction(academy.slug, 'unpublish', 'Academy unpublished'),
    });
  if (st === 'archived')
    items.push({
      label: 'Restore',
      icon: ArchiveRestore,
      run: () => onAction(academy.slug, 'restore', 'Academy restored'),
    });
  else
    items.push({
      label: 'Archive',
      icon: Archive,
      run: () => onAction(academy.slug, 'archive', 'Academy archived'),
      danger: true,
    });
  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-label={`Actions for ${academy.title}`}
        onClick={() => setOpen((v) => !v)}
        className="rounded-xl border border-border bg-background p-2 text-muted-foreground shadow-sm transition hover:bg-muted hover:text-foreground"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute bottom-full right-0 z-20 mb-1 w-44 overflow-hidden rounded-xl border border-border bg-white py-1 shadow-sm">
          {items.map(({ label, icon: Icon, danger, run }) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                setOpen(false);
                void run();
              }}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition',
                danger
                  ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30'
                  : 'text-foreground hover:bg-muted',
              )}
            >
              <Icon className="h-4 w-4 text-muted-foreground" /> {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
