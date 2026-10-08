import { serverApiUrl } from '@/lib/server-api-url';

const API_BASE = serverApiUrl();
const REVALIDATE = 60;

export interface Sponsor {
  id: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  websiteUrl: string | null;
  tier: string | null;
  sortOrder: number;
  isActive: boolean;
}

/** Server-side: active sponsors for a tenant (real backend data, ISR 60s). */
export async function fetchPublishedSponsors(tenantSlug: string): Promise<Sponsor[]> {
  try {
    const res = await fetch(`${API_BASE}/sponsors`, {
      headers: { 'x-tenant-slug': tenantSlug },
      next: { revalidate: REVALIDATE },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as Sponsor[] | { data?: Sponsor[] };
    if (Array.isArray(data)) return data.filter((s) => s.isActive !== false);
    if (Array.isArray(data?.data)) return data.data.filter((s) => s.isActive !== false);
    return [];
  } catch {
    return [];
  }
}
