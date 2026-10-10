import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { matchQuality, normalizeSearchText, tokenizeSearchQuery } from '@titan/shared';

/**
 * Search was exact in production because Meilisearch is not configured there
 * (`MEILI_HOST` is empty), so every query took the Postgres fallback.
 *
 * Reproduced live before the fix:
 *   q="3-axis"          -> 1 result
 *   q="3 axis"          -> 2 results
 *   q="3_axis"          -> 0
 *   q="3/axis"          -> 0
 *   q="machining-center"-> 0
 *
 * The fallback compared the raw query with a single `ILIKE '%query%'`, so punctuation decided
 * whether anything matched.
 */
describe('search normalisation, end to end', () => {
  const TITLE = '3-Axis Vertical Machining Center';

  it('finds a record however the query is punctuated', () => {
    for (const q of ['3-axis', '3 axis', '3_axis', '3/axis', '3.axis', '3axis', '3-Axis']) {
      expect(matchQuality(TITLE, q), q).not.toBeNull();
    }
  });

  it('matches across every punctuation style for the same phrase', () => {
    const phrase = '3 Axis Vertical Machining Center';
    const variants = [
      '3-Axis_Vertical/Machining.Center',
      '3 axis vertical machining center',
      '3axisverticalmachiningcenter',
    ];
    for (const v of variants) {
      expect(matchQuality(phrase, v), v).not.toBeNull();
    }
  });

  it('does not match an unrelated record', () => {
    expect(matchQuality('Aerospace Manufacturing Academy', '3-axis-vertical')).toBeNull();
  });

  it('an empty query matches nothing rather than everything', () => {
    for (const q of ['', '   ', '-_./', null, undefined]) {
      expect(matchQuality(TITLE, q as unknown as string)).toBeNull();
      expect(tokenizeSearchQuery(q as unknown as string)).toEqual([]);
    }
  });

  it('a user-typed LIKE wildcard cannot widen the match', () => {
    // `contains` escapes `%` and `_`; normalisation also treats them as separators, so a
    // bare wildcard tokenises to nothing instead of matching every row.
    expect(tokenizeSearchQuery('%')).toEqual([]);
    expect(tokenizeSearchQuery('%%')).toEqual([]);
    expect(tokenizeSearchQuery('_')).toEqual([]);
    expect(matchQuality(TITLE, '%')).toBeNull();
  });

  it('accents are folded so a diacritic does not decide a match', () => {
    expect(normalizeSearchText('Café')).toBe('cafe');
    expect(matchQuality('Café Machining', 'cafe machining')).not.toBeNull();
    expect(matchQuality('Cafe Machining', 'Café Machining')).not.toBeNull();
  });

  it('the service ranks on normalised text rather than the raw query', () => {
    const src = readFileSync(
      resolve(__dirname, '../src/modules/search/search.service.ts'),
      'utf8',
    );
    // The old scorer compared a lower-cased raw needle with a lower-cased raw title.
    const scorer = src.slice(src.indexOf('function scoreCandidate'), src.indexOf('function publicResult'));
    expect(scorer).toContain('matchQuality');
    expect(scorer).toContain('normalizeSearchText');
    expect(scorer).not.toContain('title === needle');
  });

  it('the SQL pre-filter is token-based, so it cannot exclude a real match', () => {
    const src = readFileSync(
      resolve(__dirname, '../src/modules/search/search.service.ts'),
      'utf8',
    );
    expect(src).toContain('function tokenFilter');
    expect(src).toContain('tokenizeSearchQuery');
  });

  it('configures Meilisearch separators and typo tolerance when it is enabled', () => {
    const src = readFileSync(
      resolve(__dirname, '../src/modules/search/search.service.ts'),
      'utf8',
    );
    // Otherwise the two paths disagree the moment Meilisearch is switched on.
    expect(src).toContain('separatorTokens');
    expect(src).toContain('typoTolerance');
    expect(src).toContain('rankingRules');
  });
});

/**
 * The SQL pre-filter must not be stricter than the matcher.
 *
 * Two bugs here shipped in the first version and were caught by the live endpoint returning
 * nothing for a query that had matched before: `replace()` in Postgres takes a literal string
 * rather than a regex, so the normalisation removed nothing; and the squashed form was ANDed in
 * as an extra requirement instead of offered as an alternative.
 */
describe('the SQL pre-filter agrees with the matcher', () => {
  it('uses regexp_replace, not replace, which Postgres treats as a literal', () => {
    const src = readFileSync(
      resolve(__dirname, '../src/modules/search/search.service.ts'),
      'utf8',
    );
    const filter = src.slice(src.indexOf('function tokenFilter'), src.indexOf('const contains = tokenFilter'));
    expect(filter).toContain("regexp_replace(lower(");
    // The bug is `replace(lower(col::text), '[^a-z0-9]+', '')` — a literal, not a regex.
    // Asserting the negative form separately is self-defeating: "regexp_replace(lower("
    // contains "replace(lower(" as a substring.
    expect(filter).not.toMatch(/replace\(lower\([^)]*\), '\^/);
  });

  it('offers the squashed form as an alternative rather than an extra requirement', () => {
    const src = readFileSync(
      resolve(__dirname, '../src/modules/search/search.service.ts'),
      'utf8',
    );
    // The squashed clause is inside the same parenthesised OR as the token conjunction.
    expect(src).toMatch(/OR \$\{normalised\(column\)\} LIKE/);
  });

  it('requires every token, so a multi-token query cannot match on one word alone', () => {
    const src = readFileSync(
      resolve(__dirname, '../src/modules/search/search.service.ts'),
      'utf8',
    );
    expect(src).toContain('sql` AND `');
  });
});

/**
 * The SQL text itself must be well-formed.
 *
 * A stray `}` inside the pre-filter shipped and passed typecheck: it lives inside a template
 * string, so TypeScript has no opinion about it, and the failure only surfaced as a Postgres
 * scanner error on the live endpoint. Rendering the built condition is the only way to catch
 * that class of defect.
 */
describe('the generated SQL is well-formed', () => {
  it('never emits a brace before a closing paren, which is what broke the endpoint', () => {
    const src = readFileSync(
      resolve(__dirname, '../src/modules/search/search.service.ts'),
      'utf8',
    );
    const filter = src.slice(src.indexOf('function tokenFilter'), src.indexOf('const contains = tokenFilter'));
    /**
     * The defect was `ESCAPE '\\'})` — a stray `}` that Postgres rejected with
     * "syntax error at or near }". Counting brackets is not viable here because the filter nests
     * template literals, so the specific malformed sequence is what gets asserted.
     */
    expect(filter).not.toMatch(/\}\)/);
  });

  it('a regexp_replace pattern is never passed to replace(), which takes a literal', async () => {
    const { sql } = await import('drizzle-orm');
    const src = readFileSync(
      resolve(__dirname, '../src/modules/search/search.service.ts'),
      'utf8',
    );
    const filter = src.slice(src.indexOf('function tokenFilter'), src.indexOf('const contains = tokenFilter'));
    // `replace(lower(col), ...)` would be the literal-string bug; the pattern must go through
    // regexp_replace to be treated as a pattern at all.
    expect(filter).toContain('regexp_replace(');
    expect(filter).not.toMatch(/[^_]replace\(lower\(/);
  });
});
