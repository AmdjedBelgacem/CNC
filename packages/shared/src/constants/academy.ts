/**
 * Slugs that academies may never take. They would collide with static route
 * segments under /academy/[academySlug] or shadow well-known site paths.
 */
export const RESERVED_ACADEMY_SLUGS: Readonly<string[]> = [
  'courses',
  'lessons',
  'new',
  'edit',
  'admin',
  'api',
  'login',
  'register',
  'account',
  'settings',
  'search',
  'feed',
  'events',
  'products',
  'sitemap.xml',
  'robots.txt',
];

export function isReservedAcademySlug(slug: string): boolean {
  return RESERVED_ACADEMY_SLUGS.includes(slug);
}
