'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  difficultyKey,
  difficultyTone,
  difficultyFallback,
} from '@/lib/difficulty';
import {
  BadgeCheck,
  BookOpen,
  ExternalLink,
  EyeOff,
  Globe,
  GraduationCap,
  LayoutGrid,
  LayoutList,
  Pencil,
  PlayCircle,
  Plus,
  RefreshCw,
  Signal,
  Users,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toast';
import {
  AdminCommandBar,
  AdminPageHeader,
  BarIconButton,
  BarPrimaryButton,
} from '@/components/admin/admin-chrome';
import {
  EmptyState,
  ErrorBanner,
  FilterChip,
  Pagination,
  PillTabs,
  Select,
  SegmentedIconToggle,
  Skeleton,
  StatusPill,
  Toolbar,
  type Tone,
} from '@/components/admin/admin-ui';
import { CourseRowMenu, type CourseAction } from './course-row-menu';

/* Courses carry a thumbnail, a subtitle, a difficulty level and live enrollment
 * and lesson counts. The previous card treated the thumbnail as a full-bleed
 * 16:9 hero, so the sixteen courses that have no thumbnail rendered as a large
 * empty box that read as a broken image, and the enrollment/lesson chips used a
 * foreground-coloured background that vanished against dark-mode foreground
 * text. Both are fixed below, and difficulty is now a readable level rather
 * than a raw "L3". */

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
  academyTitle?: string | null;
  academySlug?: string | null;
}

type StatusKey = 'draft' | 'published' | 'archived';

function statusOf(c: Pick<CourseRow, 'isPublished' | 'isArchived'>): StatusKey {
  if (c.isArchived) return 'archived';
  return c.isPublished ? 'published' : 'draft';
}

const STATUS_TONE: Record<StatusKey, Tone> = {
  published: 'emerald',
  draft: 'amber',
  archived: 'slate',
};

const STATUS_LABEL_KEYS: Record<StatusKey, string> = {
  draft: 'draft',
  published: 'published',
  archived: 'archived',
};

const STATUS_LABEL_DEFAULTS: Record<StatusKey, string> = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
};

