/**
 * Search normalisation and matching.
 *
 * Shared so the query the user typed, the text we rank, and the tokens we filter on are all
 * produced by one function. A second implementation in the indexer is how the two drift apart.
 *
 * The problem this solves: search was exact. `3_axis`, `3/axis` and `machining-center` all
 * returned nothing while `3-axis` matched, because the fallback compared the raw string with a
 * single `ILIKE '%query%'`. Separators are how humans punctuate compound words, so they cannot
 * decide whether two things match.
 */

/** Separators treated as equivalent to a space. */
const SEPARATORS = /[-_./\\|,;:()[\]{}<>+@#$%^&*~=?"'`]+/g;

/** Latin diacritics, folded so "Café" and "cafe" are the same token. */
const COMBINING_MARKS = /[̀-ͯ]/g;

/**
 * Canonical form of a string for comparison: lower-cased, diacritics folded, every separator
 * collapsed to a single space, no leading or trailing space.
 *
 * "  3-Axis__Vertical/Machining  " and "3 axis vertical machining" produce the same value.
 */
export function normalizeSearchText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(SEPARATORS, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalised text with the spaces removed, so a query typed without separators still matches.
 * `3axis` becomes `3axis`, and the squashed candidate "3-Axis Vertical…" becomes
 * "3axisvertical…", which contains it.
 */
export function squashSearchText(value: unknown): string {
  return normalizeSearchText(value).replace(/\s+/g, '');
}

/** The individual words of a query, in order, de-duplicated. */
export function tokenizeSearchQuery(value: unknown): string[] {
  const normalized = normalizeSearchText(value);
  return normalized ? [...new Set(normalized.split(' ').filter(Boolean))] : [];
}

export type MatchQuality = 'exact' | 'phrase' | 'all-tokens' | 'partial';

/**
 * How well a candidate matches a query, best first.
 *
 * - `exact`       squashed candidate equals squashed query (`3axis` = `3-axis`)
 * - `phrase`      the normalised query appears as a contiguous phrase
 * - `all-tokens`  every query token matches the start of some candidate token
 * - `partial`     the squashed query appears somewhere in the squashed candidate
 *
 * Returns null when the candidate does not match at all. "All tokens" is a prefix match per
 * token so that a query prefix still finds results — typing `mach` should not require the full
 * word to be stored — while a candidate containing a token in the middle of a word does not
 * qualify.
 */
export function matchQuality(candidateText: unknown, query: unknown): MatchQuality | null {
  const tokens = tokenizeSearchQuery(query);
  if (!tokens.length) return null;

  const candidateNormalized = normalizeSearchText(candidateText);
  if (!candidateNormalized) return null;
  const candidateSquashed = candidateNormalized.replace(/\s+/g, '');
  const querySquashed = tokens.join('');
  const queryNormalized = tokens.join(' ');

  if (candidateSquashed === querySquashed) return 'exact';
  if (candidateNormalized.includes(queryNormalized)) return 'phrase';

  const candidateTokens = candidateNormalized.split(' ').filter(Boolean);
  const everyTokenMatches = tokens.every((token) =>
    candidateTokens.some((candidateToken) => candidateToken.startsWith(token)),
  );
  if (everyTokenMatches) return 'all-tokens';

  if (candidateSquashed.includes(querySquashed)) return 'partial';
  return null;
}

/** Base score per tier, added to whatever the type-specific ranking already produced. */
const TIER_BONUS: Record<MatchQuality, number> = {
  exact: 1000,
  phrase: 500,
  'all-tokens': 200,
  partial: 50,
};

/**
 * Combine the match tier with an existing score, so a better textual match always outranks a
 * worse one and the original score still orders results within a tier.
 */
export function searchMatchScore(
  candidateText: unknown,
  query: unknown,
  baseScore = 0,
): number | null {
  const quality = matchQuality(candidateText, query);
  if (!quality) return null;
  return TIER_BONUS[quality] + baseScore;
}

export { TIER_BONUS as SEARCH_MATCH_TIERS };
