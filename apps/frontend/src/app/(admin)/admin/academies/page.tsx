'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
    BadgeCheck,
  BookOpen,
  ExternalLink,
    Globe,
  GraduationCap,
  LayoutGrid,
  LayoutList,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
    X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toast';
import {
  AdminCommandBar,
  AdminPageHeader,
  BarButton,
  BarIconButton,
  BarPrimaryButton,
} from '@/components/admin/admin-chrome';
import {
  EmptyState,
  ErrorBanner,
  FilterChip,
  Pagination,
  PillTabs,
  SegmentedIconToggle,
  Skeleton,
  SkeletonRows,
  StatusPill,
  Toolbar,
  type Tone,
} from '@/components/admin/admin-ui';
import { AcademyRowMenu, type AcademyAction } from './academy-row-menu';

/* Academies are branded destinations: each one carries its own accent colour, a
 * logo, a hero image and a subtitle. Rendering them as bare title/slug rows
 * threw all of that away, so this screen is built as a card gallery by default
 * and keeps a dense table for scanning and bulk work. */

interface AcademyRow {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description?: string | null;
  heroImageUrl?: string | null;
  logoUrl?: string | null;
  accentColor?: string | null;
  isPublished: boolean;
  isArchived: boolean;
  updatedAt: string;
  courseCount: number;
  sortOrder?: number;
}

type StatusKey = 'draft' | 'published' | 'archived';

function statusOf(a: Pick<AcademyRow, 'isPublished' | 'isArchived'>): StatusKey {
  if (a.isArchived) return 'archived';
  return a.isPublished ? 'published' : 'draft';
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

/**
 * Only a literal #rgb / #rrggbb value is ever interpolated into a style.
 * accent_color is operator-supplied and lands straight in a CSS custom property,
 * so anything that is not a plain hex colour is discarded rather than trusted.
 */
function safeAccent(value?: string | null): string | null {
  if (!value) return null;
  const v = value.trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) return v;
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(`#${v}`) && /^[0-9a-f]{3,6}$/i.test(v)) return `#${v}`;
  return null;
}

/** Deterministic fallback hue so an academy without a brand colour still looks distinct. */
function hueFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
}

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

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */
function AcademyCard({
  academy,
  onOpen,
  onAction,
  labels,
  tCommon,
}: {
  academy: AcademyRow;
  onOpen: () => void;
  onAction: (slug: string, action: AcademyAction) => void;
  labels: { publish: string; unpublish: string; archive: string; restore: string; menu: string };
  tCommon: (key: string, values?: Record<string, string | number | Date>) => string;
}) {
  const t = useTranslations('admin.academiesPage');
  const st = statusOf(academy);
  const accent = safeAccent(academy.accentColor);
  const hue = hueFor(academy.id);
  const archived = st === 'archived';

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
        'group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xs transition-all duration-200',
        'card-hover cursor-pointer hover:border-border-strong',
        'focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10',
        archived && 'opacity-80',
      )}
    >
      {/* Cover: the operator's hero image, or a brand-coloured gradient. */}
      <div
        className="relative h-32 w-full shrink-0 overflow-hidden"
        style={
          accent
            ? {
                backgroundImage: `linear-gradient(135deg, ${accent} 0%, ${accent}55 55%, transparent 100%)`,
              }
            : {
                backgroundImage: `linear-gradient(135deg, hsl(${hue} 62% 42%) 0%, hsl(${(hue + 40) % 360} 55% 30%) 100%)`,
              }
        }
      >
        {academy.heroImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={academy.heroImageUrl}
            alt=""
            className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        )}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(to top, rgb(0 0 0 / 0.55) 0%, rgb(0 0 0 / 0.12) 45%, transparent 100%)',
          }}
        />

        {/* Logo sits on the cover edge, the way a product tile would. */}
        <div className="absolute bottom-3 start-4 flex items-end gap-3">
          <span className="flex size-12 items-center justify-center overflow-hidden rounded-xl border-2 border-card bg-card shadow-sm">
            {academy.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={academy.logoUrl} alt="" className="size-full object-cover" />
            ) : (
              <GraduationCap
                className="size-6"
                style={accent ? { color: accent } : { color: `hsl(${hue} 62% 45%)` }}
              />
            )}
          </span>
        </div>

        <div className="absolute end-3 top-3">
          <StatusPill
            label={t(`status.${STATUS_LABEL_KEYS[st]}`, {
              default: STATUS_LABEL_DEFAULTS[st],
            })}
            tone={STATUS_TONE[st]}
            pulse={st === 'published'}
            className="border-card/40 bg-card/85 backdrop-blur-sm"
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="line-clamp-2 block text-sm font-bold leading-snug tracking-tight text-foreground transition group-hover:text-primary">
              {academy.title}
            </span>
            <p className="mt-1 truncate font-mono text-2xs text-muted-foreground">/{academy.slug}</p>
          </div>
          <AcademyRowMenu
            academy={academy}
            onAction={(slug, action) => onAction(slug, action)}
            labels={labels}
          />
        </div>

        {academy.subtitle && (
          <p className="mt-2.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {academy.subtitle}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-4">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2 py-1 text-2xs font-semibold text-foreground">
            <BookOpen className="size-3 text-muted-foreground" />
            {academy.courseCount}
            <span className="font-normal text-muted-foreground">
              {t('courseCount', {
                count: academy.courseCount,
                default: '{count, plural, one {course} other {courses}}',
              }).replace(/^[\d\s]+/, '')}
            </span>
          </span>
          <span className="text-2xs text-muted-foreground">{timeAgo(academy.updatedAt, tCommon)}</span>
        </div>
      </div>

      {/* The whole card opens the editor, so these stay quiet until wanted. A row
          of identical primary buttons would out-shout the content it labels. */}
      <div className="flex items-center gap-2 border-t border-border bg-muted/20 px-5 py-2.5">
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex flex-1 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted active:scale-[0.98]"
        >
          <Pencil className="size-3.5 text-muted-foreground" />
          {t('manage', { default: 'Manage' })}
        </button>
        <a
          href={`/academies/${academy.slug}`}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <ExternalLink className="size-3.5" />
          {t('view', { default: 'View' })}
        </a>
      </div>
    </article>
  );
}

