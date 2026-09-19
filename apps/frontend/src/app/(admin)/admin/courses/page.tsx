'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
  BookOpen,
  Layers,
  Eye,
  Users,
  PlayCircle,
  BadgeCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toast';
import {
  AdminCommandBar,
  BarIconButton,
  BarPrimaryButton,
  AdminKpiCard,
  AdminPageHeader,
} from '@/components/admin/admin-chrome';
import {
  Toolbar,
  PillTabs,
  Select,
  TableCard,
  Pagination,
  EmptyState,
} from '@/components/admin/admin-ui';
interface CourseRow {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description?: string | null;
  thumbnailUrl: string | null;
  isPublished: boolean;
  isArchived: boolean;
  updatedAt: string;
  publishedAt: string | null;
  difficulty: number | null;
  enrollments: number;
  lessonsCount: number;
}
function statusOf(c: Pick<CourseRow, 'isPublished' | 'isArchived'>) {
  if (c.isArchived) return 'archived';
  return c.isPublished ? 'published' : 'draft';
}
const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-amber-50 text-amber-700 border-amber-200/70',
  published: 'bg-emerald-50 text-emerald-700 border-emerald-200/70',
  archived: 'bg-muted text-muted-foreground border-border',
};
export default function AdminCoursesPage() {
  const tAdmin = useTranslations('admin');
  const router = useRouter();
  const params = useSearchParams();
  const status = params.get('status') ?? '';
  const zeroEnrollments = params.get('enrollments') === '0';
  const academy = params.get('academy') ?? '';
  const q = params.get('q') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const PAGE_SIZE = 12;
  const [academyOptions, setAcademyOptions] = useState<{ slug: string; title: string }[]>([]);
  const [rows, setRows] = useState<CourseRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qInput, setQInput] = useState(q);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const setParam = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === '') next.delete(k);
        else next.set(k, v);
      }
      if (!('page' in patch)) next.delete('page');
      router.replace(`/admin/courses?${next.toString()}`);
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
        if (zeroEnrollments) qs.set('enrollments', '0');
        if (academy) qs.set('academy', academy);
        if (q) qs.set('search', q);
        const res = await fetch(`/api/proxy/admin/courses?${qs.toString()}`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const data = await res.json();
        setRows(Array.isArray(data?.items) ? data.items : []);
        setTotal(Number(data?.total ?? 0));
      } catch (e: any) {
        setError(e?.message || 'Failed to load courses');
        setRows(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, status, zeroEnrollments, academy, q],
  );
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/proxy/admin/academies?limit=100', {
          credentials: 'include',
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data?.items)) {
          setAcademyOptions(
            data.items.map((a: { slug: string; title: string }) => ({
              slug: a.slug,
              title: a.title,
            })),
          );
        }
      } catch {
        // filter simply stays hidden-empty; list still loads unfiltered
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const act = async (
    slug: string,
    action: 'publish' | 'unpublish' | 'archive' | 'restore',
    okMsg: string,
  ) => {
    try {
      const res = await fetch(`/api/proxy/admin/courses/${slug}/${action}`, {
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
  const stats = useMemo(() => {
    const all = rows ?? [];
    return {
      total,
      published: all.filter((c) => statusOf(c) === 'published').length,
      drafts: all.filter((c) => statusOf(c) === 'draft').length,
      enrollments: all.reduce((s, c) => s + (c.enrollments ?? 0), 0),
    };
  }, [rows, total]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(status || zeroEnrollments || q);
  return (
    <div className="w-full">
      <AdminCommandBar
        trail={[{ label: 'Titans of CNC' }, { label: tAdmin('courses') }]}
        count={loading ? null : total}
        live="Live"
        search={{
          value: qInput,
          onChange: setQInput,
          placeholder: 'Search by title or slug…',
          ariaLabel: 'Search courses',
        }}
        actions={
          <BarIconButton
            title="Refresh courses"
            spinning={loading || refreshing}
            onClick={() => load(true)}
          >
            <RefreshCw className="h-4 w-4" />
          </BarIconButton>
        }
        primary={
          <BarPrimaryButton
            icon={<Plus className="h-4 w-4" strokeWidth={2.5} />}
            onClick={() => router.push('/admin/courses/new')}
          >
            New course
          </BarPrimaryButton>
        }
      />

      <div className="mx-auto w-full max-w-[1500px] space-y-6 pt-6">
        <AdminPageHeader
          title={tAdmin('courses')}
          description="Create, publish and organize your catalog — every course with live enrollment and lesson counts."
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
            label="Total courses"
            value={loading ? '—' : String(total)}
            sub={`${rows?.length ?? 0} shown`}
            tone="blue"
          />
          <AdminKpiCard
            icon={Globe}
            label="Published"
            value={String(stats.published)}
            sub="Live to learners"
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
            icon={Users}
            label="Enrollments"
            value={stats.enrollments.toLocaleString()}
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
          />{' '}
          <button
            type="button"
            onClick={() => setParam({ enrollments: zeroEnrollments ? null : '0' })}
            className={cn(
              'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition active:scale-[0.98]',
              zeroEnrollments
                ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200'
                : 'border-border bg-background text-muted-foreground hover:text-foreground',
            )}
          >
            <span
              className={cn(
                'h-2 w-2 rounded-full',
                zeroEnrollments ? 'bg-red-500' : 'bg-muted-foreground/40',
              )}
            />
            Zero enrollments
          </button>
          <div className="ml-auto flex items-center gap-2">
            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setQInput('');
                  router.replace('/admin/courses');
                }}
                className="h-9 shrink-0 rounded-xl bg-blue-600 px-3.5 text-xs font-bold text-white shadow-sm shadow-blue-600/25 transition hover:bg-blue-700 active:scale-[0.98]"
              >
                Clear
              </button>
            )}
            <Select
              value={academy}
              onChange={(v) => setParam({ academy: v || null })}
              label="Academy"
            >
              {' '}
              <option value="">All academies</option>{' '}
              {academyOptions.map((a) => (
                <option key={a.slug} value={a.slug}>
                  {a.title}
                </option>
              ))}{' '}
            </Select>{' '}
            <Select value={view} onChange={(v) => setView(v as any)} label="View">
              <option value="grid">Grid view</option> <option value="list">List view</option>
            </Select>
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
          view === 'grid' ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card">
                  <div className="aspect-[16/9] animate-pulse bg-muted" />
                  <div className="space-y-2 p-4">
                    <div className="h-4 w-2/3 animate-pulse rounded-md bg-muted" />
                    <div className="h-3 w-1/2 animate-pulse rounded-md bg-muted/70" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <TableCard>
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 border-b border-border p-4 last:border-0"
                >
                  <div className="h-12 w-20 animate-pulse rounded-xl bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-48 animate-pulse rounded-md bg-muted" />
                    <div className="h-3 w-32 animate-pulse rounded-md bg-muted/60" />
                  </div>
                </div>
              ))}
            </TableCard>
          )
        ) : !rows || rows.length === 0 ? (
          <TableCard>
            {' '}
            <EmptyState
              icon={BookOpen}
              title={hasFilters ? 'No courses match your filters' : 'Create your first course'}
              body={
                zeroEnrollments
                  ? 'Every course has at least one enrollment — great sign.'
                  : hasFilters
                    ? 'Try adjusting or clearing your filters.'
                    : 'Build a course with the studio: basics, curriculum, media and pricing.'
              }
              action={
                hasFilters ? (
                  <button
                    type="button"
                    onClick={() => {
                      setQInput('');
                      router.replace('/admin/courses');
                    }}
                    className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold shadow-sm hover:bg-muted"
                  >
                    Clear filters
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => router.push('/admin/courses/new')}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-700 active:scale-[0.98]"
                  >
                    <Plus className="h-4 w-4" /> New course
                  </button>
                )
              }
            />{' '}
          </TableCard>
        ) : view === 'grid' ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {' '}
            {rows.map((c) => {
              const st = statusOf(c);
              return (
                <article
                  key={c.id}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
                >
                  {' '}
                  <button
                    type="button"
                    onClick={() => router.push(`/admin/courses/${c.slug}/edit`)}
                    className="relative block aspect-[16/9] overflow-hidden text-left"
                  >
                    {' '}
                    {c.thumbnailUrl /* eslint-disable-next-line @next/next/no-img-element */ ? (
                      <img
                        src={c.thumbnailUrl}
                        alt=""
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center bg-muted">
                        <BookOpen className="h-10 w-10 text-muted-foreground/50" />
                      </span>
                    )}
                    <span className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
                    <span
                      className={cn(
                        'absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border bg-white/95 px-2.5 py-0.5 text-[11px] font-semibold capitalize shadow-sm backdrop-blur',
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
                    <span className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
                      {' '}
                      <span className="inline-flex items-center gap-1 rounded-md bg-foreground px-2 py-0.5 text-[11px] font-semibold text-white">
                        <Users className="h-3 w-3" /> {c.enrollments}
                      </span>{' '}
                      <span className="inline-flex items-center gap-1 rounded-md bg-foreground px-2 py-0.5 text-[11px] font-semibold text-white">
                        <PlayCircle className="h-3 w-3" /> {c.lessonsCount} lessons
                      </span>{' '}
                    </span>{' '}
                  </button>{' '}
                  <div className="flex flex-1 flex-col p-4">
                    <h3 className="truncate text-[15px] font-bold tracking-tight transition group-hover:text-blue-600">
                      {c.title}
                    </h3>
                    {(c.subtitle || c.description) && (
                      <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-[13px] leading-snug text-muted-foreground">
                        {c.subtitle || c.description}
                      </p>
                    )}
                    <p className="mt-1.5 flex items-center gap-1.5 truncate font-mono text-xs text-muted-foreground">
                      <span className="truncate">/{c.slug}</span>
                      <span aria-hidden="true">·</span>
                      <span className="shrink-0">
                        {typeof c.difficulty === 'number' ? `L${c.difficulty} · ` : ''}Updated{' '}
                        {new Date(c.updatedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </p>
                    <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
                      <button
                        type="button"
                        onClick={() => router.push(`/admin/courses/${c.slug}/edit`)}
                        className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-600 text-xs font-bold text-white shadow-md shadow-blue-600/25 transition hover:bg-blue-700 active:scale-[0.98]"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                      <CourseRowMenu course={c} onAction={act} compact />
                    </div>
                  </div>{' '}
                </article>
              );
            })}{' '}
          </div>
        ) : (
          <TableCard
            header={
              <div className="grid grid-cols-12 gap-2">
                <span className="col-span-6">Course</span>
                <span className="col-span-2">Status</span>
                <span className="col-span-1 text-right">Enrolled</span>
                <span className="col-span-1 text-right">Lessons</span>
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
            {' '}
            {rows.map((c) => {
              const st = statusOf(c);
              return (
                <div
                  key={c.id}
                  onClick={() => router.push(`/admin/courses/${c.slug}/edit`)}
                  className="group grid cursor-pointer grid-cols-12 items-center gap-2 border-b border-border px-5 py-3.5 transition last:border-0 hover:bg-muted/50"
                >
                  <span className="col-span-6 flex min-w-0 items-center gap-3">
                    {c.thumbnailUrl /* eslint-disable-next-line @next/next/no-img-element */ ? (
                      <img
                        src={c.thumbnailUrl}
                        alt=""
                        className="h-10 w-16 shrink-0 rounded-lg object-cover shadow-sm ring-1 ring-border"
                      />
                    ) : (
                      <span className="flex h-10 w-16 shrink-0 items-center justify-center rounded-lg bg-blue-600/10 text-blue-600 transition group-hover:bg-blue-600 group-hover:text-white dark:text-blue-400">
                        <BookOpen className="h-4 w-4" />
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold tracking-tight transition group-hover:text-blue-600">
                        {c.title}
                      </span>
                      <span className="block truncate font-mono text-[11px] text-muted-foreground">
                        /{c.slug}
                        {typeof c.difficulty === 'number' ? ` · L${c.difficulty}` : ''}
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
                  <span className="col-span-1 text-right">
                    <span className="block text-sm font-bold tabular-nums">{c.enrollments}</span>
                    <span className="block text-[11px] text-muted-foreground">enrolled</span>
                  </span>
                  <span className="col-span-1 text-right">
                    <span className="block text-sm font-bold tabular-nums">{c.lessonsCount}</span>
                    <span className="block text-[11px] text-muted-foreground">lessons</span>
                  </span>
                  <span
                    className="col-span-2 flex justify-end"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <CourseRowMenu course={c} onAction={act} compact />
                    <button
                      type="button"
                      onClick={() => router.push(`/admin/courses/${c.slug}/edit`)}
                      className="ml-1.5 inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm shadow-blue-600/25 transition hover:bg-blue-700 focus-visible:opacity-100 max-lg:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                    >
                      <Eye className="h-3.5 w-3.5" /> Open
                    </button>
                  </span>
                </div>
              );
            })}{' '}
          </TableCard>
        )}{' '}
        {!loading && rows && rows.length > 0 && view === 'grid' && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              onPrev={() => setParam({ page: String(page - 1) })}
              onNext={() => setParam({ page: String(page + 1) })}
            />
          </div>
        )}
      </div>
    </div>
  );
}
function CourseRowMenu({
  course,
  onAction,
  compact,
}: {
  course: CourseRow;
  onAction: (
    slug: string,
    action: 'publish' | 'unpublish' | 'archive' | 'restore',
    msg: string,
  ) => Promise<void>;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const st = statusOf(course);
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
      run: () => onAction(course.slug, 'publish', 'Course published'),
    });
  if (st === 'published')
    items.push({
      label: 'Unpublish',
      icon: GlobeLock,
      run: () => onAction(course.slug, 'unpublish', 'Course unpublished'),
    });
  if (st === 'archived')
    items.push({
      label: 'Restore',
      icon: ArchiveRestore,
      run: () => onAction(course.slug, 'restore', 'Course restored'),
    });
  else
    items.push({
      label: 'Archive',
      icon: Archive,
      run: () => onAction(course.slug, 'archive', 'Course archived'),
      danger: true,
    });
  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      {' '}
      <button
        type="button"
        aria-label={`Actions for ${course.title}`}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'rounded-xl border border-border bg-card p-2 text-muted-foreground shadow-sm transition hover:bg-muted hover:text-foreground',
          compact && 'h-8 w-8 p-1.5',
        )}
      >
        {' '}
        <MoreHorizontal className="h-4 w-4" />{' '}
      </button>{' '}
      {open && (
        <div className="absolute bottom-full right-0 z-20 mb-1 w-44 overflow-hidden rounded-xl border border-border bg-white py-1 shadow-sm">
          {' '}
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
              {' '}
              <Icon className="h-4 w-4 text-muted-foreground" /> {label}{' '}
            </button>
          ))}{' '}
        </div>
      )}{' '}
    </div>
  );
}
