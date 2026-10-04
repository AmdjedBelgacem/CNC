'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Puck, useGetPuck } from '@measured/puck';
import type { Content, Data } from '@measured/puck';
import { useTranslations } from 'next-intl';
import { getBlockDefinition } from '@titan/shared';
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
import { Loader2 } from 'lucide-react';
import { BuilderHeader, VIEWPORTS } from '@/components/builder/editor-header';
import { BuilderDialogs } from '@/components/builder/dialogs';
import { ToastViewport, toast } from '@/components/ui/toast';
import { builderActions } from '@/components/builder/builder-actions';
import { useBuilderUI } from '@/components/builder/builder-ui-store';
import { StructureSidebar } from '@/components/builder/structure-sidebar';
import { InspectorPanel } from '@/components/builder/inspector-panel';
import { CanvasControls } from '@/components/builder/canvas-controls';
import { useMediaQuery, IS_DESKTOP_QUERY } from '@/lib/use-media-query';
import { NoPageSelected } from '@/components/builder/builder-shell';
import { VersionDrawer } from '@/components/builder/version-drawer';
import { BuilderShortcuts } from '@/components/builder/publish-checklist';
import { useOpenPage } from '@/components/builder/use-open-page';
import type { PageRecord as SharedPageRecord } from '@titan/shared';
/**
 * The editor's view of a page.
 *
 * Extends the shared record with the two editor-specific shapes rather than
 * re-declaring it: the previous local copy had already drifted and was missing
 * `isSystem`/`seo*`/`showInNav`, so anything reading those got `undefined`.
 */
type PageRecord = SharedPageRecord & { layout: Data };
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
--puck-color-azure-07:#1B4DB1;
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
/**
 * Nothing loaded.
 *
 * The old version said "choose a page from the list above" and rendered no list,
 * so it was a dead end. It now offers the pages as cards, which is the only
 * useful thing to do in this state.
 */
