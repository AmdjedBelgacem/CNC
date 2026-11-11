import { describe, expect, it } from 'vitest';
import { layoutFingerprint } from '@/lib/builder/layout-fingerprint';

describe('layoutFingerprint', () => {
  const saved = { root: { props: {} }, content: [{ type: 'section', props: { id: 'a', title: 'Hi' } }] };

  it('treats Puck\'s empty slots and zones as the same page', () => {
    const fromPuck = {
      root: { props: {} },
      content: [{ type: 'section', props: { id: 'a', title: 'Hi', footer: [], records: [] } }],
      zones: {},
    };
    expect(layoutFingerprint(fromPuck)).toBe(layoutFingerprint(saved));
  });

  it('ignores property order', () => {
    const reordered = { content: [{ props: { title: 'Hi', id: 'a' }, type: 'section' }], root: { props: {} } };
    expect(layoutFingerprint(reordered)).toBe(layoutFingerprint(saved));
  });

  it('still notices a real edit, so the unsaved-changes badge is not lost', () => {
    const edited = { ...saved, content: [{ type: 'section', props: { id: 'a', title: 'Changed' } }] };
    expect(layoutFingerprint(edited)).not.toBe(layoutFingerprint(saved));
    const added = { ...saved, content: [{ type: 'section', props: { id: 'a', title: 'Hi', animType: 'blurIn' } }] };
    expect(layoutFingerprint(added)).not.toBe(layoutFingerprint(saved));
  });

  it('notices a removed block and a slot that gained a child', () => {
    expect(layoutFingerprint({ ...saved, content: [] })).not.toBe(layoutFingerprint(saved));
    const withChild = {
      ...saved,
      content: [{ type: 'section', props: { id: 'a', title: 'Hi', footer: [{ type: 'text', props: { id: 'b' } }] } }],
    };
    expect(layoutFingerprint(withChild)).not.toBe(layoutFingerprint(saved));
  });

  it('keeps meaningful falsy values', () => {
    const a = { content: [{ type: 't', props: { id: 'a', hidden: false, label: '' } }] };
    const b = { content: [{ type: 't', props: { id: 'a' } }] };
    expect(layoutFingerprint(a)).not.toBe(layoutFingerprint(b));
  });
});
