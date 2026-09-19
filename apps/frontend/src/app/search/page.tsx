'use client';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Search, BookOpen, ShoppingBag, FileText, Calendar, User, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
type SearchResultType = 'course' | 'product' | 'post' | 'event' | 'user';
interface SearchResultItem {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
}
const TYPE_META: Record<SearchResultType, { label: string; icon: typeof BookOpen }> = {
  course: { label: 'Courses', icon: BookOpen },
  product: { label: 'Products', icon: ShoppingBag },
  post: { label: 'Posts', icon: FileText },
  event: { label: 'Events', icon: Calendar },
  user: { label: 'People', icon: User },
};
const ALL_TYPES: SearchResultType[] = ['course', 'product', 'user', 'post', 'event'];
function SearchPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQ = searchParams.get('q') ?? '';
  const [inputValue, setInputValue] = useState(initialQ);
  const [query, setQuery] = useState(initialQ);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeType, setActiveType] = useState<SearchResultType | 'all'>('all'); // Debounce input -> query -> URL
  useEffect(() => {
    const t = setTimeout(() => setQuery(inputValue.trim()), 300);
    return () => clearTimeout(t);
  }, [inputValue]);
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (query) params.set('q', query);
    else params.delete('q');
    const newUrl = params.toString() ? `/search?${params.toString()}` : '/search';
    router.replace(newUrl, { scroll: false }); // eslint-disable-line
    if (!query || query.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    fetch(`/api/proxy/search/public?q=${encodeURIComponent(query)}`, {
      credentials: 'include',
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : { results: [] }))
      .then((data) => setResults(Array.isArray(data?.results) ? data.results : []))
      .catch(() => {
        if (!controller.signal.aborted) setResults([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query]);
  const grouped = useMemo(() => {
    const map: Record<string, SearchResultItem[]> = {};
    for (const r of results) {
      if (!map[r.type]) map[r.type] = [];
      map[r.type]!.push(r);
    }
    return map;
  }, [results]);
  const filteredResults = useMemo(() => {
    if (activeType === 'all') return results;
    return results.filter((r) => r.type === activeType);
  }, [results, activeType]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: results.length };
    for (const t of ALL_TYPES) c[t] = grouped[t]?.length ?? 0;
    return c;
  }, [results, grouped]);
  const clear = useCallback(() => {
    setInputValue('');
    setQuery('');
    router.replace('/search', { scroll: false });
  }, [router]);
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {' '}
      <div className="mb-6">
        {' '}
        <h1 className="text-2xl font-bold tracking-tight">Search</h1>{' '}
        <p className="mt-1 text-sm text-muted-foreground">
          Find published courses, products, people, posts and events.
        </p>{' '}
      </div>{' '}
      <div className="relative mb-4">
        {' '}
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />{' '}
        <input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Search courses, products, people…"
          autoFocus
          className="h-11 w-full rounded-xl border border-input bg-card pl-10 pr-10 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
        />{' '}
        {inputValue && (
          <button
            type="button"
            onClick={clear}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Clear"
          >
            {' '}
            <X className="h-4 w-4" />{' '}
          </button>
        )}{' '}
        {loading && (
          <Loader2 className="absolute right-10 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}{' '}
      </div>{' '}
      {/* Type filters */}{' '}
      {query.length >= 2 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {' '}
          <button
            type="button"
            onClick={() => setActiveType('all')}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
              activeType === 'all'
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-muted-foreground hover:bg-muted',
            )}
          >
            {' '}
            All <span className="ml-1 opacity-70">({counts.all})</span>{' '}
          </button>{' '}
          {ALL_TYPES.map((t) => {
            const count = counts[t] ?? 0;
            if (count === 0 && activeType !== t) return null;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setActiveType(t)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition',
                  activeType === t
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted',
                )}
              >
                {' '}
                {TYPE_META[t].label} <span className="ml-1 opacity-70">({count})</span>{' '}
              </button>
            );
          })}{' '}
        </div>
      )}{' '}
      {/* Results */}{' '}
      <div className="space-y-6">
        {' '}
        {!query ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
            {' '}
            <Search className="mx-auto h-6 w-6 text-muted-foreground" />{' '}
            <p className="mt-3 text-sm font-medium">Start typing to search</p>{' '}
            <p className="mt-1 text-xs text-muted-foreground">
              Published courses, products, posts, events and people.
            </p>{' '}
          </div>
        ) : query.length < 2 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Keep typing…</p>
        ) : loading ? (
          <div className="space-y-3">
            {' '}
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
            ))}{' '}
          </div>
        ) : filteredResults.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card px-6 py-12 text-center">
            {' '}
            <p className="text-sm font-medium">No results for “{query}”.</p>{' '}
            <p className="mt-1 text-xs text-muted-foreground">
              Try a different term or check spelling.
            </p>{' '}
            <Link
              href="/courses"
              className="mt-4 inline-flex text-sm font-medium text-primary hover:underline"
            >
              {' '}
              Browse courses →{' '}
            </Link>{' '}
          </div>
        ) : activeType === 'all' ? (
          ALL_TYPES.map((type) => {
            const items = grouped[type];
            if (!items?.length) return null;
            const Icon = TYPE_META[type].icon;
            return (
              <section
                key={type}
                className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
              >
                {' '}
                <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-2.5">
                  {' '}
                  <Icon className="h-4 w-4 text-muted-foreground" />{' '}
                  <h2 className="text-sm font-semibold">{TYPE_META[type].label}</h2>{' '}
                  <span className="text-xs text-muted-foreground">· {items.length}</span>{' '}
                  <button
                    type="button"
                    onClick={() => setActiveType(type)}
                    className="ml-auto text-xs font-medium text-primary hover:underline"
                  >
                    {' '}
                    View all{' '}
                  </button>{' '}
                </div>{' '}
                <ul className="divide-y divide-border">
                  {' '}
                  {items.slice(0, 4).map((item) => (
                    <li key={`${item.type}-${item.id}`}>
                      {' '}
                      <Link
                        href={item.href}
                        className="flex items-center gap-3 px-4 py-3 transition hover:bg-muted/60"
                      >
                        {' '}
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          {' '}
                          <Icon className="h-4 w-4" />{' '}
                        </span>{' '}
                        <span className="min-w-0 flex-1">
                          {' '}
                          <span className="block truncate text-sm font-medium">
                            {item.title}
                          </span>{' '}
                          {item.subtitle && (
                            <span className="block truncate text-xs text-muted-foreground">
                              {item.subtitle}
                            </span>
                          )}{' '}
                        </span>{' '}
                      </Link>{' '}
                    </li>
                  ))}{' '}
                </ul>{' '}
              </section>
            );
          })
        ) : (
          <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            {' '}
            <ul className="divide-y divide-border">
              {' '}
              {filteredResults.map((item) => {
                const Icon = TYPE_META[item.type].icon;
                return (
                  <li key={`${item.type}-${item.id}`}>
                    {' '}
                    <Link
                      href={item.href}
                      className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-muted/60"
                    >
                      {' '}
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        {' '}
                        <Icon className="h-4 w-4" />{' '}
                      </span>{' '}
                      <span className="min-w-0 flex-1">
                        {' '}
                        <span className="block truncate text-sm font-medium">
                          {item.title}
                        </span>{' '}
                        {item.subtitle && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {item.subtitle}
                          </span>
                        )}{' '}
                      </span>{' '}
                      <span className="shrink-0 rounded-md border border-border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {' '}
                        {TYPE_META[item.type].label.slice(0, -1)}{' '}
                      </span>{' '}
                    </Link>{' '}
                  </li>
                );
              })}{' '}
            </ul>{' '}
          </section>
        )}{' '}
      </div>{' '}
      <p className="mt-8 text-center text-[11px] text-muted-foreground">
        Tenant-isolated · published content only
      </p>{' '}
    </div>
  );
}
export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-4xl px-4 py-8">
          <div className="h-11 animate-pulse rounded-xl bg-muted" />
        </div>
      }
    >
      {' '}
      <SearchPageInner />{' '}
    </Suspense>
  );
}