function PageDataView() {
  return <NoPageSelected />;
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

  // Registration MUST happen in an effect, never during render.
  //
  // `onPuck` re-applies the open page into a freshly-registered canvas, and that
  // path calls into the builder store. Calling it while rendering made
  // `BuilderHeader` receive a store update from inside `PuckDispatchBridge`'s own
  // render: "Cannot update a component (BuilderHeader) while rendering a
  // different component (PuckDispatchBridge)". Registering from an effect also
  // means the canvas is patched after the commit, which is what React expects.
  useEffect(() => {
    onDispatch(puck.dispatch as (action: unknown) => void);
    onPuck(puck as never);
  }, [onDispatch, onPuck, puck]);

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
    <>
      <BuilderShortcuts />
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
    </>
  );
}
export function BuilderEditor() {
  const tb = useTranslations('builder');
  /**
   * The open page lives in the shared UI store, NOT in local state.
   *
   * `PageManager` (the header) writes the store when you pick a page. While this
   * component kept its own `useState` copy, that write changed nothing here, so
   * `useEffect(..., [slug, load])` never fired and switching pages silently did
   * nothing — the header updated and the canvas stayed on the old page. The
   * previous switcher only appeared to work because it also called `load()`
   * directly, which hid the split.
   */
  // The open page comes from `useOpenPage`, the single owner of both the store
  // write and the URL. The ad-hoc "restore once" effect that used to live here
  // was the wrong shape: React Refresh preserves hook state, so its `useRef`
  // guard survived a Fast Refresh and the restore never ran again — which is
  // exactly why the page still snapped back to home until a hard reload.
  // The open page comes straight from the URL. There is no store copy, so there
  // is nothing that a reload, a Fast Refresh rebuild or a second writer can send
  // out of step with what is on screen.
  const { slug } = useOpenPage();

  const [page, setPage] = useState<PageRecord | null>(null);
  const [data, setData] = useState<Data | null>(null);
  /**
   * The page the canvas is currently mounted against, and the `key` that keeps
   * Puck honest.
   *
   * Puck reads its `data` prop exactly once, at mount. Every later change has to
   * come through `dispatch({type:'setData'})`, and that is an imperative path: it
   * silently does nothing if the dispatch is not registered yet, and Puck gives
   * no acknowledgement. Page switching was relying on it, which is why the ribbon
   * and the URL could move to a new page while the canvas kept showing the old
   * one.
   *
   * So a page switch remounts Puck instead. `key` changes only once the new
   * layout has actually been fetched, so the remount happens with the right data
   * as Puck's *initial* prop — the one path Puck guarantees. In-page edits, saves,
   * reverts and resets still go through the dispatch, so ordinary editing does not
   * remount and stays cheap.
   */
  const [canvasPage, setCanvasPage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [versions, setVersions] = useState<VersionRecord[]>([]);
  const [showVersions, setShowVersions] = useState(false);
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
   * A layout that could not be handed to Puck yet.
   *
   * Puck registers through a child effect, so a page load can complete before it
   * is ready — and after a Fast Refresh the canvas subtree re-registers while a
   * load may already be in flight. The old code had `if (!puck) return` and
   * `puckDispatch.current?.(...)`, so those loads were *silently discarded*: the
   * header and the URL updated to the new page while the canvas kept rendering
   * the previous one. That is the reported "the ribbon changes but the content
   * doesn't". The handoff is now queued and flushed on registration, so it
   * cannot be lost.
   */
  const pendingLayout = useRef<{ layout: Data; clearSelection: boolean } | null>(null);
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
  // `registerPuck` feeds Puck's `overrides` useMemo, so its identity must stay
  // stable: changing it recreates the overrides object, remounts Puck, and
  // re-triggers the registration it services. It therefore reads nothing from the
  // render scope — it only flushes a queued layout — and declares no dependencies.

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

      // Flush anything that arrived before Puck was ready. Without this the load
      // is lost and the canvas keeps the previous page's blocks.
      const pending = pendingLayout.current;
      if (pending) {
        pendingLayout.current = null;
        if (pending.clearSelection) {
          (puck as any).dispatch?.({
            type: 'setUi',
            ui: { itemSelector: null } as never,
          } as never);
        }
        (puck as any).dispatch?.({
          type: 'setData',
          data: () => pending.layout,
        } as never);
        return;
      }

      // Nothing else. Registration used to decide which page the canvas should
      // show and, on disagreement, start its own load — which raced the switch
      // already in flight and could land the previous page afterwards. A page
      // switch now remounts Puck with the correct layout as its initial `data`,
      // and `load` is the only thing that fetches a page, so registration has
      // nothing to decide.
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
    const dispatch = puckDispatch.current;
    baselineLatch.current = puck != null && dispatch != null;
    if (!puck || !dispatch) {
      // Queue rather than drop. `registerPuck` flushes this.
      pendingLayout.current = { layout, clearSelection };
      return;
    }
    if (clearSelection) {
      (puck as any).dispatch({
        type: 'setUi',
        ui: { itemSelector: null } as never,
      } as never);
    }
    // Puck only reads the `data` prop when it first mounts, so this dispatch is
    // the ONLY way a page change reaches the canvas. It must never be optional.
    pendingLayout.current = null;
    dispatch({
      type: 'setData',
      data: () => layout,
    });
    // Reset Puck's history so the previous page's edits are not undoable on the
    // page that replaced it.
    //
    // This used to be a `setTimeout(anchor, 300)` that read `puck.appState.data`
    // at fire time. On a page switch the canvas is remounted, so that closure held
    // the *previous* Puck instance and wrote the *previous* page's data 300ms
    // later — which is precisely the reported "it switches to the new page, then
    // snaps back". Anchor synchronously, from the layout we just set, so there is
    // no window in which anything stale can be written.
    puck.history.setHistories([
      {
        state: {
          data: layout,
          ui: puck.appState?.ui as never,
        } as never,
      },
    ]);
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
        isNew: boolean;
      }[] = [];
      walkLayoutNodes(layout, (node) => {
        const id = (node.props?.id as string | undefined) ?? '';
        nodes.push({
          type: node.type,
          id,
          isNew: Boolean(id) && !seen.has(id),
        });
        if (id) seen.add(id);
      });
      const missing: {
        type: string;
        id: string;
      }[] = [];
      for (const node of nodes) {
        const def = node.id ? getBlockDefinition(node.type) : undefined;
        if (!node.isNew || !def?.seed || !def.zones) continue;
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
        const loadedIds = new Set<string>();
        walkLayoutNodes(migrated as unknown as PageLayout, (node) => {
          const id = node.props?.id;
          if (typeof id === 'string') loadedIds.add(id);
        });
        // Existing nodes—including intentionally empty containers—have already
        // been authored. Only nodes inserted after this load should auto-seed.
        seenIds.current.set(target, loadedIds);
        setData(migrated);
        // The canvas is remounted against this page: `canvasPage` drives Puck's
        // `key`, so a page switch re-reads `data` at mount instead of depending
        // on an imperative setData that cannot be acknowledged.
        setCanvasPage(target);
        liveRef.current = migrated;
        baselineRef.current = migrated;
        syncStore(migrated, clearSelection);
      };
      if (cached) {
        setPage(cached);
        setStatus({
          status: cached.status,
          version: cached.version,
          title: cached.title,
          isSystem: cached.isSystem,
          showInNav: cached.showInNav,
          seoTitle: cached.seoTitle,
          seoDescription: cached.seoDescription,
        });
        apply(cached.layout, true);
        setDirty(false);
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
          title: body.title,
          isSystem: body.isSystem,
          showInNav: body.showInNav,
          seoTitle: body.seoTitle,
          seoDescription: body.seoDescription,
        });
        if (JSON.stringify(body.layout) !== JSON.stringify(cached?.layout) || !cached) {
          apply(body.layout, true);
        }
        setDirty(false);
        setShowVersions(false);
        setVersionsOpen(false);
      } catch (err) {
        if (token !== loadToken.current) return;
        toast({
          type: 'err',
          title: tb('editor.loadFailed', { default: 'Failed to load page' }),
          description: err instanceof Error ? err.message : undefined,
        });
      } finally {
        if (token === loadToken.current) setLoading(false);
      }
    },
    [syncStore, setStatus, setDirty, setVersionsOpen, tb],
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
        title: tb('editor.versionsFailed', { default: 'Failed to load versions' }),
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
        title: updated.title,
        isSystem: updated.isSystem,
        showInNav: updated.showInNav,
        seoTitle: updated.seoTitle,
        seoDescription: updated.seoDescription,
      });
      setData(updated.layout);
      liveRef.current = updated.layout;
      baselineRef.current = updated.layout;
      baselineLatch.current = true;
      syncStore(updated.layout);
      setDirty(false);
      toast({
        type: 'ok',
        title: tb('editor.draftSaved', { default: 'Draft saved' }),
        description: tb('editor.draftSavedDetail', {
          version: updated.version ? `v${updated.version}\n` : '',
          slug: updated.slug,
          default: `Saved ${updated.version ? `v${updated.version}\n` : ''}to ${updated.slug}`,
        }),
      });
    } catch (err) {
      toast({
        type: 'err',
        title: tb('editor.saveFailed', { default: 'Save failed' }),
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  }, [slug, page?.title, syncStore, setSaving, setDirty, setStatus, tb]);
  const publish = useCallback(
    async (note?: string) => {
      setSaving(true);
      try {
        if (!liveRef.current) throw new Error('The page is not ready to publish');
        const res = await apiProxyFetch(`/api/proxy/builder/pages/${slug}/publish`, {
          method: 'POST',
          body: JSON.stringify({
            layout: liveRef.current,
            title: page?.title,
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
        setData(updated.layout);
        liveRef.current = updated.layout;
        baselineRef.current = updated.layout;
        syncStore(updated.layout);
        setDirty(false);
        pageCache.current.set(slug, updated);
        toast({
          type: 'ok',
          title: tb('editor.pagePublished', { default: 'Page published' }),
          description: tb('editor.pagePublishedDetail', {
            slug: updated.slug,
            version: updated.version,
            default: `${updated.slug} is now live (v${updated.version})`,
          }),
        });
      } catch (err) {
        toast({
          type: 'err',
          title: tb('editor.publishFailed', { default: 'Publish failed' }),
          description: err instanceof Error ? err.message : undefined,
        });
      } finally {
        setSaving(false);
      }
    },
    [slug, page?.title, syncStore, setDirty, setSaving, setStatus, tb],
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
        title: updated.title,
        isSystem: updated.isSystem,
        showInNav: updated.showInNav,
        seoTitle: updated.seoTitle,
        seoDescription: updated.seoDescription,
      });
      setData(updated.layout);
      liveRef.current = updated.layout;
      baselineRef.current = updated.layout;
      baselineLatch.current = true;
      syncStore(updated.layout, true);
      setDirty(false);
      toast({
        type: 'ok',
        title: tb('editor.pageReset', { default: 'Page reset' }),
        description: tb('editor.pageResetDetail', { default: 'Restored the default layout' }),
      });
    } catch (err) {
      toast({
        type: 'err',
        title: tb('editor.resetFailed', { default: 'Reset failed' }),
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  }, [slug, syncStore, setSaving, setDirty, setStatus, tb]);
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
          title: tb('editor.restoredVersion', { version, default: `Restored v${version}` }),
        });
      } catch (err) {
        toast({
          type: 'err',
          title: tb('editor.revertFailed', { default: 'Revert failed' }),
          description: err instanceof Error ? err.message : undefined,
        });
      } finally {
        setSaving(false);
      }
    },
    [slug, syncStore, setSaving, setDirty, setStatus, setVersionsOpen, tb],
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
    <div className="relative -m-4 -mb-14 h-[calc(100dvh_-_env(safe-area-inset-bottom)_-_3.5rem)] overflow-hidden bg-background sm:-m-6 sm:-mb-14 lg:-my-8 lg:-me-8 lg:-ms-4 lg:h-dvh">
      {' '}
      <style>{HOST_CSS}</style>
      <style>{CANVAS_CSS}</style>{' '}
      {!data ? (
        <div className="flex h-full items-center justify-center gap-3 text-muted-foreground">
          {' '}
          {loading && <Loader2 className="size-5 animate-spin" />}
          {loading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="size-5 animate-spin" aria-hidden="true" />
              {tb('editor.loadingPage', { default: 'Loading page…' })}
            </span>
          ) : (
            <PageDataView />
          )}
        </div>
      ) : (
        <div className="flex h-full min-h-0 flex-col">
          {' '}
          <div className="min-h-0 flex-1">
            {' '}
            <Puck
              // A page switch remounts the canvas with the new page as Puck's
              // initial `data`, instead of hoping an imperative setData landed.
              key={canvasPage ?? 'empty'}
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
          </div>{' '}
        </div>
      )}
      {showVersions && (
        <VersionDrawer
          versions={versions}
          saving={saving}
          onClose={() => {
            setShowVersions(false);
            setVersionsOpen(false);
          }}
          onRevert={(version) => void revert(version)}
        />
      )}
      <BuilderDialogs /> <ToastViewport />{' '}
    </div>
  );
}
