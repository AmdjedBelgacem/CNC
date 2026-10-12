import { describe, it, expect } from 'vitest';
import {
  harvestBlock,
  harvestLessonBlocks,
  toFieldMap,
  applyBlockTranslations,
  splitHtml,
  joinHtml,
  htmlTexts,
} from '../src/lesson-translation';
import type { LessonBlock } from '../src/types/lesson';

const block = (content: unknown, id = 'b1'): LessonBlock =>
  ({ id, type: 'rich-text', sortOrder: 0, content }) as unknown as LessonBlock;

describe('harvestBlock', () => {
  it('collects prose by key name', () => {
    const fields = harvestBlock(block({ title: 'Welcome', text: 'Hello' }));
    expect(fields.map((f) => f.key)).toEqual(['title', 'text']);
  });

  it('never collects ids, urls or numbers', () => {
    const fields = harvestBlock(
      block({ id: 'x', src: '/a.png', type: 'image', sortOrder: 3, title: 'Keep' }),
    );
    expect(fields.map((f) => f.key)).toEqual(['title']);
  });

  it('skips empty strings', () => {
    expect(harvestBlock(block({ title: '   ', text: 'x' })).map((f) => f.key)).toEqual(['text']);
  });

  it('walks nested arrays', () => {
    const fields = harvestBlock(
      block({ questions: [{ prompt: 'Q1', options: [{ label: 'A' }, { label: 'B' }] }] }),
    );
    expect(fields.map((f) => f.value)).toEqual(['Q1', 'A', 'B']);
  });

  it('collects hotspot labels', () => {
    const fields = harvestBlock(
      block({ hotspots: [{ id: 'h1', x: 1, y: 2, label: 'Pin', tooltip: 'Tip' }] }),
    );
    expect(fields.map((f) => f.value)).toEqual(['Pin', 'Tip']);
  });

  it('excludes alt text unless asked, because it is an a11y hint rather than prose', () => {
    expect(harvestBlock(block({ alt: 'A photo', caption: 'A caption' })).map((f) => f.key)).toEqual([
      'caption',
    ]);
    expect(
      harvestBlock(block({ alt: 'A photo', caption: 'A caption' }), { includeAlt: true }).map((f) => f.key),
    ).toEqual(['alt', 'caption']);
  });

  it('treats html as text segments, not markup', () => {
    const fields = harvestBlock(block({ html: '<p>Hello <b>world</b></p>' }));
    const html = fields.find((f) => f.isHtml);
    expect(html?.value).toBe('Hello\nworld');
    expect(html?.value).not.toContain('<');
  });
});

describe('html round trip', () => {
  it('round trips byte for byte when nothing is translated', () => {
    // The invariant that makes partial translation safe: untranslated markup must come back
    // exactly as authored, or every HTML field would drift a little on each pass.
    for (const html of [
      '<h2 class="x">Title</h2><p>Body <strong>bold</strong> end</p>',
      '<b>Hello</b> <i>world</i>',
      '<ul><li>one</li> <li>two</li></ul>',
      '<p>  spaced  </p>',
      'plain text only',
      '<br/>',
    ]) {
      const { segments, tags } = splitHtml(html);
      expect(joinHtml(htmlTexts(segments), tags, segments)).toBe(html);
    }
  });

  it('exposes only the visible runs of text to the model', () => {
    const { segments } = splitHtml('<b>Hello</b> <i>world</i>');
    expect(htmlTexts(segments)).toEqual(['Hello', 'world']);
  });

  it('keeps the original text for a segment the model did not return', () => {
    const original = '<p>One</p><p>Two</p>';
    const { segments, tags } = splitHtml(original);
    // A missing translation must not delete a paragraph.
    expect(joinHtml(['واحد'], tags, segments)).toBe('<p>واحد</p><p>Two</p>');
  });

  it('restores the space between tags', () => {
    const original = '<b>Hello</b> <i>world</i>';
    const { segments, tags } = splitHtml(original);
    expect(joinHtml(['مرحبا', 'عالم'], tags, segments)).toBe('<b>مرحبا</b> <i>عالم</i>');
  });
});

describe('harvestLessonBlocks', () => {
  it('prefixes keys with the block id so identical paths stay distinct', () => {
    const fields = harvestLessonBlocks([block({ title: 'A' }, 'b1'), block({ title: 'B' }, 'b2')]);
    expect(fields.map((f) => f.key)).toEqual(['b1:title', 'b2:title']);
    expect(toFieldMap(fields)).toEqual({ 'b1:title': 'A', 'b2:title': 'B' });
  });

  it('handles a lesson with no blocks', () => {
    expect(harvestLessonBlocks(null)).toEqual([]);
  });
});

describe('applyBlockTranslations', () => {
  it('writes back by path and leaves the input untouched', () => {
    const content = { title: 'Welcome', text: 'Hello' } as never;
    const fields = harvestBlock(block(content));
    const next = applyBlockTranslations(content, fields, { title: 'مرحبا', text: 'مرحبا' });
    expect(next).toEqual({ title: 'مرحبا', text: 'مرحبا' });
    expect(content).toEqual({ title: 'Welcome', text: 'Hello' });
  });

  it('skips labels the model did not return instead of clearing them', () => {
    const content = { title: 'Welcome', text: 'Hello' } as never;
    const fields = harvestBlock(block(content));
    const next = applyBlockTranslations(content, fields, { title: 'مرحبا' });
    expect(next).toEqual({ title: 'مرحبا', text: 'Hello' });
  });

  it('does not invent keys that were not harvested', () => {
    const content = { title: 'Welcome' } as never;
    const next = applyBlockTranslations(content, harvestBlock(block(content)), { sneaky: 'x' });
    expect(next).toEqual({ title: 'Welcome' });
  });

  it('preserves markup when writing translated html', () => {
    const content = { html: '<p>Hello <b>world</b></p>' } as never;
    const fields = harvestBlock(block(content));
    const next = applyBlockTranslations(content, fields, {
      'html': 'مرحبا\nعالم',
    });
    expect(next).toMatchObject({ html: '<p>مرحبا <b>عالم</b></p>' });
  });

  it('round trips through the real harvest/apply cycle', () => {
    const content = {
      questions: [{ prompt: 'Pick one', options: [{ label: 'A' }] }],
      caption: 'Fig 1',
    } as never;
    const fields = harvestBlock(block(content));
    const map = toFieldMap(fields);
    const next = applyBlockTranslations(
      content,
      fields,
      Object.fromEntries(Object.keys(map).map((k) => [k, `ع:${k}`])),
    );
    expect((next as { questions: Array<{ prompt: string; options: Array<{ label: string }> }> })
      .questions[0]!.prompt).toBe('ع:questions.0.prompt');
    expect((next as { questions: Array<{ options: Array<{ label: string }> }> })
      .questions[0]!.options[0]!.label).toBe('ع:questions.0.options.0.label');
  });
});
