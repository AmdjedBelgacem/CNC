import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT_FRONTEND = join(__dirname, '../../frontend');
const read = (rel: string) => readFileSync(join(ROOT_FRONTEND, rel), 'utf8');

const editor = read('src/app/(admin)/admin/builder/builder-editor.tsx');
const manager = read('src/components/builder/page-manager.tsx');
const shell = read('src/components/builder/builder-shell.tsx');
const openPage = read('src/components/builder/use-open-page.ts');
const storeSource = read('src/components/builder/builder-ui-store.ts');
const useAuth = read('src/hooks/use-auth.ts');

/**
 * Which page the builder is editing.
 *
 * Three previous designs all failed the same way — the open page was kept in two
 * places and reconciled:
 *
 *   1. The header wrote a zustand slug while the editor kept its own `useState`
 *      copy, so switching pages did nothing at all.
 *   2. Unified on the store. Any reload or Fast Refresh re-evaluated the store
 *      module and reset it to its `home` default, so the page snapped back to the
 *      homepage.
 *   3. Added the URL plus a "restore once" ref. React Refresh *preserves* hook
 *      state, so the ref survived the rebuild, the restore never ran again, and
 *      it still took a hard reload to recover.
 *
 * The fix was to delete the second copy. The URL is the only source of truth: it
 * is not reset by a module rebuild, survives a hard refresh, and makes a page
 * linkable. These tests exist so a second copy cannot quietly reappear.
 */
describe('the open page has exactly one source of truth', () => {
  it('the editor reads the page from the URL, not from a store or local state', () => {
    expect(editor).toMatch(/const \{ slug \} = useOpenPage\(\)/);
    expect(editor).not.toMatch(/const \[slug, setSlug\] = useState/);
    expect(editor).not.toMatch(/useBuilderUI\(\(s\) => s\.slug\)/);
  });

  it('the builder store no longer holds a page at all', () => {
    // A module-level value is the thing that kept resetting. Its absence is the
    // structural guarantee that there is nothing left to fall out of step.
    expect(storeSource).not.toMatch(/\bslug\b/);
    expect(storeSource).not.toMatch(/setSlug/);
  });

  it('the hook derives the slug from the URL and reads no store', () => {
    expect(openPage).toMatch(
      /const currentFromUrl = onBuilder \? searchParams\.get\(PAGE_PARAM\) : null/,
    );
    expect(openPage).toMatch(/const slug = currentFromUrl \|\| DEFAULT_PAGE_SLUG/);
    expect(openPage).not.toMatch(/useBuilderUI/);
  });

  it('opening a page is a navigation and nothing else', () => {
    expect(openPage).toMatch(
      /router\.replace\(builderPageHref\(next\), \{ scroll: false \}\)/,
    );
    expect(openPage).not.toMatch(/setSlug/);
  });

  it('openPage does not depend on the search params', () => {
    // Depending on `useSearchParams` gives it a new identity on every
    // navigation; `load` depends on it, so every navigation would refetch.
    const body = openPage.slice(openPage.indexOf('const openPage = useCallback'));
    expect(body).toMatch(/\[router\]/);
  });

  it('the default page keeps the bare path, so /admin/builder stays canonical', () => {
    expect(openPage).toMatch(
      /if \(!slug \|\| slug === DEFAULT_PAGE_SLUG\) return BUILDER_BASE_PATH/,
    );
  });

  it('the `?page=` param is only read on the builder route', () => {
    // `?page=` belongs to other routes; hijacking it would fight them.
    expect(openPage).toMatch(/onBuilder \? searchParams\.get/);
  });

  it('every writer navigates through the one hook', () => {
    expect(manager).toMatch(/const \{ slug, openPage \} = useOpenPage\(\)/);
    expect(shell).toMatch(/const \{ openPage \} = useOpenPage\(\)/);
    for (const [name, source] of [
      ['manager', manager],
      ['shell', shell],
      ['editor', editor],
    ] as const) {
      expect(source, `${name} must not write the slug directly`).not.toMatch(/setSlug\(/);
    }
  });

  it('the load effect watches the URL slug', () => {
    expect(editor).toMatch(/\[slug, load\]\);/);
  });

  it('load never navigates — the URL is already authoritative', () => {
    // Navigating from inside load would fight the router while a page is loading,
    // and could replace a newer navigation with a slower older one.
    const start = editor.indexOf('const load = useCallback');
    const end = editor.indexOf('loadRef.current = load;');
    const body = editor.slice(start, end);
    expect(body).not.toMatch(/openPage|router\.replace/);
  });
});

