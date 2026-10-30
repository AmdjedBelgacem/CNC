'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useTranslations } from 'next-intl';
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

async function readJson<T>(url: string): Promise<T | null> {
  try {
    const res = await apiProxyFetch(url);
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
  const tProducts = useTranslations('pages.products');
  const tEvents = useTranslations('pages.events');
  const tFeed = useTranslations('pages.feed');

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
          readJson<unknown>('/api/proxy/academies'),
          readJson<unknown>('/api/proxy/courses?page=1&limit=6'),
          readJson<unknown>('/api/proxy/sponsors'),
          readJson<unknown>('/api/proxy/products?limit=200'),
          readJson<unknown>('/api/proxy/events?limit=50'),
          readJson<unknown>('/api/proxy/events?limit=50&upcoming=true'),
          readJson<unknown>('/api/proxy/feed?limit=50'),
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
  }, []);

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
    });
  }, [pageSlug, loading, failed, academies, courses.length, sponsors.length]);

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
