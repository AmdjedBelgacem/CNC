const API_BASE =
  process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const REVALIDATE = 60;

export interface EventLocation {
  venue?: string;
  address?: string;
  city?: string;
  state?: string;
}

export interface CatalogEvent {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  eventType: string;
  startDate: string;
  endDate: string | null;
  location: EventLocation | null;
  isVirtual: boolean;
  maxAttendees: number | null;
  price: number | null;
  thumbnailUrl: string | null;
  isPublished?: boolean;
  registeredCount: number;
}

function tenantHeaders(tenantSlug: string): HeadersInit {
  return { 'x-tenant-slug': tenantSlug };
}

/** Server-side: list published events for the events hall. */
export async function fetchCatalogEvents(
  tenantSlug: string,
  opts: { limit?: number; upcoming?: boolean } = {},
): Promise<CatalogEvent[]> {
  try {
    const params = new URLSearchParams();
    params.set('limit', String(opts.limit ?? 50));
    if (opts.upcoming) params.set('upcoming', 'true');
    const res = await fetch(`${API_BASE}/events?${params.toString()}`, {
      headers: tenantHeaders(tenantSlug),
      next: { revalidate: REVALIDATE },
    });
    if (!res.ok) return [];
    const json = await res.json();
    const rows = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
    return rows.filter((e: CatalogEvent) => e.isPublished !== false);
  } catch {
    return [];
  }
}
