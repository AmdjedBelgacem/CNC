'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  ExternalLink,
  Globe,
  GraduationCap,
  LayoutGrid,
  LayoutList,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Star,
  TrendingDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toast';
import { formatMoney } from '@/lib/api/normalize';
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
  SegmentedIconToggle,
  Select,
  Skeleton,
  StatusPill,
  Toolbar,
  type Tone,
} from '@/components/admin/admin-ui';
import { ProductRowMenu, type ProductAction } from './product-row-menu';
import { categoryStyle } from '@/components/admin/product-category';

/* A product catalogue with no product photography still has one strong visual
 * signal per item: its category. Each card is built around that, with the price
 * as the headline number, because in a store the price is what the operator is
 * scanning for. Stock state and the featured flag are surfaced as badges so
 * problems in the catalogue are visible without opening each row. */

interface ProductRow {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  description?: string | null;
  thumbnailUrl: string | null;
  price: number;
  compareAtPrice: number | null;
  currency: string;
  category: string | null;
  isPublished: boolean;
  isArchived: boolean;
  featured: boolean;
  inventory: number | null;
  trackInventory: boolean;
  isDigital: boolean;
  updatedAt: string;
  academyId: string | null;
  courseId: string | null;
  academy?: { id: string; title: string; slug: string } | null;
  course?: { id: string; title: string; slug: string } | null;
}

type StatusKey = 'draft' | 'published' | 'archived';

