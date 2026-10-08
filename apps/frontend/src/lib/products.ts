import type { Product } from '@/lib/api/types';
import { serverApiUrl } from '@/lib/server-api-url';

/**
 * Resolved through `serverApiUrl`, which reads `API_URL` first.
 *
 * This file used to compute its own base from `API_INTERNAL_URL ||
 * NEXT_PUBLIC_API_URL`, skipping `API_URL`. In the production container both of those
 * are empty and `API_URL` is `http://backend:4000`, so the fallback resolved to
 * `http://localhost:4000` — the frontend container's own loopback, where nothing
 * listens. Server-rendered product pages would have rendered their error state on every
 * request. One resolver, one precedence order.
 */
const API_BASE = serverApiUrl();
const REVALIDATE = 60;

function tenantHeaders(tenantSlug: string): HeadersInit {
  return { 'x-tenant-slug': tenantSlug };
}

/** Server-side: list published products for the storefront. */
export async function fetchCatalogProducts(
  tenantSlug: string,
  opts: { limit?: number; category?: string; featured?: boolean } = {},
): Promise<Product[]> {
  try {
    const params = new URLSearchParams();
    if (opts.limit) params.set('limit', String(opts.limit));
    if (opts.category) params.set('category', opts.category);
    if (opts.featured) params.set('featured', 'true');
    const res = await fetch(`${API_BASE}/products?${params.toString()}`, {
      headers: tenantHeaders(tenantSlug),
      next: { revalidate: REVALIDATE },
    });
    if (!res.ok) return [];
    const json = await res.json();
    const rows = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
    return rows.filter((p: Product) => p.isPublished !== false && p.isArchived !== true);
  } catch {
    return [];
  }
}

/** Server-side: list published products linked to an academy or course. */
export async function fetchLinkedProducts(
  tenantSlug: string,
  opts: { academyId?: string; courseId?: string; limit?: number },
): Promise<Product[]> {
  try {
    const params = new URLSearchParams();
    if (opts.academyId) params.set('academyId', opts.academyId);
    if (opts.courseId) params.set('courseId', opts.courseId);
    if (opts.limit) params.set('limit', String(opts.limit));
    const res = await fetch(`${API_BASE}/products?${params.toString()}`, {
      headers: tenantHeaders(tenantSlug),
      next: { revalidate: REVALIDATE },
    });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
  } catch {
    return [];
  }
}

/**
 * Server-side: one published product by slug.
 *
 * The detail page renders from this during SSR. It used to fetch only on the client,
 * which meant a hard navigation produced an empty shell until React Query resolved —
 * the page looked blank until a refresh. Fetching here and seeding React Query with
 * `initialData` means the HTML that arrives already contains the product.
 *
 * Returns `null` rather than throwing on any failure, so the client can show its own
 * error and retry state instead of the route failing to render.
 */
export async function fetchProductBySlug(
  tenantSlug: string,
  slug: string,
): Promise<Product | null> {
  if (!slug) return null;
  try {
    const res = await fetch(`${API_BASE}/products/${encodeURIComponent(slug)}`, {
      headers: tenantHeaders(tenantSlug),
      next: { revalidate: REVALIDATE },
    });
    if (!res.ok) return null;
    return (await res.json()) as Product;
  } catch {
    return null;
  }
}
