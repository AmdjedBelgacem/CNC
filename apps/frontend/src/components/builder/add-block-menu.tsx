'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useBuilderPuck } from '@/lib/builder/use-builder-puck';
import {
  Anchor,
  AlignLeft,
  BarChart3,
  BookOpen,
  Building2,
  CheckSquare2,
  Container,
  CreditCard,
  Gauge,
  GraduationCap,
  Grid3x3,
  Heading,
  HelpCircle,
  Image,
  LayoutGrid,
  Link2,
  ListTree,
  Megaphone,
  MousePointerClick,
  Navigation,
  PanelBottom,
  Plus,
  Puzzle,
  Rows3,
  Search,
  Shapes,
  Sparkles,
  Tag,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { puckConfig } from '@/lib/builder/puck-config';
import { getZoneItems, type PageLayout } from '@titan/shared';
import { cn } from '@/lib/utils';
const ROOT_ZONE = 'root:default-zone';
const BLOCK_ICONS: Record<string, LucideIcon> = {
  nav: Navigation,
  footer: PanelBottom,
  hero: Sparkles,
  stats: BarChart3,
  'partner-logos': Building2,
  'feature-tiles': LayoutGrid,
  'academy-grid': GraduationCap,
  'cta-banner': Megaphone,
  faq: HelpCircle,
  section: Container,
  'stat-item': TrendingUp,
  'logo-item': Image,
  'feature-item': CheckSquare2,
  'academy-card': BookOpen,
  'faq-item': HelpCircle,
  'footer-col': ListTree,
  stack: Rows3,
  grid: Grid3x3,
  card: CreditCard,
  heading: Heading,
  text: AlignLeft,
  button: MousePointerClick,
  link: Link2,
  'nav-link': Anchor,
  image: Image,
  icon: Shapes,
  badge: Tag,
  'avatar-stack': Users,
  'progress-card': Gauge,
}; /** * Header dropdown replacing Puck's left sidebar palette: click a block type to * insert it after the current selection (or at the end of the root zone). * Includes search and keyboard navigation (↑/↓/Enter). */
export function AddBlockMenu({ asCard = false }: { asCard?: boolean }) {
  const appState = useBuilderPuck((s) => s.appState);
  const dispatch = useBuilderPuck((s) => s.dispatch);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);
  useEffect(() => {
    if (open) {
      setQuery('');
      setHighlight(0);
      window.setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);
  const insert = (componentType: string) => {
    const sel = appState.ui.itemSelector;
    const zone = sel?.zone ?? ROOT_ZONE;
    const items = getZoneItems(appState.data as unknown as PageLayout, zone);
    const index = sel?.zone === zone ? (sel?.index ?? 0) + 1 : items.length;
    dispatch({
      type: 'insert',
      componentType,
      destinationZone: zone,
      destinationIndex: index,
      recordHistory: true,
    } as never);
    setOpen(false);
  };
  const label = (type: string) => {
    const component = puckConfig.components[type] as { label?: string; title?: string } | undefined;
    return component?.label ?? component?.title ?? type;
  };
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out: { category: string; type: string; label: string }[] = [];
    for (const [category, { components }] of Object.entries(puckConfig.categories ?? {})) {
      for (const type of components ?? []) {
        const l = label(type);
        if (!q || l.toLowerCase().includes(q) || type.toLowerCase().includes(q)) {
          out.push({ category, type, label: l });
        }
      }
    }
    return out;
  }, [query]);
  useEffect(() => {
    setHighlight(0);
  }, [query]);
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, rows.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter' && rows[highlight]) {
      e.preventDefault();
      insert(rows[highlight].type);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };
  return (
    <div ref={rootRef} className={cn('relative', asCard && 'w-full')}>
      {' '}
      {asCard ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full flex-col items-center gap-1 rounded-xl border border-border bg-background p-3 text-xs font-medium transition hover:bg-muted active:scale-95"
        >
          {' '}
          <Plus className="h-5 w-5" /> Add Block{' '}
        </button>
      ) : (
        <Button size="sm" className="h-8 gap-1.5 px-3" onClick={() => setOpen((v) => !v)}>
          {' '}
          <Plus className="h-3.5 w-3.5" /> Add Block{' '}
        </Button>
      )}{' '}
      {open && (
        <div
          className="fixed left-3 right-3 top-[48px] z-50 w-auto overflow-hidden rounded-xl border border-border bg-popover shadow-sm lg:absolute lg:left-0 lg:right-auto lg:top-full lg:mt-1.5 lg:w-64"
          onKeyDown={onKeyDown}
        >
          {' '}
          <div className="border-b border-border p-1.5">
            {' '}
            <div className="relative">
              {' '}
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />{' '}
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search blocks…"
                className="h-8 w-full rounded-lg border border-border bg-background pl-8 pr-2 text-xs text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/20"
              />{' '}
            </div>{' '}
          </div>{' '}
          <div ref={listRef} className="scrollbar-thin max-h-[55vh] overflow-y-auto p-1.5">
            {' '}
            {rows.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                No blocks match “{query}”
              </p>
            ) : (
              rows.map((row, i) => {
                const Icon = BLOCK_ICONS[row.type] ?? Puzzle;
                return (
                  <button
                    key={`${row.category}-${row.type}`}
                    type="button"
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => insert(row.type)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium transition',
                      i === highlight
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground hover:bg-muted',
                    )}
                  >
                    {' '}
                    <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />{' '}
                    <span className="truncate">{row.label}</span>{' '}
                    <span className="ml-auto shrink-0 font-mono text-[9px] uppercase text-muted-foreground/60">
                      {row.category}
                    </span>{' '}
                  </button>
                );
              })
            )}{' '}
          </div>{' '}
          <div className="border-t border-border px-2 py-1.5">
            {' '}
            <p className="text-[10px] text-muted-foreground/70">
              {' '}
              Inserts after the selected block — or at the end of the page.{' '}
              <kbd className="rounded border border-border bg-muted px-1 font-mono">↑↓</kbd>{' '}
              navigate,{' '}
              <kbd className="rounded border border-border bg-muted px-1 font-mono">↵</kbd>{' '}
              insert{' '}
            </p>{' '}
          </div>{' '}
        </div>
      )}{' '}
    </div>
  );
}
