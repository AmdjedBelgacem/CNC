import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Regression cover for the follow graph.
 *
 * Two invariants are easy to break and impossible to notice without a test:
 *
 *  1. A member can never follow themselves. There are two follow routes (the
 *     social one and the older profile toggle) and both must refuse it, or the
 *     UI can offer a Follow button that the API then rejects.
 *
 *  2. `follows` carries a UNIQUE (follower_id, following_id) index. Every insert
 *     therefore has to use `onConflictDoNothing`; a plain insert raises 23505
 *     and turns a double-click into a 500.
 *
 * The routes live in the Nest app, which has no unit-level harness here, so these
 * are static assertions over the source — the same approach as
 * `middleware-auth-signal.spec.ts`.
 */
describe('follow graph invariants', () => {
  const social = readFileSync(
    resolve(__dirname, '../src/modules/social/social.service.ts'),
    'utf8',
  );
  const socialController = readFileSync(
    resolve(__dirname, '../src/modules/social/social.controller.ts'),
    'utf8',
  );
  const profileController = readFileSync(
    resolve(__dirname, '../src/modules/auth/profile.controller.ts'),
    'utf8',
  );
  const schema = readFileSync(
    resolve(__dirname, '../src/database/schema/users.ts'),
    'utf8',
  );
  const migration = readFileSync(
    resolve(__dirname, '../src/database/migrations/016_follows_unique_constraint.sql'),
    'utf8',
  );

  it('declares a unique constraint on the follow edge', () => {
    expect(schema).toMatch(/uniqueIndex\('follows_follower_following_unique'\)/);
    expect(migration).toMatch(/UNIQUE \("follower_id", "following_id"\)/);
    // Self-follow rows are not a valid state, so the migration purges any.
    expect(migration).toMatch(/DELETE FROM "follows" WHERE "follower_id" = "following_id"/);
  });

  it('refuses a self-follow on the social route', () => {
    expect(social).toMatch(
      /if \(followerId === followingId\) throw new ConflictException\('Cannot follow yourself'\)/,
    );
  });

  it('refuses a self-follow on the profile toggle route', () => {
    expect(profileController).toMatch(
      /if \(String\(currentUser\.id\) === String\(targetUserId\)\) \{\s*throw new ConflictException\('Cannot follow yourself'\)/,
    );
  });

  it('inserts follow edges idempotently on both routes', () => {
    // Without onConflictDoNothing the unique index turns a duplicate edge into
    // a 500 instead of a no-op.
    expect(social).toMatch(/onConflictDoNothing\(\{ target: \[follows\.followerId, follows\.followingId\] \}\)/);
    expect(profileController).toMatch(
      /onConflictDoNothing\(\{ target: \[follows\.followerId, follows\.followingId\] \}\)/,
    );
  });

  it('scopes follow writes to the same tenant', () => {
    expect(social).toMatch(/Cross-tenant follow is not allowed/);
  });

  it('honours the who-can-follow preference', () => {
    expect(social).toMatch(/This member does not accept new followers/);
  });

  it('never returns the viewer as a follow suggestion', () => {
    const suggestions = social.slice(social.indexOf('async getSuggestions'));
    expect(suggestions).toMatch(/not in \$\{excluded\}/);
    expect(suggestions).toMatch(/const excluded = \[\s*viewerId,/);
  });

  it('marks the follow write endpoints as authenticated', () => {
    // A public follow endpoint would let anyone wire up arbitrary edges.
    const guarded = (src: string, route: string) => {
      const index = src.indexOf(route);
      expect(index).toBeGreaterThan(-1);
      const window = src.slice(Math.max(0, index - 220), index);
      return /JwtAuthGuard/.test(window);
    };
    expect(guarded(socialController, "@Post('follow/:userId')")).toBe(true);
    expect(guarded(socialController, "@Get('suggestions')")).toBe(true);
    expect(guarded(profileController, "@Post('profile/:userId/follow')")).toBe(true);
  });
});
