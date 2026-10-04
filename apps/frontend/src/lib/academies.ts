import type { AcademyDetail, AcademySummary } from '@titan/shared';

const API_BASE =
  process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const REVALIDATE = 60;

function tenantHeaders(tenantSlug: string, locale?: string): HeadersInit {
  return {
    'x-tenant-slug': tenantSlug,
    ...(locale
      ? {
          'x-locale': locale,
          'x-next-locale': locale,
          'accept-language': `${locale},en;q=0.8`,
        }
      : {}),
  };
}

/** Server-side: list published academies for a tenant (real backend data, ISR 60s). */
export async function fetchPublishedAcademies(tenantSlug: string): Promise<AcademySummary[]> {
  try {
    const res = await fetch(`${API_BASE}/academies`, {
      headers: tenantHeaders(tenantSlug),
      next: { revalidate: REVALIDATE },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as AcademySummary[] | { data?: AcademySummary[] };
    if (Array.isArray(data)) return data;
    if (Array.isArray((data as { data?: AcademySummary[] }).data)) {
      return (data as { data: AcademySummary[] }).data;
    }
    return [];
  } catch {
    return [];
  }
}

/** Server-side: academy detail + its published courses (real backend data, ISR 60s). */
export async function fetchAcademyDetail(
  tenantSlug: string,
  slug: string,
  locale?: string,
): Promise<AcademyDetail | null> {
  try {
    const res = await fetch(`${API_BASE}/academies/${encodeURIComponent(slug)}`, {
      headers: tenantHeaders(tenantSlug, locale),
      next: { revalidate: REVALIDATE },
    });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return (await res.json()) as AcademyDetail;
  } catch {
    return null;
  }
}

export type { AcademySummary, AcademyDetail };
