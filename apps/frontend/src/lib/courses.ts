import type { ContentLocale, Course } from '@titan/shared';
import { coerceLocale } from '@/i18n/config';

const API_BASE =
  process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const REVALIDATE = 60;

function tenantHeaders(tenantSlug: string, locale?: ContentLocale): HeadersInit {
  const resolved = coerceLocale(locale ?? process.env.NEXT_LOCALE);
  return { 'x-tenant-slug': tenantSlug, 'x-locale': resolved, 'x-next-locale': resolved, 'accept-language': `${resolved},en;q=0.8` };
}

/** Public course list row — API includes the parent academy for meta labels. */
export type CourseListItem = Course & {
  academy?: { id: string; slug: string; title: string; accentColor: string | null } | null;
};

/**
 * Server-side: published courses for a tenant (real backend data, ISR 60s).
 * Ordered by sortOrder from the API.
 */
export async function fetchPublishedCourses(
  tenantSlug: string,
  limit = 6,
  locale?: ContentLocale,
): Promise<CourseListItem[]> {
  try {
    // limit/page must be numeric strings for class-validator @IsNumber()
    const res = await fetch(`${API_BASE}/courses?page=1&limit=${limit}`, {
      headers: tenantHeaders(tenantSlug, locale),
      next: { revalidate: REVALIDATE },
    });
    if (!res.ok) return [];
    const body = (await res.json()) as CourseListItem[] | { data?: CourseListItem[] };
    if (Array.isArray(body)) return body;
    if (Array.isArray(body?.data)) return body.data;
    return [];
  } catch {
    return [];
  }
}

export type { Course };
