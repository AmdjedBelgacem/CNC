import { describe, expect, it } from 'vitest';
import { AuthService } from '../src/modules/auth/services/auth.service';

/**
 * Account deletion used to accept a bare authenticated POST: the "type DELETE" gate
 * lived only in the browser, so one request (or any XSS / CSRF-with-token) destroyed
 * the account. The service must now enforce the typed confirmation server-side, plus
 * the current password whenever the account has one.
 */
type ServiceDeps = {
  user: { id: string; passwordHash: string | null } | null;
  verify: (hash: string, password: string) => Promise<boolean>;
  revoked: string[];
  logged: string[];
};

function build(deps: Partial<ServiceDeps> = {}) {
  const d: ServiceDeps = {
    user: { id: 'u1', passwordHash: 'hash' },
    verify: async () => false,
    revoked: [],
    logged: [],
    ...deps,
  };

  const updates: Array<Record<string, unknown>> = [];
  const drizzle = {
    db: {
      query: { users: { findFirst: async () => d.user } },
      update: () => ({ set: (v: Record<string, unknown>) => ({ where: async () => void updates.push(v) }) }),
    },
  };
  const tokenService = { revokeAllUserTokens: async (id: string) => void d.revoked.push(id) };
  const auditService = { log: async (p: { action: string }) => void d.logged.push(p.action) };
  const passwordService = { verify: (h: string, p: string) => d.verify(h, p) };

  const svc = AuthService as unknown as new (...args: unknown[]) => {
    deleteMyAccount(userId: string, input?: { confirmation?: string; password?: string }): Promise<void>;
  };
  // AuthService ctor order: drizzle, passwordService, tokenService, auditService, ...
  const service = new svc(drizzle, passwordService, tokenService, auditService);
  return { service, d, updates };
}

const rejects = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
    return null;
  } catch (error) {
    return error as { constructor: { name: string }; status?: number };
  }
};

describe('deleteMyAccount confirmation', () => {
  it('rejects a request with no confirmation', async () => {
    const { service, d } = build();
    const err = await rejects(() => service.deleteMyAccount('u1', {}));
    expect(err?.constructor.name).toBe('BadRequestException');
    expect(d.revoked).toEqual([]);
  });

  it('rejects a wrong confirmation string', async () => {
    const { service } = build();
    const err = await rejects(() => service.deleteMyAccount('u1', { confirmation: 'remove-me' }));
    expect(err?.constructor.name).toBe('BadRequestException');
  });

  it('accepts the confirmation case-insensitively', async () => {
    const { service } = build({ user: { id: 'u1', passwordHash: null } });
    await expect(service.deleteMyAccount('u1', { confirmation: 'delete' })).resolves.toBeUndefined();
  });

  it('rejects the correct confirmation with a missing password', async () => {
    const { service, d } = build();
    const err = await rejects(() => service.deleteMyAccount('u1', { confirmation: 'DELETE' }));
    expect(err?.constructor.name).toBe('UnauthorizedException');
    expect(d.revoked).toEqual([]);
  });

  it('rejects the correct confirmation with a wrong password', async () => {
    const { service } = build({ verify: async () => false });
    const err = await rejects(() =>
      service.deleteMyAccount('u1', { confirmation: 'DELETE', password: 'nope' }),
    );
    expect(err?.constructor.name).toBe('UnauthorizedException');
  });

  it('deletes when the confirmation and password are both correct', async () => {
    const { service, d, updates } = build({ verify: async () => true });
    await service.deleteMyAccount('u1', { confirmation: 'DELETE', password: 'right' });
    expect(updates[0]).toMatchObject({ accountStatus: 'deleted' });
    expect(d.revoked).toEqual(['u1']);
    expect(d.logged).toContain('user.delete.self');
  });

  it('does not require a password for an OAuth-only account', async () => {
    const { service, updates } = build({ user: { id: 'u1', passwordHash: null } });
    await service.deleteMyAccount('u1', { confirmation: 'DELETE' });
    expect(updates[0]).toMatchObject({ accountStatus: 'deleted' });
  });
});

describe('getLoginHistory action coverage', () => {
  function historyService() {
    const captured: Array<Record<string, unknown>> = [];
    const auditService = { getLogs: async (opts: Record<string, unknown>) => (captured.push(opts), []) };
    const svc = AuthService as unknown as new (...args: unknown[]) => {
      getLoginHistory(userId: string, limit?: number): Promise<unknown>;
    };
    // AuthService ctor order: drizzle, passwordService, tokenService, auditService, ...
    return { service: new svc({}, {}, {}, auditService), captured };
  }

  it('queries every login-related action, not just exact "user.login"', async () => {
    const { service, captured } = historyService();
    await service.getLoginHistory('u1', 20);
    const opts = captured[0]!;
    // An exact-equality filter on 'user.login' hid every failed attempt.
    expect(opts.action).toBeUndefined();
    expect(opts.actions).toEqual(
      expect.arrayContaining(['user.login', 'user.login.failed']),
    );
  });

  it('includes the 2FA intermediate steps', async () => {
    const { service, captured } = historyService();
    await service.getLoginHistory('u1');
    expect(captured[0]!.actions).toEqual(
      expect.arrayContaining(['user.login.2fa_pending', 'user.login.2fa_verified']),
    );
  });

  it('stays scoped to the requesting user and honours the limit', async () => {
    const { service, captured } = historyService();
    await service.getLoginHistory('u1', 15);
    expect(captured[0]).toMatchObject({ userId: 'u1', limit: 15 });
  });
});