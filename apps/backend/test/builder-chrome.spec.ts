import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (rel: string) => readFileSync(join(__dirname, '../../frontend', rel), 'utf8');

const header = read('src/components/builder/editor-header.tsx');
const pageManager = read('src/components/builder/page-manager.tsx');
const shell = read('src/components/builder/builder-shell.tsx');
const drawer = read('src/components/builder/version-drawer.tsx');
const page = read('src/app/(admin)/admin/builder/page.tsx');
const editor = read('src/app/(admin)/admin/builder/builder-editor.tsx');
const en = JSON.parse(read('messages/en.json'));
const ar = JSON.parse(read('messages/ar.json'));

/**
 * Builder chrome invariants.
 *
 * The two that matter most came from reading the old toolbar rather than from a
 * failing test: the viewport switcher and the publish status were inside a
 * `hidden … xl:flex` block, so on any laptop under 1280px the two controls you
 * most need while designing were not rendered at all. Nothing failed; the
 * controls were simply gone.
 */
describe('builder chrome', () => {
  it('never hides a primary control behind a viewport breakpoint', () => {
    // The device switcher and the publish state must be present at every width.
    // A `hidden … xl:flex` wrapper is how they disappeared before.
    const hiddenWrappers = [
      ...header.matchAll(/className="[^"]*\bhidden\b[^"]*"/g),
    ].map((match) => match[0]);
    for (const wrapper of hiddenWrappers) {
      // Only decorative duplicate labels may be breakpoint-hidden; a control
      // cluster may not.
      expect(wrapper, `control hidden behind a breakpoint: ${wrapper}`).not.toMatch(
        /\bxl:flex\b|\bxl:inline\b|\b2xl:flex\b/,
      );
    }
  });

  it('renders the viewport switcher unconditionally', () => {
    const call = header.indexOf('<ViewportSwitcher');
    expect(call).toBeGreaterThan(-1);
    // Whatever precedes it in the same row must not be a hidden wrapper.
    const preceding = header.slice(Math.max(0, call - 240), call);
    expect(preceding).not.toMatch(/className="[^"]*\bhidden\b[^"]*"/);
  });

  it('groups the tools instead of one flat control strip', () => {
    for (const group of ['group.tools', 'group.insert', 'group.view', 'group.panels']) {
      expect(header).toContain(`tb('${group}')`);
    }
    // Each group is a labelled landmark, not a row of anonymous buttons.
    expect(header).toMatch(/role="group"/);
  });

  it('moves the destructive action out of the primary row', () => {
    // Reset replaces a whole page draft, so it must not sit next to Save.
    const resetIndex = header.indexOf('setResetOpen(true)');
    expect(resetIndex).toBeGreaterThan(-1);
    const saveIndex = header.indexOf("saveDraft()");
    // They are in different components, which is the point: the reset handler is
    // only reachable from the overflow menu.
    const overflowStart = header.indexOf('function OverflowMenu(');
    expect(overflowStart).toBeGreaterThan(-1);
    expect(resetIndex).toBeGreaterThan(overflowStart);
    expect(saveIndex).toBeGreaterThan(-1);
  });

  it('labels the overflow menu with role="menu" and its items with menuitem', () => {
    expect(header).toMatch(/role="menu"/);
    expect(header).toMatch(/role="menuitem"/);
    // The trigger declares what it opens. It is plumbed through IconButton rather
    // than written inline, so assert the plumbing AND that the overflow menu is
    // the caller asking for a "menu" popup — a stricter pairing than a string
    // match on one element.
    expect(header).toMatch(/aria-haspopup=\{haspopup\}/);
    expect(header).toMatch(/aria-expanded=\{expanded\}/);
    expect(header).toMatch(/haspopup="menu"/);
  });

  it('marks the current page programmatically in the page manager', () => {
    // The old switcher used role="menuitemradio" + aria-checked. The page manager
    // is a searchable dialog instead, so the guarantee is expressed as a labelled
    // dialog with aria-current on the active row. The requirement is unchanged:
    // a screen reader must be able to tell which page is open.
    expect(pageManager).toMatch(/role="dialog"/);
    expect(pageManager).toMatch(/aria-haspopup="dialog"/);
    expect(pageManager).toMatch(/aria-current=\{active \? 'page'/);
    expect(pageManager).toMatch(/aria-label=\{tb\('pages\.dialogLabel'\)\}/);
  });

  it('the page manager drives the API, not the hardcoded seeded slug list', () => {
    // A page created through the API used to be invisible in the editor because
    // the switcher iterated BUILDER_PAGE_DEFS.
    expect(pageManager).toMatch(/api\.get<PageRecord\[\]>\('\/builder\/pages'\)/);
    expect(header).not.toMatch(/BUILDER_PAGE_DEFS/);
  });

  it('closes menus on outside click and Escape', () => {
    expect(header).toMatch(/useDismissableMenu/);
    expect(header).toMatch(/event\.key === 'Escape'/);
    expect(header).toMatch(/document\.addEventListener\('mousedown'/);
  });

  it('moves focus into the version drawer and closes it on Escape', () => {
    expect(drawer).toMatch(/role="dialog"/);
    expect(drawer).toMatch(/aria-modal="true"/);
    expect(drawer).toMatch(/closeRef\.current\?\.focus\(\)/);
    expect(drawer).toMatch(/event\.key === 'Escape'/);
    // The canvas is dimmed, so the drawer is clearly a separate surface.
    expect(drawer).toMatch(/absolute inset-0/);
  });

  it('confirms before discarding the current draft', () => {
    expect(drawer).toMatch(/window\.confirm/);
    expect(drawer).toMatch(/history\.revertConfirm/);
  });

  it('offers the page list when no page is loaded, opening through the shared hook', () => {
    // The empty-state cards used to write the store and call load() directly,
    // which is a second way to move the page. They go through `useOpenPage` now.
    expect(shell).toMatch(/const \{ openPage \} = useOpenPage\(\)/);
    expect(shell).toMatch(/onClick=\{\(\) => openPage\(definition\.slug\)\}/);
    expect(shell).not.toMatch(/builderActions\.current\?\.load/);
  });

  it('legacy page list rendering is still present', () => {
    // The old state said "choose a page from the list above" and rendered no list.
    expect(shell).toMatch(/BUILDER_PAGE_DEFS\.map/);
    expect(shell).toMatch(/empty\.title/);
    expect(editor).toMatch(/<NoPageSelected \/>/);
  });

  it('shows a skeleton rather than a bare loading string', () => {
    expect(shell).toMatch(/export function BuilderSkeleton/);
    // Asserts the shared <Skeleton> component, not a literal animate-pulse class:
    // ui/skeleton.tsx intentionally uses a shimmer rather than pulse ("Shimmer, never
    // pulse" — animate-pulse fades the whole block and reads as a flash on load).
    expect(shell).toMatch(/<Skeleton/);
    expect(page).toMatch(/if \(!Editor\) return <BuilderSkeleton \/>/);
    // The old route rendered the literal string "Loading builder…".
    expect(page).not.toMatch(/Loading builder…/);
  });

  it('handles a chunk that fails to load', () => {
    expect(page).toMatch(/\.catch\(/);
    expect(page).toMatch(/setFailed\(true\)/);
    expect(page).toMatch(/BuilderLoadFailed/);
  });

  it('is direction-safe', () => {
    // The exit arrow is the one glyph that must mirror; the rest are not
    // direction-of-reading icons.
    expect(header).toMatch(/ArrowLeft className="flip-rtl/);
    const physical = [...header.matchAll(/className="[^"]*?\b(ml|mr|pl|pr|left|right)-\d/g)];
    expect(physical.map((m) => m[0]), 'physical side utilities do not flip in Arabic').toEqual([]);
  });

  it('announces loading and modal state to assistive tech', () => {
    expect(shell).toMatch(/aria-busy="true"/);
    expect(shell).toMatch(/role="status"/);
    expect(shell).toMatch(/className="sr-only"/);
    expect(header).toMatch(/aria-pressed=/);
  });
});

describe('builder strings', () => {
  const used = [...header.matchAll(/\btb\(\s*'([\w.]+)'/g)].map((m) => m[1]!);
  const alsoUsed = [
    ...shell.matchAll(/\btb\(\s*'([\w.]+)'/g),
    ...drawer.matchAll(/\btb\(\s*'([\w.]+)'/g),
    ...page.matchAll(/\btb\(\s*'([\w.]+)'/g),
  ].map((m) => m[1]!);
  const all = [...new Set([...used, ...alsoUsed])];

  it('has every key it reads, in both locales', () => {
    const resolve = (catalog: Record<string, unknown>, path: string) =>
      path.split('.').reduce<unknown>((node, part) => {
        if (node && typeof node === 'object' && part in (node as Record<string, unknown>)) {
          return (node as Record<string, unknown>)[part];
        }
        return undefined;
      }, catalog);
    const missingEn = all.filter((key) => resolve(en.builder, key) === undefined);
    const missingAr = all.filter((key) => resolve(ar.builder, key) === undefined);
    expect(missingEn, `missing from en: ${missingEn.join(', ')}`).toEqual([]);
    expect(missingAr, `missing from ar: ${missingAr.join(', ')}`).toEqual([]);
  });

  it('has Arabic for every builder string, not English copied over', () => {
    // A template-only value such as "{n}m ago" is a value; anything with words
    // must be translated.
    // Type and measurement tokens are typed by a designer, and the viewport
    // title is a pure template. Translating them would be wrong, so they are
    // named explicitly rather than swept up by a fuzzy rule.
    const nonTranslatable = new Set([
      'builder.fieldLabels.2rem', 'builder.fieldLabels.3rem', 'builder.fieldLabels.4rem',
      'builder.fieldLabels.2xl', 'builder.fieldLabels.xl',
      'builder.fieldLabels.h1', 'builder.fieldLabels.h2', 'builder.fieldLabels.h3',
      'builder.fieldLabels.h4',
      'builder.fieldLabels.l', 'builder.fieldLabels.m', 'builder.fieldLabels.s',
      'builder.canvas.viewportTitle',
    ]);

    const hasArabic = (text: string) => /[\u0600-\u06FF]/.test(text);
    const untranslated: string[] = [];
    for (const [key, value] of Object.entries(en.builder)) {
      if (typeof value !== 'object' || value === null) continue;
      for (const [name, text] of Object.entries(value as Record<string, string>)) {
        if (typeof text !== 'string') continue;
        const path = `builder.${key}.${name}`;
        const arabic = resolveText(ar, path);
        if (arabic === undefined || hasArabic(arabic)) continue;
        if (nonTranslatable.has(path)) continue;
        if (/^[\s\d{}:.,%()·/-]*$/.test(text)) continue; // value, not prose
        untranslated.push(`${path} = ${JSON.stringify(arabic)}`);
      }
    }
    expect(untranslated).toEqual([]);

    // The allowlist must not rot.
    const stale = [...nonTranslatable].filter((path) => resolveText(en, path) === undefined);
    expect(stale).toEqual([]);
  });

  it('leaves no dotted key where the catalog nests an object', () => {
    // A flat "group.tools" key renders as the literal path at runtime.
    const flat = Object.keys(en.builder).filter((key) => key.includes('.'));
    expect(flat, `flat dotted keys in the builder namespace: ${flat.join(', ')}`).toEqual([]);
  });
});

function resolveText(catalog: Record<string, unknown>, path: string): string | undefined {
  const [namespace, ...rest] = path.split('.');
  let node: unknown = (catalog as Record<string, unknown>)[namespace!];
  for (const part of rest) {
    if (node && typeof node === 'object' && part in (node as Record<string, unknown>)) {
      node = (node as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof node === 'string' ? node : undefined;
}

/**
 * Header components must not subscribe to the whole Puck `appState`.
 *
 * `appState` is a fresh object on nearly every Puck interaction — hover,
 * selection, drag — so `useBuilderPuck((s) => s.appState)` re-renders on every
 * pointer move. These components render inside `BuilderHeader`, which is part of
 * Puck's own tree, so that cost lands on the canvas and reads as the editor
 * hanging. Selecting the leaf (`s.appState.data`) changes only when the data
 * actually changes.
 */
describe('header components use narrow Puck selectors', () => {
  const narrow = [
    'src/components/builder/publish-checklist.tsx',
    'src/components/builder/block-productivity.tsx',
  ];

  for (const file of narrow) {
    it(`${file.split('/').pop()} does not select the whole appState`, () => {
      const source = read(file);
      expect(
        source,
        'select s.appState.data (or another leaf) rather than s.appState',
      ).not.toMatch(/useBuilderPuck\(\(s\) => s\.appState\)/);
      expect(
        source,
        'a component that reads only the layout should select s.appState.data',
      ).toMatch(/useBuilderPuck\(\(s\) => s\.appState\.data\)/);
    });
  }

  it('the page manager does not double-load a page', () => {
    // setSlug alone triggers builder-editor's load effect; calling load here too
    // fetched every page twice and applied the layout twice against a stale
    // `seenIds` set for that slug.
    const manager = read('src/components/builder/page-manager.tsx');
    expect(manager).not.toMatch(/builderActions\.current\?\.load/);
    expect(manager).toMatch(/openPage\(next\)/);
  });

  it('the page manager cannot re-request the list in a loop', () => {
    // `pages.length === 0` is not enough: a failed or empty response leaves it
    // at 0 and the effect is free to re-fire on every render.
    const manager = read('src/components/builder/page-manager.tsx');
    expect(manager).toMatch(/const requested = useRef\(false\)/);
    expect(manager).toMatch(/requested\.current = true/);
  });
});
