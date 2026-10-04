import type { Product } from '@/lib/api/types';

const API_BASE =
  process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
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
