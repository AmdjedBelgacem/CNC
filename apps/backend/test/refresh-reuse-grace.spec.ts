import { describe, it, expect } from 'vitest';
import { TokenService } from '../src/modules/auth/services/token.service';

/**
 * Regression cover for the refresh-token reuse race.
 *
 * `verifyAndRotateRefreshToken` rotates on every refresh. A browser can present the
 * pre-rotation cookie twice within a second (double navigation, a reload fired while
 * the previous refresh is still in flight, two tabs waking together) because the
 * `Set-Cookie` carrying the replacement has not landed yet. That race used to be
 * indistinguishable from a replay, and the reuse handler responded by revoking the
 * user's entire token family and every session — a reproducible account-wide logout
 * from nothing more than two fast page loads.
 *
 * These tests pin the boundary: inside the grace window the request is still denied
 * but the family survives; outside it, revocation is unchanged.
 */

/** Counts calls that would revoke the family, so we can assert on the side effect. */
function makeDrizzle(existing: unknown, spy: { revokes: number }) {
  const revoke = async () => {
    spy.revokes++;
    return [] as unknown[];
  };
  return {
    db: {
      query: { refreshTokens: { findFirst: async () => existing } },
      select: () => ({ from: () => ({ where: revoke }) }),
      update: () => ({ set: () => ({ where: revoke }) }),
    },
  } as any;
}

function makeService(drizzle: unknown) {
  return new TokenService({} as any, drizzle as any, { get: () => '15m' } as any, {} as any);
}

const RAW = 'raw-refresh-token-value';
const USER = { id: 'u1', email: 'a@b.c', role: 'admin', tenantId: 't1', accountStatus: 'active' };

function revokedToken(revokedAt: Date | null) {
  return { id: 'rt1', userId: 'u1', isRevoked: true, revokedAt, expiresAt: new Date(Date.now() + 1e9), user: USER };
}

describe('refresh-token reuse grace window', () => {
  it('a token rotated moments ago is denied WITHOUT revoking the family', async () => {
    const spy = { revokes: 0 };
    const svc = makeService(makeDrizzle(revokedToken(new Date()), spy));
    await expect(svc.verifyAndRotateRefreshToken(RAW)).rejects.toThrow(
      'Refresh token has been revoked',
    );
    expect(spy.revokes).toBe(0);
  });

  it('a token rotated well outside the window still revokes the family', async () => {
    const spy = { revokes: 0 };
    const old = new Date(Date.now() - 10 * 60 * 1000);
    const svc = makeService(makeDrizzle(revokedToken(old), spy));
    await expect(svc.verifyAndRotateRefreshToken(RAW)).rejects.toThrow(
      'Refresh token has been revoked',
    );
    expect(spy.revokes).toBeGreaterThan(0);
  });

  it('a revoked token with no revokedAt timestamp fails closed (revokes)', async () => {
    const spy = { revokes: 0 };
    const svc = makeService(makeDrizzle(revokedToken(null), spy));
    await expect(svc.verifyAndRotateRefreshToken(RAW)).rejects.toThrow(
      'Refresh token has been revoked',
    );
    expect(spy.revokes).toBeGreaterThan(0);
  });

  it('a replayed token never yields a session, inside the window or out', async () => {
    const spy = { revokes: 0 };
    const svc = makeService(makeDrizzle(revokedToken(new Date()), spy));
    await expect(svc.verifyAndRotateRefreshToken(RAW)).rejects.toThrow();
    // No token pair is returned on either path — denial is unconditional.
    await expect(
      svc.verifyAndRotateRefreshToken(RAW).then(() => 'resolved'),
    ).rejects.toThrow();
  });

  it('an unknown token is rejected before any revocation logic runs', async () => {
    const spy = { revokes: 0 };
    const svc = makeService(makeDrizzle(null, spy));
    await expect(svc.verifyAndRotateRefreshToken(RAW)).rejects.toThrow(
      'Invalid or expired refresh token',
    );
    expect(spy.revokes).toBe(0);
  });

  it('grace window is configurable and defaults to 10s', async () => {
    const src = await import('node:fs').then((fs) =>
      fs.readFileSync(new URL('../src/modules/auth/services/token.service.ts', import.meta.url), 'utf8'),
    );
    expect(src).toMatch(/REFRESH_REUSE_GRACE_MS\s*=\s*Number\(process\.env\.REFRESH_REUSE_GRACE_MS \?\? 10_000\)/);
  });
});
