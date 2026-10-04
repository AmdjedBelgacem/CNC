'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  ArrowRight,
  Command,
  CornerDownLeft,
  FileSearch,
  Loader2,
  Search,
  Sparkles,
} from 'lucide-react';
import { useSiteSearch, type SearchResultItem } from '@/hooks/use-search';
import { SearchResultRow } from '@/components/search/search-result-row';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/states';
import { VisuallyHidden } from '@/components/ui/visually-hidden';

export const GLOBAL_SEARCH_OPEN_EVENT = 'global-search:open';
export const PUBLIC_SEARCH_OPEN_EVENT = GLOBAL_SEARCH_OPEN_EVENT;
export const ADMIN_SEARCH_OPEN_EVENT = GLOBAL_SEARCH_OPEN_EVENT;

export function openGlobalSearch() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(GLOBAL_SEARCH_OPEN_EVENT));
}

export function openPublicSearch() {
  openGlobalSearch();
}

export function openAdminSearch() {
  openGlobalSearch();
}

export function GlobalSearchPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('search');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const scope = pathname?.startsWith('/admin') ? 'admin' : 'public';
  const { results, isFetching, isError, error, refetch } = useSiteSearch(debouncedQuery, {
    enabled: open,
    scope,
    limit: 8,
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener(GLOBAL_SEARCH_OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener(GLOBAL_SEARCH_OPEN_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setDebouncedQuery('');
    setActiveIndex(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 180);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [results]);

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const select = useCallback((href: string) => {
    setOpen(false);
    router.push(href);
  }, [router]);

  const trimmed = query.trim();
  const isDebouncing = trimmed !== debouncedQuery;
  const canViewAll = trimmed.length >= 2;

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (isDebouncing) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, Math.max(0, results.length - 1)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const item = results[activeIndex];
      if (item) select(item.href);
      else if (query.trim().length >= 2) select(`/search?q=${encodeURIComponent(query.trim())}&scope=${scope}`);
    }
  };

  const resultLabel = useMemo(() => {
    if (isDebouncing || (isFetching && results.length === 0)) return t('searching');
    if (results.length > 0) return `${results.length} ${t('results')}`;
    return t('commandHint');
  }, [isDebouncing, isFetching, results.length, t]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        size="2xl"
        hideClose
        title={t('title')}
        className="!left-1/2 !top-4 !w-[calc(100vw-1.5rem)] !max-w-3xl !translate-x-[-50%] !translate-y-0 overflow-hidden rounded-3xl border-border/80 bg-card/95 p-0 shadow-2xl backdrop-blur-xl sm:!top-20 sm:!w-[calc(100vw-3rem)]"
        overlayClassName="!bg-black/25 !backdrop-blur-0"
      >
        <DialogTitle className="sr-only">{t('title')}</DialogTitle>
        <div className="relative border-b border-border/80 bg-foreground px-5 py-5 text-background sm:px-7 sm:py-6">
          <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.12)_1px,transparent_1px)] [background-size:28px_28px]" />
          <div className="relative flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20"><Command className="size-4" /></span>
              <div><p className="font-display text-sm font-semibold tracking-wide">{t('commandLabel')}</p><p className="mt-0.5 text-[11px] text-background/60">{scope === 'admin' ? t('adminWorkspace') : t('publicCatalog')}</p></div>
            </div>
            <kbd className="hidden rounded-md border border-background/20 bg-background/10 px-2 py-1 font-mono text-[10px] font-semibold text-background/70 sm:block">ESC</kbd>
          </div>
          <div className="relative mt-5 flex items-center gap-3 rounded-xl border border-white/15 bg-background px-4 shadow-xl">
            <Search className="size-4 shrink-0 text-primary" />
            <input
              ref={inputRef}
              type="search"
              autoFocus
              role="combobox"
              aria-expanded="true"
              aria-controls="global-search-results"
              aria-activedescendant={!isDebouncing && results[activeIndex] ? `global-search-result-${activeIndex}` : undefined}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder={scope === 'admin' ? t('adminPlaceholder') : t('placeholder')}
              className="h-12 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
            />
            {(isFetching || isDebouncing) && <Loader2 className="size-4 shrink-0 animate-spin text-primary" />}
          </div>
        </div>

        <div id="global-search-results" ref={listRef} role="listbox" className="max-h-[min(62vh,460px)] overflow-y-auto p-3 sm:p-4">
          {trimmed.length < 2 ? (
            <div className="px-1 py-3 sm:px-3 sm:py-5">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"><Sparkles className="size-3.5 text-primary" />{t('quickJump')}</div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {[
                  { href: '/courses', label: t('courses'), detail: t('quickCourses') },
                  { href: '/products', label: t('products'), detail: t('quickProducts') },
                  { href: '/feed', label: t('posts'), detail: t('quickPosts') },
                  { href: '/notifications', label: t('notifications'), detail: t('quickNotifications') },
                ].map((item) => (
                  <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="group flex items-center gap-3 rounded-xl border border-border/70 bg-background/50 px-3 py-3 transition hover:border-primary/25 hover:bg-primary/[0.04]">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground transition group-hover:bg-primary/10 group-hover:text-primary"><ArrowRight className="flip-rtl size-3.5" /></span>
                    <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{item.label}</span><span className="block truncate text-[11px] text-muted-foreground">{item.detail}</span></span>
                    <CornerDownLeft className="size-3.5 text-muted-foreground/40" />
                  </Link>
                ))}
              </div>
              <p className="mt-6 text-center text-xs text-muted-foreground">{t('commandHint')}</p>
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center gap-3 px-3 py-12 text-center">
              <p className="text-sm font-semibold text-destructive">{t('failed')}</p>
              {error instanceof Error && error.message && <p className="max-w-md text-xs text-muted-foreground">{error.message}</p>}
              <button type="button" onClick={() => void refetch()} className="text-sm font-semibold text-primary hover:underline">{t('retry')}</button>
            </div>
          ) : isDebouncing || (isFetching && results.length === 0) ? (
            <div className="space-y-2" role="status" aria-busy aria-label={t('loading') ?? 'Searching'}>
              <span className="sr-only">{t('loading') ?? 'Searching'}</span>
              {[0, 1, 2, 3, 4].map((item) => (
                <Skeleton key={item} className="h-[4.25rem] w-full rounded-xl" />
              ))}
            </div>
          ) : results.length === 0 ? (
            <EmptyState compact icon={FileSearch} title={t('noResults')} description={t('noResultsHint')} />
          ) : (
            <div className="space-y-1">
              <div className="flex items-center justify-between px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"><span>{resultLabel}</span><span className="font-mono normal-case tracking-normal">{scope === 'admin' ? 'ADMIN' : 'PUBLIC'}</span></div>
              {results.map((item: SearchResultItem, index) => (
                <div key={`${item.type}-${item.id}`} data-active={index === activeIndex} onMouseEnter={() => setActiveIndex(index)}>
                  <SearchResultRow id={`global-search-result-${index}`} item={item} active={index === activeIndex} option onNavigate={() => setOpen(false)} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border/80 bg-muted/20 px-4 py-3 text-[10px] text-muted-foreground sm:px-6">
          <span className="flex items-center gap-2"><kbd className="rounded border border-border bg-card px-1.5 py-0.5 font-mono">↑↓</kbd>{t('shortcut')}</span>
          {canViewAll && <button type="button" onClick={() => select(`/search?q=${encodeURIComponent(trimmed)}&scope=${scope}`)} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">{t('viewAllResults')}<ArrowRight className="flip-rtl size-3" /></button>}
        </div>
        <VisuallyHidden>{t('searchResults')}</VisuallyHidden>
      </DialogContent>
    </Dialog>
  );
}

export function PublicSearchPalette() {
  return <GlobalSearchPalette />;
}
