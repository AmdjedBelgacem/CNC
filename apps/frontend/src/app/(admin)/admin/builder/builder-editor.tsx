'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Puck, useGetPuck } from '@measured/puck';
import type { Content, Data } from '@measured/puck';
import { BUILDER_PAGE_DEFS, getBlockDefinition } from '@titan/shared';
import {
  findNodeById,
  getSlotChildren,
  isNodeArray,
  migrateLegacyLayout,
  slotNamesFor,
  walkLayoutNodes,
  type PageLayout,
  type PuckNode,
} from '@titan/shared';
import { puckConfig } from '@/lib/builder/puck-config';
import { apiProxyFetch } from '@/hooks/use-api-proxy';
import { Loader2, X } from 'lucide-react';
import { BuilderHeader, VIEWPORTS } from '@/components/builder/editor-header';
import { BuilderDialogs } from '@/components/builder/dialogs';
import { ToastViewport, toast } from '@/components/ui/toast';
import { builderActions } from '@/components/builder/builder-actions';
import { useBuilderUI } from '@/components/builder/builder-ui-store';
import { StructureSidebar } from '@/components/builder/structure-sidebar';
import { InspectorPanel } from '@/components/builder/inspector-panel';
import { CanvasControls } from '@/components/builder/canvas-controls';
import { MATERIAL_SYMBOLS_HREF } from '@/components/fonts/material-symbols-href';
import { useMediaQuery, IS_DESKTOP_QUERY } from '@/lib/use-media-query';
interface PageRecord {
  id: string;
  slug: string;
  title: string;
  layout: Data;
  status: 'draft' | 'published';
  version: number;
  publishedAt: string | null;
}
interface VersionRecord {
  id: string;
  version: number;
  status: 'snapshot' | 'published';
  note: string | null;
  changedByName: string | null;
  createdAt: string;
}
const PUCK_IFRAME = {
  enabled: true,
};
const PUCK_VIEWPORTS = VIEWPORTS.map(({ label, width }) => ({
  label,
  width,
}));
const PUCK_UI = {
  leftSideBarVisible: false,
  rightSideBarVisible: false,
  previewMode: 'edit' as const,
};
/**
 * Canvas chrome — injected INTO the iframe document (the override's children * are portaled into the frame). Recolours Puck's outline scale to the app * blue and adds smooth hover/selection rings, rounded dropzones, and a glassy * hover label chip. Class names are version-pinned to @measured/puck 0.20.2. */
const CANVAS_CSS = `
:root{
--puck-color-azure-01:#f2f7ff;
--puck-color-azure-02:#e3edff;
--puck-color-azure-03:#c9dcff;
--puck-color-azure-04:#a7c4ff;
--puck-color-azure-05:#7da6ff;
--puck-color-azure-06:#3b82f6;
--puck-color-azure-07:#2563eb;
--puck-color-azure-08:#1d4ed8;
--puck-color-azure-09:#1e40af;
--puck-color-azure-10:#17367f;
--puck-color-azure-11:#11285e;
--puck-color-azure-12:#0b1b40;
}
[data-puck-dropzone]:has([data-puck-component]){display:contents;}
[data-puck-component]{transition:outline-color .15s ease,background-color .15s ease;}
[data-puck-overlay]{transition:box-shadow .18s ease;}
[data-puck-overlay][class*="--hover"],[data-puck-overlay][class*="--selected"]{box-shadow:0 0 0 4px rgba(37,99,235,.16),0 16px 32px -12px rgba(37,99,235,.35);}
._DraggableComponent-overlay_1vaqy_12{border-radius:10px;transition:outline-color .15s ease,background-color .15s ease;}
._DropZone--isEnabled_1i2sv_59{outline:2px dashed var(--puck-color-azure-07);border-radius:12px;transition:outline-color .15s ease;}
._DropZone_1i2sv_1:empty{border-radius:12px;}
._DraggableComponent-actions_1vaqy_71{background:rgba(15,23,42,.92);color:#fff;border-radius:9999px;padding:2px 4px;box-shadow:0 8px 24px -8px rgba(0,0,0,.45);backdrop-filter:blur(8px);font-size:11px;}
._DraggableComponent-actions_1vaqy_71 button{background:transparent;color:rgba(255,255,255,.92);border-radius:9999px;}
._DraggableComponent-actions_1vaqy_71 button:hover{background:rgba(255,255,255,.16);}
`;
/**
 * Host chrome — injected into the builder document: the neutral dotted stage * and the floating device frame. Hover/selection rings live in CANVAS_CSS — * Puck portals its overlays into the iframe document, not the host. */
