import type { MetadataRoute } from 'next';
import { fetchPublishedAcademies } from '@/lib/academies';
import { DEFAULT_TENANT_SLUG } from '@/lib/tenant-config';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://titansofmanufacturing.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE_URL}/academy`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/courses`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE_URL}/feed`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE_URL}/events`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/products`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/repair`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/notifications`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.3 },
  ];

  try {
    const academies = await fetchPublishedAcademies(DEFAULT_TENANT_SLUG);
    const academyRoutes: MetadataRoute.Sitemap = academies.map((a) => ({
      url: `${BASE_URL}/academy/${a.slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.85,
    }));
    return [...staticRoutes, ...academyRoutes];
  } catch {
    return staticRoutes;
  }
}
