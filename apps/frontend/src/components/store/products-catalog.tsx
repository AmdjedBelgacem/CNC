'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ALL_CATEGORIES, buildCategoryHref, readCategoryFromSearch } from '@/lib/store-category';
import { useLocale, useTranslations } from 'next-intl';
import { CURRENCY_NAMES, DEFAULT_CURRENCY } from '@titan/shared';
import {
  ArrowUpDown,
  Check,
  LayoutGrid,
  List,
  PackageSearch,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { ProductCard, type Product as CatalogProduct } from '@/components/store/product-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCurrencyStore } from '@/stores/currency-store';
import { useFxRates } from '@/hooks/use-fx-rates';
import { STOREFRONT_CURRENCIES, convertMinorUnits, currencySymbol } from '@/lib/money';
import { cn } from '@/lib/utils';
import { LayoutBox, Stagger, StaggerItem } from '@/components/ui/motion';

type SortKey = 'featured' | 'newest' | 'price-asc' | 'price-desc' | 'name';
type FormatFilter = 'all' | 'digital' | 'physical';
type StockFilter = 'all' | 'in' | 'out';
type Density = 'comfortable' | 'dense';

const PAGE_SIZE = 12;

function isInStock(product: CatalogProduct) {
  return (product.inventory ?? 0) > 0 || Boolean(product.allowBackorder);
}

function isOnSale(product: CatalogProduct) {
  return Boolean(product.compareAtPrice && product.compareAtPrice > product.price);
}

export function ProductsCatalog({ categories = [] }: { categories?: string[] }) {
  const t = useTranslations('products');
  const locale = useLocale();

  const displayCurrency = useCurrencyStore((s) => s.code);
  const setDisplayCurrency = useCurrencyStore((s) => s.setCode);
  const { rates, loading: ratesLoading, error: ratesError, source, refresh } = useFxRates();

  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [query, setQuery] = useState('');
  // The category lives in the URL rather than only in component state, so a
  // department link such as /products?category=Machines is shareable and
  // survives a reload. Every other filter stays local.
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedCategory = readCategoryFromSearch(searchParams.toString());
  const [category, setCategory] = useState(requestedCategory);
  const [sort, setSort] = useState<SortKey>('featured');
  const [format, setFormat] = useState<FormatFilter>('all');
  const [stock, setStock] = useState<StockFilter>('all');
  const [saleOnly, setSaleOnly] = useState(false);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [density, setDensity] = useState<Density>('comfortable');
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetch('/api/proxy/products?limit=200')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        setProducts(Array.isArray(data?.data) ? (data.data as CatalogProduct[]) : []);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Request failed');
        setProducts([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  // Adopt a new `?category=` value (browser back/forward, or a link clicked
  // before this island hydrated).
  useEffect(() => {
    setCategory(requestedCategory);
    setPage(1);
  }, [requestedCategory]);

  /**
   * Department links in the `products-departments` island drive this filter.
   * The island is server-rendered and cannot touch router state, so it
   * dispatches an event that lands in the URL.
   */
  useEffect(() => {
    const onCategory = (event: Event) => {
      const name = (event as CustomEvent<string>).detail;
      if (typeof name !== 'string' || !name) return;
      applyCategory(name);
    };
    window.addEventListener('catalog:category', onCategory);
    return () => window.removeEventListener('catalog:category', onCategory);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, requestedCategory]);

  const applyCategory = useCallback(
    (next: string) => {
      setCategory(next);
      setPage(1);
      // `replace` keeps the department grid from filling the history stack:
      // a shopper clicking four departments should go back to where they came
      // from, not through four near-identical store pages.
      router.replace(buildCategoryHref(pathname, searchParams.toString(), next), { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const categoryOptions = useMemo(() => {
    const names = new Set<string>();
    categories.forEach((c) => c.trim() && names.add(c.trim()));
    products.forEach((p) => p.category?.trim() && names.add(p.category.trim()));
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [categories, products]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    products.forEach((p) => {
      const name = p.category?.trim();
      if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
    });
    return counts;
  }, [products]);

  // Every price below is expressed in the selected display currency so the
  // filters, the sort and the cards all agree on one number.
  const priceInDisplay = useCallback(
    (minor: number | null | undefined, from: string | null | undefined) =>
      convertMinorUnits(minor, from, displayCurrency, rates),
    [displayCurrency, rates],
  );

  const unitPriceInDisplay = useCallback(
    (product: CatalogProduct) =>
      priceInDisplay(product.variants?.[0]?.price ?? product.price, product.currency),
    [priceInDisplay],
  );

  const bounds = useMemo(() => {
    const prices = products.map((p) => unitPriceInDisplay(p) / 100);
    if (prices.length === 0) return { min: 0, max: 0 };
    return { min: Math.floor(Math.min(...prices)), max: Math.ceil(Math.max(...prices)) };
  }, [products, unitPriceInDisplay]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const min = minPrice.trim() === '' ? null : Number(minPrice);
    const max = maxPrice.trim() === '' ? null : Number(maxPrice);

    const result = products.filter((product) => {
      if (category !== ALL_CATEGORIES && product.category !== category) return false;
      if (format === 'digital' && !product.isDigital) return false;
      if (format === 'physical' && product.isDigital) return false;
      if (stock === 'in' && !isInStock(product)) return false;
      if (stock === 'out' && isInStock(product)) return false;
      if (saleOnly && !isOnSale(product)) return false;

      const unit = unitPriceInDisplay(product) / 100;
      if (min !== null && Number.isFinite(min) && unit < min) return false;
      if (max !== null && Number.isFinite(max) && unit > max) return false;

      if (needle) {
        const haystack = [
          product.title,
          product.tagline,
          product.description,
          product.category,
          ...(product.tags ?? []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });

    const priceOf = (p: CatalogProduct) => unitPriceInDisplay(p);
    const nameOf = (p: CatalogProduct) => p.title.trim().toLowerCase();
    const dateOf = (p: CatalogProduct) => new Date(p.updatedAt ?? p.createdAt ?? 0).getTime() || 0;

    return result.sort((a, b) => {
      switch (sort) {
        case 'price-asc':
          return priceOf(a) - priceOf(b);
        case 'price-desc':
          return priceOf(b) - priceOf(a);
        case 'name':
          return nameOf(a).localeCompare(nameOf(b), locale);
        case 'newest':
          return dateOf(b) - dateOf(a);
        case 'featured':
        default: {
          if (Boolean(a.featured) !== Boolean(b.featured)) return a.featured ? -1 : 1;
          const order = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
          if (order !== 0) return order;
          return nameOf(a).localeCompare(nameOf(b), locale);
        }
      }
    });
  }, [
    products,
    query,
    category,
    format,
    stock,
    saleOnly,
    minPrice,
    maxPrice,
    sort,
    locale,
    unitPriceInDisplay,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  const paged = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );

  const activeFilterCount =
    (category !== ALL_CATEGORIES ? 1 : 0) +
    (format !== 'all' ? 1 : 0) +
    (stock !== 'all' ? 1 : 0) +
    (saleOnly ? 1 : 0) +
    (minPrice.trim() !== '' || maxPrice.trim() !== '' ? 1 : 0) +
    (query.trim() !== '' ? 1 : 0);

  const clearAll = () => {
    setQuery('');
    applyCategory('all');
    setFormat('all');
    setStock('all');
    setSaleOnly(false);
    setMinPrice('');
    setMaxPrice('');
  };

  const currencyCode = displayCurrency;
  const moneyFormat = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currencyCode,
        numberingSystem: 'latn',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }),
    [locale, currencyCode],
  );
  const currency = (value: number) => moneyFormat.format(value);
  const currencySymbolLabel = useMemo(
    () => currencySymbol(currencyCode, locale),
    [currencyCode, locale],
  );
  const ratesPending = ratesLoading || (!!products.length && !rates && !ratesError);

  const searchField = (placeholder: string) => (
    <div className="relative">
      <Search
        className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setPage(1);
        }}
        placeholder={placeholder}
        aria-label={t('searchPlaceholder')}
        className="ps-9"
      />
    </div>
  );

  const filterPanel = (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="inline-flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground">
          <SlidersHorizontal className="size-3.5 text-primary" />
          {t('filters')}
        </h3>
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="h-7 px-2 text-xs">
            <X className="size-3.5 rtl:rotate-0" />
            {t('clearAll')}
          </Button>
        )}
      </div>

      {/* Desktop/tablet: the product search lives at the top of the rail. Phones
          keep it in the results header, so it is hidden here. */}
      <div className="hidden md:block">{searchField(t('searchPlaceholder'))}</div>

      <div className="space-y-2">
        <Label
          htmlFor="catalog-category"
          className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground"
        >
          {t('category')}
        </Label>
        <Select value={category} onValueChange={(value) => applyCategory(value)}>
          <SelectTrigger id="catalog-category" className="h-9 bg-card" aria-label={t('category')}>
            <SelectValue placeholder={t('allCategories')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allCategories')}</SelectItem>
            {categoryOptions.map((name) => (
              <SelectItem key={name} value={name}>
                {name} · {categoryCounts.get(name) ?? 0}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <fieldset className="space-y-2">
        <legend className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
          {t('availability')}
        </legend>
        <div className="space-y-1.5">
          <CheckRow
            checked={stock === 'in'}
            onChange={() => setStock(stock === 'in' ? 'all' : 'in')}
            label={t('inStockOnly')}
          />
          <CheckRow
            checked={stock === 'out'}
            onChange={() => setStock(stock === 'out' ? 'all' : 'out')}
            label={t('outOfStockOnly')}
          />
          <CheckRow
            checked={saleOnly}
            onChange={() => setSaleOnly((v) => !v)}
            label={t('onSale')}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
          {t('formatFilter')}
        </legend>
        <div className="space-y-1.5">
          <CheckRow
            checked={format === 'all'}
            onChange={() => setFormat('all')}
            label={t('allFormats')}
            radio
          />
          <CheckRow
            checked={format === 'digital'}
            onChange={() => setFormat('digital')}
            label={t('digitalOnly')}
            radio
          />
          <CheckRow
            checked={format === 'physical'}
            onChange={() => setFormat('physical')}
            label={t('physicalOnly')}
            radio
          />
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
          {t('priceRange')}
        </Label>
        {/* Amounts are entered in major units; the symbol is pinned inside the
            field and the row stays LTR so numbers read correctly in Arabic. */}
        <div className="flex items-center gap-2" dir="ltr">
          <div className="relative flex-1">
            <span
              className="pointer-events-none absolute inset-y-0 start-3 flex items-center font-mono text-xs text-muted-foreground"
              aria-hidden
            >
              {currencySymbolLabel}
            </span>
            <Input
              inputMode="numeric"
              min={0}
              placeholder={bounds.min > 0 ? String(bounds.min) : t('min')}
              aria-label={`${t('min')} ${currencyCode}`}
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value.replace(/[^\d.]/g, ''))}
              className="h-9 ps-9 font-mono tabular-nums"
            />
          </div>
          <span className="text-muted-foreground">–</span>
          <div className="relative flex-1">
            <span
              className="pointer-events-none absolute inset-y-0 start-3 flex items-center font-mono text-xs text-muted-foreground"
              aria-hidden
            >
              {currencySymbolLabel}
            </span>
            <Input
              inputMode="numeric"
              min={0}
              placeholder={bounds.max > 0 ? String(bounds.max) : t('max')}
              aria-label={`${t('max')} ${currencyCode}`}
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value.replace(/[^\d.]/g, ''))}
              className="h-9 ps-9 font-mono tabular-nums"
            />
          </div>
        </div>
        {bounds.max > 0 && (
          <p className="font-mono text-[11px] text-muted-foreground" dir="ltr">
            {currency(bounds.min)} – {currency(bounds.max)}
          </p>
        )}
      </div>

      {/* Currency: SAR is the workspace's primary currency; every price, filter
          and sort on this page is expressed in the selected currency. */}
      <div className="space-y-2">
        <Label
          htmlFor="catalog-currency"
          className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground"
        >
          {t('currency')}
        </Label>
        <Select value={displayCurrency} onValueChange={setDisplayCurrency}>
          <SelectTrigger id="catalog-currency" className="h-9 bg-card" aria-label={t('currency')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STOREFRONT_CURRENCIES.map((code) => (
              <SelectItem key={code} value={code}>
                {code} · {CURRENCY_NAMES[code]}
                {code === DEFAULT_CURRENCY ? ` · ${t('primaryCurrency')}` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-start justify-between gap-2">
          <p className="font-mono text-[10px] leading-snug text-muted-foreground">
            {ratesError
              ? t('currencyRatesError')
              : ratesPending
                ? t('currencyRatesLoading')
                : t('currencyHint', {
                    source: source === 'live' ? t('liveRates') : t('fallbackRates'),
                  })}
          </p>
          <button
            type="button"
            onClick={refresh}
            disabled={ratesLoading}
            aria-label={t('refreshRates')}
            className="mt-0.5 shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw className={cn('size-3.5', ratesLoading && 'animate-spin')} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="grid gap-6 md:grid-cols-[236px_minmax(0,1fr)] md:gap-8 lg:grid-cols-[272px_minmax(0,1fr)] lg:gap-10">
      {/* Filters live on the left from tablet up; below `md` they collapse into
          the sheet toggled from the results header. */}
      <aside className={cn('md:block', filtersOpen ? 'block' : 'hidden')}>
        <div className="rounded-xl border border-border bg-card/60 p-5 shadow-xs md:sticky md:top-24">
          {filterPanel}
          {filtersOpen && (
            <Button className="mt-5 w-full md:hidden" onClick={() => setFiltersOpen(false)}>
              {t('apply')}
            </Button>
          )}
        </div>
      </aside>

      <div className="min-w-0 space-y-5">
        {/* Phones only: the rail (and its search) is collapsed, so the search
            stays pinned above the results. */}
        <div className="md:hidden">{searchField(t('searchPlaceholder'))}</div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            {t('showing', { visible: filtered.length, total: products.length })}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="md:hidden"
              onClick={() => setFiltersOpen((v) => !v)}
              aria-expanded={filtersOpen}
            >
              <SlidersHorizontal className="size-4" />
              {t('filters')}
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ms-1 px-1.5 py-0 text-[10px]">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>

            <div className="flex items-center gap-1">
              <Button
                variant={density === 'comfortable' ? 'secondary' : 'ghost'}
                size="icon"
                aria-label={t('viewGrid')}
                aria-pressed={density === 'comfortable'}
                onClick={() => setDensity('comfortable')}
              >
                <LayoutGrid className="size-4" />
              </Button>
              <Button
                variant={density === 'dense' ? 'secondary' : 'ghost'}
                size="icon"
                aria-label={t('viewList')}
                aria-pressed={density === 'dense'}
                onClick={() => setDensity('dense')}
              >
                <List className="size-4" />
              </Button>
            </div>

            <div className="flex w-full items-center gap-2 sm:w-auto sm:min-w-[200px]">
              <ArrowUpDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <Select
                value={sort}
                onValueChange={(value) => {
                  setSort(value as SortKey);
                  setPage(1);
                }}
              >
                <SelectTrigger
                  id="catalog-sort"
                  className="h-9 w-full min-w-0 flex-1"
                  aria-label={t('sortBy')}
                >
                  <SelectValue placeholder={t('sortBy')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="featured">{t('sortFeatured')}</SelectItem>
                  <SelectItem value="newest">{t('sortNewest')}</SelectItem>
                  <SelectItem value="price-asc">{t('sortPriceAsc')}</SelectItem>
                  <SelectItem value="price-desc">{t('sortPriceDesc')}</SelectItem>
                  <SelectItem value="name">{t('sortName')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {error && !loading && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 px-5 py-8 text-center">
            <p className="text-sm font-medium text-foreground">{t('loadFailedShort')}</p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">{error}</p>
            <Button variant="outline" className="mt-4" onClick={() => setReloadKey((k) => k + 1)}>
              {t('retry')}
            </Button>
          </div>
        )}

        {!error && loading && (
          <div
            className={cn(
              'grid gap-4',
              density === 'dense'
                ? 'sm:grid-cols-2 xl:grid-cols-4'
                : 'sm:grid-cols-2 xl:grid-cols-3',
            )}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-3 rounded-xl border border-border bg-card p-3">
                <Skeleton className="aspect-square w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </div>
        )}

        {!error && !loading && filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-card/60 px-6 py-16 text-center">
            <PackageSearch className="mx-auto size-8 text-muted-foreground" aria-hidden />
            <p className="mt-4 font-display text-lg font-semibold text-foreground">
              {products.length === 0 ? t('noProducts') : t('emptyTitle')}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {products.length === 0 ? t('shopByDepartmentHint') : t('emptyHint')}
            </p>
            {activeFilterCount > 0 && (
              <Button variant="outline" className="mt-5" onClick={clearAll}>
                {t('clearAll')}
              </Button>
            )}
          </div>
        )}

        {!error && !loading && filtered.length > 0 && (
          <Stagger
            key={page}
            className={cn(
              'grid gap-4',
              density === 'dense'
                ? 'sm:grid-cols-2 xl:grid-cols-4'
                : 'sm:grid-cols-2 xl:grid-cols-3',
            )}
            // Products cascade in per page load. `maxDelay` keeps a 4-column
            // grid from taking half a second to finish appearing.
            gap={0.035}
            maxDelay={0.28}
          >
            {paged.map((product, i) => (
              <StaggerItem key={product.id} index={i}>
                <LayoutBox>
                  <ProductCard product={product} />
                </LayoutBox>
              </StaggerItem>
            ))}
          </Stagger>
        )}

        {!error && !loading && totalPages > 1 && (
          <nav
            className="flex flex-wrap items-center justify-center gap-2 pt-2"
            aria-label={t('pageOf', { current: page, total: totalPages })}
          >
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              {t('previous')}
            </Button>
            {Array.from({ length: totalPages }).map((_, i) => {
              const number = i + 1;
              const active = number === page;
              return (
                <Button
                  key={number}
                  variant={active ? 'default' : 'outline'}
                  size="icon"
                  className="size-9"
                  aria-current={active ? 'page' : undefined}
                  aria-label={t('pageOf', { current: number, total: totalPages })}
                  onClick={() => setPage(number)}
                >
                  {number}
                </Button>
              );
            })}
            <Button
              variant="outline"
              size="sm"
              disabled={page === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              {t('next')}
            </Button>
          </nav>
        )}
      </div>
    </div>
  );
}

function CheckRow({
  checked,
  onChange,
  label,
  radio,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  radio?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
      <span
        className={cn(
          'flex size-4 shrink-0 items-center justify-center border transition-colors',
          radio ? 'rounded-full' : 'rounded',
          checked ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card',
        )}
        aria-hidden
      >
        {checked && <Check className="size-3" />}
      </span>
      <input
        type={radio ? 'radio' : 'checkbox'}
        className="sr-only"
        checked={checked}
        onChange={onChange}
        name={radio ? 'products-format' : undefined}
      />
      <span>{label}</span>
    </label>
  );
}
