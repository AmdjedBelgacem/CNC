import { describe, it, expect } from 'vitest';
import { coverageOf, readPath, writePath, buildFieldMap } from '../src/types/translations';
import { COURSE_FIELDS, PRODUCT_FIELDS, HOTSPOT_FIELDS } from '../src/types/translatable-entities';

describe('readPath', () => {
  it('reads nested paths', () => {
    expect(readPath({ cta: { primary: { label: 'Go' } } }, 'cta.primary.label')).toBe('Go');
  });

  it('joins array fields with newlines', () => {
    expect(readPath({ features: ['a', 'b'] }, 'features')).toBe('a\nb');
  });

  it('returns empty string for a missing path rather than throwing', () => {
    expect(readPath({ a: 1 }, 'a.b.c')).toBe('');
    expect(readPath(null, 'title')).toBe('');
    expect(readPath({}, 'deep.missing')).toBe('');
  });
});

describe('writePath', () => {
  it('creates intermediate objects', () => {
    const target: Record<string, unknown> = {};
    writePath(target, 'cta.primary.label', 'Go');
    expect(target).toEqual({ cta: { primary: { label: 'Go' } } });
  });

  it('writes lists as trimmed, non-empty arrays', () => {
    const target: Record<string, unknown> = {};
    writePath(target, 'features', ' a \n\n b ', 'list');
    expect(target.features).toEqual(['a', 'b']);
  });

  it('writes empty text as null so the key does not read as an empty string', () => {
    const target: Record<string, unknown> = {};
    writePath(target, 'title', '   ');
    expect(target.title).toBeNull();
  });

  it('replaces an array sitting where an object is needed', () => {
    const target: Record<string, unknown> = { cta: ['stale'] };
    writePath(target, 'cta.label', 'Go');
    expect(target.cta).toEqual({ label: 'Go' });
  });
});

describe('coverageOf', () => {
  const source = { title: 'CNC', subtitle: '', description: 'About' };
  const fields = COURSE_FIELDS.filter((f) => ['Title', 'Subtitle', 'Description'].includes(f.label));

  it('does not count fields that are empty in English', () => {
    const coverage = coverageOf(source, { title: 'CNC' }, fields);
    expect(coverage.missing).toEqual(['Description']);
    expect(coverage.total).toBe(2);
  });

  it('counts a field only when both sides have content', () => {
    expect(coverageOf(source, { title: 'cnc' }, fields).translated).toBe(1);
  });

  it('treats an absent translation object as fully missing', () => {
    const coverage = coverageOf(source, null, fields);
    expect(coverage.translated).toBe(0);
    expect(coverage.missing).toEqual(['Title', 'Description']);
  });

  it('reads through dot paths inside the translation object', () => {
    const coverage = coverageOf(
      { seo: { title: 'CNC' } },
      { seo: { title: 'CNC بالعربية' } },
      [{ label: 'SEO title', path: 'seo.title' }],
    );
    expect(coverage.translated).toBe(1);
  });
});

describe('buildFieldMap', () => {
  it('skips empty English fields', () => {
    const map = buildFieldMap({ title: 'CNC', subtitle: '  ' }, COURSE_FIELDS);
    expect(map.Title).toBe('CNC');
    expect(map).not.toHaveProperty('Subtitle');
  });

  it('keeps list fields as one joined value so bullet order survives', () => {
    const map = buildFieldMap({ features: ['one', 'two'] }, PRODUCT_FIELDS);
    expect(map['Bullet points']).toBe('one\ntwo');
  });
});

describe('hotspot fields', () => {
  it('describes label, tooltip and detail', () => {
    expect(HOTSPOT_FIELDS.map((f) => f.label)).toEqual(['Label', 'Tooltip', 'Detail']);
  });

  it('applies coverage per hotspot rather than across all of them', () => {
    // English has all three strings; the Arabic copy of h2 has only a label.
    const english = {
      h1: { label: 'X', tooltip: 'Y', detail: 'Z' },
      h2: { label: 'W', tooltip: 'V', detail: 'U' },
    };
    const arabic = {
      h1: { label: 'س', tooltip: 'ص', detail: 'ص2' },
      h2: { label: 'س2' },
    };
    expect(coverageOf(english.h1, arabic.h1, HOTSPOT_FIELDS).translated).toBe(3);
    expect(coverageOf(english.h2, arabic.h2, HOTSPOT_FIELDS).missing).toEqual(['Tooltip', 'Detail']);
  });

  it('keys hotspots by id so a reordered hotspot keeps its own copy', () => {
    const english = [{ id: 'a', label: 'First' }, { id: 'b', label: 'Second' }];
    const arabic: Record<string, { label?: string }> = { b: { label: 'الثاني' }, a: { label: 'الأول' } };
    const afterReorder = [english[1]!, english[0]!];
    const labels = afterReorder.map((hotspot) => arabic[hotspot.id]?.label);
    expect(labels).toEqual(['الثاني', 'الأول']);
  });
});
