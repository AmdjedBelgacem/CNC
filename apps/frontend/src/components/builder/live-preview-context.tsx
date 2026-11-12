'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createTranslator, useTranslations } from 'next-intl';
import { useCanvasLocale } from '@/components/builder/canvas-locale';
import { apiProxyFetch } from '@/hooks/use-api-proxy';
import { buildLiveHomeMetrics, type LiveHomeMetrics } from '@/lib/home-metrics';
import {
  academyHeroStats,
  eventsHeroStats,
  feedHeroStats,
  productsHeroStats,
  type HeroStat,
} from '@/lib/catalog-stats';
import { buildWireSnapshot, emptyWireSnapshot, type WireSnapshot } from '@/lib/feed-snapshot';
import type { AcademySummary } from '@/lib/academies';
import type { CourseListItem } from '@/lib/courses';
import type { Sponsor } from '@/lib/sponsors';
import type { CatalogEvent } from '@/lib/events';
import type { Product as ApiProduct } from '@/lib/api/types';

/**
 * Live data for the builder canvas.
 *
 * The published site substitutes tenant data into marketing blocks on the server
 * (`HomeBuilder`, `applyLiveHomeMetrics`, `useCatalogStats`). The editor used to
 * render the seed mock data instead, so a page could look materially different
 * in the builder and on the site — fake academy cards, fake course cards, fake
 * partner marks, and hero counters frozen at whatever the seed said.
 *
 * This provider loads the same public endpoints once per page and exposes the
 * derived values. The block components read it only while `puck.isEditing` is
 * true, so the public render path is untouched.
 */

export interface BuilderLivePreview {
  pageSlug: string;
  loading: boolean;
  failed: boolean;
  academies: AcademySummary[];
  courses: CourseListItem[];
  sponsors: Sponsor[];
  products: ApiProduct[];
  events: CatalogEvent[];
  upcomingEvents: CatalogEvent[];
  snapshot: WireSnapshot;
  homeMetrics: LiveHomeMetrics | null;
  heroStats: HeroStat[] | null;
}

const LivePreviewContext = createContext<BuilderLivePreview | null>(null);

