import { describe, expect, it } from 'vitest';
import { navShapeOf, parseNavShape } from '../src/lib/admin-shape-memory';

const FALLBACK = [0, 0, 0];

describe('navigation skeleton shape', () => {
  it('records one row per item, group children one level in', () => {
    const tree = [
      { label: 'Academy' },
      { label: 'More', children: [{ label: 'Groups' }, { label: 'About' }] },
      { label: 'Sponsors' },
    ];
    expect(navShapeOf(tree)).toEqual([0, 0, 1, 1, 0]);
  });

  it('reads a remembered shape back', () => {
    expect(parseNavShape('[0,0,1,1,0]', FALLBACK)).toEqual([0, 0, 1, 1, 0]);
  });

  it('falls back when nothing usable is stored', () => {
    expect(parseNavShape(null, FALLBACK)).toBe(FALLBACK);
    expect(parseNavShape('not json', FALLBACK)).toBe(FALLBACK);
    expect(parseNavShape('[]', FALLBACK)).toBe(FALLBACK);
    expect(parseNavShape('[0,2]', FALLBACK)).toBe(FALLBACK);
    expect(parseNavShape(JSON.stringify(Array(61).fill(0)), FALLBACK)).toBe(FALLBACK);
  });
});
