import { describe, expect, it } from 'vitest';
import { navShapeOf, parseNavShape } from '../src/lib/admin-shape-memory';

const FALLBACK = [0, 0, 0];

describe('navigation skeleton shape', () => {
  it('records one row per item, group children one level in', () => {
    const tree: { label: string; children?: { label: string }[] }[] = [
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

import { parseListCount } from '../src/lib/admin-shape-memory';

describe('remembered list counts', () => {
  it('reads a stored count, including zero', () => {
    expect(parseListCount('7', 5)).toBe(7);
    expect(parseListCount('0', 5)).toBe(0);
  });

  it('caps at the maximum a skeleton needs', () => {
    expect(parseListCount('500', 5, 20)).toBe(20);
  });

  it('falls back on nothing or garbage', () => {
    expect(parseListCount(null, 5)).toBe(5);
    expect(parseListCount('', 5)).toBe(5);
    expect(parseListCount('abc', 5)).toBe(5);
    expect(parseListCount('-2', 5)).toBe(5);
    expect(parseListCount('2.5', 5)).toBe(5);
  });
});
