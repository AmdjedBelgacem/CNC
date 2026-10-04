import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ArrowRight, Download, Headset, Truck } from 'lucide-react';
import { ProductsCatalog } from '@/components/store/products-catalog';
import { DepartmentLink } from '@/components/store/department-link';
import { getImageSrc } from '@/lib/images';
import { coerceCurrency, formatMinorUnits } from '@/lib/money';
import type { Product as ApiProduct } from '@/lib/api/types';

/** Live featured strip — the `products-featured` island (On the bench). */
export function ProductsFeatured({ products }: { products: ApiProduct[] }) {
  const featured = products.filter((p) => p.featured).slice(0, 6);
  if (featured.length === 0) return null;

  // Server-rendered strip has no shopper preference yet; state the stored price.
  const money = (cents: number | null | undefined, currency?: string | null) =>
    formatMinorUnits(cents, coerceCurrency(currency), 'en-US');

  return (
    <section
      id="on-the-bench"
      className="border-b border-border bg-surface-sunken/50 px-margin-mobile md:px-margin-desktop py-12 md:py-16"
    >
      <div className="mx-auto w-full max-w-[1800px]">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              On the bench
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Featured this week
            </h2>
          </div>
          <a
            href="#inventory"
            className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-primary"
          >
            Full catalog
            <ArrowRight className="flip-rtl size-3.5" />
          </a>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {featured.map((product) => (
            <Link
              key={product.id}
              href={`/products/${product.slug}`}
              className="group relative flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xs transition-colors hover:border-primary/40"
            >
              <div className="relative aspect-square overflow-hidden border-b border-border bg-surface-sunken">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getImageSrc(product.thumbnailUrl, 'product')}
                  alt={product.title}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <span className="absolute start-3 top-3 rounded-sm bg-primary px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-primary-foreground">
                  Featured
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-1 p-4">
                {product.category ? (
                  <span className="font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                    {product.category}
                  </span>
                ) : null}
                <h3 className="font-display text-sm font-semibold leading-snug tracking-tight text-foreground transition-colors group-hover:text-primary">
                  {product.title}
                </h3>
                <div className="mt-auto flex items-center justify-between pt-3">
                  <span className="font-mono text-sm font-semibold text-foreground tabular-nums">
                    {money(product.price, product.currency || 'USD')}
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">
                    View
                    <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5 rtl:rotate-180" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Live inventory island — the `products-inventory` island. */
export async function ProductsInventory({ categories }: { categories: { name: string; count: number }[] }) {
  const t = await getTranslations('products');

  return (
    <section
      id="inventory"
      className="px-margin-mobile md:px-margin-desktop mx-auto w-full max-w-[1800px] py-14 md:py-20"
    >
      <div className="mb-8 flex flex-col gap-6 border-b border-border pb-8 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between lg:gap-10">
        <div className="max-w-2xl lg:min-w-[380px] lg:flex-1">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            {t('liveInventory')}
          </p>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            {t('catalogTitle')}
          </h2>
          <p className="mt-3 text-muted-foreground">{t('catalogSubtitle')}</p>
        </div>
        <ProductsTrustStrip />
      </div>
      <ProductsCatalog categories={categories.map((c) => c.name)} />
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
          className="flex items-start gap-3 rounded-lg border border-border bg-card/60 px-4 py-3"
        >
          <item.icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0">
            <p className="font-display text-sm font-semibold text-foreground">{item.title}</p>
            <p className="font-mono text-[11px] leading-snug text-muted-foreground">{item.hint}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Department index island — the `products-departments` island. */
export async function ProductsDepartments({ categories }: { categories: { name: string; count: number }[] }) {
  const t = await getTranslations('products');

  return (
    <section
      id="departments"
      className="border-y border-border bg-surface-sunken/50 px-margin-mobile md:px-margin-desktop py-14 md:py-20"
    >
      <div className="mx-auto w-full max-w-[1800px]">
        <div className="mb-8 max-w-2xl">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            {t('directory')}
          </p>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            {t('shopByDepartment')}
          </h2>
          <p className="mt-3 text-muted-foreground">{t('shopByDepartmentHint')}</p>
        </div>

        {categories.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
            {t('noDepartments')}
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {categories.map((dept, i) => (
              <li key={dept.name}>
                <DepartmentLink name={dept.name} index={i + 1} count={t('skuCount', { count: dept.count })}>
                  <ArrowRight className="size-4 shrink-0 text-primary opacity-0 transition group-hover:opacity-100 rtl:rotate-180" />
                </DepartmentLink>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/** Hero stats helper shared by the products route (live counters). */
export function productsHeroStats(
  products: ApiProduct[],
  categories: { name: string; count: number }[],
): { label: string; value: string }[] {
  // Hero stats are server-rendered before the shopper picks a currency, so they
  // stay in the primary workspace currency (SAR).
  const money = (cents: number | null | undefined) =>
    formatMinorUnits(cents, coerceCurrency(products[0]?.currency), 'en-US');
  const minPrice = products.reduce(
    (min, p) => Math.min(min, p.price ?? Number.POSITIVE_INFINITY),
    Number.POSITIVE_INFINITY,
  );
  const maxPrice = products.reduce((max, p) => Math.max(max, p.price ?? 0), 0);
  const range =
    Number.isFinite(minPrice) && maxPrice > 0
      ? `${money(minPrice)} – ${money(maxPrice)}`
      : '—';
  return [
    { label: 'SKUs', value: String(products.length) },
    { label: 'Departments', value: String(categories.length) },
    { label: 'Price range', value: range },
    { label: 'Free ship', value: 'over $99' },
  ];
}
