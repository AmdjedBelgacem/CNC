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
   * `StatusInfo` never had a slug field, so `collectPublishIssues` read it as undefined on every
   * page and raised "This page has no URL slug" and "A built-in page must keep a slug" as hard
   * errors regardless of the page's actual slug — two false errors, and publish blocked, on
   * every page in the builder.
   *
   * The slug is passed in from the URL rather than added to the store: a module-level copy of the
   * open page is what previously fell out of step with the route, and an existing test guards
   * against reintroducing one.
   */
  const header = read('components/builder/editor-header.tsx');
  const store = read('components/builder/builder-ui-store.ts');
  const checklist = read('components/builder/publish-checklist.tsx');

  it('the editor header takes the slug from the URL', () => {
    expect(header).toMatch(/const \{ slug: openSlug \} = useOpenPage\(\)/);
    expect(header).toMatch(/slug: openSlug/);
  });

  it('the store still holds no copy of the open page', () => {
    expect(store).not.toMatch(/\bslug\b/);
  });

  it('the checklist accepts a slug as an explicit fact', () => {
    expect(checklist).toMatch(/slug\?: string \| null/);
  });

  it('the rules themselves were correct — they only fire on a genuinely empty slug', () => {
    const rules = readFileSync(
      resolve(__dirname, '../../../packages/shared/src/utils/publish-rules.ts'),
      'utf8',
    );
    expect(rules).toMatch(/!page\.slug\?\.trim\(\)/);
    expect(rules).toMatch(/page\.isSystem && !page\.slug/);
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

describe('the simulator console stays readable in Arabic', () => {
  /**
   * The hero console mirrors into the left column in RTL, but its telemetry is technical LTR UI:
   * feed/spindle labels, axis values and mode tabs. Inheriting RTL reversed the strings
   * (`mm/min 4,200 :FEED`) and moved signs to the wrong side (`142.308+`).
   */
  const consoleBlock = read('components/builder/blocks/hero-console-block.tsx');

  it('pins the console card and floating metric copy to LTR', () => {
    expect(consoleBlock).toMatch(/liquid-glass shadow-xl" dir="ltr"/);
    expect(consoleBlock).toMatch(/<div dir="ltr">/);
  });
});

describe('every block is either editable or explains why it is not', () => {
  /**
   * Twelve of the forty-one registered blocks had no `BLOCK_INSPECTOR` entry, so selecting them
   * fell through to "This block has no editable properties". Several hold the page's copy —
   * Spotlight Cards, Closing CTA, Card Grid, CTA Signup — and their headings, body text and button
   * labels were editable only as raw JSON.
   */
  const fields = read('components/builder/inspector/fields.ts');
  const notice = read('components/builder/inspector/dynamic-content-notice.tsx');

  it('the composite blocks that hold copy now have inspector definitions', () => {
    for (const type of [
      'spotlight-cards',
      'closing-cta',
      'card-grid',
      'cta-signup',
      'hero-console',
      'twin-section',
      'program-card',
      'testimonial-card',
      'catalog-hero',
    ]) {
      expect(fields).toMatch(new RegExp(`'${type}':\\s*\\{ label:`));
    }
  });

  it('those definitions expose the text fields, not only appearance', () => {
    // Eyebrow/title/subtitle/body/label are the copy an editor wants to change.
    expect(fields).toMatch(/key: 'eyebrow', label: 'Eyebrow', control: 'text'/);
    expect(fields).toMatch(/key: 'subtitle', label: 'Subtitle', control: 'textarea'/);
    expect(fields).toMatch(/key: 'body', label: 'Body', control: 'textarea'/);
    expect(fields).toMatch(/key: 'primaryLabel', label: 'Primary label', control: 'text'/);
    expect(fields).toMatch(/key: 'quote', label: 'Quote', control: 'textarea'/);
  });

  it('data-driven blocks are labelled as dynamic instead of silently uneditable', () => {
    for (const type of [
      'academy-grid',
      'program-cards',
      'partner-logos',
      'catalog-hero',
      'live-island',
    ]) {
      expect(notice).toMatch(new RegExp(`['\\"]?${type}['\\"]?\\s*:`));
    }
    // Testimonials have no public source on the homepage; they are covered by
    // the "hidden on the homepage" set instead of the dynamic-source map.
    expect(notice).toMatch(/HIDDEN_ON_HOME = new Set\(\['testimonials'/);
    expect(notice).toMatch(/Dynamic content/);
    // It must name where the content actually lives, not just say "dynamic".
    expect(notice).toMatch(/href:/);
  });

  it('the notice renders in the inspector, including the no-properties fallback', () => {
    const inspector = read('components/builder/inspector/smart-inspector.tsx');
    expect(inspector).toMatch(
      /<DynamicContentNotice type=\{selected\.type\} props=\{selected\.props\} \/>/,
    );
    // Twice: once above the field groups, once above the "no editable properties" panel.
    expect((inspector.match(/<DynamicContentNotice/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});

describe('the publish checklist dropdown is not trapped by the inspector', () => {
  const checklist = read('components/builder/publish-checklist.tsx');

  /**
   * It was a native `<details>`, so the list expanded in place inside the header toolbar and was
   * painted under the right-hand inspector — unreadable in exactly the situation it exists for.
   */
  it('uses the same portal as the other popovers', () => {
    expect(checklist).toMatch(/<AnchorPanel/);
    // `<details>` survives only in the comment explaining why it was replaced.
    const code = checklist.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/<details/);
    expect(code).not.toMatch(/<summary/);
  });

  it('still exposes the error and warning counts on the trigger', () => {
    expect(checklist).toMatch(/publish\.errorCount/);
    expect(checklist).toMatch(/publish\.warningCount/);
    expect(checklist).toMatch(/aria-expanded=\{open\}/);
  });
});

describe('Layers drag-and-drop cannot corrupt the tree', () => {
  const tree = read('components/builder/structure-tree.tsx');

  it('carries the source node identity, not just a position', () => {
    expect(tree).toMatch(/sourceId: node\.id/);
    expect(tree).toMatch(/sourceType: node\.type/);
  });

  it('refuses to drop a container into its own subtree', () => {
    expect(tree).toMatch(/tree\.ancestors\.get\(node\.id\).*includes\(payload\.sourceId\)/);
  });

  it('validates cross-zone moves against the destination allow-list and capacity', () => {
    expect(tree).toMatch(/getBlockDefinition\(owner\.type\)\?\.zones\?\.\[slot\]/);
    expect(tree).toMatch(/spec\.allow\.includes\(payload\.sourceType\)/);
    expect(tree).toMatch(/getZoneItems\(.*\)\.length < spec\.max/);
  });
});

describe('builder toasts provide every interpolation variable', () => {
  const editor = read('app/(admin)/admin/builder/builder-editor.tsx');

  it('passes the saved slug to the draft-saved detail', () => {
    expect(editor).toMatch(/draftSavedDetail[\s\S]{0,160}slug: updated\.slug/);
  });

  it('passes the published slug to the published detail', () => {
    expect(editor).toMatch(/pagePublishedDetail[\s\S]{0,160}slug: updated\.slug/);
  });

  it('does not reset Arabic state from a save response that may predate the Arabic PATCH', () => {
    expect(editor).toMatch(/setArabicLayout\([\s\S]{0,120}\n  \}, \[page\?\.id\]\)/);
  });
});

describe('filling missing page translations preserves reviewed copy', () => {
  const page = read('components/builder/page-translation.tsx');
  const hook = read('components/admin/translation/use-translate-draft.ts');

  it('the translation hook can exclude fields the caller already reviewed', () => {
    expect(hook).toMatch(/filterFields\?:/);
    expect(hook).toMatch(/filterFields\?\.\(group\.key, key, value\)/);
  });

  it('the page panel excludes already-translated field keys from the missing scope', () => {
    expect(page).toMatch(/filterFields: \(_group, key\) => !reviewedKeys\.has\(key\)/);
    expect(page).toMatch(/readPageTranslationField\(target, field\)/);
  });

  it('applies a partial translation onto the existing Arabic tree', () => {
    expect(page).toMatch(/mergeLayoutStructure\(harvested\.layout, base\)/);
    expect(page).toMatch(/const base = prev\?\.layout \?\? existingAligned \?\? harvested\.layout/);
  });

  it('chunks page fields under the translate endpoint\'s 40-field cap', () => {
    expect(page).toMatch(/index \+= 40/);
    expect(page).toMatch(/entries\.slice\(index, index \+ 40\)/);
  });

  it('does not count English fallback copy as a completed translation in review', () => {
    expect(page).toMatch(/missing: !translation\.trim\(\) \|\| translation\.trim\(\) === field\.value\.trim\(\)/);
  });
});
