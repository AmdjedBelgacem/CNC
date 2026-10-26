/**
 * Pure hero-stat builders shared by the public routes and the builder canvas.
 *
 * These used to live inside async server components. The builder needs the same
 * numbers to preview a page, but it cannot import a module that pulls in
 * `next-intl/server`. Keeping the arithmetic and formatting here means there is
 * exactly one implementation, so the editor and the published page cannot drift.
 */

import type { Product as ApiProduct } from '@/lib/api/types';
import type { CatalogEvent } from '@/lib/events';
import type { WireSnapshot } from '@/lib/feed-snapshot';
import { coerceCurrency, formatMinorUnits } from '@/lib/money';

export interface HeroStat {
  label: string;
  value: string;
}

export type Translator = (
  key: string,
  values?: Record<string, string | number | Date>,
) => unknown;

/** Academy catalog counters, with the same fallbacks the public route uses. */
export function academyHeroStats(
  academies: { courseCount: number }[],
): HeroStat[] {
  const totalCourses = academies.reduce((sum, a) => sum + a.courseCount, 0);
  return [
    { label: 'Academies', value: String(academies.length || 4) },
    { label: 'Courses', value: String(totalCourses || 12) },
    { label: 'Price', value: '$0' },
    { label: 'Format', value: 'Self-paced' },
  ];
}

/** Upcoming events, falling back to the future-dated rows when the API gave none. */
export function upcomingEvents(
  events: CatalogEvent[],
  upcoming: CatalogEvent[],
): CatalogEvent[] {
  const now = Date.now();
  return upcoming.length
    ? upcoming
    : events.filter((e) => new Date(e.startDate).getTime() >= now);
}

/** Products catalog counters. */
export function productsHeroStats(
  t: Translator,
  products: ApiProduct[],
  categories: { name: string; count: number }[],
): HeroStat[] {
  // Hero stats are server-rendered before the shopper picks a currency, so they
  // stay in the primary workspace currency (SAR).
  const money = (cents: number | null | undefined) =>
    formatMinorUnits(cents, coerceCurrency(products[0]?.currency), 'en-US');
  const minPrice = products.reduce(
    (min, p) => Math.min(min, p.price ?? Number.POSITIVE_INFINITY),
    Number.POSITIVE_INFINITY,
  );
  const maxPrice = products.reduce((max, p) => Math.max(max, p.price ?? 0), 0);
  const range =
    Number.isFinite(minPrice) && maxPrice > 0
      ? `${money(minPrice)} – ${money(maxPrice)}`
      : '—';
  return [
    { label: String(t('statSkus')), value: String(products.length) },
    { label: String(t('statDepartments')), value: String(categories.length) },
    { label: String(t('statPriceRange')), value: range },
    { label: String(t('statFreeShipping')), value: String(t('freeShippingThreshold')) },
  ];
}

/** Events hall counters. */
export function eventsHeroStats(
  t: Translator,
  events: CatalogEvent[],
  upcoming: CatalogEvent[],
): HeroStat[] {
  const list = upcomingEvents(events, upcoming);
  const typeCount = new Set(events.map((e) => e.eventType)).size;
  const cityCount = new Set(
    events
      .filter((e) => !e.isVirtual)
      .map((e) => e.location?.city)
      .filter(Boolean),
  ).size;
  const freeCount = events.filter((e) => !e.price || e.price === 0).length;
  return [
    { label: String(t('statUpcoming')), value: String(list.length) },
    { label: String(t('statFormats')), value: String(typeCount || '—') },
    { label: String(t('statCities')), value: String(cityCount || t('online')) },
    { label: String(t('statFreeSeats')), value: String(freeCount) },
  ];
}

/** Community-wire counters. */
export function feedHeroStats(
  snapshot: WireSnapshot,
  t: Translator,
): HeroStat[] {
  return [
    { label: String(t('postsOnWire')), value: String(snapshot.postCount) },
    { label: String(t('topics')), value: String(snapshot.topics.length) },
    { label: String(t('activeAuthors')), value: String(snapshot.activeAuthors) },
    {
      label: String(t('reactions')),
      value: String(snapshot.likeCount + snapshot.commentCount),
    },
  ];
}
