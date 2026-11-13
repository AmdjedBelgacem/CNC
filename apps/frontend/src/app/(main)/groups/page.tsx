'use client';
import { rememberListCount } from '@/lib/admin-shape-memory';
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Plus, Search, Users } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { GroupCard } from '@/components/groups/group-card';
import { groupsApi, type StudyGroup } from '@/lib/groups-api';
import { useAuthStore } from '@/stores/auth-store';
import { AnimatePresence, Crossfade, Reveal, Stagger, StaggerItem } from '@/components/ui/motion';
import { ActivePill } from '@/components/feed/feed-motion';
import { cn } from '@/lib/utils';
import { GroupGridSkeleton, GroupsPageSkeleton } from '@/components/skeletons/public-page-replicas';

const MapView = dynamic(() => import('./map-view'), {
  ssr: false,
  loading: () => <Skeleton className="h-80 w-full rounded-xl" />,
});

/** Matches the DTO: 1–60 per page. */
const PAGE_SIZE = 12;

export default function GroupsPage() {
  return (
    <Suspense fallback={<GroupsPageSkeleton />}>
      <GroupsContent />
    </Suspense>
  );
}

function GroupsContent() {
  const t = useTranslations('pages.groups');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Filters live in the URL so a filtered view is shareable and survives a reload. The map and
  // the grid must always show the same set, which only holds if they read the same query.
  const city = searchParams.get('city') ?? '';
  const academy = searchParams.get('academy') ?? '';

  const [term, setTerm] = useState(searchParams.get('q') ?? '');
  const [debounced, setDebounced] = useState(term);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(term), 300);
    return () => window.clearTimeout(id);
  }, [term]);

  function setPage(next: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (next <= 1) params.delete('page');
    else params.set('page', String(next));
    router.replace(`/groups?${params.toString()}`, { scroll: false });
  }

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    // Typing a search resets pagination implicitly: the result set changes identity.
    next.delete('page');
    router.replace(`/groups?${next.toString()}`, { scroll: false });
  }

  const { data: cityList } = useQuery({
    queryKey: ['study-groups', 'cities'],
    queryFn: () => groupsApi.cities(),
    staleTime: 60_000,
  });

  const page = Number(searchParams.get('page') ?? '1') || 1;

  const {
    data,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['study-groups', 'list', { city, academy, q: debounced, page }],
    queryFn: () =>
      groupsApi.list({
        city: city || undefined,
        academy: academy || undefined,
        search: debounced || undefined,
        page,
        limit: PAGE_SIZE,
      }),
    placeholderData: (prev) => prev,
    retry: 1,
  });

  const groups = data?.data ?? [];
  const total = data?.total ?? 0;
  const hasFilters = Boolean(city || academy || debounced.trim());

  /**
   * Academy pills come from the rows themselves rather than a hardcoded list: `study_groups.academy`
   * is a free-text legacy taxonomy key with no backing table, so a fixed list would drift from what
   * is actually stored.
   */
  const academies = useMemo(() => {
    const seen = new Set<string>();
    for (const g of groups) if (g.academy) seen.add(g.academy);
    if (academy) seen.add(academy);
    return ['cnc', 'grinding', 'swiss', 'aerospace', 'automotive', 'toolmaking', 'welding', 'composites'].filter(
      (a) => seen.has(a) || a === academy,
    );
  }, [groups, academy]);

  const locations = useMemo(
    () =>
      groups
        .filter((g): g is StudyGroup & { lat: number; lng: number } => g.lat != null && g.lng != null)
        .map((g) => ({
          id: g.id,
          lat: g.lat,
          lng: g.lng,
          name: g.name,
          city: g.city,
          state: g.state,
        })),
    [groups],
  );

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // The /groups skeleton draws as many cards as the unfiltered first page last showed.
  useEffect(() => {
    if (!isLoading && !error && !hasFilters && page === 1) rememberListCount('public-groups', groups.length);
  }, [isLoading, error, hasFilters, page, groups.length]);

  return (
    <div>
      <section className="relative isolate overflow-hidden border-b border-border/70 py-20 md:py-28">
        <div className="ambient-wash absolute inset-0 -z-10" aria-hidden="true" />
        <div className="container mx-auto px-4 text-center">
          <h1 className="mx-auto mb-4 max-w-3xl text-balance font-display text-4xl font-medium tracking-[-0.022em] text-foreground sm:text-5xl">
            {t('title')}
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">{t('subtitle')}</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild>
              <Link href="/groups/new">
                <Plus className="me-2 size-4" aria-hidden="true" /> {t('startGroup')}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/groups/mine">{t('myGroups')}</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="border-b border-border/70 py-10">
        <Reveal className="container mx-auto px-4">
          <div className="overflow-hidden rounded-2xl border border-border/70 shadow-xs">
            <MapView locations={locations} />
          </div>
        </Reveal>
      </section>

      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder={t('searchPlaceholder')}
                aria-label={t('searchPlaceholder')}
                className="ps-9"
                type="search"
              />
            </div>
            <div className="sm:w-56">
              <label htmlFor="group-city-filter" className="sr-only">
                {t('cityFilter')}
              </label>
              <select
                id="group-city-filter"
                value={city}
                onChange={(e) => setFilter('city', e.target.value)}
                className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">{t('allCities')}</option>
                {(cityList ?? []).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-8 flex gap-2 overflow-x-auto pb-2" role="group" aria-label={t('academyFilter')}>
            <button
              type="button"
              onClick={() => setFilter('academy', '')}
              aria-pressed={!academy}
              className={cn(
                'relative shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
                !academy
                  ? 'border-transparent text-primary'
                  : 'border-border/70 bg-card text-muted-foreground hover:border-border-strong hover:text-foreground',
              )}
            >
              {!academy && <ActivePill layoutId="groups-academy-pill" className="bg-primary/10 shadow-none ring-primary/25" />}
              <span className="relative">{tCommon('all')}</span>
            </button>
            {academies.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setFilter('academy', academy === a ? '' : a)}
                aria-pressed={academy === a}
                className={cn(
                  'relative shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium capitalize transition-colors',
                  academy === a
                    ? 'border-transparent text-primary'
                    : 'border-border/70 bg-card text-muted-foreground hover:border-border-strong hover:text-foreground',
                )}
              >
                {academy === a && <ActivePill layoutId="groups-academy-pill" className="bg-primary/10 shadow-none ring-primary/25" />}
                <span className="relative">{a}</span>
              </button>
            ))}
          </div>

          <Crossfade value={isLoading ? 'loading' : error ? 'error' : groups.length === 0 ? 'empty' : 'list'} axis="none">
          {isLoading && (
            <GroupGridSkeleton />
          )}

          {error && <ErrorState title={t('loadFailed')} onRetry={() => refetch()} />}

          {!isLoading && !error && groups.length === 0 && (
            <EmptyState
              icon={Users}
              title={hasFilters ? t('noMatches') : t('emptyTitle')}
              description={hasFilters ? t('noMatchesHint') : t('emptyHint')}
              action={
                hasFilters ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setTerm('');
                      router.replace('/groups', { scroll: false });
                    }}
                  >
                    {t('clearFilters')}
                  </Button>
                ) : (
                  <Button asChild>
                    <Link href="/groups/new">{t('startGroup')}</Link>
                  </Button>
                )
              }
            />
          )}

          {!isLoading && !error && groups.length > 0 && (
            <>
              <p className="mb-4 text-sm text-muted-foreground" aria-live="polite">
                {t('resultsCount', { count: total })}
              </p>
              <Stagger as="ul" className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <AnimatePresence>
                  {groups.map((g, i) => (
                    <StaggerItem as="li" key={g.id} index={i} layout="position">
                      <GroupCard group={g} className="h-full" />
                    </StaggerItem>
                  ))}
                </AnimatePresence>
              </Stagger>

              {pageCount > 1 && (
                <nav className="mt-8 flex items-center justify-center gap-4" aria-label={t('pagination')}>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || isFetching}
                    onClick={() => setPage(page - 1)}
                  >
                    {t('previous')}
                  </Button>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {t('pageOf', { page, pages: pageCount })}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= pageCount || isFetching}
                    onClick={() => setPage(page + 1)}
                  >
                    {t('next')}
                  </Button>
                </nav>
              )}
            </>
          )}
          </Crossfade>

          {!isAuthenticated && (
            <p className="mt-10 text-center text-sm text-muted-foreground">
              {t('haveAccount')}{' '}
              <Link href="/login?returnUrl=/groups" className="font-medium text-primary underline-offset-4 hover:underline">
                {tCommon('signIn')}
              </Link>
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
