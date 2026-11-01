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
  X,
} from 'lucide-react';
import { useSiteSearch, type SearchResultItem } from '@/hooks/use-search';
import { SearchResultRow } from '@/components/search/search-result-row';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/states';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { AnimatePresence, LayoutGroup, m } from 'framer-motion';
import { ease, spring, transition } from '@/lib/motion';

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
  const tc = useTranslations('common');
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

  const view =
    trimmed.length < 2
      ? 'quick'
      : isError
        ? 'error'
        : isDebouncing || (isFetching && results.length === 0)
          ? 'loading'
          : results.length === 0
            ? 'empty'
            : 'results';
  const busy = isFetching || isDebouncing;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        size="2xl"
        hideClose
        title={t('title')}
        /*
         * No positioning overrides here on purpose.
         *
         * DialogContent is already centred (`fixed left-1/2 top-1/2` plus the
         * `.dialog-pop` rule that carries `translate: -50% -50%`). This panel used to
         * force `!top-4 !translate-y-0 sm:!top-20`, which cancelled that translate and
         * pinned the palette to the top edge of the viewport — it opened under the
         * header and the results ran off the bottom. Centring is the base behaviour, so
         * only the width is overridden here.
         */
        className="!w-[calc(100vw-1.5rem)] !max-w-2xl overflow-hidden rounded-2xl border-border/80 bg-card p-0 shadow-2xl sm:!w-[calc(100vw-3rem)]"
        overlayClassName="!bg-overlay/30 !backdrop-blur-[2px]"
      >
        <DialogTitle className="sr-only">{t('title')}</DialogTitle>

        {/* ── Input row ─────────────────────────────────────────────── */}
        <div className="relative border-b border-border/70">
          <div className="flex items-center gap-3 px-4 sm:px-5">
            <span className="relative flex size-5 shrink-0 items-center justify-center text-muted-foreground">
              <AnimatePresence mode="popLayout" initial={false}>
                {busy ? (
                  <m.span
                    key="busy"
                    initial={{ opacity: 0, scale: 0.5, rotate: -90 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    transition={spring.snappy}
                    className="absolute"
                  >
                    <Loader2 className="size-[18px] animate-spin text-primary" />
                  </m.span>
                ) : (
                  <m.span
                    key="idle"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    transition={spring.snappy}
                    className="absolute"
                  >
                    <Search className="size-[18px]" />
                  </m.span>
                )}
              </AnimatePresence>
            </span>
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
              className="h-14 min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/70 sm:h-16 sm:text-[17px] [&::-webkit-search-cancel-button]:hidden"
            />
            <span className="hidden shrink-0 items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground sm:inline-flex">
              <Command className="size-3" />
              {scope === 'admin' ? t('adminWorkspace') : t('publicCatalog')}
            </span>
            <kbd className="hidden shrink-0 rounded-md border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground shadow-xs sm:block">ESC</kbd>
            {/* The kbd hint is desktop-only, so phones need a visible way out. */}
            <DialogClose asChild>
              <button
                type="button"
                aria-label={tc('close')}
                className="-me-1 rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:hidden"
              >
                <X className="size-4" />
              </button>
            </DialogClose>
          </div>
          {/* Indeterminate hairline while a query is in flight. */}
          <AnimatePresence>
            {busy && (
              <m.span
                key="progress"
                aria-hidden
                className="absolute inset-x-0 -bottom-px h-px overflow-hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.3 } }}
              >
                <m.span
                  className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-primary to-transparent"
                  initial={{ left: '-33%' }}
                  animate={{ left: '100%' }}
                  transition={{ duration: 1.1, ease: ease.standard, repeat: Infinity }}
                />
              </m.span>
            )}
          </AnimatePresence>
        </div>

        {/* ── Body ──────────────────────────────────────────────────── */}
        <div id="global-search-results" ref={listRef} role="listbox" className="max-h-[min(60vh,460px)] min-h-[16rem] overflow-y-auto overscroll-contain p-2 sm:p-3">
          <AnimatePresence mode="wait" initial={false}>
            <m.div
              key={view}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.22, ease: ease.emerge } }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
            >
              {view === 'quick' ? (
                <div className="px-2 py-3 sm:px-3 sm:py-4">
                  <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Sparkles className="size-3.5 text-primary" />{t('quickJump')}</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {[
                      { href: '/courses', label: t('courses'), detail: t('quickCourses') },
                      { href: '/products', label: t('products'), detail: t('quickProducts') },
                      { href: '/feed', label: t('posts'), detail: t('quickPosts') },
                      { href: '/notifications', label: t('notifications'), detail: t('quickNotifications') },
                    ].map((item, i) => (
                      <m.div
                        key={item.href}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ ...transition.enter, delay: 0.04 + i * 0.04 }}
                      >
                        <Link href={item.href} onClick={() => setOpen(false)} className="group flex items-center gap-3 rounded-xl border border-border/70 bg-background/60 px-3 py-3 transition-[background-color,border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:bg-card hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                          <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground transition group-hover:bg-primary/10 group-hover:text-primary"><ArrowRight className="flip-rtl size-3.5 transition-transform group-hover:translate-x-0.5" /></span>
                          <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{item.label}</span><span className="block truncate text-xs text-muted-foreground">{item.detail}</span></span>
                          <CornerDownLeft className="size-3.5 text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100" />
                        </Link>
                      </m.div>
                    ))}
                  </div>
                  <p className="mt-6 text-center font-display text-[15px] italic text-muted-foreground">{t('commandHint')}</p>
                </div>
              ) : view === 'error' ? (
                <div className="flex flex-col items-center gap-3 px-3 py-12 text-center">
                  <span className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive"><X className="size-5" /></span>
                  <p className="font-display text-lg font-medium text-foreground">{t('failed')}</p>
                  {error instanceof Error && error.message && <p className="max-w-md text-xs text-muted-foreground">{error.message}</p>}
                  <button type="button" onClick={() => void refetch()} className="rounded-full px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/[0.06]">{t('retry')}</button>
                </div>
              ) : view === 'loading' ? (
                <div className="space-y-1.5 p-1" role="status" aria-busy aria-label={t('loading') ?? 'Searching'}>
                  <span className="sr-only">{t('loading') ?? 'Searching'}</span>
                  {[0, 1, 2, 3, 4].map((item) => (
                    <div key={item} className="flex items-center gap-3 px-2 py-2" style={{ opacity: 1 - item * 0.16 }}>
                      <Skeleton className="size-9 shrink-0 rounded-lg" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3.5 w-1/2 rounded" />
                        <Skeleton className="h-3 w-3/4 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : view === 'empty' ? (
                <EmptyState compact icon={FileSearch} title={t('noResults')} description={t('noResultsHint')} />
              ) : (
                <LayoutGroup id="global-search">
                  <div className="space-y-0.5">
                    <div className="flex items-center justify-between px-3 pb-1.5 pt-1 text-xs text-muted-foreground"><span>{resultLabel}</span><span className="font-mono text-[10px]">{scope === 'admin' ? 'ADMIN' : 'PUBLIC'}</span></div>
                    {results.map((item: SearchResultItem, index) => (
                      <m.div
                        key={`${item.type}-${item.id}`}
                        data-active={index === activeIndex}
                        onMouseEnter={() => setActiveIndex(index)}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ ...transition.enter, delay: Math.min(index * 0.025, 0.2) }}
                      >
                        <SearchResultRow
                          id={`global-search-result-${index}`}
                          item={item}
                          active={index === activeIndex}
                          option
                          activeLayoutId="global-search-active"
                          onNavigate={() => setOpen(false)}
                        />
                      </m.div>
                    ))}
                  </div>
                </LayoutGroup>
              )}
            </m.div>
          </AnimatePresence>
        </div>

        {/* ── Footer ────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 border-t border-border/70 bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground sm:px-5">
          <span className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <kbd className="rounded-md border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] shadow-xs">↑</kbd>
              <kbd className="rounded-md border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] shadow-xs">↓</kbd>
              <kbd className="rounded-md border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] shadow-xs">↵</kbd>
            </span>
            {t('shortcut')}
          </span>
          <AnimatePresence initial={false}>
            {canViewAll && (
              <m.button
                key="view-all"
                type="button"
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 6 }}
                transition={spring.smooth}
                onClick={() => select(`/search?q=${encodeURIComponent(trimmed)}&scope=${scope}`)}
                className="group inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium text-primary transition-colors hover:bg-primary/[0.06]"
              >
                {t('viewAllResults')}
                <ArrowRight className="flip-rtl size-3 transition-transform group-hover:translate-x-0.5" />
              </m.button>
            )}
          </AnimatePresence>
        </div>
        <VisuallyHidden>{t('searchResults')}</VisuallyHidden>
      </DialogContent>
    </Dialog>
  );
}

export function PublicSearchPalette() {
  return <GlobalSearchPalette />;
}
