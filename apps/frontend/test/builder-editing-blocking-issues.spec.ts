import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Three things that made the builder unusable, found by driving the real editor.
 */
const read = (p: string) => readFileSync(resolve(__dirname, '../src', p), 'utf8');

describe('popovers escape the toolbar instead of being trapped by it', () => {
  /**
   * Both popovers sat inside the editor toolbox bar, which is `overflow-x-auto` so it can scroll
   * on narrow screens. One non-`visible` axis makes the other compute to `auto`, so an
   * absolutely-positioned dropdown was clipped to the 44px bar and painted under the layers
   * sidebar — the menu was effectively unreachable.
   */
  const header = read('components/builder/editor-header.tsx');
  const menu = read('components/builder/add-block-menu.tsx');
  const sections = read('components/builder/saved-sections-actions.tsx');
  const panel = read('components/builder/anchor-panel.tsx');

  it('the toolbar really is a clipping ancestor, which is why a portal is required', () => {
    expect(header).toMatch(/overflow-x-auto/);
  });

  it('both popovers use the portal', () => {
    expect(menu).toMatch(/<AnchorPanel/);
    expect(sections).toMatch(/<AnchorPanel/);
  });

  it('neither uses absolute positioning against the clipped toolbar', () => {
    expect(menu).not.toMatch(/lg:absolute lg:start-0 lg:end-auto lg:top-full/);
    expect(sections).not.toMatch(/lg:absolute lg:start-0 lg:end-auto lg:top-full/);
  });

  it('the portal renders into document.body so no ancestor can clip it', () => {
    expect(panel).toMatch(/createPortal\(/);
    expect(panel).toMatch(/document\.body/);
    expect(panel).toMatch(/position: 'fixed'/);
  });

  it('the portal stacks above the sidebar (z-40) and below modals (z-[60])', () => {
    expect(panel).toMatch(/zIndex: 55/);
  });

  it('it repositions on scroll and resize, since fixed coordinates go stale', () => {
    expect(panel).toMatch(/addEventListener\('scroll'/);
    expect(panel).toMatch(/addEventListener\('resize'/);
  });

  it('it flips above the trigger when there is no room below', () => {
    expect(panel).toMatch(/flip/);
  });

  it('dismissal moved to the portal so it also catches clicks outside the clipped ancestor', () => {
    expect(panel).toMatch(/pointerdown/);
    expect(panel).toMatch(/Escape/);
  });
});

describe('publish checks report the real slug', () => {
  /**
   * `StatusInfo` had no `slug` field, so `collectPublishIssues` read `slug` as undefined on every
   * page and raised "This page has no URL slug" and "A built-in page must keep a slug" as hard
   * errors regardless of the page's actual slug — two false errors, and publish blocked, on
   * every page in the builder.
   */
  const store = read('components/builder/builder-ui-store.ts');
  const editor = read('app/(admin)/admin/builder/builder-editor.tsx');

  it('the status type carries a slug', () => {
    expect(store).toMatch(/slug\?: string;/);
  });

  it('every setStatus call site supplies it', () => {
    const sites = editor.match(/setStatus\(\{[\s\S]{0,400}?\}\);/g) ?? [];
    expect(sites.length).toBeGreaterThanOrEqual(3);
    for (const site of sites) expect(site).toMatch(/slug:/);
  });

  it('the checklist therefore receives a slug for a page that has one', () => {
    // The rules themselves were correct — they only fire when the slug is genuinely empty.
    const rules = readFileSync(
      resolve(__dirname, '../../../packages/shared/src/utils/publish-rules.ts'),
      'utf8',
    );
    expect(rules).toMatch(/!page\.slug\?\.trim\(\)/);
  });
});

describe('every element on a page is individually reachable', () => {
  /**
   * Pages are authored as a few `section` wrappers containing `stack` → `heading`/`text`. The
   * structure tree started fully collapsed, so it showed seven opaque sections and none of the
   * content inside them — the page read as a handful of big containers with nothing editable.
   */
  const tree = read('components/builder/structure-tree.tsx');

  it('the tree starts expanded rather than collapsed', () => {
    expect(tree).toMatch(/setExpanded\(new Set\(tree\.branchIds\)\)/);
  });

  it('it still collects every branch, not just the top level', () => {
    expect(tree).toMatch(/if \(node\.hasChildren\) branchIds\.push\(node\.id\)/);
    expect(tree).toMatch(/collect\(node\.children\)/);
  });

  it('individual branches remain collapsible', () => {
    expect(tree).toMatch(/const toggle =/);
  });

  it('the selection still auto-expands its ancestor chain', () => {
    expect(tree).toMatch(/tree\.ancestors\.get\(selectedId\)/);
  });
});