function timeAgo(
  iso: string,
  tCommon: (key: string, values?: Record<string, string | number | Date>) => string,
): string {
  const tm = new Date(iso).getTime();
  if (Number.isNaN(tm)) return '—';
  const diff = Date.now() - tm;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return tCommon('justNow', { default: 'just now' });
  if (mins < 60) return tCommon('minutesAgo', { n: mins, default: '{n}m ago' });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return tCommon('hoursAgo', { n: hours, default: '{n}h ago' });
  const days = Math.floor(hours / 24);
  if (days < 30) return tCommon('daysAgo', { n: days, default: '{n}d ago' });
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/** Deterministic hue so a course with no thumbnail is still distinguishable. */
function hueFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
}

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */
function CourseCard({
  course,
  onOpen,
  onAction,
  labels,
  tCommon,
}: {
  course: CourseRow;
  onOpen: () => void;
  onAction: (slug: string, action: CourseAction) => void;
  labels: { publish: string; unpublish: string; archive: string; restore: string; menu: string };
  tCommon: (key: string, values?: Record<string, string | number | Date>) => string;
}) {
  const t = useTranslations('admin.coursesPage');
  const tDifficulty = useTranslations('admin');
  const st = statusOf(course);
  const hue = hueFor(course.id);
  const noEnrollments = course.enrollments === 0;

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
        st === 'archived' && 'opacity-80',
      )}
    >
      <div className="flex gap-4 p-4">
        {/* Thumbnail, or a compact branded placeholder. Keeping this small means a
            missing image no longer dominates the whole card. */}
        <div className="relative size-24 shrink-0 overflow-hidden rounded-xl border border-border sm:size-28">
          {course.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={course.thumbnailUrl}
              alt=""
              className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div
              className="flex size-full items-center justify-center"
              style={{
                backgroundImage: `linear-gradient(135deg, hsl(${hue} 55% 26%) 0%, hsl(${(hue + 45) % 360} 50% 16%) 100%)`,
              }}
            >
              <GraduationCap className="size-7 text-white/35" />
            </div>
          )}
          {st !== 'archived' && (
            <span
              className="absolute bottom-1.5 end-1.5 flex size-6 items-center justify-center rounded-md bg-black/60 backdrop-blur-sm"
              title={t('editCourse', { default: 'Edit course' })}
            >
              <PlayCircle className="size-3.5 text-white/85" />
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-2">
            <span className="line-clamp-2 text-sm font-bold leading-snug tracking-tight text-foreground transition group-hover:text-primary">
              {course.title}
            </span>
            <div onClick={(e) => e.stopPropagation()}>
              <CourseRowMenu
                course={course}
                onAction={onAction}
                labels={labels}
              />
            </div>
          </div>

          <p className="mt-0.5 truncate font-mono text-2xs text-muted-foreground">/{course.slug}</p>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <StatusPill
              label={t(`status.${STATUS_LABEL_KEYS[st]}`, {
                default: STATUS_LABEL_DEFAULTS[st],
              })}
              tone={STATUS_TONE[st]}
              pulse={st === 'published'}
            />
            {typeof course.difficulty === 'number' && (
              <StatusPill
                label={tDifficulty(difficultyKey(course.difficulty), {
                  default: difficultyFallback(course.difficulty),
                })}
                tone={difficultyTone(course.difficulty)}
                dot={false}
              />
            )}
            {noEnrollments && st === 'published' && (
              <StatusPill
                label={t('needsAttention', { default: 'No enrollments' })}
                tone="amber"
                icon={EyeOff}
              />
            )}
          </div>

          {(course.subtitle || course.description) && (
            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {course.subtitle || course.description}
            </p>
          )}

          <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-3 text-2xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Users className="size-3" />
              <span className={cn('tabular-nums', noEnrollments && 'font-semibold text-warning')}>
                {course.enrollments}
              </span>
              {t('enrolledShort', { default: 'enrolled' })}
            </span>
            <span className="inline-flex items-center gap-1">
              <BookOpen className="size-3" />
              <span className="tabular-nums">{course.lessonsCount}</span>
              {t('lessonsShort', { default: 'lessons' })}
            </span>
            {course.academyTitle && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <GraduationCap className="size-3 shrink-0" />
                <span className="truncate">{course.academyTitle}</span>
              </span>
            )}
            <span className="ms-auto shrink-0">{timeAgo(course.updatedAt, tCommon)}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-border bg-muted/20 px-4 py-2.5">
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex flex-1 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted active:scale-[0.98]"
        >
          <Pencil className="size-3.5 text-muted-foreground" />
          {t('edit', { default: 'Edit' })}
        </button>
        <a
          href={`/academy/${course.slug}`}
          target="_blank"
          rel="noreferrer noopener"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <ExternalLink className="size-3.5" />
          {t('view', { default: 'View' })}
        </a>
      </div>
    </article>
  );
}

