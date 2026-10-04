'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  ArrowRight,
  BookOpen,
  Command,
  Compass,
  FileSearch,
  Loader2,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import {
  PUBLIC_SEARCH_RESULT_TYPES,
  SEARCH_RESULT_TYPES,
  searchResultTypesForScope,
  useSiteSearch,
  type SearchResultType,
} from '@/hooks/use-search';
import { SearchResultRow, SearchTypeIcon, SEARCH_TYPE_ICON } from '@/components/search/search-result-row';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { cn } from '@/lib/utils';

type SearchSort = 'relevance' | 'title' | 'newest';

function typeFromParam(value: string | null, allowed: SearchResultType[]): SearchResultType | 'all' {
  return value && allowed.includes(value as SearchResultType) ? (value as SearchResultType) : 'all';
}

function sortFromParam(value: string | null): SearchSort {
  return value === 'title' || value === 'newest' ? value : 'relevance';
}

function SearchPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations('search');
  const qParam = searchParams.get('q') ?? '';
  const scope: 'public' | 'admin' = searchParams.get('scope') === 'admin' || pathname?.startsWith('/admin') ? 'admin' : 'public';
  const allowedTypes = searchResultTypesForScope(scope);
  const typeParam = typeFromParam(searchParams.get('type'), allowedTypes);
  const pageParam = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const sortParam = sortFromParam(searchParams.get('sort'));
  const [inputValue, setInputValue] = useState(qParam);
  const [query, setQuery] = useState(qParam);
  const [activeType, setActiveType] = useState<SearchResultType | 'all'>(typeParam);
  const [page, setPage] = useState(pageParam);
  const [sort, setSort] = useState<SearchSort>(sortParam);

  useEffect(() => {
    setInputValue(qParam);
    setQuery(qParam);
    setActiveType(typeParam);
    setPage(pageParam);
    setSort(sortParam);
  }, [pageParam, qParam, sortParam, typeParam]);

  useEffect(() => {
    if (inputValue.trim() === qParam) return;
    const timer = window.setTimeout(() => {
      setQuery(inputValue.trim());
      setPage(1);
    }, 280);
    return () => window.clearTimeout(timer);
  }, [inputValue, qParam]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (query) params.set('q', query);
    else params.delete('q');
    if (activeType !== 'all') params.set('type', activeType);
    else params.delete('type');
    if (sort !== 'relevance') params.set('sort', sort);
    else params.delete('sort');
    if (scope === 'admin') params.set('scope', 'admin');
    else params.delete('scope');
    if (page > 1) params.set('page', String(page));
    else params.delete('page');
    const next = params.toString();
    if (next !== searchParams.toString()) router.replace(next ? `/search?${next}` : '/search', { scroll: false });
  }, [activeType, page, query, router, scope, searchParams, sort]);

  const { results, groups, total, pageCount, counts, isLoading, isFetching, isError, error, refetch, engine } =
    useSiteSearch(query, { scope, page, limit: 12, type: activeType, sort });

  const clear = useCallback(() => {
    setInputValue('');
    setQuery('');
    setActiveType('all');
    setPage(1);
    setSort('relevance');
    router.replace('/search', { scroll: false });
  }, [router]);

  const setType = (type: SearchResultType | 'all') => {
    setActiveType(type);
    setPage(1);
  };

  const chooseQuickSearch = (value: string) => {
    setInputValue(value);
    setQuery(value);
    setPage(1);
  };

  const visibleResults = useMemo(
    () => (activeType === 'all' ? results : results.filter((item) => item.type === activeType)),
    [activeType, results],
  );
  const visibleGroups = useMemo(
    () => (activeType === 'all' ? groups : groups.filter((group) => group.type === activeType)),
    [activeType, groups],
  );
  const hasQuery = query.trim().length >= 2;
  const resultTypes = scope === 'admin' ? SEARCH_RESULT_TYPES : PUBLIC_SEARCH_RESULT_TYPES;
  const groupLabel = (type: SearchResultType) => t(type);

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-background">
      <section className="relative overflow-hidden border-b border-secondary/20 bg-secondary text-secondary-foreground">
        <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:32px_32px]" />
        <div className="pointer-events-none absolute -end-24 -top-32 size-[28rem] rounded-full bg-primary/20 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-secondary-foreground/65">
            <span className="inline-flex items-center gap-2 rounded-full border border-secondary-foreground/20 bg-secondary-foreground/10 px-3 py-1.5">
              <Command className="size-3.5 text-primary" />
              {scope === 'admin' ? t('adminWorkspace') : t('publicCatalog')}
            </span>
            <span className="hidden sm:inline">{t('searchEverywhere')}</span>
          </div>
          <div className="mt-6 max-w-3xl">
            <h1 className="font-display text-4xl font-semibold tracking-[-0.04em] sm:text-5xl lg:text-6xl">{t('heroTitle')}</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-secondary-foreground/70 sm:text-base">{t('heroHint')}</p>
          </div>
          <form
            className="relative mt-8 max-w-3xl"
            onSubmit={(event) => {
              event.preventDefault();
              setQuery(inputValue.trim());
              setPage(1);
            }}
          >
            <Search className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder={t('placeholder')}
              aria-label={t('title')}
              autoFocus
              className="h-16 w-full rounded-2xl border border-white/15 bg-background px-12 pe-28 text-base text-foreground shadow-2xl outline-none placeholder:text-muted-foreground/70 focus:ring-4 focus:ring-primary/25 sm:h-[4.5rem] sm:text-lg"
            />
            {isFetching && <Loader2 className="absolute end-20 top-1/2 size-4 -translate-y-1/2 animate-spin text-primary" />}
            {inputValue && (
              <button
                type="button"
                onClick={clear}
                className="absolute end-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label={t('clear')}
              >
                <X className="size-4" />
              </button>
            )}
            <kbd className="pointer-events-none absolute end-4 top-1/2 hidden -translate-y-1/2 rounded-md border border-border bg-muted px-2 py-1 font-mono text-[10px] font-semibold text-muted-foreground sm:block">
              ⌘K
            </kbd>
          </form>
          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-secondary-foreground/60">
            <span className="uppercase tracking-[0.14em]">{t('trySearching')}</span>
            {['CNC', 'Titanium', 'Machining'].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => chooseQuickSearch(value)}
                className="rounded-full border border-secondary-foreground/15 bg-secondary-foreground/5 px-3 py-1.5 font-medium text-secondary-foreground/80 transition hover:border-primary/50 hover:bg-primary/10 hover:text-secondary-foreground"
              >
                {value}
              </button>
            ))}
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-14">
        {!hasQuery ? (
          <div className="grid gap-4 md:grid-cols-[1.15fr_.85fr]">
            <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-xs sm:p-8">
              <div className="absolute end-0 top-0 size-40 rounded-full bg-primary/10 blur-3xl" />
              <div className="relative">
                <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Compass className="size-5" /></div>
                <h2 className="mt-6 font-display text-2xl font-semibold tracking-tight">{t('discoverTitle')}</h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{t('discoverHint')}</p>
                <div className="mt-7 grid gap-2 sm:grid-cols-2">
                  {[
                    { href: '/courses', label: t('courses'), icon: BookOpen },
                    { href: '/products', label: t('products'), icon: Sparkles },
                    { href: '/feed', label: t('posts'), icon: FileSearch },
                    { href: '/events', label: t('events'), icon: Compass },
                  ].map((item) => (
                    <Link key={item.href} href={item.href} className="group flex items-center gap-3 rounded-xl border border-border bg-background/60 px-3 py-3 transition hover:border-primary/30 hover:bg-primary/[0.03]">
                      <item.icon className="size-4 text-muted-foreground transition group-hover:text-primary" />
                      <span className="flex-1 text-sm font-medium">{item.label}</span>
                      <ArrowRight className="flip-rtl size-3.5 text-muted-foreground/50 transition group-hover:translate-x-0.5 group-hover:text-primary" />
                    </Link>
                  ))}
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-surface-sunken/40 p-6 sm:p-8">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"><Sparkles className="size-4 text-primary" />{t('searchTips')}</div>
              <div className="mt-6 space-y-5">
                {[
                  [t('tipOneTitle'), t('tipOneHint')],
                  [t('tipTwoTitle'), t('tipTwoHint')],
                  [t('tipThreeTitle'), t('tipThreeHint')],
                ].map(([title, hint], index) => (
                  <div key={title} className="flex gap-4">
                    <span className="font-mono text-xs text-primary">0{index + 1}</span>
                    <div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{hint}</p></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{t('resultsFor', { query })}</p>
                <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">{total} {t('results')}</h2>
                {engine && <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{t('engineLabel')}: {engine}</p>}
              </div>
              <Select value={sort} onValueChange={(value) => { setSort(value as SearchSort); setPage(1); }}>
                <SelectTrigger className="h-9 w-[10rem] rounded-lg border-border bg-card text-xs" aria-label={t('sortLabel')}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="relevance">{t('sortRelevance')}</SelectItem>
                  <SelectItem value="title">{t('sortTitle')}</SelectItem>
                  <SelectItem value="newest">{t('sortNewest')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="no-scrollbar -mx-1 mt-5 flex gap-2 overflow-x-auto px-1 pb-2" role="tablist" aria-label={t('typeFilter')}>
              <button type="button" role="tab" aria-selected={activeType === 'all'} onClick={() => setType('all')} className={cn('inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold transition', activeType === 'all' ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground')}>
                {t('allResults')} <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-[10px]">{total}</span>
              </button>
              {resultTypes.map((type) => {
                const count = counts[type];
                const Icon = SEARCH_TYPE_ICON[type];
                return (
                  <button key={type} type="button" role="tab" aria-selected={activeType === type} onClick={() => setType(type)} className={cn('inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold transition', activeType === type ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground')}>
                    <Icon className="size-3.5" />{t(type)} {count !== undefined && <span className="opacity-65">{count}</span>}
                  </button>
                );
              })}
            </div>

            <div className="mt-7">
              {isError ? (
                <ErrorState title={t('failed')} description={error instanceof Error ? error.message : undefined} onRetry={() => void refetch()} />
              ) : isLoading || (isFetching && results.length === 0) ? (
                <div className="grid gap-3 md:grid-cols-2" role="status" aria-busy>
                  {[0, 1, 2, 3, 4, 5].map((item) => <Skeleton key={item} className="h-[4.5rem] rounded-xl" />)}
                </div>
              ) : total === 0 || visibleResults.length === 0 ? (
                <EmptyState icon={Search} title={t('noResults')} description={t('noResultsHint')} action={<Button variant="outline" onClick={clear}>{t('clear')}</Button>} />
              ) : activeType === 'all' ? (
                <div className="space-y-5">
                  {visibleGroups.map((group) => (
                    <section key={group.type} className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
                      <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-4 py-3">
                        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><SearchTypeIcon type={group.type} /></span>
                        <div className="flex-1"><h3 className="text-sm font-semibold">{groupLabel(group.type)}</h3><p className="text-[11px] text-muted-foreground">{group.items.length} {t('results')}</p></div>
                        <button type="button" onClick={() => setType(group.type)} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">{t('viewAll')} <ArrowRight className="flip-rtl size-3" /></button>
                      </div>
                      <div className="divide-y divide-border/70 p-1.5">{group.items.slice(0, 4).map((item) => <SearchResultRow key={`${item.type}-${item.id}`} item={item} showType={false} />)}</div>
                    </section>
                  ))}
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-border bg-card p-1.5 shadow-xs">{visibleResults.map((item) => <SearchResultRow key={`${item.type}-${item.id}`} item={item} />)}</div>
              )}
            </div>

            {hasQuery && !isError && pageCount > 1 && (
              <nav className="mt-8 flex items-center justify-between gap-3" aria-label={t('pagination')}>
                <Button variant="outline" size="sm" disabled={page <= 1 || isFetching} onClick={() => setPage((value) => Math.max(1, value - 1))}>{t('previous')}</Button>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{t('pageOf', { page, pageCount })}</span>
                <Button variant="outline" size="sm" disabled={page >= pageCount || isFetching} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>{t('next')}</Button>
              </nav>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8"><Skeleton className="h-64 rounded-2xl" /></div>}>
      <SearchPageInner />
    </Suspense>
  );
}
