import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { HomeBuilder } from '@/components/home/home-builder';
import {
  ProductsDepartments,
  ProductsFeatured,
  ProductsInventory,
  productsHeroStats,
} from '@/components/store/products-islands';
import { fetchCatalogProducts } from '@/lib/products';
import { resolvePageLayout } from '@/lib/builder/theme';
import { DEFAULT_TENANT_SLUG } from '@/lib/tenant-config';
import { serializeJsonLd } from '@/lib/json-ld';

export const metadata: Metadata = {
  title: 'Products',
  description:
    'Shop precision tooling, workholding, and shop essentials curated for aerospace, medical, and production machining.',
  alternates: { canonical: '/products' },
  openGraph: {
    title: 'Products | Baroot CNC Solutions',
    description: 'Precision tooling and shop essentials with free shipping on orders over $99.',
    type: 'website',
    url: '/products',
  },
};

export default async function ProductsPage() {
  const cookieStore = await cookies();
  const tenantSlug = cookieStore.get('x-tenant-slug')?.value || DEFAULT_TENANT_SLUG;
  const [layout, products] = await Promise.all([
    resolvePageLayout(tenantSlug, 'products'),
    fetchCatalogProducts(tenantSlug, { limit: 100 }),
  ]);

  const categoryCounts = new Map<string, number>();
  for (const p of products) {
    if (p.category) categoryCounts.set(p.category, (categoryCounts.get(p.category) ?? 0) + 1);
  }
  const categories = Array.from(categoryCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Products',
    numberOfItems: products.length,
    itemListElement: products.slice(0, 20).map((product, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Product',
        name: product.title,
        description: product.tagline || product.description || undefined,
        image: product.thumbnailUrl || undefined,
        url: `/products/${product.slug}`,
        category: product.category || undefined,
        offers:
          product.price != null
            ? {
                '@type': 'Offer',
                price: (product.price / 100).toFixed(2),
                priceCurrency: product.currency || 'USD',
                availability: (product.inventory ?? 0) > 0 || product.allowBackorder
                  ? 'https://schema.org/InStock'
                  : 'https://schema.org/OutOfStock',
              }
            : undefined,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <HomeBuilder
        layout={layout}
        heroStats={productsHeroStats(products, categories)}
        islands={{
          'products-featured': <ProductsFeatured products={products} />,
          'products-inventory': <ProductsInventory categories={categories} />,
          'products-departments': <ProductsDepartments categories={categories} />,
        }}
      />
    </>
  );
}
