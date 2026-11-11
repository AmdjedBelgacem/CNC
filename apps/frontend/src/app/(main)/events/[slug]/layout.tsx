import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';
import { fetchEventBySlug } from '@/lib/events';
import { DEFAULT_TENANT_SLUG } from '@/lib/tenant-config';
import { BRAND_NAME, OG_IMAGE, absoluteUrl } from '@/lib/brand';

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

function describe(input: string | null | undefined, max = 158): string {
  const text = (input ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).replace(/[\s,.;:—-]+$/, '')}…`;
}

/**
 * The event page renders on the client, so without this every event shared the site's generic
 * title and description in search results, browser tabs and link previews.
 */
export async function generateMetadata({ params }: Pick<LayoutProps, 'params'>): Promise<Metadata> {
  const { slug } = await params;
  const locale = await getLocale();
  const cookieStore = await cookies();
  const tenantSlug = cookieStore.get('x-tenant-slug')?.value || DEFAULT_TENANT_SLUG;
  const event = await fetchEventBySlug(tenantSlug, slug, locale);
  const t = await getTranslations('events');
  const canonical = absoluteUrl(`/events/${slug}`);

  if (!event) {
    return { title: t('title'), robots: { index: false, follow: true }, alternates: { canonical } };
  }

  const description = describe(event.description) || `${event.title} — ${BRAND_NAME}`;
  const image = event.thumbnailUrl ? [event.thumbnailUrl] : [OG_IMAGE];
  return {
    title: event.title,
    description,
    alternates: { canonical },
    openGraph: { type: 'website', title: event.title, description, url: canonical, siteName: BRAND_NAME, images: image },
    twitter: { card: 'summary_large_image', title: event.title, description, images: image },
  };
}

/**
 * A real 404 for an unknown or unpublished event. The page itself renders on the client, so
 * without this check an unknown slug answered 200 with an empty shell, which crawlers index as
 * a soft 404. The fetch is the same one `generateMetadata` makes, so Next serves it once.
 */
export default async function EventDetailLayout({ children, params }: LayoutProps) {
  const { slug } = await params;
  const locale = await getLocale();
  const cookieStore = await cookies();
  const tenantSlug = cookieStore.get('x-tenant-slug')?.value || DEFAULT_TENANT_SLUG;
  const event = await fetchEventBySlug(tenantSlug, slug, locale);
  if (!event) notFound();
  return children;
}