const HOST_CSS = `
._Puck_1yxlw_19{height:100%;min-height:0;}
.Puck > div:first-child{height:100%;min-height:0;}
._PuckLayout_1yxlw_38{height:100%;min-height:0;}
._PuckLayout-inner_1yxlw_38{height:100%;min-height:0;}
._PuckCanvas_18jay_1{background-color:var(--color-background);background-image:radial-gradient(var(--color-border) 1px,transparent 1px);background-size:22px 22px;min-height:0;}
._PuckCanvas-root_18jay_30{border:1px solid var(--color-border);border-radius:16px;box-shadow:0 24px 64px -24px rgba(0,0,0,.4),0 4px 16px -8px rgba(0,0,0,.15);}
/* The embedded canvas shares horizontal space with the Layers/Inspector
 * sidebars, so Puck's 358/321px minimums must not force overflow — the
 * zoom machinery (autoZoom) scales the viewport width down instead. */
._PuckCanvas-inner_18jay_21{min-width:0;}
._PuckCanvas-root_18jay_30{min-width:0;}
._PuckCanvas_18jay_1 iframe{border-radius:15px;}
/* Puck's stock ViewportControls stay mounted (the zoom machinery lives there) but are replaced by the app's own CanvasControls pill — hidden, not unmounted. display:none (not visibility) so they reserve no blank strip above the canvas; the pill drives them programmatically. */
._PuckCanvas-controls_18jay_16{display:none !important;}
/* The floating CanvasControls pill (desktop only) overlays the top of the
 * canvas — reserve room so the first block never slides underneath it. */
@media (min-width:1024px){
._PuckCanvas_18jay_1._PuckCanvas_18jay_1{padding-top:60px;}
}
@media (max-width:1023px){
._PuckCanvas-inner_18jay_21{min-width:0;}
._PuckCanvas-root_18jay_30{min-width:0;}
._PuckCanvas_18jay_1{padding:10px;}
}
`;
function PageDataView() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      {' '}
      <p className="font-medium text-foreground">No page selected</p>{' '}
      <p className="max-w-sm text-sm text-muted-foreground">
        Choose a page from the list above to start editing.
      </p>{' '}
    </div>
  );
}
/**
 * Puck only initializes its store from the `data` prop on mount, so loading a * different page (or reverting) requires an explicit store reset. Puck's * `dispatch` is only reachable inside its tree, so this bridge registers the * store dispatch on BuilderEditor's ref when Puck mounts. All syncs are then * triggered imperatively from load/save/publish/revert — never from effects * (header children remount on store changes, so effect-based syncing is * unreliable and can clobber in-flight edits). * * Uses `useGetPuck` (non-subscribing) instead of `usePuck()`: the bridge must * never re-render on store changes, or every commit triggers a React effect * disconnect/reconnect traversal across the whole tree (~800ms in dev). */
function PuckDispatchBridge({
  onDispatch,
  onPuck,
}: {
  onDispatch: (dispatch: (action: unknown) => void) => void;
  onPuck: (puck: {
    dispatch: (action: unknown) => void;
    history: {
      setHistories: (
        histories: {
          state: unknown;
        }[],
      ) => void;
    };
  }) => void;
}) {
  const puck = useGetPuck()();
  onDispatch(puck.dispatch as (action: unknown) => void);
  onPuck(puck as never);
  return null;
}

