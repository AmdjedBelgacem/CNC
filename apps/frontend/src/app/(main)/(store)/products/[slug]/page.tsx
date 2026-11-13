import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import type { ContentLocale } from '@titan/shared';
import { DEFAULT_TENANT_SLUG } from '@/lib/tenant-config';
import { fetchProductBySlug, fetchRelatedProducts } from '@/lib/products';
import { ProductDetailClient } from './product-detail-client';

/**
 * Server entry point for the product detail page.
 *
 * The page body is a client component (cart, gallery, hotspots), but its data is fetched
 * here so the server-rendered HTML already contains the product. Previously the fetch ran
 * only on the client, so a hard navigation rendered an empty shell until React Query
 * resolved — the page looked blank until it was refreshed. Passing the result down as
 * `initialProduct` seeds the query cache, and React Query still revalidates in the
 * background so a stale price or stock count corrects itself.
 *
 * `generateMetadata` is unchanged and also runs on the server.
 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const locale = (await getLocale()) as ContentLocale;
  const cookieStore = await cookies();
  const tenantSlug = cookieStore.get('x-tenant-slug')?.value || DEFAULT_TENANT_SLUG;
  const product = await fetchProductBySlug(tenantSlug, slug, locale);
  if (!product) {
    // Unknown slug: generic metadata; the 404 status comes from the page body's notFound().
    return { title: 'Product', robots: { index: false, follow: true } };
  }
  return {
    title: product.title,
    description: product.tagline || product.description?.slice(0, 160) || undefined,
    openGraph: {
      title: product.title,
      description: product.tagline || undefined,
      images: product.thumbnailUrl ? [{ url: product.thumbnailUrl }] : undefined,
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const locale = (await getLocale()) as ContentLocale;
  const cookieStore = await cookies();
  const tenantSlug = cookieStore.get('x-tenant-slug')?.value || DEFAULT_TENANT_SLUG;
  const initialProduct = await fetchProductBySlug(tenantSlug, slug, locale);
  if (!initialProduct) notFound();
  // Related products load with the page so their section is in the first paint; fetched in
  // the browser, it appeared afterwards and the page grew by ~700px under the reader.
  const relatedProducts = await fetchRelatedProducts(tenantSlug, initialProduct.id, locale);
  return (
    <ProductDetailClient
      slug={slug}
      initialProduct={initialProduct}
      initialRelated={relatedProducts ? { productId: initialProduct.id, products: relatedProducts } : null}
    />
  );
}