/**
 * Canvas registration.
 *
 * A Fast Refresh rebuild remounts the Puck subtree, and the load effect watches
 * `[slug, load]`, so it does not re-run. The canvas was left holding nothing (or
 * the previous page) while the header and the URL both said otherwise, which is
 * the reported "it shows the right page then goes back to the homepage".
 * Registering Puck is the only signal that the canvas was reset.
 */
describe('the canvas follows the open page', () => {
  /**
   * A page switch remounts Puck instead of dispatching.
   *
   * Puck reads its `data` prop exactly once, at mount. Every later change is an
   * imperative `dispatch({type:'setData'})`, which gives no acknowledgement and
   * no-ops when the dispatch is not registered. That is why the ribbon and the
   * URL could move to a new page while the canvas kept showing the old one. The
   * `key` re-reads `data` at mount — the one path Puck guarantees.
   */
  it('remounts Puck against the page that was actually fetched', () => {
    expect(editor).toMatch(/const \[canvasPage, setCanvasPage\] = useState<string \| null>\(null\)/);
    expect(editor).toMatch(/key=\{canvasPage \?\? 'empty'\}/);
    // The key must be set where the new layout exists, not where the URL changed:
    // remounting on the URL change would mount Puck with the *previous* page.
    expect(editor).toMatch(/setCanvasPage\(target\)/);
  });

  it('sets the canvas page in exactly one place', () => {
    // Both the cached and the fetched path funnel through `apply`, so a single
    // `setCanvasPage` call covers page switching entirely. A second call site
    // would be a chance to set the key before the layout exists.
    const marks = editor.match(/setCanvasPage\(/g) ?? [];
    expect(marks.length, 'the key must be set from exactly one place').toBe(1);
  });

  it('never drops a layout on the floor when Puck is not ready', () => {
    // `if (!puck) return` and `puckDispatch.current?.()` used to discard a page
    // load that landed before Puck registered, leaving the canvas stale.
    expect(editor).toMatch(/const pendingLayout = useRef<\{ layout: Data; clearSelection: boolean \} \| null>\(null\)/);
    // Scoped to the page-load path (`syncStore`). `handleChange`'s auto-seed
    // dispatch is a different concern and may legitimately no-op.
    const syncStore = editor.slice(
      editor.indexOf('const syncStore = useCallback'),
      editor.indexOf('const overrides = useMemo'),
    );
    expect(syncStore).toMatch(/pendingLayout\.current = \{ layout, clearSelection \};\s*\n\s*return;/);
    expect(syncStore).not.toMatch(/puckDispatch\.current\?\.\(/);
    expect(syncStore).not.toMatch(/if \(!puck\) return;/);
    // And the queue is flushed on registration.
    const start = editor.indexOf('const registerPuck = useCallback(');
    const body = editor.slice(start, start + 3000);
    expect(body).toMatch(/const pending = pendingLayout\.current;/);
  });

  /**
   * Registration must not decide which page the canvas shows.
   *
   * It used to: on disagreement it started its own `load`, which raced the switch
   * already in flight and could land the previous page *after* the new one — the
   * "switches for a fraction of a second, then snaps back" report. A page switch
   * remounts Puck with the right layout as its initial `data`, and `load` is the
   * only thing that fetches a page, so registration only flushes the queue.
   */
  it('registration only flushes the queue; it never loads or re-selects', () => {
    const start = editor.indexOf('const registerPuck = useCallback(');
    const body = editor.slice(start, start + 3000);
    expect(body, 'registration must not start a load').not.toMatch(/loadRef|load\(/);
    expect(body, 'registration must not compare slugs').not.toMatch(/loadedSlug|desired/);
    expect(body, 'registration must only flush the queue').toMatch(
      /const pending = pendingLayout\.current;/,
    );
  });

  it('no timer writes to the canvas after the fact', () => {
    // `setTimeout(anchor, 300)` read `puck.appState.data` at fire time. On a page
    // switch the canvas is remounted, so that closure held the previous Puck and
    // wrote the previous page's data 300ms later — exactly the reported snap-back.
    const code = editor.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code, 'a delayed write can only ever be stale').not.toMatch(/setTimeout|setInterval/);
  });

  it('the history anchor is synchronous and uses the layout just set', () => {
    // Resetting history stops the previous page's edits being undoable on the new
    // page, and doing it inline removes the window in which stale data could land.
    const syncStore = editor.slice(
      editor.indexOf('const syncStore = useCallback'),
      editor.indexOf('const overrides = useMemo'),
    );
    expect(syncStore).toMatch(/puck\.history\.setHistories\(\[/);
    expect(syncStore).toMatch(/data: layout,/);
  });

  it('registerPuck stays referentially stable, or it would remount the canvas', () => {
    // `overrides` is memoised on it: a changing identity recreates the overrides
    // object, remounts Puck, and re-triggers the registration it services.
    const start = editor.indexOf('const registerPuck = useCallback(');
    const body = editor.slice(start, start + 3000);
    const deps = body.match(/\n    (\[[^\]]*\]),\n  \);/);
    expect(deps, 'registerPuck must declare an empty dependency array').toBeTruthy();
    expect(deps![1]!.trim()).toBe('[]');
  });
});

/**
 * `PuckDispatchBridge` called its registration callbacks during render.
 *
 * `onPuck` re-applies the open page into a freshly-registered canvas, and that
 * path writes to the builder store. Called during render it made `BuilderHeader`
 * setState from inside the bridge's own render: "Cannot update a component
 * (BuilderHeader) while rendering a different component (PuckDispatchBridge)".
 */
describe('Puck registers in an effect, not during render', () => {
  const bridge = editor.slice(
    editor.indexOf('function PuckDispatchBridge'),
    editor.indexOf('function BuilderPuckShell'),
  );

  it('registers inside a useEffect', () => {
    expect(bridge).toMatch(/useEffect\(\(\) => \{\s*onDispatch\(/);
  });

  it('has no registration call left in the render body', () => {
    const renderPart = bridge.slice(0, bridge.indexOf('useEffect'));
    expect(renderPart).not.toMatch(/^\s*onDispatch\(/m);
    expect(renderPart).not.toMatch(/^\s*onPuck\(/m);
  });

  it('renders nothing, so it has no state of its own to tear', () => {
    expect(bridge).toMatch(/return null;\s*\}/);
  });
});

/**
 * `useAuth()` returned the whole store, so it subscribed to every field. The
 * console warning was the symptom; the cost was that `store` sat in every
 * `useCallback` dependency, so each auth write handed every callback a new
 * identity and re-rendered everything downstream.
 */
describe('store subscriptions are narrow', () => {
  it('useAuth shallow-compares the whole store instead of reading it raw', () => {
    expect(useAuth).toMatch(/useShallow\(\(s\) => s\)/);
    expect(useAuth).not.toMatch(/const store = useAuthStore\(\);/);
  });

  it('the callbacks depend on stable actions, not the store object', () => {
    expect(useAuth).toMatch(/const setAuth = useAuthStore\(\(s\) => s\.setAuth\)/);
    expect(useAuth).not.toMatch(/\[store[,]/);
  });

  it('no component subscribes to an entire store', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry.name)) {
          const body = readFileSync(full, 'utf8');
          // `useSomethingStore()` with no argument subscribes to every field.
          for (const m of body.matchAll(/use([A-Za-z]+Store)\(\)/g)) {
            offenders.push(`${full.replace(ROOT_FRONTEND + '/', '')}: use${m[1]}Store()`);
          }
        }
      }
    };
    walk(join(ROOT_FRONTEND, 'src'));
    expect(offenders, 'these re-render on every write').toEqual([]);
  });
});
