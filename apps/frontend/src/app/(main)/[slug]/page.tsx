import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { API_BASE, tenantHeaders } from '@/lib/builder/theme';
import { HomeBuilder } from '@/components/home/home-builder';
import { fetchPublishedAcademies } from '@/lib/academies';
import { fetchPublishedCourses } from '@/lib/courses';
import { fetchPublishedSponsors } from '@/lib/sponsors';
import { DEFAULT_TENANT_SLUG } from '@/lib/tenant-config';
import { cookies } from 'next/headers';

/**
 * A page the admin created in the builder.
 *
 * Only reached for slugs that have no route folder of their own. Next.js
 * resolves `/about`, `/products` and friends from their own `page.tsx`, so a
 * custom page can never shadow a real route — which is also why the create
 * endpoint refuses those slugs.
 *
 * Draft and disabled pages 404 here. The backend's public read enforces the
 * same rule; the check below is what turns that 404 into a proper Next.js
 * not-found instead of a rendered error boundary.
 */

interface PublishedPage {
  title: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  layout: { root: { props?: Record<string, unknown> }; content: unknown[] };
}

async function loadPublishedPage(
  tenantSlug: string,
  slug: string,
  locale: string,
): Promise<PublishedPage | null> {
  try {
    const res = await fetch(`${API_BASE}/content/pages/${encodeURIComponent(slug)}`, {
      // `x-locale` is the backend's first precedence (see resolveContentLocale); the cookie
      // alone was being ignored because the backend only reads `NEXT_LOCALE` from it, not
      // `locale`. Send both so an Arabic visitor actually gets the Arabic layout.
      headers: { ...tenantHeaders(tenantSlug), 'x-locale': locale, cookie: `NEXT_LOCALE=${locale}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as PublishedPage;
    return data?.layout ? data : null;
  } catch {
    return null;
  }
}

async function getContext(): Promise<{ tenantSlug: string; locale: string }> {
  const store = await cookies();
  return {
    tenantSlug: store.get('x-tenant-slug')?.value || DEFAULT_TENANT_SLUG,
    // Only `ar` is a translated content locale today; anything else is English.
    locale: store.get('NEXT_LOCALE')?.value === 'ar' ? 'ar' : 'en',
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { tenantSlug, locale } = await getContext();
  const page = await loadPublishedPage(tenantSlug, slug, locale);
  if (!page) return { title: 'Not found' };
  return {
    title: page.seoTitle || page.title,
    description: page.seoDescription ?? undefined,
    alternates: { canonical: `/${slug}` },
    // A page that exists but is not published should not be indexed even if the
    // backend is briefly unreachable; `robots` is the cheaper signal to trust.
    robots: { index: true, follow: true },
  };
}

export default async function DynamicBuilderPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { tenantSlug, locale } = await getContext();
  const page = await loadPublishedPage(tenantSlug, slug, locale);
  if (!page) notFound();

  /**
   * Rendered through `HomeBuilder`, not `BlockRenderer`, so a custom page behaves like the
   * fixed routes do.
   *
   * `BlockRenderer` renders whatever the layout says, which for the catalog-aware blocks
   * means the hardcoded seed content that ships with each block. That is why a page built in
   * the admin looked nothing like the same blocks on the home page: `academy-grid` showed
   * fake academies, `program-cards` fake courses, `partner-logos` fake sponsors, and a
   * `live-island` rendered its editor placeholder — the string "this stub only appears in
   * the builder canvas" — to real visitors. `HomeBuilder` substitutes live tenant data into
   * exactly those blocks, and drops seed testimonials, since there is no public API for
   * them and fabricated social proof should never reach the storefront.
   *
   * The fetchers each swallow their own errors and return an empty list, so a catalog that
   * is unreachable degrades to the seed blocks instead of failing the page.
   */
  const [academies, courses, sponsors] = await Promise.all([
    fetchPublishedAcademies(tenantSlug),
    fetchPublishedCourses(tenantSlug, 6, locale as never),
    fetchPublishedSponsors(tenantSlug),
  ]);

  return (
    <HomeBuilder
      layout={page.layout as never}
      academies={academies}
      courses={courses}
      sponsors={sponsors}
    />
  );
}