/** Card-shaped placeholder so the gallery does not reflow when data lands. */
function AcademyCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
      <Skeleton className="h-32 w-full rounded-none" />
      <div className="space-y-3 p-5">
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-8 w-full rounded-lg" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function AdminAcademiesPage() {
  const t = useTranslations('admin.academiesPage');
  const tAdmin = useTranslations('admin');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const params = useSearchParams();
  const status = params.get('status') ?? '';
  const q = params.get('q') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const PAGE_SIZE = 12;

  const [rows, setRows] = useState<AcademyRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState<Record<string, number> | null>(null);
  const [facetTotal, setFacetTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qInput, setQInput] = useState(q);
  const [backfillBusy, setBackfillBusy] = useState(false);
  const [view, setView] = useState<'gallery' | 'table'>('gallery');

  const setParam = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === '') next.delete(k);
        else next.set(k, v);
      }
      if (!('page' in patch)) next.delete('page');
      const qs = next.toString();
      router.replace(qs ? `/admin/academies?${qs}` : '/admin/academies');
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
        if (status) qs.set('status', status);
        if (q) qs.set('search', q);
        const res = await fetch(`/api/proxy/admin/academies?${qs.toString()}`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json();
        setRows(Array.isArray(data?.items) ? data.items : []);
        setTotal(Number(data?.total ?? 0));
        setFacets(data?.facets && typeof data.facets === 'object' ? data.facets : null);
        setFacetTotal(Number(data?.facetTotal ?? data?.total ?? 0));
      } catch (e) {
        setError(e instanceof Error ? e.message : t('loadFailed', { default: 'Failed to load' }));
        setRows(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [page, status, q],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const act = useCallback(
    async (
      slug: string,
      action: 'publish' | 'unpublish' | 'archive' | 'restore',
      okMsg?: string,
    ) => {
      try {
        const res = await fetch(`/api/proxy/admin/academies/${slug}/${action}`, {
          method: 'POST',
          credentials: 'include',
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.message ?? `${res.status}`);
        }
        toast({
          type: 'ok',
          title: okMsg ?? t(`actionDone.${action}`, { default: `Academy ${action}ed` }),
        });
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

  const runBackfill = useCallback(async () => {
    setBackfillBusy(true);
    try {
      const reportRes = await fetch('/api/proxy/admin/academies/backfill/report', {
        credentials: 'include',
      });
      if (!reportRes.ok) throw new Error('Report failed');
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
      if (!res.ok) throw new Error(data?.message ?? 'Backfill failed');
      toast({
        type: 'ok',
        title: t('defaultAcademyReady', { default: 'Default academy ready' }),
        description: t('defaultAcademyBody', {
          created: data.created ? 'Created' : 'Reused',
          title: report.proposed.title,
          assigned: data.assigned,
          default:
            '{created} "{title}" — {assigned, plural, one {# course} other {# courses}} assigned.',
        }),
      });
      void load(true);
    } catch (e) {
      toast({
        type: 'err',
        title: t('backfillFailed', { default: 'Backfill failed' }),
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setBackfillBusy(false);
    }
  }, [load, t]);

  const countOf = (k: string) => facets?.[k] ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(status || q);
  const shownCourses = useMemo(
    () => (rows ?? []).reduce((sum, a) => sum + (a.courseCount ?? 0), 0),
    [rows],
  );

  const menuLabels = {
    publish: t('action.publish', { default: 'Publish' }),
    unpublish: t('action.unpublish', { default: 'Unpublish' }),
    archive: t('action.archive', { default: 'Archive' }),
    restore: t('action.restore', { default: 'Restore' }),
    menu: t('action.menu', { title: '', default: 'Academy actions' }),
  };

  return (
    <div className="w-full">
      <AdminCommandBar
        trail={[{ label: 'Titans of CNC' }, { label: tAdmin('academies', { default: 'Academies' })}]}
        count={loading ? null : total}
        live={t('live', { default: 'Live' })}
        search={{
          value: qInput,
          onChange: setQInput,
          placeholder: t('searchPlaceholder', { default: 'Search academies…' }),
          ariaLabel: t('searchAria', { default: 'Search academies' }),
        }}
        actions={
          <>
            <BarIconButton
              title={t('refresh', { default: 'Refresh academies' })}
              spinning={refreshing}
              onClick={() => load(true)}
            >
              <RefreshCw className="size-4" />
            </BarIconButton>
            <BarButton
              icon={<Sparkles className="size-4" />}
              disabled={backfillBusy}
              onClick={() => void runBackfill()}
            >
              {t('defaultAcademy', { default: 'Default academy' })}
            </BarButton>
          </>
        }
        primary={
          <BarPrimaryButton
            icon={<Plus className="size-4" strokeWidth={2.5} />}
            onClick={() => router.push('/admin/academies/new')}
          >
            {t('newAcademy', { default: 'New academy' })}
          </BarPrimaryButton>
        }
      />

      <div className="mx-auto w-full max-w-[1500px] space-y-6 pt-6">
        <AdminPageHeader
          title={tAdmin('academies', { default: 'Academies' })}
          description={t('description', {
            default:
              'Academies are branded destinations that group your courses into programs — assign courses from here or from Course Studio.',
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

        {/* One unified summary rather than four competing boxes: the numbers read
            as a single sentence about the catalogue. */}
        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
          <dl className="grid grid-cols-2 divide-x divide-border sm:grid-cols-4">
            {[
              {
                key: 'total',
                icon: GraduationCap,
                label: t('kpiTotal', { default: 'Academies' }),
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
                key: 'courses',
                icon: BookOpen,
                label: t('kpiCoursesPlaced', { default: 'Courses placed' }),
                value: loading ? '—' : shownCourses,
                tone: 'text-foreground' as const,
              },
            ].map((s) => (
              <div key={s.key} className="flex items-center gap-3 px-5 py-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/60 text-muted-foreground">
                  <s.icon className="size-4" />
                </span>
                <div className="min-w-0">
                  <dd className={cn('font-display text-xl font-bold leading-none tabular-nums', s.tone)}>
                    {loading && s.key === 'courses' ? '—' : s.value}
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
            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setQInput('');
                  router.replace('/admin/academies');
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
                { key: 'gallery', icon: LayoutGrid, label: t('galleryView', { default: 'Gallery view' }) },
                { key: 'table', icon: LayoutList, label: t('tableView', { default: 'Table view' }) },
              ]}
            />
          </div>
        </Toolbar>

        {loading ? (
          view === 'gallery' ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <AcademyCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <SkeletonRows rows={6} columns={3} />
            </div>
          )
        ) : !rows || rows.length === 0 ? (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <EmptyState
              icon={hasFilters ? GraduationCap : Sparkles}
              tone={hasFilters ? 'amber' : 'blue'}
              title={
                hasFilters
                  ? t('emptyNoMatch', { default: 'No academies match your filters' })
                  : t('emptyCreateFirst', { default: 'Create your first academy' })
              }
              body={
                hasFilters
                  ? t('emptyNoMatchBody', { default: 'Try adjusting or clearing your filters.' })
                  : t('emptyCreateFirstBody', {
                      default:
                        'Academies group courses into branded programs. Create one, then assign courses to it.',
                    })
              }
              action={
                hasFilters ? (
                  <button
                    type="button"
                    onClick={() => {
                      setQInput('');
                      router.replace('/admin/academies');
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold shadow-xs transition hover:bg-muted"
                  >
                    <X className="size-4" />
                    {t('clearFilters', { default: 'Clear filters' })}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => router.push('/admin/academies/new')}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-xs transition hover:bg-primary active:scale-[0.98]"
                  >
                    <Plus className="size-4" />
                    {t('newAcademy', { default: 'New academy' })}
                  </button>
                )
              }
            />
          </div>
        ) : view === 'gallery' ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((a) => (
              <AcademyCard
                key={a.id}
                academy={a}
                onOpen={() => router.push(`/admin/academies/${a.slug}/edit`)}
                onAction={(slug, action) => void act(slug, action)}
                labels={menuLabels}
                tCommon={tCommon}
              />
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] border-collapse text-start">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <th scope="col" className="px-6 py-3.5 text-start font-semibold">
                      {t('colAcademy', { default: 'Academy' })}
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-start font-semibold">
                      {t('colStatus', { default: 'Status' })}
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-end font-semibold">
                      {t('colCourses', { default: 'Courses' })}
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-end font-semibold">
                      {t('colUpdated', { default: 'Updated' })}
                    </th>
                    <th scope="col" className="py-3.5 pe-6 ps-4 text-end font-semibold">
                      {t('colActions', { default: 'Actions' })}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-13">
                  {rows.map((a) => {
                    const st = statusOf(a);
                    return (
                      <tr
                        key={a.id}
                        tabIndex={0}
                        onClick={() => router.push(`/admin/academies/${a.slug}/edit`)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            router.push(`/admin/academies/${a.slug}/edit`);
                          }
                        }}
                        className="group cursor-pointer transition-colors duration-150 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                      >
                        <td className="px-6 py-3.5">
                          <div className="flex min-w-0 items-center gap-3">
                            <span
                              className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border"
                              style={
                                safeAccent(a.accentColor)
                                  ? { backgroundColor: `${safeAccent(a.accentColor)}1a`, color: safeAccent(a.accentColor)! }
                                  : undefined
                              }
                            >
                              {a.logoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={a.logoUrl} alt="" className="size-full object-cover" />
                              ) : (
                                <GraduationCap className="size-5" />
                              )}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-foreground transition group-hover:text-primary">
                                {a.title}
                              </p>
                              <p className="truncate font-mono text-2xs text-muted-foreground">/{a.slug}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <StatusPill
                            label={t(`status.${STATUS_LABEL_KEYS[st]}`, {
                              default: STATUS_LABEL_DEFAULTS[st],
                            })}
                            tone={STATUS_TONE[st]}
                            pulse={st === 'published'}
                          />
                        </td>
                        <td className="px-4 py-3.5 text-end">
                          <span className="font-semibold tabular-nums text-foreground">{a.courseCount}</span>
                        </td>
                        <td className="px-4 py-3.5 text-end">
                          <p className="font-medium text-foreground">
                            {new Date(a.updatedAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </p>
                          <p className="text-2xs text-muted-foreground">
                            {timeAgo(a.updatedAt, tCommon)}
                          </p>
                        </td>
                        <td className="py-3.5 pe-6 ps-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <AcademyRowMenu
                              academy={a}
                              onAction={(slug, action) => void act(slug, action)}
                              labels={menuLabels}
                            />
                            <button
                              type="button"
                              onClick={() => router.push(`/admin/academies/${a.slug}/edit`)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground shadow-xs transition hover:bg-muted active:scale-[0.98]"
                            >
                              <Pencil className="size-3.5" />
                              {t('manage', { default: 'Manage' })}
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
