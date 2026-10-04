import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validatePageLayout, walkLayoutNodes } from '@titan/shared';
import { HIDDEN_PROP, collectPublishIssues, isNodeHidden } from '@titan/shared';

const read = (rel: string) => readFileSync(join(__dirname, '../../frontend', rel), 'utf8');

/**
 * "Hide block" was implemented by writing a `__hidden` prop.
 *
 * Nothing read it: `BuilderNode` drops a node when `props.visible === false`, so
 * the button flipped a flag nothing honoured, the editor showed the block, and
 * the block rendered on the public site anyway. The feature looked finished and
 * changed nothing. These tests pin the marker to the one the renderer checks, so
 * the two cannot drift apart again.
 */
describe('hidden blocks use the marker the renderer honours', () => {
  const productivity = read('src/components/builder/block-productivity.tsx');
  const renderer = read('src/components/builder/block-renderer.tsx');

  it('HIDDEN_PROP is the same prop the public renderer drops on', () => {
    // The renderer is the contract: whatever it checks is what must be written.
    // When these disagreed, the hide button flipped a marker nothing read.
    const checked = renderer.match(/props\.(\w+) === false/)?.[1];
    expect(checked, 'the renderer no longer drops nodes on a false prop').toBeDefined();
    expect(
      HIDDEN_PROP,
      `the renderer drops a node on props.${checked} === false, but the shared HIDDEN_PROP is "${HIDDEN_PROP}"`,
    ).toBe(checked);
  });

  it('the shared isNodeHidden agrees with that marker', () => {
    expect(isNodeHidden({ type: 'heading', props: { [HIDDEN_PROP]: false } })).toBe(true);
    expect(isNodeHidden({ type: 'heading', props: { text: 'shown' } })).toBe(false);
    expect(isNodeHidden({ type: 'heading' })).toBe(false);
  });

  it('the editor component imports the shared marker rather than its own copy', () => {
    expect(productivity).toMatch(/HIDDEN_PROP,\s*\n/);
    expect(productivity).toMatch(/export \{ HIDDEN_PROP \}/);
  });

  it('toggle writes false to hide and removes the prop to show', () => {
    expect(productivity).toMatch(/node\.props\[HIDDEN_PROP\] = false/);
    expect(productivity).toMatch(/delete node\.props\[HIDDEN_PROP\]/);
  });

  it('the selected block reads as hidden only when the prop is false', () => {
    expect(productivity).toMatch(/selectedItem\?\.props\?\.\[HIDDEN_PROP\] === false/);
  });

  it('a hidden block still validates, so hiding can never break a publish', () => {
    // Unknown keys are allowed on purpose; if that ever tightens, a hidden block
    // would make the page unpublishable and the author could not recover it.
    const layout = {
      root: { props: {} },
      content: [
        {
          type: 'section',
          props: {
            id: 's1',
            visible: false,
            content: [{ type: 'heading', props: { id: 'h1', text: 'Hidden' } }],
          },
        },
      ],
      schemaVersion: 2 as const,
    };
    const result = validatePageLayout(layout);
    expect(result.ok, result.ok ? '' : result.issues.join('; ')).toBe(true);
  });

  it('hiding a parent does not hide its children from the layout', () => {
    // Visibility is a render-time concern, not a structural one: the children
    // must survive so showing the parent again restores the subtree intact.
    const layout = {
      root: { props: {} },
      content: [
        {
          type: 'section',
          props: {
            id: 's1',
            visible: false,
            content: [{ type: 'heading', props: { id: 'h1', text: 'Child' } }],
          },
        },
      ],
    } as never;
    const ids: string[] = [];
    walkLayoutNodes(layout, (node) => {
      const id = node.props?.id as string | undefined;
      if (id) ids.push(id);
    });
    expect(ids).toContain('h1');
  });
});

describe('publish checklist rules', () => {
  it('reports a page with no title or slug as an error', () => {
    const issues = collectPublishIssues(
      { title: '  ', slug: '' },
      { root: { props: {} }, content: [{ type: 'heading', props: { text: 'hi' } }] },
      );
    expect(issues.filter((i) => i.level === 'error').map((i) => i.id).sort()).toEqual(['slug', 'title']);
  });

  it('flags an empty page as a warning, not an error', () => {
    // An empty page is a legitimate starting point; blocking a publish over it
    // would be hostile, but an author should be told.
    const issues = collectPublishIssues(
      { title: 'Real title', slug: 'real-slug' },
      { root: { props: {} }, content: [] },
      );
    expect(issues.find((i) => i.id === 'empty')?.level).toBe('warning');
    expect(issues.some((i) => i.level === 'error')).toBe(false);
  });

  it('escalates to an error when every block is hidden, because the page renders blank', () => {
    const issues = collectPublishIssues(
      { title: 'Real title', slug: 'real-slug' },
      {
        root: { props: {} },
        content: [
          { type: 'heading', props: { id: 'a', text: 'One', visible: false } },
          { type: 'heading', props: { id: 'b', text: 'Two', visible: false } },
        ],
      },
      );
    const all = issues.find((i) => i.id === 'allHidden');
    expect(all?.level).toBe('error');
    expect(all?.values).toEqual({ count: 2 });
  });

  it('warns without erroring when only some blocks are hidden', () => {
    const issues = collectPublishIssues(
      { title: 'Real title', slug: 'real-slug' },
      {
        root: { props: {} },
        content: [
          { type: 'heading', props: { id: 'a', text: 'Shown' } },
          { type: 'heading', props: { id: 'b', text: 'Hidden', visible: false } },
        ],
      },
      );
    expect(issues.find((i) => i.id === 'allHidden')).toBeUndefined();
    const hidden = issues.find((i) => i.id === 'hidden');
    expect(hidden?.level).toBe('warning');
    expect(hidden?.values).toEqual({ count: 1 });
  });

  it('reminds the author that a disabled page stays off the site when published', () => {
    const issues = collectPublishIssues(
      { title: 'Real title', slug: 'real-slug', status: 'disabled' },
      { root: { props: {} }, content: [{ type: 'heading', props: { text: 'hi' } }] },
      );
    expect(issues.find((i) => i.id === 'disabled')?.level).toBe('warning');
  });

  it('counts a block as empty only when it has no prose at all', () => {
    // A card whose only prop is a background class is empty; one with a title
    // is not. Getting this backwards would nag about every styled block.
    const issues = collectPublishIssues(
      { title: 'Real title', slug: 'real-slug', seoDescription: 'described' },
      {
        root: { props: {} },
        content: [
          { type: 'card', props: { id: 'c1', className: 'border', padding: 'md' } },
          { type: 'heading', props: { id: 'h1', text: 'Real heading' } },
        ],
      },
      );
    const empty = issues.find((i) => i.id === 'noText');
    expect(empty?.level).toBe('warning');
    expect(empty?.values).toEqual({ count: 1 });
  });

  it('produces no issues for a healthy page', () => {
    const issues = collectPublishIssues(
      { title: 'Real title', slug: 'real-slug', status: 'published', seoDescription: 'described' },
      {
        root: { props: {} },
        content: [
          { type: 'heading', props: { id: 'h1', text: 'Real heading' } },
          { type: 'text', props: { id: 't1', text: 'Real body copy' } },
        ],
      },
      );
    expect(issues).toEqual([]);
  });

  it('returns nothing rather than throwing when there is no page yet', () => {
    expect(collectPublishIssues(null, null)).toEqual([]);
  });
});
