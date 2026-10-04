import { describe, expect, it } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { SupabaseAuthGuard } from '../src/modules/auth/guards/supabase-auth.guard';
import { JwtStrategy } from '../src/modules/auth/strategies/jwt.strategy';

const APP_USER = {
  id: 'app-user-1',
  email: 'u@example.com',
  name: 'User',
  username: 'user',
  avatarUrl: null,
  role: 'admin',
  tenantId: 'tenant-1',
  accountStatus: 'active',
  emailVerifiedAt: new Date(),
  twoFactorEnabled: false,
};

type Harness = { guard: SupabaseAuthGuard; request: Record<string, unknown> };

function build(
  opts: {
    enabled?: boolean;
    claims?: Record<string, unknown> | null;
    user?: Record<string, unknown> | null;
    header?: string | null;
    rbacThrows?: boolean;
  } = {},
): Harness {
  const request: Record<string, unknown> = {
    headers: opts.header === null ? {} : { authorization: opts.header ?? 'Bearer token' },
  };

  const verifier = {
    enabled: opts.enabled ?? true,
    verify: () => {
      if (opts.claims === null) throw new UnauthorizedException('bad token');
      return opts.claims ?? { sub: 'auth-uuid-1' };
    },
  };

  const drizzle = {
    db: { query: { users: { findFirst: async () => (opts.user === undefined ? APP_USER : opts.user) } } },
  };

  const rbac = {
    resolvePermissions: async () => {
      if (opts.rbacThrows) throw new Error('rbac unavailable');
      return ['from-rbac'];
    },
  };

  const guard = new SupabaseAuthGuard(verifier as never, drizzle as never, rbac as never);
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as never;

  return { guard, request, context } as Harness & { context: never };
}

const run = (h: ReturnType<typeof build>) => h.guard.canActivate((h as unknown as { context: never }).context);

describe('SupabaseAuthGuard', () => {
  it('refuses to act while the feature flag is off', async () => {
    const h = build({ enabled: false });
    await expect(run(h)).resolves.toBe(false);
  });

  it('rejects a request with no Authorization header', async () => {
    const h = build({ header: null });
    await expect(run(h)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a non-Bearer scheme', async () => {
    const h = build({ header: 'Basic abc' });
    await expect(run(h)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an invalid token', async () => {
    const h = build({ claims: null });
    await expect(run(h)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an anonymous Supabase session', async () => {
    const h = build({ claims: { sub: 'x', is_anonymous: true } });
    await expect(run(h)).rejects.toThrow(/anonymous/i);
  });

  it('rejects an identity with no linked application user', async () => {
    const h = build({ user: null });
    await expect(run(h)).rejects.toThrow(/no application user/i);
  });

  it('rejects a deleted account', async () => {
    const h = build({ user: { ...APP_USER, accountStatus: 'deleted' } });
    await expect(run(h)).rejects.toThrow(/deleted/i);
  });

  it('sets request.user and allows the request through', async () => {
    const h = build();
    await expect(run(h)).resolves.toBe(true);
    expect((h.request.user as { id: string }).id).toBe('app-user-1');
  });

  /**
   * The whole point of the bridge: every downstream consumer (@CurrentUser(), the RBAC
   * guards, audit logging) reads these fields. If the shapes diverge, 144 call sites
   * silently see undefined.
   */
  it('produces exactly the field set JwtStrategy provides', async () => {
    const h = build();
    await run(h);

    const strategySource = JwtStrategy.prototype.validate.toString();
    const produced = Object.keys(h.request.user as Record<string, unknown>).sort();
    const expected = [
      'accountStatus', 'avatarUrl', 'email', 'emailVerifiedAt', 'id',
      'impersonatedBy', 'impersonating', 'name', 'permissions',
      'role', 'tenantId', 'twoFactorEnabled', 'username',
    ].sort();

    expect(produced).toEqual(expected);
    // Every field the JWT strategy populates must exist here too.
    for (const field of expected) expect(strategySource).toContain(field);
  });

  it('never takes the tenant from the token, so x-tenant-slug stays authoritative', async () => {
    const h = build({ claims: { sub: 'auth-uuid-1', tenant_id: 'spoofed-tenant' } });
    await run(h);
    // The resolved tenant comes from the database row, never from claims.
    expect((h.request.user as { tenantId: string }).tenantId).toBe('tenant-1');
  });

  it('resolves permissions from local RBAC, never from a token claim', async () => {
    const h = build({ claims: { sub: 'auth-uuid-1', permissions: ['*'], app_metadata: { role: 'super_admin' } } });
    await run(h);
    // A Supabase claim must not grant anything; RBAC stays in this application.
    expect((h.request.user as { permissions: string[] }).permissions).toEqual(['from-rbac']);
  });

  it('falls back to no permissions when RBAC resolution fails', async () => {
    const h = build({ rbacThrows: true });
    await run(h);
    expect((h.request.user as { permissions: string[] }).permissions).toEqual([]);
  });
});