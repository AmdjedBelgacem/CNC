import { describe, it, expect } from 'vitest';
import { TokenService } from '../src/modules/auth/services/token.service';
import { userSessions } from '../src/database/schema/auth';

/**
 * Regression cover for atomic refresh rotation.
 *
 * `verifyAndRotateRefreshToken` used to read `isRevoked`, decide, and *then* write.
 * Two refreshes arriving together both read `false`, both proceeded, and both minted
 * a replacement — one logical session, two live refresh tokens. The read-then-write
 * pair is a TOCTOU window, and under load it is not theoretical: a double navigation
 * or two tabs waking at once is enough to hit it.
 *
 * The fix folds the predicate into the UPDATE — `WHERE token_hash = ? AND is_revoked
 * = false ... RETURNING id` — so the database, not the application, decides the
 * winner. Exactly one caller gets a row back and mints the replacement; the loser gets
 * an empty result and is denied.
 *
 * Critically, the loser must be denied *without* running the reuse response. A
 * simultaneous refresh from the legitimate client is indistinguishable from a race,
 * and revoking the family there is what signed users out of every device.
 */

const RAW = 'raw-refresh-token-value';
const USER = {
  id: 'u1', email: 'a@b.c', role: 'admin', tenantId: 't1', accountStatus: 'active',
};

/** Live (not revoked, not expired) token row as `findFirst` would return it. */
function liveToken() {
  return {
    id: 'rt1', userId: 'u1', isRevoked: false, revokedAt: null,
    expiresAt: new Date(Date.now() + 60_000), user: USER,
  };
}

type Spy = { familyRevokes: number; sessionUpdates: number };

/**
 * Drizzle double for the rotation path.
 *
 * `select()` is only ever reached via `handleReusedToken`, so counting it is a clean
 * marker of "the reuse response ran". The `update().set().where()` shape is shared by
 * session-row revocation and by the reuse response, so it is counted separately and
 * keyed on the table identity instead.
 */
function makeDrizzle(opts: { existing: unknown; claimedRows: unknown[]; spy: Spy; claimState?: { claimed: boolean } }) {
  const { existing, claimedRows, spy, claimState } = opts;

  return {
    db: {
      query: { refreshTokens: { findFirst: async () => existing } },
      select: () => ({ from: () => ({ where: async () => { spy.familyRevokes++; return []; } }) }),
      update: (table: unknown) => ({
        set: () => ({
          where: () => {
            if (table === userSessions) spy.sessionUpdates++;
            const thenable = Promise.resolve([]) as Promise<unknown[]> & {
              returning: () => Promise<unknown[]>;
            };
            thenable.returning = async () => {
              if (!claimState) return claimedRows;
              // Shared mutable state models the single row both racers contend for.
              if (claimState.claimed) return [];
              claimState.claimed = true;
              return claimedRows;
            };
            return thenable;
          },
        }),
      }),
      insert: () => ({ values: async () => [] }),
    },
  } as any;
}

function makeService(drizzle: unknown) {
  // Constructor order is (jwt, drizzle, config, redis). The winner path signs an
  // access token, so `jwt.sign` must exist for the success case to complete.
  const jwt = { sign: (payload: unknown) => `signed.${Buffer.from(JSON.stringify(payload)).toString('base64url')}` };
  const config = { get: () => '15m' };
  return new TokenService(jwt as any, drizzle as any, config as any, {} as any);
}

const newSpy = (): Spy => ({ familyRevokes: 0, sessionUpdates: 0 });

describe('atomic refresh rotation (compare-and-swap claim)', () => {
  it('claimRefreshToken returns true when the UPDATE matched a row', async () => {
    const spy = newSpy();
    const svc = makeService(makeDrizzle({ existing: liveToken(), claimedRows: [{ id: 'rt1' }], spy }));
    await expect(svc.claimRefreshToken(RAW)).resolves.toBe(true);
  });

  it('claimRefreshToken returns false when no row matched (already claimed)', async () => {
    const spy = newSpy();
    const svc = makeService(makeDrizzle({ existing: liveToken(), claimedRows: [], spy }));
    await expect(svc.claimRefreshToken(RAW)).resolves.toBe(false);
  });

  it('the claim predicate is a compare-and-swap on is_revoked = false', async () => {
    const src = await import('node:fs').then((fs) =>
      fs.readFileSync(new URL('../src/modules/auth/services/token.service.ts', import.meta.url), 'utf8'),
    );
    // The UPDATE must both filter on the un-revoked state and return the matched rows,
    // otherwise two concurrent callers can both "win".
    expect(src).toMatch(
      /\.where\(and\(eq\(refreshTokens\.tokenHash, tokenHash\), eq\(refreshTokens\.isRevoked, false\)\)\)\s*\.returning\(/,
    );
  });

  it('a winning claim also ends the matching user_sessions row', async () => {
    const spy = newSpy();
    const svc = makeService(makeDrizzle({ existing: liveToken(), claimedRows: [{ id: 'rt1' }], spy }));
    await svc.claimRefreshToken(RAW);
    // Rotation used to call revokeRefreshToken(), which ended BOTH rows. Without this
    // the session list grows by one stale entry on every refresh.
    expect(spy.sessionUpdates).toBe(1);
  });

  it('a losing claim touches nothing', async () => {
    const spy = newSpy();
    const svc = makeService(makeDrizzle({ existing: liveToken(), claimedRows: [], spy }));
    await svc.claimRefreshToken(RAW);
    expect(spy.sessionUpdates).toBe(0);
  });

  it('a concurrent loser is denied without revoking the family', async () => {
    const spy = newSpy();
    // Live token at read time, but the CAS finds it already claimed by the winner.
    const svc = makeService(makeDrizzle({ existing: liveToken(), claimedRows: [], spy }));
    await expect(svc.verifyAndRotateRefreshToken(RAW)).rejects.toThrow(
      'Refresh token has been revoked',
    );
    // Denial is not treated as theft: no family-wide revocation is issued.
    expect(spy.familyRevokes).toBe(0);
    expect(spy.sessionUpdates).toBe(0);
  });

  it('the winner mints a replacement and rotates the token', async () => {
    const spy = newSpy();
    const svc = makeService(makeDrizzle({ existing: liveToken(), claimedRows: [{ id: 'rt1' }], spy }));
    const out = await svc.verifyAndRotateRefreshToken(RAW);
    expect(out.user).toMatchObject({ id: 'u1', tenantId: 't1' });
    expect(typeof out.accessToken).toBe('string');
    expect(typeof out.refreshToken).toBe('string');
    expect(out.refreshToken).not.toBe(RAW);
  });

  it('exactly one of two racing callers wins', async () => {
    const spy = newSpy();
    const svc = makeService(makeDrizzle({
      existing: liveToken(), claimedRows: [{ id: 'rt1' }], spy, claimState: { claimed: false },
    }));

    const results = await Promise.allSettled([
      svc.verifyAndRotateRefreshToken(RAW),
      svc.verifyAndRotateRefreshToken(RAW),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    // The loser must not trigger the reuse response.
    expect(spy.familyRevokes).toBe(0);
  });
});
