import { describe, expect, it } from 'vitest';
import {
  matchQuality,
  normalizeSearchText,
  searchMatchScore,
  squashSearchText,
  tokenizeSearchQuery,
} from '../src/search/match';

/**
 * Search was exact: "3_axis", "3/axis" and "machining-center" returned nothing while "3-axis"
 * matched, because the fallback compared the raw string with one `ILIKE '%query%'`.
 */
describe('normalizeSearchText', () => {
  it('treats every separator as equivalent to a space', () => {
    const expected = '3 axis vertical machining center';
    for (const input of [
      '3-Axis Vertical Machining Center',
      '3_axis_vertical_machining_center',
      '3/axis/vertical/machining/center',
      '3.axis.vertical.machining.center',
      '  3-Axis__Vertical/Machining  Center  ',
    ]) {
      expect(normalizeSearchText(input), input).toBe(expected);
    }
  });

  it('is case-insensitive and folds Latin diacritics', () => {
    expect(normalizeSearchText('Café Machining')).toBe('cafe machining');
    expect(normalizeSearchText('CAFÉ MACHINING')).toBe('cafe machining');
  });

  it('handles empty and non-string input without throwing', () => {
    for (const input of [null, undefined, '', '   ', 0, {}]) {
      expect(() => normalizeSearchText(input)).not.toThrow();
      expect(typeof normalizeSearchText(input)).toBe('string');
    }
  });
});

describe('squashSearchText', () => {
  it('removes separators so an unpunctuated query still matches', () => {
    expect(squashSearchText('3-Axis')).toBe('3axis');
    expect(squashSearchText('machining center')).toBe('machiningcenter');
  });
});

describe('tokenizeSearchQuery', () => {
  it('splits on any separator', () => {
    expect(tokenizeSearchQuery('A-b')).toEqual(['a', 'b']);
    expect(tokenizeSearchQuery('a_b/c.d e')).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('de-duplicates while preserving order', () => {
    // "3axis" is a distinct token from "3" and "axis"; only identical tokens collapse.
    expect(tokenizeSearchQuery('axis 3-axis axis')).toEqual(['axis', '3']);
  });

  it('returns nothing for an empty query', () => {
    for (const input of ['', '   ', '-_./', null, undefined]) {
      expect(tokenizeSearchQuery(input)).toEqual([]);
    }
  });
});

describe('matchQuality', () => {
  const TITLE = '3-Axis Vertical Machining Center';

  it('finds a title regardless of how the query is punctuated', () => {
    expect(matchQuality('a b', 'A-b')).not.toBeNull();
    // After normalisation these two strings are identical, so this is an exact match, not a
    // phrase one — punctuation is exactly what the phrase tier is there to absorb.
    expect(matchQuality('3 axis vertical machining center', '3-Axis_Vertical/Machining.Center')).toBe('exact');
    for (const q of ['3-axis', '3 axis', '3_axis', '3/axis', '3.axis', '3axis']) {
      expect(matchQuality(TITLE, q), q).not.toBeNull();
    }
  });

  it('ranks exact above phrase above all-tokens above partial', () => {
    expect(matchQuality('Machining', 'machining')).toBe('exact');
    expect(matchQuality('CNC Machining Center', 'machining center')).toBe('phrase');
    expect(matchQuality('Machining CNC 3 Axis', 'machining axis')).toBe('all-tokens');
    // "machiningxyz" is a single token that is not a prefix of any word in the candidate, and
    // the squashed query is not a substring either, so this is not a match at all.
    expect(matchQuality('Machining bits', 'machiningxyz')).toBeNull();
  });

  it('requires every token to match, not just one', () => {
    expect(matchQuality('Machining Center', 'machining lathe')).toBeNull();
  });

  it('matches a token that is a prefix of a word, so partial typing still works', () => {
    expect(matchQuality('Machining', 'mach')).not.toBeNull();
  });

  /**
   * A phrase is a substring match, so a query may match inside a longer word — that is what
   * makes "machin" find "machining" and is deliberate. The all-tokens tier is stricter: each
   * token must start a word, so a multi-token query cannot be satisfied by fragments.
   */
  it('matches a phrase inside a longer word, but not an all-tokens match', () => {
    expect(matchQuality('Machining Center', 'achining')).toBe('phrase');
    expect(matchQuality('Machining Center', 'achining zzz')).toBeNull();
  });

  it('returns null for an empty query or empty candidate', () => {
    expect(matchQuality(TITLE, '')).toBeNull();
    expect(matchQuality(TITLE, '   ')).toBeNull();
    expect(matchQuality('', 'axis')).toBeNull();
    expect(matchQuality(null, 'axis')).toBeNull();
  });

  it('treats LIKE wildcards as separators, so they cannot widen a match', () => {
    // '%' and '_' are separators here, so they tokenise to nothing rather than becoming a
    // wildcard that would match every row.
    expect(tokenizeSearchQuery('%')).toEqual([]);
    expect(tokenizeSearchQuery('_')).toEqual([]);
    expect(matchQuality('Machining', '%')).toBeNull();
    expect(matchQuality('Machining', '_')).toBeNull();
  });
});

describe('searchMatchScore', () => {
  it('orders tiers above any base score', () => {
    // One candidate per tier, each genuinely reaching that tier. `partial` needs a
    // multi-token query whose squashed form is a substring while no token starts a word and
    // the spaced phrase is absent — a single-word candidate cannot get there.
    const exact = searchMatchScore('Machining', 'machining', 0);
    const phrase = searchMatchScore('CNC Machining Center', 'machining center', 0);
    const tokens = searchMatchScore('Machining CNC Axis', 'machining axis', 0);
    const partial = searchMatchScore('PrecisionMachiningAxisTools', 'machining axis', 0);
    expect(matchQuality('PrecisionMachiningAxisTools', 'machining axis')).toBe('partial');
    expect(exact!).toBeGreaterThan(phrase!);
    expect(phrase!).toBeGreaterThan(tokens!);
    expect(tokens!).toBeGreaterThan(partial!);
  });

  it('keeps the base score as the tie-break inside a tier', () => {
    expect(searchMatchScore('Machining', 'machining', 10)).toBeGreaterThan(
      searchMatchScore('Machining', 'machining', 1),
    );
  });

  it('returns null when there is no match at all', () => {
    expect(searchMatchScore('Machining', 'lathe', 5)).toBeNull();
  });
});
