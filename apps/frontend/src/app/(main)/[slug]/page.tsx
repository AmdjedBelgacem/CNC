import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BlockRenderer } from '@/components/builder/block-renderer';
import { API_BASE, tenantHeaders } from '@/lib/builder/theme';
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
      headers: { ...tenantHeaders(tenantSlug), cookie: `locale=${locale}` },
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
    locale: store.get('locale')?.value === 'ar' ? 'ar' : 'en',
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
  return <BlockRenderer layout={page.layout as never} />;
}