function CourseCardSkeleton() {
  return (
    <div className="flex gap-4 rounded-2xl border border-border bg-card p-4 shadow-xs">
      <Skeleton className="size-24 shrink-0 rounded-xl sm:size-28" />
      <div className="flex-1 space-y-3">
        <Skeleton className="h-3.5 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-5 w-32 rounded-full" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function AdminCoursesPage() {
  const tAdmin = useTranslations('admin');
  const t = useTranslations('admin.coursesPage');
  const tDifficulty = useTranslations('admin');
  const tCommon = useTranslations('common');
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
  const [facets, setFacets] = useState<Record<string, number> | null>(null);
  const [facetTotal, setFacetTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qInput, setQInput] = useState(q);
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
      router.replace(qs ? `/admin/courses?${qs}` : '/admin/courses');
    },
    [params, router],
  );

  useEffect(() => {
    if (qInput === q) return;
    const timer = setTimeout(() => setParam({ q: qInput || null }), 350);
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
        if (status) qs.set('status', status);
        if (zeroEnrollments) qs.set('enrollments', '0');
        if (academy) qs.set('academy', academy);
        if (q) qs.set('search', q);
        const res = await fetch(`/api/proxy/admin/courses?${qs.toString()}`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json();
        setRows(Array.isArray(data?.items) ? data.items : []);
        setTotal(Number(data?.total ?? 0));
        setFacets(data?.facets && typeof data.facets === 'object' ? data.facets : null);
        setFacetTotal(Number(data?.facetTotal ?? data?.total ?? 0));
      } catch (e) {
        setError(e instanceof Error ? e.message : t('loadFailed', { default: 'Failed to load courses' }));
        setRows(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [page, status, zeroEnrollments, academy, q],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/proxy/admin/academies?limit=100', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data?.items)) {
          setAcademyOptions(
            data.items.map((a: { slug: string; title: string }) => ({ slug: a.slug, title: a.title })),
          );
        }
      } catch {
        // The filter simply stays empty; the list still loads unfiltered.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const act = useCallback(
    async (slug: string, action: CourseAction) => {
      try {
        const res = await fetch(`/api/proxy/admin/courses/${slug}/${action}`, {
          method: 'POST',
          credentials: 'include',
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.message ?? `${res.status}`);
        }
        toast({ type: 'ok', title: t(`actionDone.${action}`, { default: `Course ${action}ed` }) });
        void load(true);
      } catch (e) {
        toast({
          type: 'err',
          title: t('actionFailed', { default: 'Action failed' }),
          description: e instanceof Error ? e.message : undefined,
        });
      }
    },
    [load, t],
  );

  const countOf = (k: string) => facets?.[k] ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(status || zeroEnrollments || academy || q);
  const shownEnrollments = useMemo(
    () => (rows ?? []).reduce((s, c) => s + (c.enrollments ?? 0), 0),
    [rows],
  );

  const menuLabels = {
    publish: t('action.publish', { default: 'Publish' }),
    unpublish: t('action.unpublish', { default: 'Unpublish' }),
    archive: t('action.archive', { default: 'Archive' }),
    restore: t('action.restore', { default: 'Restore' }),
    menu: t('action.menu', { default: 'Course actions' }),
  };

  return (
    <div className="w-full">
      <AdminCommandBar
        trail={[{ label: 'Titans of CNC' }, { label: tAdmin('courses', { default: 'Courses' })}]}
        count={loading ? null : total}
        live={tAdmin('live', { default: 'Live' })}
        search={{
          value: qInput,
          onChange: setQInput,
          placeholder: t('searchPlaceholder', { default: 'Search courses…' }),
          ariaLabel: t('searchAria', { default: 'Search courses' }),
        }}
        actions={
          <BarIconButton
            title={t('refreshAria', { default: 'Refresh courses' })}
            spinning={loading || refreshing}
            onClick={() => load(true)}
          >
            <RefreshCw className="size-4" />
          </BarIconButton>
        }
        primary={
          <BarPrimaryButton
            icon={<Plus className="size-4" strokeWidth={2.5} />}
            onClick={() => router.push('/admin/courses/new')}
          >
            {t('newCourse', { default: 'New course' })}
          </BarPrimaryButton>
        }
      />

      <div className="mx-auto w-full max-w-[1500px] space-y-6 pt-6">
        <AdminPageHeader
          title={tAdmin('courses', { default: 'Courses' })}
          description={t('description', {
            default:
              'Create, publish and organize your catalog — every course with live enrollment and lesson counts.',
          })}
          badge={
            <span className="inline-flex items-center gap-2 self-start rounded-full border border-success/30 bg-success/10 px-3 py-1.5 text-xs font-semibold text-success md:self-auto">
              <BadgeCheck className="size-4" />
              {t('tenantSafeBadge', { default: 'Tenant-safe · Instant publish' })}
            </span>
          }
        />

        {error && (
          <ErrorBanner message={error} onRetry={() => load()} retryLabel={tCommon('retry', { default: 'Retry' })} />
        )}

        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
          <dl className="grid grid-cols-2 divide-x divide-border sm:grid-cols-4">
            {[
              {
                key: 'total',
                icon: GraduationCap,
                label: t('kpiTotal', { default: 'Courses' }),
                value: facetTotal || total,
                tone: 'text-foreground' as const,
              },
              {
                key: 'published',
                icon: Globe,
                label: t('kpiPublished', { default: 'Live' }),
                value: countOf('published'),
                tone: 'text-success' as const,
              },
              {
                key: 'drafts',
                icon: Pencil,
                label: t('kpiDrafts', { default: 'Drafts' }),
                value: countOf('draft'),
                tone: countOf('draft') > 0 ? ('text-warning' as const) : ('text-foreground' as const),
              },
              {
                key: 'enrollments',
                icon: Users,
                label: t('kpiEnrollments', { default: 'Enrollments' }),
                value: loading ? '—' : shownEnrollments,
                tone: 'text-foreground' as const,
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

        <Toolbar>
          <PillTabs
            value={status}
            onChange={(k) => setParam({ status: k || null })}
            options={[
              { key: '', label: tCommon('all', { default: 'All' }), count: facetTotal || undefined },
              { key: 'draft', label: t('filterDrafts', { default: 'Drafts' }), count: countOf('draft') },
              {
                key: 'published',
                label: t('filterPublished', { default: 'Published' }),
                count: countOf('published'),
              },
              {
                key: 'archived',
                label: t('filterArchived', { default: 'Archived' }),
                count: countOf('archived'),
              },
            ]}
          />

          <button
            type="button"
            aria-pressed={zeroEnrollments}
            onClick={() => setParam({ enrollments: zeroEnrollments ? null : '0' })}
            className={cn(
              'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition active:scale-[0.98]',
              zeroEnrollments
                ? 'border-destructive/30 bg-destructive/10 text-destructive'
                : 'border-border bg-card text-muted-foreground shadow-xs hover:text-foreground',
            )}
          >
            <Signal className="size-3.5" />
            {t('zeroEnrollments', { default: 'Zero enrollments' })}
          </button>

          <Select
            value={academy}
            onChange={(v) => setParam({ academy: v || null })}
            label={t('academyLabel', { default: 'Academy' })}
          >
            <option value="">{t('allAcademies', { default: 'All academies' })}</option>
            {academyOptions.map((a) => (
              <option key={a.slug} value={a.slug}>
                {a.title}
              </option>
            ))}
          </Select>

          <div className="ms-auto flex flex-wrap items-center justify-end gap-1.5">
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
                tone={STATUS_TONE[status as StatusKey] ?? 'blue'}
                label={t(`status.${STATUS_LABEL_KEYS[status as StatusKey] ?? status}`, {
                  default: STATUS_LABEL_DEFAULTS[status as StatusKey] ?? status,
                })}
                onClear={() => setParam({ status: null })}
              />
            )}
            {zeroEnrollments && (
              <FilterChip
                tone="amber"
                label={t('zeroEnrollments', { default: 'Zero enrollments' })}
                onClear={() => setParam({ enrollments: null })}
              />
            )}
            {academy && (
              <FilterChip
                tone="cyan"
                label={
                  academyOptions.find((a) => a.slug === academy)?.title ??
                  t('academyLabel', { default: 'Academy' })
                }
                onClear={() => setParam({ academy: null })}
              />
            )}
            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setQInput('');
                  router.replace('/admin/courses');
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3.5 text-xs font-bold text-primary-foreground shadow-xs transition hover:bg-primary active:scale-[0.98]"
              >
                <X className="size-3.5" />
                {tCommon('clear', { default: 'Clear' })}
              </button>
            )}
            <SegmentedIconToggle
              label={t('viewMode', { default: 'View mode' })}
              value={view}
              onChange={setView}
              options={[
                { key: 'grid', icon: LayoutGrid, label: t('gridView', { default: 'Grid view' }) },
                { key: 'table', icon: LayoutList, label: t('listView', { default: 'List view' }) },
              ]}
            />
          </div>
        </Toolbar>

        {loading ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <CourseCardSkeleton key={i} />
            ))}
          </div>
        ) : !rows || rows.length === 0 ? (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <EmptyState
              icon={hasFilters ? GraduationCap : BookOpen}
              tone={hasFilters ? 'amber' : 'blue'}
              title={
                hasFilters
                  ? t('emptyNoMatch', { default: 'No courses match your filters' })
                  : t('emptyCreateFirst', { default: 'Create your first course' })
              }
              body={
                hasFilters
                  ? t('emptyNoMatchBody', { default: 'Try adjusting or clearing your filters.' })
                  : t('emptyCreateFirstBody', {
                      default:
                        'Courses hold your lessons, media and pricing. Create one to start building your academy.',
                    })
              }
              action={
                hasFilters ? (
                  <button
                    type="button"
                    onClick={() => {
                      setQInput('');
                      router.replace('/admin/courses');
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold shadow-xs transition hover:bg-muted"
                  >
                    <X className="size-4" />
                    {t('clearFilters', { default: 'Clear filters' })}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => router.push('/admin/courses/new')}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-xs transition hover:bg-primary active:scale-[0.98]"
                  >
                    <Plus className="size-4" />
                    {t('newCourse', { default: 'New course' })}
                  </button>
                )
              }
            />
          </div>
        ) : view === 'grid' ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {rows.map((c) => (
              <CourseCard
                key={c.id}
                course={c}
                onOpen={() => router.push(`/admin/courses/${c.slug}/edit`)}
                onAction={(slug, action) => void act(slug, action)}
                labels={menuLabels}
                tCommon={tCommon}
              />
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-start">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <th scope="col" className="px-6 py-3.5 text-start font-semibold">
                      {t('colCourse', { default: 'Course' })}
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-start font-semibold">
                      {t('colStatus', { default: 'Status' })}
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-end font-semibold">
                      {t('colLessons', { default: 'Lessons' })}
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-end font-semibold">
                      {t('colEnrollments', { default: 'Enrolled' })}
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-start font-semibold">
                      {t('colUpdated', { default: 'Updated' })}
                    </th>
                    <th scope="col" className="py-3.5 pe-6 ps-4 text-end font-semibold">
                      {t('colActions', { default: 'Actions' })}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-13">
                  {rows.map((c) => {
                    const st = statusOf(c);
                    return (
                      <tr
                        key={c.id}
                        tabIndex={0}
                        onClick={() => router.push(`/admin/courses/${c.slug}/edit`)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            router.push(`/admin/courses/${c.slug}/edit`);
                          }
                        }}
                        className="group cursor-pointer transition-colors duration-150 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                      >
                        <td className="px-6 py-3.5">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border">
                              {c.thumbnailUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={c.thumbnailUrl} alt="" className="size-full object-cover" />
                              ) : (
                                <GraduationCap className="size-4 text-muted-foreground" />
                              )}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-foreground transition group-hover:text-primary">
                                {c.title}
                              </p>
                              <p className="truncate font-mono text-2xs text-muted-foreground">
                                /{c.slug}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <StatusPill
                              label={t(`status.${STATUS_LABEL_KEYS[st]}`, {
                                default: STATUS_LABEL_DEFAULTS[st],
                              })}
                              tone={STATUS_TONE[st]}
                              pulse={st === 'published'}
                            />
                            {typeof c.difficulty === 'number' && (
                              <StatusPill
                                label={tDifficulty(difficultyKey(c.difficulty), {
                                  default: difficultyFallback(c.difficulty),
                                })}
                                tone={difficultyTone(c.difficulty)}
                                dot={false}
                              />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-end font-semibold tabular-nums text-foreground">
                          {c.lessonsCount}
                        </td>
                        <td className="px-4 py-3.5 text-end">
                          <span
                            className={cn(
                              'tabular-nums',
                              c.enrollments === 0
                                ? 'font-semibold text-warning'
                                : 'text-foreground',
                            )}
                          >
                            {c.enrollments}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-muted-foreground">
                          {timeAgo(c.updatedAt, tCommon)}
                        </td>
                        <td className="py-3.5 pe-6 ps-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <CourseRowMenu
                              course={c}
                              onAction={(slug, action) => void act(slug, action)}
                              labels={menuLabels}
                            />
                            <button
                              type="button"
                              onClick={() => router.push(`/admin/courses/${c.slug}/edit`)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground shadow-xs transition hover:bg-muted active:scale-[0.98]"
                            >
                              <Pencil className="size-3.5" />
                              {t('edit', { default: 'Edit' })}
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
      </div>
    </div>
  );
}
