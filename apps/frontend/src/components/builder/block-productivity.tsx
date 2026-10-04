'use client';

/**
 * Block productivity: duplicate, copy/paste, hide, find, breadcrumb.
 *
 * These are the operations an author reaches for constantly while editing a
 * long page, and each one used to mean a manual rebuild: duplicating a section
 * meant re-adding its children one at a time, and "find the text I wrote twenty
 * blocks up" meant scrolling.
 *
 * Every operation goes through Puck's `dispatch` with a `replace`, so the whole
 * thing is one undo step and the debounced history recorder captures it.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ChevronRight,
  Copy,
  CopyPlus,
  Eye,
  EyeOff,
  Search,
  X,
} from 'lucide-react';
import {
  HIDDEN_PROP,
  cloneSubtreeWithFreshIds,
  findNodeById,
  insertNodeAtZone,
  walkLayoutNodes,
  type PageLayout,
  type PuckNode,
} from '@titan/shared';

export { HIDDEN_PROP };
import { useBuilderPuck } from '@/lib/builder/use-builder-puck';
import { useBuilderUI } from '@/components/builder/builder-ui-store';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';

/**
 * Clipboard held in memory, not `navigator.clipboard`.
 *
 * The payload is a layout subtree, not text: the async clipboard API would need
 * a serialization round trip, is unavailable on insecure origins, and would
 * leak page content to the OS clipboard. Same-page copy/paste is the documented
 * behaviour; the brief asked for "same page at minimum".
 */
let clipboard: PuckNode | null = null;

