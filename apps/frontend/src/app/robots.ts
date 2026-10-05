import type { MetadataRoute } from 'next';
import { SITE_URL as BASE_URL } from '@/lib/brand';

/**
 * robots.txt
 *
 * `disallow` is not an access control — it only asks well-behaved crawlers to skip a path.
 * It matters here for crawl budget and for keeping private/transactional URLs out of
 * indexes, so it mirrors the sitemap's exclusions: no /admin, no /login, no /notifications.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin',
          '/account/',
          '/cart/',
          '/checkout/',
          '/login',
          '/register',
          '/notifications',
          '/messages/',
          '/settings/',
          '/2fa/',
          '/verify',
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
