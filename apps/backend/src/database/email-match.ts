import { sql, type SQL, type SQLWrapper } from 'drizzle-orm';

/**
 * Case-insensitive email comparison.
 *
 * Supabase always normalises auth emails to lowercase, but this application's `users.email`
 * column is a plain `varchar` and historically stored whatever casing the user typed. A
 * login therefore did not fail on a wrong password — Supabase verified it — it failed on
 * the local lookup that follows, because `email = 'ahmed@…'` does not match a row stored as
 * `'Ahmed@…'`. That surfaced as "No application account is linked to this identity", an
 * error that blamed the account link rather than the casing.
 *
 * `lower(col) = lower($1)` is used rather than `ilike` on purpose: `ilike` treats `%` and
 * `_` as wildcards, so a submitted address of `%` would match every row and turn an
 * email-based lookup into an authentication bypass. This treats the input as a literal.
 */
export function emailEquals(column: SQLWrapper, email: string): SQL {
  return sql`lower(${column}) = lower(${email})`;
}