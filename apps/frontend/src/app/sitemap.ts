import type { MetadataRoute } from 'next';
import { fetchPublishedAcademies } from '@/lib/academies';
import { fetchPublishedCourses } from '@/lib/courses';
import { fetchCatalogProducts } from '@/lib/products';
import { DEFAULT_TENANT_SLUG } from '@/lib/tenant-config';
import { SITE_URL as BASE_URL } from '@/lib/brand';

/**
 * Force per-request rendering.
 *
 * Next prerenders this route at build time by default, and `API_INTERNAL_URL` is a Vercel
 * *service binding* that only exists at runtime. Every fetch therefore failed during the
 * build, the empty result was baked in, and the served sitemap listed only the static
 * routes — no courses, academies or products, which are the pages that matter. Verified
 * against production: 9 URLs with and without this line.
 *
 * Dynamic rendering costs one invocation per sitemap request; crawlers fetch it rarely, and
 * a correct sitemap is worth more than the invocations.
 */
export const dynamic = 'force-dynamic';

/**
 * Sitemap for the public surface.
 *
 * Two defects made the previous version nearly useless. It emitted eight static URLs and
 * nothing else — every course and product detail page was missing, which are the pages
 * that actually earn impressions — while advertising `/notifications`, a per-user page
 * that should never be crawlable. Content routes are now pulled from the API, and
 * anything private or transactional is excluded outright.
 */

/** Never advertise these: private, transactional, or thin. */
const EXCLUDED_PREFIXES = [
  '/admin',
  '/api',
  '/account',
  '/cart',
  '/checkout',
  '/login',
  '/register',
  '/notifications',
  '/messages',
  '/settings',
  '/verify',
  '/reset',
  '/2fa',
];

function isPublic(url: string): boolean {
  return !EXCLUDED_PREFIXES.some((prefix) => url === prefix || url.startsWith(`${prefix}/`));
}

/** Coerce an API timestamp into a valid Date, falling back to now. */
function toDate(value: unknown): Date {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? new Date() : value;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  type Freq = NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>;
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: now, changeFrequency: 'weekly' as Freq, priority: 1.0 },
    { url: `${BASE_URL}/about`, lastModified: now, changeFrequency: 'monthly' as Freq, priority: 0.7 },
    { url: `${BASE_URL}/academy`, lastModified: now, changeFrequency: 'daily' as Freq, priority: 0.9 },
    { url: `${BASE_URL}/courses`, lastModified: now, changeFrequency: 'daily' as Freq, priority: 0.9 },
    { url: `${BASE_URL}/products`, lastModified: now, changeFrequency: 'weekly' as Freq, priority: 0.8 },
    { url: `${BASE_URL}/events`, lastModified: now, changeFrequency: 'weekly' as Freq, priority: 0.8 },
    { url: `${BASE_URL}/feed`, lastModified: now, changeFrequency: 'daily' as Freq, priority: 0.6 },
    { url: `${BASE_URL}/terms`, lastModified: now, changeFrequency: 'yearly' as Freq, priority: 0.3 },
    { url: `${BASE_URL}/privacy`, lastModified: now, changeFrequency: 'yearly' as Freq, priority: 0.3 },
  ].filter((route) => isPublic(route.url.replace(BASE_URL, '') || '/'));

  // Each entity type is fetched independently so one failing endpoint cannot empty the
  // whole sitemap — the previous version returned statics only if academies threw.
  const [academies, courses, products] = await Promise.all([
    fetchPublishedAcademies(DEFAULT_TENANT_SLUG).catch(() => []),
    fetchPublishedCourses(DEFAULT_TENANT_SLUG).catch(() => []),
    fetchCatalogProducts(DEFAULT_TENANT_SLUG).catch(() => []),
  ]);

  const academyRoutes: MetadataRoute.Sitemap = academies.map((academy) => ({
    url: `${BASE_URL}/academy/${academy.slug}`,
    lastModified: toDate((academy as unknown as { updatedAt?: unknown }).updatedAt),
    changeFrequency: 'weekly' as Freq,
    priority: 0.85,
  }));

  const courseRoutes: MetadataRoute.Sitemap = courses.map((course) => ({
    url: `${BASE_URL}/courses/${course.slug}`,
    lastModified: toDate((course as unknown as { updatedAt?: unknown }).updatedAt),
    changeFrequency: 'weekly' as Freq,
    priority: 0.8,
  }));

  const productRoutes: MetadataRoute.Sitemap = products.map((product) => ({
    url: `${BASE_URL}/products/${product.slug}`,
    lastModified: toDate((product as unknown as { updatedAt?: unknown }).updatedAt),
    changeFrequency: 'weekly' as Freq,
    priority: 0.7,
  }));

  return [...staticRoutes, ...academyRoutes, ...courseRoutes, ...productRoutes].filter((route) =>
    isPublic(route.url),
  );
}
