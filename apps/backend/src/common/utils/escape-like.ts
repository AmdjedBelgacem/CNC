import { sql, type SQL, type SQLWrapper, type AnyColumn } from 'drizzle-orm';

/**
 * Escape the LIKE/ILIKE wildcards (`%`, `_`) and the escape character itself so a user's
 * search text matches literally. Pair the result with `ESCAPE '\\'` — the helpers below do —
 * otherwise a query of `%` or `_` matches every row and `\` is interpreted by Postgres.
 */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

/** `%<escaped value>%`, for a "contains" match. */
export function containsPattern(value: string): string {
  return `%${escapeLike(value)}%`;
}

type Target = AnyColumn | SQLWrapper;

/** Case-sensitive "contains" with the user's text matched literally. */
export function likeContains(target: Target, value: string): SQL {
  return sql`${target} LIKE ${containsPattern(value)} ESCAPE '\\'`;
}

/** Case-insensitive "contains" with the user's text matched literally. */
export function ilikeContains(target: Target, value: string): SQL {
  return sql`${target} ILIKE ${containsPattern(value)} ESCAPE '\\'`;
}
