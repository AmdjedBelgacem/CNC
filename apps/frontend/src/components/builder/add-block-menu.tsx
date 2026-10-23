'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
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
  MessageSquareQuote,
  MonitorPlay,
  MailPlus,
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
  TerminalSquare,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { AnchorPanel } from '@/components/builder/anchor-panel';
import { Button } from '@/components/ui/button';
import { puckBlockLabel, puckCategoryLabel, puckConfig } from '@/lib/builder/puck-config';
import {
  BLOCK_CATEGORIES,
  BLOCK_REGISTRY,
  findNodeById,
  getBlockDefinition,
  getZoneItems,
  isKnownBlockType,
  type BlockDefinition,
  type PageLayout,
} from '@titan/shared';
import { cn } from '@/lib/utils';
const ROOT_ZONE = 'root:default-zone';
/**
 * Page chrome that the public shell already renders.
 *
 * These blocks are still valid in legacy layouts (the public renderer skips
 * them, and `nav` remains registered with Puck so those layouts stay editable),
 * but offering them in the insert menu would create a block with no visible
 * public effect.
 */
const INSERT_MENU_EXCLUDED = new Set(['nav', 'footer']);
const BLOCK_ICONS: Record<string, LucideIcon> = {
  // Five blocks previously fell back to the generic `Puzzle` glyph, which made
  // them look like placeholders in a list where everything else had an icon.
  'catalog-hero': MonitorPlay,
  'card-grid': LayoutGrid,
  'spotlight-cards': Sparkles,
  'closing-cta': CheckSquare2,
  'live-island': MousePointerClick,
  nav: Navigation,
  footer: PanelBottom,
  hero: Sparkles,
  'hero-console': MonitorPlay,
  stats: BarChart3,
  'partner-logos': Building2,
  'feature-tiles': LayoutGrid,
  'academy-grid': GraduationCap,
  'program-cards': LayoutGrid,
  'twin-section': TerminalSquare,
  testimonials: MessageSquareQuote,
  'cta-banner': Megaphone,
  'cta-signup': MailPlus,
  faq: HelpCircle,
  section: Container,
  'stat-item': TrendingUp,
  'logo-item': Image,
  'feature-item': CheckSquare2,
  'academy-card': BookOpen,
  'program-card': BookOpen,
  'testimonial-card': MessageSquareQuote,
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
  const tb = useTranslations('builder');
  const t = useTranslations('ui.builder');
  const appState = useBuilderPuck((s) => s.appState);
  const dispatch = useBuilderPuck((s) => s.dispatch);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [highlight, setHighlight] = useState(0);
  const triggerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeId = (type: string) => `add-block-option-${type}`;
  useEffect(() => {
    if (open) {
      setQuery('');
      setCategory('all');
      setHighlight(0);
      window.setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);
  const insert = (componentType: string) => {
    const layout = appState.data as unknown as PageLayout;
    const sel = appState.ui.itemSelector;
    const rootItems = getZoneItems(layout, ROOT_ZONE);
    let zone = ROOT_ZONE;
    let index = rootItems.length;

    if (sel?.zone === ROOT_ZONE) {
      index = (sel.index ?? rootItems.length - 1) + 1;
    } else if (sel?.zone) {
      /**
       * Insert beside the selected node only when its parent slot actually
       * accepts this block type. Puck silently drops an insert into a slot
       * whose `allow` list or `max` rejects it, which made "Add Block" look
       * broken whenever a seeded item (for example a stat card) happened to
       * be selected. Falling back to the end of the page is predictable and
       * guarantees the block is not lost.
       */
      const separator = sel.zone.indexOf(':');
      const ownerId = separator > 0 ? sel.zone.slice(0, separator) : '';
      const slot = separator > 0 ? sel.zone.slice(separator + 1) : '';
      const owner = findNodeById(layout, ownerId);
      const spec = owner ? getBlockDefinition(owner.type)?.zones?.[slot] : undefined;
      const items = getZoneItems(layout, sel.zone);
      const allowed = Boolean(spec && (!spec.allow || spec.allow.includes(componentType)));
      const hasRoom = !spec?.max || items.length < spec.max;
      if (allowed && hasRoom) {
        zone = sel.zone;
        index = (sel.index ?? items.length - 1) + 1;
      }
    }

    dispatch({
      type: 'insert',
      componentType,
      destinationZone: zone,
      destinationIndex: index,
      recordHistory: true,
    } as never);
    setOpen(false);
  };
  /** The stored English `label` is the fallback, so an untranslated block still reads as written. */
  const label = (type: string) => {
    const component = puckConfig.components[type] as { label?: string; title?: string } | undefined;
    return puckBlockLabel(tb, type, component?.label ?? component?.title ?? type);
  };
  const categoryLabel = (category: string) => puckCategoryLabel(tb, category, category);
  /**
   * Every block the editor can actually insert, taken from the registry.
   *
   * The menu used to iterate `puckConfig.categories`, which is a separate hand-maintained list:
   * it silently omitted `footer-col` and `nav-link` (as well as page chrome), so real blocks
   * could never be added from the UI. The registry is the single source of truth and is checked
   * against the component map so an entry without a renderer is never offered. `nav` and `footer`
   * stay registered for legacy layouts but are deliberately excluded here.
   */
  const allRows = useMemo(() => {
    const defs = BLOCK_REGISTRY as unknown as Record<string, BlockDefinition | undefined>;
    return Object.entries(defs)
      .filter(
        ([type, def]) =>
          def &&
          isKnownBlockType(type) &&
          !INSERT_MENU_EXCLUDED.has(type) &&
          Boolean(puckConfig.components[type]),
      )
      .map(([type, def]) => ({
        category: def!.category,
        type,
        label: label(type),
        description: def!.description ?? '',
      }));
  }, [tb]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of allRows) counts.set(row.category, (counts.get(row.category) ?? 0) + 1);
    return counts;
  }, [allRows]);

  /** Categories in the registry's declared order, so the tabs never shuffle. */
  const tabs = useMemo(() => {
    const present = new Set(allRows.map((r) => r.category));
    return [
      { key: 'all', count: allRows.length },
      ...BLOCK_CATEGORIES.filter((c) => present.has(c)).map((c) => ({
        key: c as string,
        count: categoryCounts.get(c) ?? 0,
      })),
    ];
  }, [allRows, categoryCounts]);

  /**
   * Rank matches so the obvious answer is first: an exact type or label beats a
   * prefix, which beats a word match, which beats a match anywhere. A search for
   * "grid" used to surface Grid Layout above Card Grid purely by registry order.
   */
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const inCategory = (c: string) => category === 'all' || c === category;
    if (!q) return allRows.filter((r) => inCategory(r.category));

    const scored: { row: (typeof allRows)[number]; score: number }[] = [];
    for (const row of allRows) {
      if (!inCategory(row.category)) continue;
      const label = row.label.toLowerCase();
      const type = row.type.toLowerCase();
      const description = row.description.toLowerCase();
      const cat = categoryLabel(row.category).toLowerCase();
      let score = -1;
      if (type === q || label === q) score = 0;
      else if (type.startsWith(q) || label.startsWith(q)) score = 1;
      else if (new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(label)) score = 2;
      else if (label.includes(q) || type.includes(q)) score = 3;
      else if (description.includes(q)) score = 4;
      else if (cat.includes(q)) score = 5;
      if (score >= 0) scored.push({ row, score });
    }
    return scored
      .sort((a, b) => a.score - b.score || a.row.label.localeCompare(b.row.label))
      .map((x) => x.row);
  }, [allRows, query, category, tb]);

  useEffect(() => {
    setHighlight(0);
  }, [query, category]);

  /** Keep the keyboard highlight inside the list as it shrinks. */
  useEffect(() => {
    if (highlight > rows.length - 1) setHighlight(Math.max(0, rows.length - 1));
  }, [rows.length, highlight]);

  /** Scroll the highlighted row into view while arrowing through a long list. */
  useEffect(() => {
    if (!open || !rows[highlight]) return;
    document.getElementById(activeId(rows[highlight].type))?.scrollIntoView({ block: 'nearest' });
  }, [open, highlight, rows]);
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
    <div ref={triggerRef} className={cn(asCard && 'w-full')}>
      {' '}
      {asCard ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full flex-col items-center gap-1 rounded-xl border border-border bg-background p-3 text-xs font-medium transition hover:bg-muted active:scale-95"
        >
          {' '}
          <Plus className="size-5" /> {t('addBlock')}{' '}
        </button>
      ) : (
        <Button size="sm" className="h-8 gap-1.5 px-3" onClick={() => setOpen((v) => !v)}>
          {' '}
          <Plus className="size-3.5" /> {t('addBlock')}{' '}
        </Button>
      )}{' '}
      <AnchorPanel
        anchorRef={triggerRef}
        open={open}
        onDismiss={() => setOpen(false)}
        minWidth={320}
      >
        <div className="flex min-h-0 flex-col" onKeyDown={onKeyDown}>
          <div className="sr-only" role="heading" aria-level={2}>
            {t('insertHeading')}
          </div>{' '}
          <div className="border-b border-border p-1.5">
            {' '}
            <div className="relative">
              {' '}
              <Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />{' '}
              <input
                ref={inputRef}
                type="text"
                role="combobox"
                aria-expanded={open}
                aria-controls="add-block-listbox"
                aria-autocomplete="list"
                aria-activedescendant={rows[highlight] ? activeId(rows[highlight].type) : undefined}
                aria-label={t('searchBlocksPlaceholder')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('searchBlocksPlaceholder')}
                className="h-8 w-full rounded-lg border border-border bg-background ps-8 pe-2 text-xs text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/20"
              />{' '}
            </div>{' '}
          </div>{' '}
          <div
            className="flex flex-wrap gap-1 border-b border-border px-1.5 py-1.5"
            role="tablist"
            aria-label={t('allCategories')}
          >
            {tabs.map((tab) => {
              const selected = category === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setCategory(tab.key)}
                  className={cn(
                    'rounded-md px-2 py-1 text-2xs font-medium transition',
                    selected
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {tab.key === 'all' ? t('allCategories') : categoryLabel(tab.key)}
                  <span className="ms-1 font-mono opacity-60">{tab.count}</span>
                </button>
              );
            })}
          </div>
          <div className="px-2.5 py-1 text-2xs text-muted-foreground/70" aria-live="polite">
            {t('resultsCount', { count: rows.length, total: allRows.length })}
          </div>
          <div
            id="add-block-listbox"
            role="listbox"
            aria-label={t('insertHeading')}
            className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-1.5"
          >
            {' '}
            {rows.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                {query
                  ? t('noBlocksMatch', { query })
                  : t('resultsCount', { count: 0, total: allRows.length })}
              </p>
            ) : (
              rows.map((row, i) => {
                const Icon = BLOCK_ICONS[row.type] ?? Puzzle;
                return (
                  <button
                    key={row.type}
                    id={activeId(row.type)}
                    type="button"
                    role="option"
                    aria-selected={i === highlight}
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => insert(row.type)}
                    className={cn(
                      'flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium transition',
                      i === highlight
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground hover:bg-muted',
                    )}
                  >
                    {' '}
                    <Icon
                      className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />{' '}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{row.label}</span>
                      {row.description ? (
                        <span className="mt-0.5 block text-2xs font-normal leading-snug text-muted-foreground">
                          {row.description}
                        </span>
                      ) : null}
                    </span>{' '}
                    <span className="mt-0.5 shrink-0 font-mono text-2xs uppercase text-muted-foreground/60">
                      {categoryLabel(row.category)}
                    </span>{' '}
                  </button>
                );
              })
            )}{' '}
          </div>{' '}
          <div className="border-t border-border px-2 py-1.5">
            {' '}
            <p className="text-2xs text-muted-foreground/70">
              {' '}
              {t('insertHint')}{' '}
              <kbd className="rounded border border-border bg-muted px-1 font-mono">↑↓</kbd>{' '}
              {t('navigateHint')}{' '}
              <kbd className="rounded border border-border bg-muted px-1 font-mono">↵</kbd>{' '}
              {t('insertVerb')}{' '}
            </p>{' '}
          </div>{' '}
        </div>
      </AnchorPanel>{' '}
    </div>
  );
}
