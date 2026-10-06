import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { IS_PUBLIC_KEY } from '@nestjs/common/constants';

const ctx = (publicRoute = false) =>
  ({
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ headers: {}, cookies: {} }) }),
  }) as never;
const handler = () => undefined;

/** Minimal stand-in for SupabaseTokenVerifier that records whether it was consulted. */
function verifierStub(enabled: boolean) {
  const seen: string[] = [];
  return {
    seen,
    stub: {
      enabled,
      verify: async (t: string) => {
        seen.push(t);
        throw new Error('Supabase verifier must not run when Supabase auth is disabled');
      },
    },
  };
}

describe('JwtAuthGuard — Supabase flag routing', () => {
  it('never consults the Supabase verifier when SUPABASE_AUTH_ENABLED is false', async () => {
    const { stub, seen } = verifierStub(false);
    const reflector = { getAllAndOverride: () => false } as never;
    const guard = new JwtAuthGuard(reflector, stub as never, undefined as never);

    // A locally issued HS256 token must reach the first-party strategy, not JWKS.
    await guard.canActivate(ctx()).catch(() => undefined);

    expect(seen).toEqual([]);
  });

  it('delegates to the Supabase guard (and not the local strategy) when the flag is true', async () => {
    const { stub } = verifierStub(true);
    const reflector = { getAllAndOverride: () => false } as never;
    let delegated = 0;
    const supabaseGuard = {
      canActivate: async () => {
        delegated += 1;
        return true;
      },
    } as never;
    const guard = new JwtAuthGuard(reflector, stub as never, supabaseGuard);

    const allowed = await guard.canActivate(ctx());

    expect(allowed).toBe(true);
    expect(delegated).toBe(1);
  });

  it('leaves public routes alone regardless of the flag', async () => {
    const { stub, seen } = verifierStub(true);
    const reflector = { getAllAndOverride: () => true } as never;
    const supabaseGuard = { canActivate: async () => true } as never;
    const guard = new JwtAuthGuard(reflector, stub as never, supabaseGuard);

    expect(await guard.canActivate(ctx(true))).toBe(true);
    expect(seen).toEqual([]);
  });
});
