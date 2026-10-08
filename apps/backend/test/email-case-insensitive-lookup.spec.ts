import { describe, expect, it } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import { users } from '../src/database/schema/users';
import { emailEquals } from '../src/database/email-match';

const dialect = new PgDialect();
const render = (email: string) => dialect.sqlToQuery(emailEquals(users.email, email));

/**
 * Reproduces the cause of "this account cannot be logged in although it is a superadmin".
 *
 * Supabase lowercases every auth email, while `users.email` is a `varchar` holding whatever
 * casing was typed at signup. A superadmin row stored as `Ahmed@barootcnc.com` therefore
 * matched only that exact casing. The password was always valid — Supabase verified it and
 * even recorded a successful `last_sign_in_at` — but the local lookup that runs immediately
 * after returned nothing, and the response blamed the account link instead of the casing.
 */
describe('emailEquals', () => {
  it('wraps both sides in lower() so casing cannot decide the match', () => {
    const { sql, params } = render('ahmed@barootcnc.com');
    expect(sql).toBe('lower("users"."email") = lower($1)');
    expect(params).toEqual(['ahmed@barootcnc.com']);
  });

  it('normalises only at comparison time, leaving the stored value untouched', () => {
    // The column itself is never rewritten: a row stored as `Ahmed@…` stays that way and is
    // still reachable, rather than the fix depending on a data migration having been run.
    const { sql: rendered } = render('AHMED@BAROOTCNC.COM');
    expect(rendered).toContain('lower("users"."email")');
    expect(rendered).not.toContain('update');
    expect(rendered).not.toContain('lower("users"."email") = lower("users"."email")');
  });

  /**
   * `ilike` is the shorter spelling of this, but it treats `%` and `_` as wildcards. A
   * submitted address of `%` would then match every row, turning any email-keyed lookup —
   * including the one that gates login — into an authentication bypass.
   */
  it('passes the submitted address as a bound literal, never a pattern', () => {
    const { sql: rendered, params } = render('%');
    expect(rendered).not.toMatch(/\bilike\b/i);
    expect(rendered).not.toMatch(/\blike\b/i);
    // It stays a parameter, so `%` cannot alter the query's shape.
    expect(rendered).toContain('$1');
    expect(params).toEqual(['%']);
  });

  it('quotes the column so the name is unambiguous', () => {
    expect(render('x@y.com').sql).toContain('"users"."email"');
  });
});