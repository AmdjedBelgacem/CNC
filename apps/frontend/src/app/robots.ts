import { MetadataRoute } from 'next';
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://titansofmanufacturing.com';
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/account/', '/cart/', '/checkout/'] },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
