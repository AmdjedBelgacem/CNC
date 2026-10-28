import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { DEFAULT_TENANT_SLUG } from '@/lib/tenant-config';
import { fetchPublishedAcademies } from '@/lib/academies';
import { fetchCatalogProducts } from '@/lib/products';
import { fetchCatalogEvents } from '@/lib/events';
import { fetchWireSnapshot } from '@/lib/feed';
import { ProductsDepartments, ProductsFeatured, ProductsInventory } from '@/components/store/products-islands';
import { AcademyPathways } from '@/components/academy/academy-pathways';
import { FeedTicker, FeedTopics, FeedWire } from '@/components/feed/feed-islands';
import {
  EventsBrowse,
  EventsFormatTicker,
  EventsNextUp,
  EventsSchedule,
} from '@/components/events/events-islands';
import { PreviewHeightReporter } from '@/components/preview/preview-height-reporter';
import { AboutFactsSection, HomeFaqSection, HomeGuidesSection } from '@/components/home/home-extras';

/**
 * Server-rendered live islands for the builder canvas.
 *
 * The public routes substitute async server components into `live-island`
 * nodes. Puck's canvas is a client tree, so it cannot call those components
 * directly. This route renders the exact same components with the exact same
 * data, and the builder embeds it in a same-origin iframe. There is no second
 * implementation of the island markup to drift.
 */
export default async function IslandPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ variant: string }>;
  searchParams: Promise<{ part?: string | string[] }>;
}) {
  const { variant } = await params;
  const query = await searchParams;
  const bodyOnly = query.part === 'body';
  const cookieStore = await cookies();
  const tenantSlug = cookieStore.get('x-tenant-slug')?.value || DEFAULT_TENANT_SLUG;

  let content: ReactNode = null;

  switch (variant) {
    case 'home-faq':
      content = <HomeFaqSection />;
      break;
    case 'home-guides':
      content = <HomeGuidesSection />;
      break;
    case 'about-facts':
      content = <AboutFactsSection />;
      break;
    case 'academy-pathways': {
      const academies = await fetchPublishedAcademies(tenantSlug);
      content = <AcademyPathways academies={academies} bodyOnly={bodyOnly} />;
      break;
    }
    case 'products-featured': {
      const products = await fetchCatalogProducts(tenantSlug, { limit: 100 });
      content = <ProductsFeatured products={products} bodyOnly={bodyOnly} />;
      break;
    }
    case 'products-inventory': {
      const products = await fetchCatalogProducts(tenantSlug, { limit: 100 });
      const categories = categoryCounts(products);
      content = (
        <ProductsInventory categories={categories} products={products} bodyOnly={bodyOnly} />
      );
      break;
    }
    case 'products-departments': {
      const products = await fetchCatalogProducts(tenantSlug, { limit: 100 });
      content = <ProductsDepartments categories={categoryCounts(products)} bodyOnly={bodyOnly} />;
      break;
    }
    case 'feed-ticker':
    case 'feed-topics':
    case 'feed-wire': {
      const snapshot = await fetchWireSnapshot(tenantSlug);
      content =
        variant === 'feed-ticker' ? (
          <FeedTicker snapshot={snapshot} />
        ) : variant === 'feed-topics' ? (
          <FeedTopics snapshot={snapshot} bodyOnly={bodyOnly} />
        ) : (
          <FeedWire snapshot={snapshot} bodyOnly={bodyOnly} />
        );
      break;
    }
    case 'events-ticker':
    case 'events-next-up':
    case 'events-schedule':
    case 'events-browse': {
      if (variant === 'events-browse') {
        content = <EventsBrowse bodyOnly={bodyOnly} />;
        break;
      }
      const [events, upcoming] = await Promise.all([
        fetchCatalogEvents(tenantSlug, { limit: 50 }),
        fetchCatalogEvents(tenantSlug, { limit: 50, upcoming: true }),
      ]);
      content =
        variant === 'events-ticker' ? (
          <EventsFormatTicker events={events} />
        ) : variant === 'events-next-up' ? (
          <EventsNextUp events={events} upcoming={upcoming} bodyOnly={bodyOnly} />
        ) : (
          <EventsSchedule events={events} upcoming={upcoming} bodyOnly={bodyOnly} />
        );
      break;
    }
    default:
      notFound();
  }

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            html, body { min-height: 0 !important; height: auto !important; overflow: hidden !important; background: transparent !important; }
            body > div { min-height: 0 !important; }
          `,
        }}
      />
      <div id="island-preview-root">{content}</div>
      <PreviewHeightReporter />
    </>
  );
}

function categoryCounts(products: { category?: string | null }[]) {
  const counts = new Map<string, number>();
  for (const product of products) {
    if (product.category) counts.set(product.category, (counts.get(product.category) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
