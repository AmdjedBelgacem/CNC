import type { ReactNode } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ArrowRight, Download, Headset, Truck } from 'lucide-react';
import { ProductsCatalog } from '@/components/store/products-catalog';
import type { Product as CatalogProduct } from '@/components/store/product-card';
import { DepartmentLink } from '@/components/store/department-link';
import { getImageSrc } from '@/lib/images';
import { coerceCurrency, formatMinorUnits } from '@/lib/money';
import { cardPrice, isQuoteOnly } from '@/lib/product-pricing';
import { cn } from '@/lib/utils';
import { Reveal, Stagger, StaggerItem } from '@/components/ui/motion';
import type { Product as ApiProduct } from '@/lib/api/types';

/**
 * Every island accepts the builder's `header` slot and a `bodyOnly` flag used
 * by the canvas preview iframe. When `header` is supplied (English pages) it
 * replaces the translated header markup with the real builder nodes. Arabic
 * pages keep the default translated header because the public renderer does
 * not pass a header for that locale.
 */
type IslandChrome = {
  header?: ReactNode;
  /** True in the builder canvas: render only the live data, not the header. */
  bodyOnly?: boolean;
};

/** Live featured strip — the `products-featured` island (On the bench). */
export async function ProductsFeatured({
  products,
  header,
  bodyOnly,
}: { products: ApiProduct[] } & IslandChrome) {
  const t = await getTranslations('pages.products');
  const featured = products.filter((p) => p.featured).slice(0, 6);
  if (featured.length === 0) return null;

  // Server-rendered strip has no shopper preference yet; state the stored price.
  const money = (cents: number | null | undefined, currency?: string | null) =>
    formatMinorUnits(cents, coerceCurrency(currency), 'en-US');

  return (
    <section
      id="on-the-bench"
      className={cn(
        'border-b border-border/70 bg-surface-sunken/40 px-margin-mobile md:px-margin-desktop py-16 md:py-24',
        bodyOnly && 'pt-0 md:pt-0',
      )}
    >
      <div className="mx-auto w-full max-w-[1800px]">
        {bodyOnly
          ? null
          : header ?? (
              <Reveal className="mb-10 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="eyebrow">{t('featuredHeading')}</p>
                  <h2 className="mt-3 text-balance font-display text-3xl font-medium tracking-[-0.02em] text-foreground md:text-4xl">
                    Featured this week
                  </h2>
                </div>
                <a href="#inventory" className="link-pill group">
                  Full catalog
                  <ArrowRight className="flip-rtl size-3.5 transition-transform group-hover:translate-x-0.5" />
                </a>
              </Reveal>
            )}
        <Stagger inViewOnly className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {featured.map((product, i) => (
            <StaggerItem key={product.id} index={i} className="h-full">
            <Link
              href={`/products/${product.slug}`}
              className="card-hover group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="relative aspect-square overflow-hidden bg-surface-sunken">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getImageSrc(product.thumbnailUrl, 'product')}
                  alt={product.title}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                />
                <span className="absolute start-3 top-3 rounded-full bg-card/90 px-2.5 py-0.5 text-[11px] font-medium text-foreground shadow-xs ring-1 ring-border/60 backdrop-blur-sm">
                  Featured
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-1.5 border-t border-border/60 p-4">
                {product.category || product.productType ? (
                  <span className="text-xs text-muted-foreground">
                    {[product.category, product.productType].filter(Boolean).join(' · ')}
                  </span>
                ) : null}
                <h3 className="text-pretty font-display text-[15px] font-medium leading-snug tracking-[-0.01em] text-foreground transition-colors group-hover:text-primary">
                  {product.title}
                </h3>
                <div className="mt-auto flex items-center justify-between pt-3">
                  <span className="text-sm font-semibold tabular-nums text-foreground">
                    {isQuoteOnly(product)
                      ? t('priceOnRequest')
                      : money(cardPrice(product), product.currency || 'USD')}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                    {t('view')}
                    <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5 rtl:rotate-180" />
                  </span>
                </div>
              </div>
            </Link>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

/** Live inventory island — the `products-inventory` island. */
export async function ProductsInventory({
  categories,
  products,
  header,
  bodyOnly,
  records,
  recordIds,
}: {
  categories: { name: string; count: number }[];
  /** Server-fetched, so the grid is populated in the HTML rather than after hydration. */
  products?: CatalogProduct[];
  /** Builder-authored product cards, rendered inside the live catalog grid. */
  records?: ReactNode;
  /** Product ids that already have a child card block. */
  recordIds?: string[];
} & IslandChrome) {
  const t = await getTranslations('products');

  return (
    <section
      id="inventory"
      className={cn(
        'px-margin-mobile md:px-margin-desktop mx-auto w-full max-w-[1800px] py-16 md:py-24',
        bodyOnly && 'pt-0 md:pt-0',
      )}
    >
      {bodyOnly
        ? null
        : header ?? (
            <Reveal className="mb-10 flex flex-col gap-8 border-b border-border/70 pb-10 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between lg:gap-10">
              <div className="max-w-2xl lg:min-w-[380px] lg:flex-1">
                <p className="eyebrow">{t('liveInventory')}</p>
                <h2 className="section-title mt-3">{t('catalogTitle')}</h2>
                <p className="mt-4 max-w-prose text-[15px] leading-relaxed text-muted-foreground">
                  {t('catalogSubtitle')}
                </p>
              </div>
              <ProductsTrustStrip />
            </Reveal>
          )}
      <ProductsCatalog
        categories={categories.map((c) => c.name)}
        initialProducts={products}
        records={records}
        recordIds={recordIds}
      />
    </section>
  );
}

/** Value props strip above the catalog grid. */
async function ProductsTrustStrip() {
  const t = await getTranslations('products');
  const items = [
    { icon: Truck, title: t('freeShipping'), hint: t('freeShippingHint') },
    { icon: Download, title: t('instantDelivery'), hint: t('instantDeliveryHint') },
    { icon: Headset, title: t('support'), hint: t('supportHint') },
  ];

  return (
    <ul className="grid max-w-full shrink-0 grid-cols-1 gap-3 sm:grid-cols-3 lg:w-[600px]">
      {items.map((item) => (
        <li
          key={item.title}
          className="flex items-start gap-3 rounded-xl border border-border/70 bg-card px-4 py-3.5 shadow-xs"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <item.icon className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{item.title}</p>
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{item.hint}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Department index island — the `products-departments` island. */
export async function ProductsDepartments({
  categories,
  header,
  bodyOnly,
}: { categories: { name: string; count: number }[] } & IslandChrome) {
  const t = await getTranslations('products');

  return (
    <section
      id="departments"
      className={cn(
        'border-y border-border/70 bg-surface-sunken/40 px-margin-mobile md:px-margin-desktop py-16 md:py-24',
        bodyOnly && 'pt-0 md:pt-0',
      )}
    >
      <div className="mx-auto w-full max-w-[1800px]">
        {bodyOnly
          ? null
          : header ?? (
              <Reveal className="mb-10 max-w-2xl">
                <p className="eyebrow">{t('directory')}</p>
                <h2 className="section-title mt-3">{t('shopByDepartment')}</h2>
                <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
                  {t('shopByDepartmentHint')}
                </p>
              </Reveal>
            )}

        {categories.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/60 px-6 py-14 text-center text-sm text-muted-foreground">
            {t('noDepartments')}
          </div>
        ) : (
          <Stagger as="ul" inViewOnly className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {categories.map((dept, i) => (
              <StaggerItem as="li" key={dept.name} index={i}>
                <DepartmentLink name={dept.name} index={i + 1} count={t('skuCount', { count: dept.count })}>
                  <ArrowRight className="size-4 shrink-0 text-primary opacity-0 transition group-hover:opacity-100 rtl:rotate-180" />
                </DepartmentLink>
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </div>
    </section>
  );
}

/**
 * Hero stats helper shared by the products route (live counters).
 *
 * The implementation lives in `lib/catalog-stats` so the builder canvas can use
 * the exact same arithmetic without importing this server module.
 */
export { productsHeroStats } from '@/lib/catalog-stats';
