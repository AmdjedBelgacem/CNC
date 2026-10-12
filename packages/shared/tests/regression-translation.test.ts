import { describe, it, expect } from 'vitest';
import { splitHtml, joinHtml, htmlTexts, applyBlockTranslations } from '../src/lesson-translation';
import { harvestPageLayout, applyPageTranslations } from '../src/page-translation';

/**
 * Regression tests for four bugs found while building the translation workflow.
 * Each names the failure it prevents, so a future refactor that reintroduces it fails loudly.
 */
describe('BUG 1: inter-tag whitespace was lost on write-back', () => {
  it('preserves the space between inline tags', () => {
    const { segments, tags } = splitHtml('<b>Hello</b> <i>world</i>');
    expect(joinHtml(['مرحبا', 'عالم'], tags, segments)).toBe('<b>مرحبا</b> <i>عالم</i>');
  });

  it('does not double the padding of a whitespace-only run', () => {
    const { segments, tags } = splitHtml('<b>A</b> <i>B</i>');
    expect(joinHtml(htmlTexts(segments), tags, segments)).toBe('<b>A</b> <i>B</i>');
  });
});

describe('BUG 2: a partial translation could delete a paragraph', () => {
  it('keeps original text for segments the model did not return', () => {
    const { segments, tags } = splitHtml('<p>One</p><p>Two</p>');
    expect(joinHtml(['واحد'], tags, segments)).toBe('<p>واحد</p><p>Two</p>');
  });

  it('leaves a field untouched when its label is absent from the response', () => {
    const content = { title: 'Welcome', text: 'Hello' } as never;
    const next = applyBlockTranslations(content, [{ key: 'title', path: 'title', value: 'Welcome' }, { key: 'text', path: 'text', value: 'Hello' }], { title: 'مرحبا' });
    expect(next).toEqual({ title: 'مرحبا', text: 'Hello' });
  });
});

describe('BUG 4: page write-back double-stripped keys, so nothing was applied', () => {
  it('actually replaces content node strings', () => {
    const draft = harvestPageLayout({
      root: {},
      content: [{ type: 'heading', props: { text: 'Welcome' } }],
    });
    const next = applyPageTranslations(draft, { 'n0:text': 'أهلاً' });
    expect(next.content[0]!.props).toEqual({ text: 'أهلاً' });
  });

  it('actually replaces zone node strings', () => {
    const draft = harvestPageLayout({
      root: {},
      content: [],
      zones: { side: [{ type: 'cta', props: { title: 'Buy' } }] },
    });
    const next = applyPageTranslations(draft, { 'z:side:0:title': 'اشترِ' });
    expect(next.zones?.side?.[0]!.props).toEqual({ title: 'اشترِ' });
  });
});