/**
 * Puck only provides an override point for its complete layout. The editor's
 * Layers and Inspector live here so they share Puck's store with the canvas.
 * Previously these components existed but were never mounted, while Puck's
 * built-in sidebars were disabled, making blocks impossible to edit.
 */
function BuilderPuckShell({
  children,
  onDispatch,
  onPuck,
}: {
  children: React.ReactNode;
  onDispatch: (dispatch: (action: unknown) => void) => void;
  onPuck: (puck: {
    dispatch: (action: unknown) => void;
    history: { setHistories: (histories: { state: unknown }[]) => void };
  }) => void;
}) {
  const structureOpen = useBuilderUI((s) => s.structureOpen);
  const inspectorOpen = useBuilderUI((s) => s.inspectorOpen);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <PuckDispatchBridge onDispatch={onDispatch} onPuck={onPuck} />
      <BuilderHeader />
      <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
        {structureOpen && <StructureSidebar />}
        <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
          {children}
          <CanvasControls />
        </div>
        {inspectorOpen && <InspectorPanel />}
      </div>
    </div>
  );
}
export function BuilderEditor() {
  const [slug, setSlug] = useState<string>(BUILDER_PAGE_DEFS[0]?.slug ?? 'home');
  const [page, setPage] = useState<PageRecord | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [versions, setVersions] = useState<VersionRecord[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const setUI = useBuilderUI((s) => s.setSlug);
  const setStatus = useBuilderUI((s) => s.setStatus);
  const setDirty = useBuilderUI((s) => s.setDirty);
  const saving = useBuilderUI((s) => s.saving);
  const setSaving = useBuilderUI((s) => s.setSaving);
  const setVersionsOpen = useBuilderUI((s) => s.setVersionsOpen);
  const isDesktop = useMediaQuery(IS_DESKTOP_QUERY);
  // Below lg the panels become overlay drawers over a full-width canvas —
  // close them by default so the canvas is usable on first load.
  useEffect(() => {
    if (isDesktop) return;
    const s = useBuilderUI.getState();
    if (s.structureOpen) s.toggleStructure();
    if (s.inspectorOpen) s.setInspectorOpen(false);
  }, [isDesktop]);

  /**
   * Live page data. Puck's own store is the source of truth while editing
   * (updates flow through `replace` dispatches), so per-keystroke React state
   * round-trips are skipped entirely. `data` only tracks the last loaded
   * baseline (for gating + initial render); `liveRef` holds the working copy
   * used by save, and `dirty` is a plain flag instead of a JSON diff.
   */
  const liveRef = useRef<Data | null>(null);
  /** Last loaded/saved layout — the unsaved-changes indicator derives from comparing live data to this, so undo-back-to-baseline clears cleanly. */
  const baselineRef = useRef<Data | null>(null);
  /** Set after a load/save/reset/revert so the next onChange adopts Puck's canonical representation as the baseline. */
  const baselineLatch = useRef(false);
  const seenIds = useRef<Map<string, Set<string>>>(new Map());
  const pageCache = useRef<Map<string, PageRecord>>(new Map());
  const puckDispatch = useRef<((action: unknown) => void) | null>(null);
  /**
Stable registration callback (unstable identity would re-run the bridge effect on every commit). */
  const registerDispatch = useCallback((dispatch: (action: unknown) => void) => {
    puckDispatch.current = dispatch;
  }, []);
  const puckRef = useRef<{
    dispatch?: (action: unknown) => void;
    appState?: {
      data: unknown;
      ui: unknown;
    };
    history: {
      setHistories: (
        histories: {
          state: unknown;
        }[],
      ) => void;
    };
  } | null>(null);
  const registerPuck = useCallback(
    (puck: {
      dispatch?: (action: unknown) => void;
      appState?: {
        data: unknown;
        ui: unknown;
      };
      history: {
        setHistories: (
          histories: {
            state: unknown;
          }[],
        ) => void;
      };
    }) => {
      puckRef.current = puck as any;
    },
    [],
  );
  const loadToken = useRef(0);

  const syncStore = useCallback((layout: Data, clearSelection = false) => {
    setData(layout);
    liveRef.current = layout;
    baselineRef.current = layout;
    // Arm the latch only when a store dispatch follows (Puck mounted): the
    // resulting onChange payload must be adopted as the baseline. On first
    // mount the bridge isn't registered yet so no dispatch happens — and
    // Puck emits no mount onChange (its subscription only fires on store
    // changes) — so an armed latch would leak and swallow the user's first
    // real edit as "clean".
    const puck = puckRef.current;
    baselineLatch.current = puck != null && puckDispatch.current != null;
    if (!puck) return;
    if (clearSelection) {
      (puck as any).dispatch({
        type: 'setUi',
        ui: { itemSelector: null } as never,
      } as never);
    }
    // Puck only reads `data` when it first mounts. Keep its live store in
    // sync for page changes, saves, reverts, and resets.
    puckDispatch.current?.({
      type: 'setData',
      data: () => layout,
    });
    const anchor = () => {
      const current = puck.appState?.data as Data | undefined;
      const ui = puck.appState?.ui as never;
      puck.history.setHistories([
        {
          state: {
            data: current ?? layout,
            ui,
          } as never,
        },
      ]);
    };
    setTimeout(anchor, 300);
  }, []);

  const overrides = useMemo(
    () => ({
      // Header is rendered by BuilderPuckShell so the shell owns the full
      // topbar -> [layers | canvas | inspector] grid. Puck renders canvas only.
      header: () => <></>,
      puck: ({ children }: { children: React.ReactNode }) => (
        <BuilderPuckShell onDispatch={registerDispatch} onPuck={registerPuck}>
          {children}
        </BuilderPuckShell>
      ),
      // Puck clones host stylesheets into the canvas iframe via
      // `CopyHostStyles` (`style, link[rel="stylesheet"]`). The old
      // `preload` → `stylesheet` swap for Material Symbols happened
      // after the initial clone and was missed by the `childList`
      // observer, leaving the iframe without the icon font (icons
      // rendered as literal words like "star"). Directly injecting
      // here guarantees the font is present even before the host
      // link is cloned.
      iframe: ({
        children,
        document: doc,
      }: {
        children: React.ReactNode;
        document?: Document;
      }) => {
        if (doc && !doc.querySelector(`link[href="${MATERIAL_SYMBOLS_HREF}"]`)) {
          const link = doc.createElement('link');
          link.rel = 'stylesheet';
          link.href = MATERIAL_SYMBOLS_HREF;
          doc.head.appendChild(link);
        }
        return <>{children}</>;
      },
    }),
    [registerDispatch, registerPuck],
  );
  /**
   * Newly inserted composed blocks are auto-seeded here: the first time a * block id is seen, its empty slots are filled from the registry seed. * Once seeded, the id is forgotten about, so the user can freely remove * children afterwards. */ const ensureSeeded =
    useCallback((next: Data, target: string): Data => {
      let seen = seenIds.current.get(target);
      if (!seen) {
        seen = new Set();
        seenIds.current.set(target, seen);
      }
      const layout = next as unknown as PageLayout;
      const nodes: {
        type: string;
        id: string;
      }[] = [];
      walkLayoutNodes(layout, (node) => {
        nodes.push({
          type: node.type,
          id: (node.props?.id as string | undefined) ?? '',
        });
        if (node.props?.id) seen.add(node.props.id as string);
      });
      const missing: {
        type: string;
        id: string;
      }[] = [];
      for (const node of nodes) {
        const def = node.id ? getBlockDefinition(node.type) : undefined;
        if (!def?.seed || !def.zones) continue;
        const live = findNodeById(layout, node.id);
        const filled =
          live != null &&
          Object.keys(def.zones).some(
            (slot) => getSlotChildren(live, slot, layout.zones).length > 0,
          );
        if (!filled) missing.push(node);
      }
      if (missing.length === 0) return next;
      const missingIds = new Set(missing.map((node) => node.id));
      const applySeeds = (list: PuckNode[]): PuckNode[] =>
        list.map((item) => {
          const itemId = item.props?.id as string | undefined;
          const def = itemId && missingIds.has(itemId) ? getBlockDefinition(item.type) : undefined;
          const seedSlots = def?.seed?.().node.props ?? {};
          const nextProps: Record<string, unknown> = { ...(item.props ?? {}) };
          let changed = false;
          for (const slot of Object.keys(def?.zones ?? {})) {
            const seedKids = seedSlots[slot];
            if (!isNodeArray(seedKids) || seedKids.length === 0) continue;
            const existing = nextProps[slot];
            // Only fill slots the user hasn't touched yet.
            if (!isNodeArray(existing) || existing.length === 0) {
              nextProps[slot] = seedKids;
              changed = true;
            }
          }
          // Recurse so nested fresh inserts are seeded in the same pass.
          for (const slot of slotNamesFor(item.type)) {
            const kids = nextProps[slot];
            if (isNodeArray(kids)) {
              const rewritten = applySeeds(kids);
              if (rewritten.some((kid, i) => kid !== kids[i])) {
                nextProps[slot] = rewritten;
                changed = true;
              }
            }
          }
          if (!changed) return item;
          return { type: item.type, props: nextProps };
        });
      return {
        ...next,
        content: applySeeds((next.content ?? []) as unknown as PuckNode[]) as unknown as Content,
      };
    }, []);
  const handleChange = useCallback(
    (next: Data) => {
      const seeded = ensureSeeded(next, slug);
      liveRef.current = seeded;
      // The first payload after a load/save is the authoritative baseline
      // for the unsaved-changes comparison.
      if (baselineLatch.current) {
        baselineLatch.current = false;
        baselineRef.current = seeded;
        setDirty(false);
      } else {
        setDirty(JSON.stringify(seeded) !== JSON.stringify(baselineRef.current));
      }
      // Reflect the seed in the editor store itself (not just the save path):
      // otherwise the canvas shows an empty composed block while the saved and
      // published layout contains its seeded children — an editor/public parity
      // gap. The reference check terminates: the second pass finds the zones // already filled and returns the same object.
      if (seeded !== next) {
        puckDispatch.current?.({
          type: 'setData',
          data: () => seeded,
        } as never);
      }
    },
    [ensureSeeded, slug, setDirty],
  );
  const load = useCallback(
    async (target: string) => {
      const token = ++loadToken.current;
      const cached = pageCache.current.get(target);
      const apply = (layout: Data, clearSelection = false) => {
        // A newer load started while this one was in flight (rapid page switching): applying the stale response would overwrite the page the
        // user actually navigated to.
        if (token !== loadToken.current) return;
        // Legacy DropZone-era rows (flat `zones` map) are migrated to inline
        // slot children on load, so the editor store — and the next save —
        // are always in the canonical slot shape.
        const migrated = migrateLegacyLayout(layout as unknown as PageLayout) as unknown as Data;
        setData(migrated);
        liveRef.current = migrated;
        baselineRef.current = migrated;
        syncStore(migrated, clearSelection);
      };
      if (cached) {
        setPage(cached);
        setStatus({
          status: cached.status,
          version: cached.version,
        });
        apply(cached.layout, true);
        setDirty(false);
        setSlug(target);
        setUI(target);
        setShowVersions(false);
        setVersionsOpen(false);
      }
      try {
        const res = await apiProxyFetch(`/api/proxy/builder/pages/${target}`);
        if (!res.ok) throw new Error('Failed to load page');
        const body = (await res.json()) as PageRecord;
        if (token !== loadToken.current) return;
        pageCache.current.set(target, body);
        setPage(body);
        setStatus({
          status: body.status,
          version: body.version,
        });
        if (JSON.stringify(body.layout) !== JSON.stringify(cached?.layout) || !cached) {
          apply(body.layout, true);
        }
        setDirty(false);
        setSlug(target);
        setUI(target);
        setShowVersions(false);
        setVersionsOpen(false);
      } catch (err) {
        if (token !== loadToken.current) return;
        toast({
          type: 'err',
          title: 'Failed to load page',
          description: err instanceof Error ? err.message : undefined,
        });
      } finally {
        if (token === loadToken.current) setLoading(false);
      }
    },
    [syncStore, setStatus, setDirty, setSlug, setUI, setVersionsOpen],
  );
  useEffect(() => {
    void load(slug);
  }, [slug, load]);
  const openVersions = async () => {
    try {
      const res = await apiProxyFetch(`/api/proxy/builder/pages/${slug}/versions`);
      if (!res.ok) throw new Error('Failed to load versions');
      setVersions((await res.json()) as VersionRecord[]);
      setShowVersions(true);
      setVersionsOpen(true);
    } catch (err) {
      toast({
        type: 'err',
        title: 'Failed to load versions',
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };
  const saveDraft = useCallback(async () => {
    if (!liveRef.current) return;
    setSaving(true);
    try {
      const res = await apiProxyFetch(`/api/proxy/builder/pages/${slug}`, {
        method: 'PUT',
        body: JSON.stringify({
          layout: liveRef.current,
          title: page?.title,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || 'Save failed');
      }
      const updated = (await res.json()) as PageRecord;
      setPage(updated);
      setStatus({
        status: updated.status,
        version: updated.version,
      });
      setData(updated.layout);
      liveRef.current = updated.layout;
      baselineRef.current = updated.layout;
      baselineLatch.current = true;
      syncStore(updated.layout);
      setDirty(false);
      toast({
        type: 'ok',
        title: 'Draft saved',
        description: `Saved ${
          updated.version
            ? `v${updated.version}
`
            : ''
        }to ${updated.slug}`,
      });
    } catch (err) {
      toast({
        type: 'err',
        title: 'Save failed',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  }, [slug, page?.title, syncStore, setSaving, setDirty, setStatus]);
  const publish = useCallback(
    async (note?: string) => {
      setSaving(true);
      try {
        const res = await apiProxyFetch(`/api/proxy/builder/pages/${slug}/publish`, {
          method: 'POST',
          body: JSON.stringify({
            note: note || undefined,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.message || 'Publish failed');
        }
        const updated = (await res.json()) as PageRecord;
        setPage(updated);
        setStatus({
          status: updated.status,
          version: updated.version,
        });
        toast({
          type: 'ok',
          title: 'Page published',
          description: `${updated.slug}
is now live (v${updated.version})`,
        });
      } catch (err) {
        toast({
          type: 'err',
          title: 'Publish failed',
          description: err instanceof Error ? err.message : undefined,
        });
      } finally {
        setSaving(false);
      }
    },
    [slug, setSaving, setStatus],
  );
  const reset = useCallback(async () => {
    setSaving(true);
    try {
      const res = await apiProxyFetch(`/api/proxy/builder/pages/${slug}/reset`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Reset failed');
      const updated = (await res.json()) as PageRecord;
      setPage(updated);
      setStatus({
        status: updated.status,
        version: updated.version,
      });
      setData(updated.layout);
      liveRef.current = updated.layout;
      baselineRef.current = updated.layout;
      baselineLatch.current = true;
      syncStore(updated.layout, true);
      setDirty(false);
      toast({
        type: 'ok',
        title: 'Page reset',
        description: 'Restored the default layout',
      });
    } catch (err) {
      toast({
        type: 'err',
        title: 'Reset failed',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  }, [slug, syncStore, setSaving, setDirty, setStatus]);
  const revert = useCallback(
    async (version: number) => {
      setSaving(true);
      try {
        const res = await apiProxyFetch(`/api/proxy/builder/pages/${slug}/revert`, {
          method: 'POST',
          body: JSON.stringify({
            version,
          }),
        });
        if (!res.ok) throw new Error('Revert failed');
        const updated = (await res.json()) as PageRecord;
        setPage(updated);
        setStatus({
          status: updated.status,
          version: updated.version,
        });
        setData(updated.layout);
        liveRef.current = updated.layout;
        baselineRef.current = updated.layout;
        baselineLatch.current = true;
        syncStore(updated.layout, true);
        setDirty(false);
        setShowVersions(false);
        setVersionsOpen(false);
        toast({
          type: 'ok',
          title: `Restored v${version}`,
        });
      } catch (err) {
        toast({
          type: 'err',
          title: 'Revert failed',
          description: err instanceof Error ? err.message : undefined,
        });
      } finally {
        setSaving(false);
      }
    },
    [slug, syncStore, setSaving, setDirty, setStatus, setVersionsOpen],
  );
  /** Expose page operations to components inside Puck's tree (header etc.). */
  useEffect(() => {
    builderActions.current = {
      load,
      openVersions,
      saveDraft,
      publish,
      reset,
      revert,
    };
  });
  /** ⌘S / ⌃S — save the draft. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void saveDraft();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saveDraft]);
  return (
    <div className="relative -m-4 -mb-14 h-[calc(100dvh_-_env(safe-area-inset-bottom)_-_3.5rem)] overflow-hidden bg-background sm:-m-6 sm:-mb-14 lg:-my-8 lg:-mr-8 lg:-ml-4 lg:h-dvh">
      {' '}
      <style>{HOST_CSS}</style>
      <style>{CANVAS_CSS}</style>{' '}
      {!data ? (
        <div className="flex h-full items-center justify-center gap-3 text-muted-foreground">
          {' '}
          {loading && <Loader2 className="h-5 w-5 animate-spin" />}
          {loading ? 'Loading page…' : <PageDataView />}
        </div>
      ) : (
        <div className="h-full min-h-0">
          {' '}
          <Puck
            config={puckConfig}
            data={data}
            onChange={handleChange}
            viewports={PUCK_VIEWPORTS}
            iframe={PUCK_IFRAME}
            /**
             * Puck's built-in sidebars are disabled entirely: the Layers * panel (left) and the Inspector (right) are rendered by this * page's own docked panels, which are far cheaper than Puck's * (~167 layer nodes re-select on every store change). */ ui={
              PUCK_UI
            }
            overrides={overrides}
          />{' '}
        </div>
      )}
      {showVersions && (
        <div className="absolute right-4 top-16 z-50 w-96 overflow-hidden rounded-xl border border-border bg-card shadow-sm max-lg:left-3 max-lg:right-3 max-lg:top-[96px] max-lg:w-auto">
          {' '}
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            {' '}
            <h3 className="text-sm font-semibold">Version history</h3>{' '}
            <button
              type="button"
              className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              onClick={() => {
                setShowVersions(false);
                setVersionsOpen(false);
              }}
            >
              {' '}
              <X className="h-4 w-4" />{' '}
            </button>{' '}
          </div>{' '}
          <div className="scrollbar-thin max-h-80 space-y-1 overflow-auto p-2">
            {' '}
            {versions.length === 0 && (
              <p className="px-2 py-3 text-sm text-muted-foreground">
                No versions yet. Publish to create the first snapshot.
              </p>
            )}
            {versions.map((v) => (
              <div
                key={v.id}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition hover:bg-muted"
              >
                {' '}
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                  v{v.version}
                </span>{' '}
                <span
                  className={`text-[10px] font-bold uppercase ${v.status === 'published' ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}
                >
                  {' '}
                  {v.status}
                </span>{' '}
                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                  {v.note || '—'}
                </span>{' '}
                <span className="hidden text-xs text-muted-foreground md:inline">
                  {v.changedByName || 'Unknown'}
                </span>{' '}
                <button
                  type="button"
                  className="text-xs font-semibold text-primary hover:underline"
                  onClick={() => void revert(v.version)}
                  disabled={saving}
                >
                  {' '}
                  Restore{' '}
                </button>{' '}
              </div>
            ))}
          </div>{' '}
        </div>
      )}
      <BuilderDialogs /> <ToastViewport />{' '}
    </div>
  );
}
