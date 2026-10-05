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

/**
 * Server-side: one course by slug, for SSR/ISR of the detail page.
 *
 * The detail page used to be a client component that fetched through React Query, so the
 * first HTML response contained no course content at all — search crawlers and answer
 * engines received a skeleton and a literal "Loading". Fetching here lets the server
 * render real title, description and curriculum outline, which is the whole point of the
 * page existing. Returns null on any failure so the caller can fall back to the
 * client-fetch path rather than 500-ing a public URL.
 */
export async function fetchCourseDetail(
  tenantSlug: string,
  slug: string,
  locale?: ContentLocale,
): Promise<Course | null> {
  if (!slug) return null;
  try {
    const resolved = coerceLocale(locale);
    const res = await fetch(
      `${API_BASE}/courses/${encodeURIComponent(slug)}?locale=${resolved}`,
      {
        headers: tenantHeaders(tenantSlug, locale),
        // Short window: prices, enrolment state and publish flags all move, and a stale
        // price is worse than a slightly slower page.
        next: { revalidate: REVALIDATE },
      },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as Course | { data?: Course };
    if (body && typeof body === 'object' && 'data' in body && body.data) return body.data;
    return body as Course;
  } catch {
    return null;
  }
}
