'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Search, BookOpen, Layers, PlayCircle, User, Loader2, CornerDownLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
interface SearchResultItem {
  type: 'course' | 'series' | 'lesson' | 'user';
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
}
const TYPE_META: Record<SearchResultItem['type'], { label: string; icon: typeof BookOpen }> = {
  course: { label: 'Course', icon: BookOpen },
  series: { label: 'Series', icon: Layers },
  lesson: { label: 'Lesson', icon: PlayCircle },
  user: { label: 'User', icon: User },
};
export const ADMIN_SEARCH_OPEN_EVENT = 'admin-search:open';
export function openAdminSearch() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ADMIN_SEARCH_OPEN_EVENT));
  }
}
export function AdminSearchPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpenEvent = () => setOpen(true);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener(ADMIN_SEARCH_OPEN_EVENT, onOpenEvent);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener(ADMIN_SEARCH_OPEN_EVENT, onOpenEvent);
    };
  }, []);
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/proxy/search?q=${encodeURIComponent(q)}`, {
          credentials: 'include',
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          setResults(Array.isArray(data?.results) ? data.results : []);
        } else {
          setResults([]);
        }
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);
  useEffect(() => {
    setActiveIndex(0);
  }, [results]);
  const select = useCallback(
    (item: SearchResultItem) => {
      setOpen(false);
      router.push(item.href);
    },
    [router],
  );
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[activeIndex]) {
      e.preventDefault();
      select(results[activeIndex]);
    }
  };
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      {' '}
      <DialogPrimitive.Portal>
        {' '}
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-gray-900" />{' '}
        <DialogPrimitive.Content
          className="fixed left-1/2 top-[15%] z-50 w-full max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-card shadow-sm"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {' '}
          <DialogPrimitive.Title className="sr-only">Global search</DialogPrimitive.Title>{' '}
          <div className="flex items-center gap-3 border-b border-border px-4">
            {' '}
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />{' '}
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search courses, lessons, users…"
              className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />{' '}
            {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}{' '}
            <kbd className="hidden shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:block">
              {' '}
              ESC{' '}
            </kbd>{' '}
          </div>{' '}
          <div ref={listRef} className="max-h-[320px] overflow-y-auto p-2">
            {' '}
            {!query.trim() ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                {' '}
                Type to search across your academy.{' '}
              </p>
            ) : !loading && results.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                No results for “{query}”.
              </p>
            ) : (
              results.map((item, i) => {
                const meta = TYPE_META[item.type];
                const Icon = meta.icon;
                return (
                  <button
                    key={`${item.type}-${item.id}`}
                    type="button"
                    data-active={i === activeIndex}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => select(item)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                      i === activeIndex
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground hover:bg-muted',
                    )}
                  >
                    {' '}
                    <span
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                        i === activeIndex
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {' '}
                      <Icon className="h-4 w-4" />{' '}
                    </span>{' '}
                    <span className="min-w-0 flex-1">
                      {' '}
                      <span className="block truncate text-sm font-medium">{item.title}</span>{' '}
                      {item.subtitle && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {item.subtitle}
                        </span>
                      )}{' '}
                    </span>{' '}
                    <span className="shrink-0 rounded-md border border-border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {' '}
                      {meta.label}{' '}
                    </span>{' '}
                    {i === activeIndex && (
                      <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}{' '}
                  </button>
                );
              })
            )}{' '}
          </div>{' '}
          <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
            {' '}
            <span>↑↓ navigate · ↵ open · esc close</span> <span>Tenant-scoped results</span>{' '}
          </div>{' '}
        </DialogPrimitive.Content>{' '}
      </DialogPrimitive.Portal>{' '}
    </DialogPrimitive.Root>
  );
}
