import { pageMeta } from '@/lib/page-title';
import { cookies } from 'next/headers';
import { getLocale, getTranslations } from 'next-intl/server';
import { HomeBuilder } from '@/components/home/home-builder';
import {
  EventsBrowse,
  EventsFormatTicker,
  EventsNextUp,
  EventsSchedule,
  eventsHeroStats,
} from '@/components/events/events-islands';
import { liveIslandHeader } from '@/components/home/live-island-header';
import { fetchCatalogEvents } from '@/lib/events';
import { resolvePageLayout } from '@/lib/builder/theme';
import { DEFAULT_TENANT_SLUG } from '@/lib/tenant-config';
import { serializeJsonLd } from '@/lib/json-ld';

export const generateMetadata = pageMeta('events', { canonical: '/events', og: true });

export default async function EventsPage() {
  const tEvents = await getTranslations('pages.events');
  const locale = await getLocale();
  const cookieStore = await cookies();
  const tenantSlug = cookieStore.get('x-tenant-slug')?.value || DEFAULT_TENANT_SLUG;
  const [layout, events, upcoming] = await Promise.all([
    resolvePageLayout(tenantSlug, 'events'),
    fetchCatalogEvents(tenantSlug, { limit: 50 }, locale),
    fetchCatalogEvents(tenantSlug, { limit: 50, upcoming: true }, locale),
  ]);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Events',
    numberOfItems: events.length,
    itemListElement: events.slice(0, 20).map((event, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Event',
        name: event.title,
        description: event.description || undefined,
        image: event.thumbnailUrl || undefined,
        url: `/events/${event.slug}`,
        startDate: event.startDate,
        endDate: event.endDate || undefined,
        eventStatus: 'https://schema.org/EventScheduled',
        eventAttendanceMode: event.isVirtual
          ? 'https://schema.org/OnlineEventAttendanceMode'
          : 'https://schema.org/OfflineEventAttendanceMode',
        location: event.isVirtual
          ? { '@type': 'VirtualLocation', url: '/events' }
          : {
              '@type': 'Place',
              name: event.location?.venue || event.location?.city || 'TBD',
              address: [event.location?.address, event.location?.city, event.location?.state]
                .filter(Boolean)
                .join(', ') || undefined,
            },
        offers:
          event.maxAttendees && event.registeredCount >= event.maxAttendees
            ? undefined
            : {
                '@type': 'Offer',
                price: ((event.price ?? 0) / 100).toFixed(2),
                priceCurrency: 'USD',
                availability: 'https://schema.org/InStock',
                url: `/events/${event.slug}`,
              },
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <HomeBuilder
        layout={layout}
        heroStats={eventsHeroStats(tEvents, events, upcoming)}
        islands={{
          'events-ticker': <EventsFormatTicker events={events} />,
          'events-next-up': (
            <EventsNextUp
              events={events}
              upcoming={upcoming}
              header={liveIslandHeader(layout, 'events-next-up', locale)}
            />
          ),
          'events-schedule': (
            <EventsSchedule
              events={events}
              upcoming={upcoming}
              header={liveIslandHeader(layout, 'events-schedule', locale)}
            />
          ),
          'events-browse': (
            <EventsBrowse header={liveIslandHeader(layout, 'events-browse', locale)} />
          ),
        }}
      />
    </>
  );
}