function statusOf(p: Pick<ProductRow, 'isPublished' | 'isArchived'>): StatusKey {
  if (p.isArchived) return 'archived';
  return p.isPublished ? 'published' : 'draft';
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

/** Stock state drives both the colour and the wording on the card. */
function stockState(p: ProductRow): { tone: Tone; key: string; value: number } | null {
  if (!p.trackInventory || p.isDigital) return null;
  const n = p.inventory ?? 0;
  if (n === 0) return { tone: 'rose', key: 'outOfStock', value: n };
  if (n < 5) return { tone: 'amber', key: 'lowStock', value: n };
  return { tone: 'slate', key: 'inStock', value: n };
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
function ProductCard({
  product,
  onOpen,
  onAction,
  labels,
  tCommon,
}: {
  product: ProductRow;
  onOpen: () => void;
  onAction: (slug: string, action: ProductAction) => void;
  labels: {
    publish: string;
    unpublish: string;
    archive: string;
    restore: string;
    delete: string;
    menu: string;
  };
  tCommon: (key: string, values?: Record<string, string | number | Date>) => string;
}) {
  const t = useTranslations('admin.productsPage');
  const st = statusOf(product);
  const style = categoryStyle(product.category);
  const CategoryIcon = style.icon;
  const stock = stockState(product);
  const discounted =
    product.compareAtPrice != null && product.compareAtPrice > product.price;
  const discountPct = discounted
    ? Math.round((1 - product.price / (product.compareAtPrice as number)) * 100)
    : 0;

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
        {/* Category tile, or the real product image when one is uploaded. */}
        <div
          className="relative flex size-24 shrink-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border border-border sm:size-28"
          style={{
            backgroundImage: `linear-gradient(140deg, hsl(${style.hue} 58% 40%) 0%, hsl(${(style.hue + 38) % 360} 52% 24%) 100%)`,
          }}
        >
          {product.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.thumbnailUrl}
              alt=""
              className="absolute inset-0 size-full object-cover"
            />
          ) : (
            <CategoryIcon className="size-7 text-white/80" />
          )}
          {discounted && (
            <span className="absolute bottom-1 end-1 inline-flex items-center gap-0.5 rounded-md bg-black/65 px-1.5 py-0.5 text-2xs font-bold text-white backdrop-blur-sm">
              <TrendingDown className="size-2.5" />
              {discountPct}%
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-2">
            {/* Price leads: in a catalogue this is the number being scanned for. */}
            <div className="min-w-0">
              <p className="font-display text-lg font-bold leading-none tracking-tight tabular-nums text-foreground">
                {formatMoney(product.price, product.currency)}
              </p>
              {discounted && (
                <p className="mt-1 text-2xs tabular-nums text-muted-foreground line-through">
                  {formatMoney(product.compareAtPrice, product.currency)}
                </p>
              )}
            </div>
            <div onClick={(e) => e.stopPropagation()}>
              <ProductRowMenu product={product} onAction={onAction} labels={labels} />
            </div>
          </div>

          <span className="mt-2 line-clamp-2 text-sm font-semibold leading-snug text-foreground transition group-hover:text-primary">
            {product.title}
          </span>
          {product.tagline && (
            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{product.tagline}</p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <StatusPill
              label={t(`status.${STATUS_LABEL_KEYS[st]}`, {
                default: STATUS_LABEL_DEFAULTS[st],
              })}
              tone={STATUS_TONE[st]}
              pulse={st === 'published'}
            />
            {product.category && (
              <StatusPill label={product.category} tone={style.tone} dot={false} icon={CategoryIcon} />
            )}
            {product.featured && (
              <StatusPill label={t('featured', { default: 'Featured' })} tone="purple" dot={false} icon={Star} />
            )}
            {product.isDigital && (
              <StatusPill label={t('digital', { default: 'Digital' })} tone="cyan" dot={false} />
            )}
          </div>

          <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-3 text-2xs text-muted-foreground">
            {stock && (
              <span className="inline-flex items-center gap-1">
                <span
                  className={cn(
                    'tabular-nums font-semibold',
                    stock.tone === 'rose'
                      ? 'text-destructive'
                      : stock.tone === 'amber'
                        ? 'text-warning'
                        : 'text-foreground',
                  )}
                >
                  {stock.value}
                </span>
                {t(`stock.${stock.key}`, { default: 'in stock' })}
              </span>
            )}
            {product.academy && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <GraduationCap className="size-3 shrink-0" />
                <span className="truncate">{product.academy.title}</span>
              </span>
            )}
            {product.course && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <GraduationCap className="size-3 shrink-0" />
                <span className="truncate">{product.course.title}</span>
              </span>
            )}
            <span className="ms-auto shrink-0">{timeAgo(product.updatedAt, tCommon)}</span>
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
          {t('manage', { default: 'Manage' })}
        </button>
        <a
          href={`/products/${product.slug}`}
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

function ProductCardSkeleton() {
  return (
    <div className="flex gap-4 rounded-2xl border border-border bg-card p-4 shadow-xs">
      <Skeleton className="size-24 shrink-0 rounded-xl sm:size-28" />
      <div className="flex-1 space-y-3">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-3.5 w-2/3" />
        <Skeleton className="h-5 w-40 rounded-full" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function AdminProductsPage() {
  const t = useTranslations('admin.productsPage');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const params = useSearchParams();
  const status = params.get('status') ?? '';
  const category = params.get('category') ?? '';
  const q = params.get('q') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const PAGE_SIZE = 12;

  const [rows, setRows] = useState<ProductRow[] | null>(null);
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
      router.replace(qs ? `/admin/products?${qs}` : '/admin/products');
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
        if (category) qs.set('category', category);
        if (q) qs.set('search', q);
        const res = await fetch(`/api/proxy/admin/products?${qs.toString()}`, {
          credentials: 'include',
        });
        if (!res.ok) {
          throw new Error(
            t('loadFailed', { status: res.status, default: 'Request failed ({status})' }),
          );
        }
        const data = await res.json();
        setRows(Array.isArray(data?.items) ? data.items : []);
        setTotal(Number(data?.total ?? 0));
        setFacets(data?.facets && typeof data.facets === 'object' ? data.facets : null);
        setFacetTotal(Number(data?.facetTotal ?? data?.total ?? 0));
      } catch (e) {
        setError(
          e instanceof Error ? e.message : t('loadFailedGeneric', { default: 'Failed to load products' }),
        );
        setRows(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [page, status, category, q],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const act = useCallback(
    async (slug: string, action: ProductAction) => {
      try {
        const method = action === 'delete' ? 'DELETE' : 'POST';
        const res = await fetch(`/api/proxy/admin/products/${slug}/${action}`, {
          method,
          credentials: 'include',
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.message ?? `${res.status}`);
        }
        toast({ type: 'ok', title: t(`actionDone.${action}`, { default: `Product ${action}ed` }) });
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

  // Category options come from what is on this page rather than a second request.
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows ?? []) if (r.category) set.add(r.category);
    return [...set].sort();
  }, [rows]);

  const countOf = (k: string) => facets?.[k] ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(status || category || q);

  const menuLabels = {
    publish: t('action.publish', { default: 'Publish' }),
    unpublish: t('action.unpublish', { default: 'Unpublish' }),
    archive: t('action.archive', { default: 'Archive' }),
    restore: t('action.restore', { default: 'Restore' }),
    delete: t('action.delete', { default: 'Delete' }),
    menu: t('action.menu', { default: 'Product actions' }),
  };

  return (
    <div className="w-full">
      <AdminCommandBar
        trail={[{ label: 'Baroot CNC Solutions' }, { label: t('title', { default: 'Products' }) }]}
        count={loading ? null : total}
        live={t('live', { default: 'Live' })}
        search={{
          value: qInput,
          onChange: setQInput,
          placeholder: t('searchPlaceholder', { default: 'Search products…' }),
          ariaLabel: t('searchAria', { default: 'Search products' }),
        }}
        actions={
          <BarIconButton
            title={t('refresh', { default: 'Refresh products' })}
            spinning={loading || refreshing}
            onClick={() => load(true)}
          >
            <RefreshCw className="size-4" />
          </BarIconButton>
        }
        primary={
          <BarPrimaryButton
            icon={<Plus className="size-4" strokeWidth={2.5} />}
            onClick={() => router.push('/admin/products/new')}
          >
            {t('newProduct', { default: 'New product' })}
          </BarPrimaryButton>
        }
      />

      <div className="mx-auto w-full max-w-[1500px] space-y-6 pt-6">
        <AdminPageHeader
          title={t('title', { default: 'Products' })}
          description={t('description', {
            default:
              'Manage your product catalog. Create, edit, publish, and organize products linked to academies and courses.',
          })}
        />

        {error && (
          <ErrorBanner message={error} onRetry={() => load()} retryLabel={tCommon('retry', { default: 'Retry' })} />
        )}

        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
          <dl className="grid grid-cols-2 divide-x divide-border sm:grid-cols-4">
            {[
              {
                key: 'total',
                icon: Package,
                label: t('kpiTotal', { default: 'Products' }),
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
                key: 'featured',
                icon: Star,
                label: t('kpiFeatured', { default: 'Featured' }),
                value: loading ? '—' : (facets?.featured ?? 0),
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
              { key: 'draft', label: t('status.draft', { default: 'Draft' }), count: countOf('draft') },
              {
                key: 'published',
                label: t('status.published', { default: 'Published' }),
                count: countOf('published'),
              },
              {
                key: 'archived',
                label: t('status.archived', { default: 'Archived' }),
                count: countOf('archived'),
              },
            ]}
          />

          {categories.length > 0 && (
            <Select
              value={category}
              onChange={(v) => setParam({ category: v || null })}
              label={t('categoryLabel', { default: 'Category' })}
            >
              <option value="">{t('allCategories', { default: 'All categories' })}</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          )}

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
                label={t(`status.${status}`, { default: status })}
                onClear={() => setParam({ status: null })}
              />
            )}
            {category && (
              <FilterChip
                tone={categoryStyle(category).tone}
                label={category}
                onClear={() => setParam({ category: null })}
              />
            )}
            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setQInput('');
                  router.replace('/admin/products');
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3.5 text-xs font-bold text-primary-foreground shadow-xs transition hover:bg-primary active:scale-[0.98]"
              >
                <span aria-hidden="true">×</span>
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
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : !rows || rows.length === 0 ? (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <EmptyState
              icon={hasFilters ? Package : Package}
              tone={hasFilters ? 'amber' : 'blue'}
              title={
                hasFilters
                  ? t('emptyFiltered', { default: 'No products match your filters' })
                  : t('emptyTitle', { default: 'Create your first product' })
              }
              body={
                hasFilters
                  ? t('emptyFilteredHint', { default: 'Try adjusting or clearing your filters.' })
                  : t('emptyHint', {
                      default:
                        'Products are items your customers can browse and purchase. Create one to get started.',
                    })
              }
              action={
                hasFilters ? (
                  <button
                    type="button"
                    onClick={() => {
                      setQInput('');
                      router.replace('/admin/products');
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold shadow-xs transition hover:bg-muted"
                  >
                    {t('clearFilters', { default: 'Clear filters' })}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => router.push('/admin/products/new')}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-xs transition hover:bg-primary active:scale-[0.98]"
                  >
                    <Plus className="size-4" />
                    {t('newProduct', { default: 'New product' })}
                  </button>
                )
              }
            />
          </div>
        ) : view === 'grid' ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {rows.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                onOpen={() => router.push(`/admin/products/${p.slug}/edit`)}
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
                      {t('colProduct', { default: 'Product' })}
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-start font-semibold">
                      {t('colStatus', { default: 'Status' })}
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-end font-semibold">
                      {t('colPrice', { default: 'Price' })}
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-end font-semibold">
                      {t('colStock', { default: 'Stock' })}
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-start font-semibold">
                      {t('colLinks', { default: 'Links' })}
                    </th>
                    <th scope="col" className="py-3.5 pe-6 ps-4 text-end font-semibold">
                      {t('colActions', { default: 'Actions' })}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-13">
                  {rows.map((p) => {
                    const st = statusOf(p);
                    const style = categoryStyle(p.category);
                    const stock = stockState(p);
                    const CategoryIcon = style.icon;
                    return (
                      <tr
                        key={p.id}
                        tabIndex={0}
                        onClick={() => router.push(`/admin/products/${p.slug}/edit`)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            router.push(`/admin/products/${p.slug}/edit`);
                          }
                        }}
                        className="group cursor-pointer transition-colors duration-150 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                      >
                        <td className="px-6 py-3.5">
                          <div className="flex min-w-0 items-center gap-3">
                            <span
                              className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border"
                              style={{
                                backgroundImage: `linear-gradient(140deg, hsl(${style.hue} 55% 42%) 0%, hsl(${(style.hue + 38) % 360} 50% 26%) 100%)`,
                              }}
                            >
                              {p.thumbnailUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={p.thumbnailUrl} alt="" className="size-full object-cover" />
                              ) : (
                                <CategoryIcon className="size-4 text-white/85" />
                              )}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-foreground transition group-hover:text-primary">
                                {p.title}
                              </p>
                              <p className="truncate font-mono text-2xs text-muted-foreground">/{p.slug}</p>
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
                            {p.featured && (
                              <StatusPill
                                label={t('featured', { default: 'Featured' })}
                                tone="purple"
                                dot={false}
                                icon={Star}
                              />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-end">
                          <span className="font-semibold tabular-nums text-foreground">
                            {formatMoney(p.price, p.currency)}
                          </span>
                          {p.compareAtPrice != null && p.compareAtPrice > p.price && (
                            <span className="block text-2xs tabular-nums text-muted-foreground line-through">
                              {formatMoney(p.compareAtPrice, p.currency)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-end">
                          <span
                            className={cn(
                              'tabular-nums',
                              !stock
                                ? 'text-muted-foreground'
                                : stock.tone === 'rose'
                                  ? 'font-semibold text-destructive'
                                  : stock.tone === 'amber'
                                    ? 'font-semibold text-warning'
                                    : 'text-foreground',
                            )}
                          >
                            {stock ? stock.value : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap gap-1">
                            {p.category && (
                              <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-1.5 py-0.5 text-2xs text-muted-foreground">
                                <CategoryIcon className="size-2.5" />
                                {p.category}
                              </span>
                            )}
                            {p.academy && (
                              <span className="inline-flex max-w-36 items-center truncate rounded-md border border-primary/20 bg-primary/5 px-1.5 py-0.5 text-2xs text-primary">
                                {p.academy.title}
                              </span>
                            )}
                            {p.course && (
                              <span className="inline-flex max-w-36 items-center truncate rounded-md border border-accent/20 bg-accent/5 px-1.5 py-0.5 text-2xs text-accent">
                                {p.course.title}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 pe-6 ps-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <ProductRowMenu
                              product={p}
                              onAction={(slug, action) => void act(slug, action)}
                              labels={menuLabels}
                            />
                            <button
                              type="button"
                              onClick={() => router.push(`/admin/products/${p.slug}/edit`)}
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