async function readJson<T>(url: string, locale: string): Promise<T | null> {
  try {
    // Live sections in the canvas use the canvas language, so product names, categories and
    // event titles match what a visitor in that language receives.
    const res = await apiProxyFetch(url, {
      headers: { 'x-locale': locale, 'x-next-locale': locale, 'accept-language': `${locale},en;q=0.8` },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object' && Array.isArray((value as { data?: unknown }).data)) {
    return (value as { data: T[] }).data;
  }
  return [];
}

export function BuilderLivePreviewProvider({
  pageSlug,
  children,
}: {
  pageSlug: string;
  children: ReactNode;
}) {
  const canvas = useCanvasLocale();
  const adminProducts = useTranslations('pages.products');
  const adminEvents = useTranslations('pages.events');
  const adminFeed = useTranslations('pages.feed');
  // Hero stat labels follow the canvas language too, not the admin's.
  const canvasT = useMemo(() => {
    if (!canvas.messages) return null;
    const make = (namespace: string) =>
      createTranslator({ locale: canvas.locale, messages: canvas.messages as never, namespace: namespace as never });
    return { products: make('pages.products'), events: make('pages.events'), feed: make('pages.feed') };
  }, [canvas.locale, canvas.messages]);
  const tProducts = canvasT?.products ?? adminProducts;
  const tEvents = canvasT?.events ?? adminEvents;
  const tFeed = canvasT?.feed ?? adminFeed;

  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [academies, setAcademies] = useState<AcademySummary[]>([]);
  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [events, setEvents] = useState<CatalogEvent[]>([]);
  const [upcoming, setUpcoming] = useState<CatalogEvent[]>([]);
  const [snapshot, setSnapshot] = useState<WireSnapshot>(() => emptyWireSnapshot());

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setFailed(false);

      const [academyData, courseData, sponsorData, productData, eventData, upcomingData, feedData] =
        await Promise.all([
          readJson<unknown>('/api/proxy/academies', canvas.locale),
          readJson<unknown>('/api/proxy/courses?page=1&limit=6', canvas.locale),
          readJson<unknown>('/api/proxy/sponsors', canvas.locale),
          readJson<unknown>('/api/proxy/products?limit=200', canvas.locale),
          readJson<unknown>('/api/proxy/events?limit=50', canvas.locale),
          readJson<unknown>('/api/proxy/events?limit=50&upcoming=true', canvas.locale),
          readJson<unknown>('/api/proxy/feed?limit=50', canvas.locale),
        ]);

      if (!active) return;

      const nextAcademies = asArray<AcademySummary>(academyData);
      const nextCourses = asArray<CourseListItem>(courseData);
      const nextSponsors = asArray<Sponsor>(sponsorData).filter(
        (s) => s.isActive !== false,
      );
      const nextProducts = asArray<ApiProduct>(productData).filter(
        (p) => p.isPublished !== false && p.isArchived !== true,
      );
      const nextEvents = asArray<CatalogEvent>(eventData).filter(
        (e) => e.isPublished !== false,
      );
      const nextUpcoming = asArray<CatalogEvent>(upcomingData).filter(
        (e) => e.isPublished !== false,
      );
      const rawPosts = asArray<unknown>(feedData);
      const nextSnapshot = rawPosts.length
        ? buildWireSnapshot(rawPosts as never)
        : emptyWireSnapshot();

      setAcademies(nextAcademies);
      setCourses(nextCourses);
      setSponsors(nextSponsors);
      setProducts(nextProducts);
      setEvents(nextEvents);
      setUpcoming(nextUpcoming);
      setSnapshot(nextSnapshot);
      setFailed(
        !academyData &&
          !courseData &&
          !sponsorData &&
          !productData &&
          !eventData &&
          !feedData,
      );
      setLoading(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, [canvas.locale]);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const product of products) {
      if (product.category) counts.set(product.category, (counts.get(product.category) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  const homeMetrics = useMemo(() => {
    if (pageSlug !== 'home') return null;
    // Until the live data arrives, use the values already baked into the saved
    // layout. Building metrics from empty arrays showed "0 academies" in the
    // canvas while the published page showed the real counts.
    if (loading || failed) return null;
    const courseTotal =
      academies.reduce((sum, a) => sum + (a.courseCount || 0), 0) || courses.length;
    return buildLiveHomeMetrics({
      academyCount: academies.length,
      courseCount: courseTotal,
      sponsorCount: sponsors.length,
      productCount: products.length,
      locale: canvas.locale,
    });
  }, [pageSlug, loading, failed, academies, courses.length, sponsors.length, products.length, canvas.locale]);

  const heroStats = useMemo<HeroStat[] | null>(() => {
    if (loading) return null;
    if (pageSlug === 'academy-landing') return academyHeroStats(academies);
    if (pageSlug === 'products') {
      return productsHeroStats(tProducts as never, products, categories);
    }
    if (pageSlug === 'events') {
      return eventsHeroStats(tEvents as never, events, upcoming);
    }
    if (pageSlug === 'feed') {
      return feedHeroStats(snapshot, tFeed as never);
    }
    return null;
  }, [
    loading,
    pageSlug,
    academies,
    products,
    categories,
    events,
    upcoming,
    snapshot,
    tProducts,
    tEvents,
    tFeed,
  ]);

  const value = useMemo<BuilderLivePreview>(
    () => ({
      pageSlug,
      loading,
      failed,
      academies,
      courses,
      sponsors,
      products,
      events,
      upcomingEvents: upcoming,
      snapshot,
      homeMetrics,
      heroStats,
    }),
    [
      pageSlug,
      loading,
      failed,
      academies,
      courses,
      sponsors,
      products,
      events,
      upcoming,
      snapshot,
      homeMetrics,
      heroStats,
    ],
  );

  return <LivePreviewContext.Provider value={value}>{children}</LivePreviewContext.Provider>;
}

/** `null` on the public site (no provider), live data inside the builder. */
export function useBuilderLivePreview(): BuilderLivePreview | null {
  return useContext(LivePreviewContext);
}
