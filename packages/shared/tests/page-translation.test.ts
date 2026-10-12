import { describe, it, expect } from 'vitest';
import { harvestPageLayout, applyPageTranslations } from '../src/page-translation';
import type { PageLayout } from '../src/types/page';

const layout = (): PageLayout => ({
  root: { props: { background: '#fff' } },
  schemaVersion: 2,
  content: [
    { type: 'heading', props: { text: 'Welcome', color: '#111' } },
    { type: 'rich-text', props: { html: '<p>Hello <b>there</b></p>' } },
    { type: 'image', props: { src: '/a.png', alt: 'A photo' } },
  ],
  zones: { sidebar: [{ type: 'cta', props: { title: 'Buy', href: '/x' } }] },
});

describe('harvestPageLayout', () => {
  it('collects prose from content and zones', () => {
    const draft = harvestPageLayout(layout());
    expect(Object.keys(draft.fields).sort()).toEqual([
      'n0:text',
      'n1:html',
      'z:sidebar:0:title',
    ]);
  });

  it('never collects urls, colors or sizes', () => {
    const draft = harvestPageLayout(layout());
    expect(Object.values(draft.fields).join(' ')).not.toContain('#');
    expect(Object.values(draft.fields).join(' ')).not.toContain('/a.png');
    expect(Object.values(draft.fields).join(' ')).not.toContain('/x');
  });
});

describe('applyPageTranslations', () => {
  it('replaces strings and leaves design values and structure alone', () => {
    const draft = harvestPageLayout(layout());
    const next = applyPageTranslations(draft, {
      'n0:text': 'أهلاً',
      'n1:html': 'مرحبا\nهناك',
      'z:sidebar:0:title': 'اشترِ',
    });
    expect(next.content[0]!.props).toEqual({ text: 'أهلاً', color: '#111' });
    expect(next.content[1]!.props).toEqual({ html: '<p>مرحبا <b>هناك</b></p>' });
    expect(next.content[2]!.props).toEqual({ src: '/a.png', alt: 'A photo' });
    expect(next.zones?.sidebar?.[0]!.props).toEqual({ title: 'اشترِ', href: '/x' });
  });

  it('preserves node types and the root', () => {
    const draft = harvestPageLayout(layout());
    const next = applyPageTranslations(draft, { 'n0:text': 'أهلاً' });
    expect(next.content.map((n) => n.type)).toEqual(['heading', 'rich-text', 'image']);
    expect(next.root.props).toEqual({ background: '#fff' });
    expect(next.schemaVersion).toBe(2);
  });

  it('does not mutate the original layout', () => {
    const original = layout();
    const draft = harvestPageLayout(original);
    applyPageTranslations(draft, { 'n0:text': 'أهلاً' });
    expect(original.content[0]!.props).toEqual({ text: 'Welcome', color: '#111' });
  });

  it('returns an identical layout when nothing is translated', () => {
    const draft = harvestPageLayout(layout());
    expect(applyPageTranslations(draft, {})).toEqual(layout());
  });

  it('ignores keys that were never harvested', () => {
    const draft = harvestPageLayout(layout());
    const next = applyPageTranslations(draft, { 'n0:text': 'أهلاً', 'n9:text': 'تخمين' });
    expect(next.content[0]!.props).toEqual({ text: 'أهلاً', color: '#111' });
    expect(next.content).toHaveLength(3);
  });

  it('handles a page with no zones', () => {
    const draft = harvestPageLayout({ root: {}, content: [{ type: 'heading', props: { text: 'Hi' } }] });
    const next = applyPageTranslations(draft, { 'n0:text': 'مرحبا' });
    expect(next.content[0]!.props).toEqual({ text: 'مرحبا' });
    expect(next.zones).toBeUndefined();
  });
});