export function BlockProductivity() {
  const tb = useTranslations('builder');
  // Narrow selectors, not the whole `appState`: a new `appState` object is
  // produced on every hover and selection, and this component renders inside the
  // header, which is part of Puck's own tree.
  const data = useBuilderPuck((s) => s.appState.data);
  const itemSelector = useBuilderPuck((s) => s.appState.ui.itemSelector);
  const selectedItem = useBuilderPuck((s) => s.selectedItem) as
    | (PuckNode & { props?: Record<string, unknown> })
    | null;
  const dispatch = useBuilderPuck((s) => s.dispatch);
  const setDirty = useBuilderUI((s) => s.setDirty);

  const layout = data as unknown as PageLayout;
  const selectedId = (selectedItem?.props?.id as string | undefined) ?? null;
  const selector = itemSelector;
  const selectedHidden = selectedItem?.props?.[HIDDEN_PROP] === false;

  const [findOpen, setFindOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<Array<{ id: string; label: string; preview: string }>>([]);
  const [activeMatch, setActiveMatch] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  /* ------------------------------------------------------------- mutate */

  /**
   * Commit a new layout as ONE undoable step.
   *
   * The order matters and is the same one `saved-sections-actions` uses:
   * `setData` merges without recording history, `setUi` moves the selection,
   * then `set` with `recordHistory` anchors the post-change state. A no-op
   * `replace` cannot be used as the anchor — `replaceAction` mutates its input
   * state in place, and that object is shared with the previously recorded
   * history entry, so undo would restore a layout whose slots render empty.
   */
  const commit = useCallback(
    (next: PageLayout, note: string, select?: { zone: string; index: number }) => {
      dispatch({ type: 'setData', data: () => next } as never);
      if (select) {
        dispatch({
          type: 'setUi',
          ui: { itemSelector: { index: select.index, zone: select.zone } },
        } as never);
      }
      dispatch({ type: 'set', state: { data: next }, recordHistory: true } as never);
      setDirty(true);
      toast({ type: 'ok', title: note });
    },
    [dispatch, setDirty],
  );

  const duplicateSelected = useCallback(() => {
    if (!selectedId || !selector?.zone) return;
    const node = findNodeById(layout, selectedId);
    if (!node) return;
    const fresh = cloneSubtreeWithFreshIds(structuredClone(node));
    const { layout: next, index } = insertNodeAtZone(
      layout,
      selector.zone,
      fresh,
      (selector.index ?? 0) + 1,
    );
    commit(next, tb('productivity.duplicated'), { zone: selector.zone, index });
  }, [commit, layout, selectedId, selector, tb]);

  const copySelected = useCallback(() => {
    if (!selectedId) return;
    const node = findNodeById(layout, selectedId);
    if (!node) return;
    clipboard = structuredClone(node);
    toast({ type: 'ok', title: tb('productivity.copied') });
  }, [layout, selectedId, tb]);

  const pasteClipboard = useCallback(() => {
    if (!clipboard) {
      toast({ type: 'err', title: tb('productivity.clipboardEmpty') });
      return;
    }
    const fresh = cloneSubtreeWithFreshIds(structuredClone(clipboard));
    const zone = selector?.zone ?? 'root:default-zone';
    const at = selector ? (selector.index ?? 0) + 1 : undefined;
    const { layout: next, index } = insertNodeAtZone(layout, zone, fresh, at);
    commit(next, tb('productivity.pasted'), { zone, index });
  }, [commit, layout, selector, tb]);

  const toggleHidden = useCallback(() => {
    if (!selectedId) return;
    const next = structuredClone(layout);
    const node = findNodeById(next, selectedId);
    if (!node?.props) return;
    if (node.props[HIDDEN_PROP] === false) {
      delete node.props[HIDDEN_PROP];
    } else {
      node.props[HIDDEN_PROP] = false;
    }
    commit(
      next,
      selectedHidden ? tb('productivity.shown') : tb('productivity.hidden'),
      selector?.zone ? { zone: selector.zone, index: selector.index ?? 0 } : undefined,
    );
  }, [commit, layout, selectedHidden, selectedId, selector, tb]);

  /* -------------------------------------------------------------- find */

  useEffect(() => {
    if (!findOpen) {
      setMatches([]);
      return;
    }
    const q = query.trim().toLowerCase();
    if (q.length < 2) {
      setMatches([]);
      return;
    }
    const found: Array<{ id: string; label: string; preview: string }> = [];
    walkLayoutNodes(layout, (node) => {
      const id = node.props?.id as string | undefined;
      if (!id) return;
      for (const [key, value] of Object.entries(node.props ?? {})) {
        if (typeof value !== 'string' || value.length < q.length) continue;
        if (!value.toLowerCase().includes(q)) continue;
        // Skip ids and asset URLs: they match any search for a letter.
        if (/^(id|src|href|image|url|icon|className)$/i.test(key)) continue;
        found.push({
          id,
          label: String(node.type),
          preview: value.slice(0, 90),
        });
        break;
      }
    });
    setMatches(found.slice(0, 50));
    setActiveMatch(0);
  }, [findOpen, query, layout]);

  useEffect(() => {
    if (findOpen) searchRef.current?.focus();
  }, [findOpen]);

  const jumpToMatch = useCallback(
    (match: { id: string }) => {
      // Selecting the node scrolls the canvas to it and opens the inspector, so
      // the author lands on the text rather than on a list entry.
      const found = locateNode(layout, match.id);
      if (!found) return;
      dispatch({
        type: 'setUi',
        ui: { itemSelector: { index: found.index, zone: found.zone } },
      } as never);
    },
    [dispatch, layout],
  );

  const cycleMatch = useCallback(
    (direction: 1 | -1) => {
      if (!matches.length) return;
      const next = (activeMatch + direction + matches.length) % matches.length;
      setActiveMatch(next);
      jumpToMatch(matches[next]!);
    },
    [activeMatch, jumpToMatch, matches],
  );

  /* -------------------------------------------------------- breadcrumb */

  const trail = useMemo(() => buildTrail(layout, selectedId), [layout, selectedId]);

  return (
    <>
      <div className="flex min-w-0 items-center gap-0.5">
        <ToolbarButton
          label={tb('productivity.duplicate')}
          disabled={!selectedId || !selector?.zone}
          onClick={duplicateSelected}
        >
          <CopyPlus className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton label={tb('productivity.copy')} disabled={!selectedId} onClick={copySelected}>
          <Copy className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label={tb('productivity.paste')}
          disabled={!clipboard}
          onClick={pasteClipboard}
        >
          <span className="text-2xs font-semibold">PASTE</span>
        </ToolbarButton>
        <ToolbarButton
          label={selectedHidden ? tb('productivity.show') : tb('productivity.hide')}
          disabled={!selectedId}
          onClick={toggleHidden}
        >
          {selectedHidden ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
        </ToolbarButton>

        <span className="mx-1 h-4 w-px bg-border" aria-hidden />

        {findOpen ? (
          <div className="flex items-center gap-1">
            <Search className="ms-1 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <Input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') cycleMatch(e.shiftKey ? -1 : 1);
                if (e.key === 'Escape') setFindOpen(false);
              }}
              placeholder={tb('productivity.findPlaceholder')}
              aria-label={tb('productivity.find')}
              className="h-7 w-40 border-0 px-1 text-13 shadow-none focus-visible:ring-0"
            />
            {query.trim().length >= 2 && (
              <span className="shrink-0 font-mono text-2xs text-muted-foreground">
                {matches.length ? `${activeMatch + 1}/${matches.length}` : '0'}
              </span>
            )}
            <ToolbarButton label={tb('productivity.close')} onClick={() => setFindOpen(false)}>
              <X className="size-3.5" />
            </ToolbarButton>
          </div>
        ) : (
          <ToolbarButton label={tb('productivity.find')} onClick={() => setFindOpen(true)}>
            <Search className="size-3.5" />
          </ToolbarButton>
        )}
      </div>

      {findOpen && query.trim().length >= 2 && (
        <div className="fixed start-4 top-24 z-50 w-80 rounded-md border border-border bg-popover p-1 shadow-lg">
          {matches.length === 0 ? (
            <p className="px-2 py-4 text-center text-2xs text-muted-foreground">
              {tb('productivity.findEmpty')}
            </p>
          ) : (
            <ul className="max-h-64 overflow-y-auto">
              {matches.map((match, index) => (
                <li key={`${match.id}-${index}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveMatch(index);
                      jumpToMatch(match);
                    }}
                    className={cn(
                      'w-full rounded-sm px-2 py-1.5 text-start hover:bg-muted',
                      index === activeMatch && 'bg-muted',
                    )}
                  >
                    <span className="block font-mono text-2xs text-muted-foreground">
                      {match.label}
                    </span>
                    <span className="block truncate text-2xs text-foreground">{match.preview}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {trail.length > 1 && (
        <nav
          aria-label={tb('productivity.breadcrumb')}
          className="flex min-w-0 items-center gap-0.5 text-2xs text-muted-foreground"
        >
          {trail.map((crumb, index) => (
            <span key={`${crumb.id}-${index}`} className="flex min-w-0 items-center gap-0.5">
              {index > 0 && <ChevronRight className="flip-rtl size-3 shrink-0 opacity-50" aria-hidden />}
              <span className={cn('truncate', index === trail.length - 1 && 'text-foreground')}>
                {crumb.label}
              </span>
            </span>
          ))}
        </nav>
      )}
    </>
  );
}

function ToolbarButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="h-7 px-1.5"
    >
      {children}
    </Button>
  );
}

/* --------------------------------------------------------------- helpers */

/** Ancestor chain of a node, outermost first, ending at the node itself. */
function buildTrail(
  layout: PageLayout,
  selectedId: string | null,
): Array<{ id: string; label: string }> {
  if (!selectedId) return [];
  const path: Array<{ id: string; label: string }> = [];
  const walk = (nodes: PuckNode[] | undefined) => {
    for (const node of nodes ?? []) {
      const id = node.props?.id as string | undefined;
      if (!id) continue;
      const nested = Object.values(node.props ?? {}).filter(
        (v): v is PuckNode[] => Array.isArray(v) && v.length > 0 && typeof v[0] === 'object',
      );
      const inHere = nested.some((list) => containsId(list, selectedId));
      if (id === selectedId || inHere) {
        path.unshift({ id, label: String(node.type) });
        if (id === selectedId) return true;
        for (const list of nested) {
          if (walk(list)) return true;
        }
      }
    }
    return false;
  };
  walk(layout.content);
  return path;
}

function containsId(nodes: PuckNode[], id: string): boolean {
  for (const node of nodes) {
    const nodeId = node.props?.id as string | undefined;
    if (nodeId === id) return true;
    for (const value of Object.values(node.props ?? {})) {
      if (Array.isArray(value) && value.length && typeof value[0] === 'object') {
        if (containsId(value as PuckNode[], id)) return true;
      }
    }
  }
  return false;
}

/** Finds the zone and index of a node id, for the find-in-page jump. */
function locateNode(
  layout: PageLayout,
  id: string,
): { zone: string; index: number } | null {
  const content = layout.content ?? [];
  const flat = content.findIndex((n) => n.props?.id === id);
  if (flat >= 0) return { zone: 'content', index: flat };
  const owner = findParentSlot(layout.content, id);
  return owner;
}

function findParentSlot(
  nodes: PuckNode[],
  id: string,
): { zone: string; index: number } | null {
  for (const node of nodes) {
    const nodeId = (node.props?.id as string | undefined) ?? null;
    for (const [key, value] of Object.entries(node.props ?? {})) {
      if (!Array.isArray(value) || !value.length || typeof value[0] !== 'object') continue;
      const list = value as PuckNode[];
      const index = list.findIndex((n) => n.props?.id === id);
      if (index >= 0) return { zone: `${nodeId}:${key}`, index };
      const deeper = findParentSlot(list, id);
      if (deeper) return deeper;
    }
  }
  return null;
}

