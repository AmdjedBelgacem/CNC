import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { SupabaseAuthClient } from '../src/modules/auth/supabase-auth.client';
import { AuthService } from '../src/modules/auth/services/auth.service';
import { AuthController } from '../src/modules/auth/auth.controller';

/**
 * Google sign-in ended at `/auth/callback?provider=google` with no session, and two
 * independent defects were behind it:
 *
 *   1. the callback returned this application's own JWT while the deployment is
 *      Supabase-exclusive, so `JwtAuthGuard` rejected the cookie and `/auth/refresh`
 *      answered `Refresh token is not valid`;
 *   2. the callback replied twice (`Reply was already sent`), because Nest still owned
 *      a passthrough reply after the handler had already redirected.
 */

const SESSION = {
  accessToken: 'supabase-access-token',
  refreshToken: 'supabase-refresh-token',
  expiresIn: 3600,
  userId: 'auth-uuid-1',
  email: 'learner@example.com',
};

type Call = { url: string; body: any; key: string };

function mockFetch(responses: { status?: number; json: unknown }[]): { calls: Call[] } {
  const calls: Call[] = [];
  let index = 0;
  const fetchMock = vi.fn(async (url: string, init: any) => {
    calls.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : undefined, key: init?.headers?.apikey });
    const response = responses[Math.min(index++, responses.length - 1)];
    return {
      ok: (response.status ?? 200) < 300,
      status: response.status ?? 200,
      text: async () => JSON.stringify(response.json),
    } as unknown as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls };
}

const client = (enabled: boolean, overrides: Record<string, unknown> = {}) => {
  const config = {
    get: (k: string) =>
      ({
        SUPABASE_AUTH_ENABLED: enabled,
        SUPABASE_URL: 'https://project.supabase.co',
        SUPABASE_PUBLISHABLE_KEY: 'anon-key',
        SUPABASE_SECRET_KEY: 'secret-key',
        ...overrides,
      })[k],
  } as never;
  return new SupabaseAuthClient(config);
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('SupabaseAuthClient.mintSessionForVerifiedEmail', () => {
  it('generates a link and redeems it for a session', async () => {
    const { calls } = mockFetch([
      { json: { id: 'auth-uuid-1', hashed_token: 'hash-1', verification_type: 'signup' } },
      { json: { access_token: SESSION.accessToken, refresh_token: SESSION.refreshToken, user: { id: 'auth-uuid-1', email: SESSION.email } } },
    ]);

    const session = await client(true).mintSessionForVerifiedEmail({ email: SESSION.email });

    expect(session).toMatchObject({ userId: 'auth-uuid-1', accessToken: SESSION.accessToken });
    expect(calls[0].url).toContain('/auth/v1/admin/generate_link');
    // Admin key: this is a privileged endpoint, and the anon key is rejected.
    expect(calls[0].key).toBe('secret-key');
    expect(calls[0].body).toMatchObject({ type: 'magiclink', email: SESSION.email });
    // Without this a first-time OAuth sign-in has no Supabase user to sign in as.
    expect(calls[0].body.should_create_user).toBe(true);
    expect(calls[1].url).toContain('/auth/v1/verify');
    expect(calls[1].key).toBe('anon-key');
  });

  it('redeems with token_hash, not token', async () => {
    // `properties` nesting is what supabase-js returns; this endpoint is flat.
    // Reading `properties.hashed_token` sent an empty token and Supabase answered
    // "Verify requires either a token or a token hash".
    const { calls } = mockFetch([
      { json: { id: 'auth-uuid-1', hashed_token: 'hash-1', verification_type: 'magiclink' } },
      { json: { access_token: SESSION.accessToken, refresh_token: SESSION.refreshToken, user: { id: 'auth-uuid-1' } } },
    ]);

    await client(true).mintSessionForVerifiedEmail({ email: SESSION.email });

    expect(calls[1].body).toEqual({ type: 'magiclink', token_hash: 'hash-1' });
    expect(calls[1].body.token).toBeUndefined();
  });

  it('never asks Supabase to send an email', async () => {
    const { calls } = mockFetch([
      { json: { hashed_token: 'hash-1', verification_type: 'magiclink' } },
      { json: { access_token: SESSION.accessToken, refresh_token: SESSION.refreshToken, user: { id: 'auth-uuid-1' } } },
    ]);
    await client(true).mintSessionForVerifiedEmail({ email: SESSION.email });
    expect(calls.map((c) => c.url).join(' ')).not.toContain('/recover');
  });

  it('fails loudly when Supabase returns no token hash', async () => {
    mockFetch([{ json: { id: 'auth-uuid-1' } }]);
    await expect(client(true).mintSessionForVerifiedEmail({ email: SESSION.email })).rejects.toThrow(
      /did not return a verification token/,
    );
  });

  it('refuses an empty address without calling Supabase', async () => {
    const { calls } = mockFetch([{ json: {} }]);
    await expect(client(true).mintSessionForVerifiedEmail({ email: '  ' })).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });
});

const LOCAL_USER = {
  id: 'app-user-1',
  tenantId: 'tenant-1',
  email: SESSION.email,
  name: 'Learner',
  username: 'learner',
  role: 'learner',
  accountStatus: 'active',
  authUserId: null as string | null,
  twoFactorEnabled: false,
};

function buildService(opts: { supabaseEnabled: boolean; user?: Record<string, unknown>; account?: unknown } = { supabaseEnabled: true }) {
  const user = { ...LOCAL_USER, ...(opts.user ?? {}) };
  const updates: { set: Record<string, unknown> }[] = [];
  const tokenCalls: string[] = [];

  const drizzle = {
    db: {
      query: { users: { findFirst: async () => user } },
      update: () => ({
        set: (values: Record<string, unknown>) => {
          updates.push({ set: values });
          return { where: async () => [] };
        },
      }),
    },
  };

  const supabaseAuth = {
    enabled: opts.supabaseEnabled,
    mintSessionForVerifiedEmail: vi.fn(async () => ({ ...SESSION, userId: opts.account === 'other' ? 'auth-uuid-2' : SESSION.userId })),
    signOut: vi.fn(async () => undefined),
  };

  const oauthService = {
    findAccount: async () => (opts.account === 'linked' ? { user } : null),
    linkAccount: vi.fn(async () => undefined),
  };

  const tokenService = {
    generateAccessToken: () => {
      tokenCalls.push('access');
      return 'local-access';
    },
    generateRefreshToken: async () => {
      tokenCalls.push('refresh');
      return 'local-refresh';
    },
  };

  const service = new AuthService(
    drizzle as never, {} as never, tokenService as never,
    { log: vi.fn(async () => undefined) } as never, {} as never, oauthService as never,
    {} as never, {} as never, {} as never, {} as never,
    { resolvePermissions: async () => ['*'] } as never,
    supabaseAuth as never, undefined, undefined, undefined,
  );

  return { service, supabaseAuth, oauthService, tokenService, tokenCalls, updates, user };
}

const oauthParams = {
  provider: 'google',
  providerAccountId: 'google-1',
  email: SESSION.email,
  name: 'Learner',
  tenantId: 'tenant-1',
};

describe('AuthService.loginWithOauth with Supabase auth enabled', () => {
  it('returns Supabase tokens, not a first-party JWT', async () => {
    const h = buildService();
    const result: any = await h.service.loginWithOauth(oauthParams);
    expect(result.accessToken).toBe(SESSION.accessToken);
    expect(result.refreshToken).toBe(SESSION.refreshToken);
    expect(result.provider).toBe('supabase');
    expect(result.twoFactorRequired).toBe(false);
    // A local JWT is exactly what JwtAuthGuard refuses to accept in this mode.
    expect(h.tokenCalls).toEqual([]);
  });

  it('links users.auth_user_id on first sign-in', async () => {
    const h = buildService();
    await h.service.loginWithOauth(oauthParams);
    const linkUpdate = h.updates.find((u) => 'authUserId' in u.set);
    expect(linkUpdate?.set).toEqual({ authUserId: SESSION.userId });
  });

  it('does not rewrite the link when it already matches', async () => {
    const h = buildService({ supabaseEnabled: true, user: { authUserId: SESSION.userId } });
    await h.service.loginWithOauth(oauthParams);
    expect(h.updates.filter((u) => 'authUserId' in u.set)).toHaveLength(0);
  });

  it('repairs a stale link so the session can resolve the account', async () => {
    const h = buildService({ supabaseEnabled: true, user: { authUserId: 'auth-uuid-old' }, account: 'other' });
    await h.service.loginWithOauth(oauthParams);
    expect(h.updates.find((u) => 'authUserId' in u.set)?.set).toEqual({ authUserId: 'auth-uuid-2' });
  });

  it('mints no session before the second factor is satisfied', async () => {
    const h = buildService({ supabaseEnabled: true, user: { twoFactorEnabled: true } });
    const result: any = await h.service.loginWithOauth(oauthParams);
    expect(result.twoFactorRequired).toBe(true);
    expect(result.accessToken).toBeUndefined();
    expect(h.supabaseAuth.mintSessionForVerifiedEmail).not.toHaveBeenCalled();
  });

  it('links the OAuth account to the application user', async () => {
    const h = buildService();
    await h.service.loginWithOauth(oauthParams);
    expect(h.oauthService.linkAccount).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'google', providerAccountId: 'google-1' }),
    );
  });
});

describe('AuthService.loginWithOauth with Supabase auth disabled', () => {
  it('keeps issuing first-party tokens', async () => {
    const h = buildService({ supabaseEnabled: false });
    const result: any = await h.service.loginWithOauth(oauthParams);
    expect(result.provider).toBe('local');
    expect(result.accessToken).toBe('local-access');
    expect(h.supabaseAuth.mintSessionForVerifiedEmail).not.toHaveBeenCalled();
  });
});

const profile = { email: SESSION.email, emailVerified: true, name: 'Learner', providerAccountId: 'google-1' };
const RESULT = { accessToken: SESSION.accessToken, refreshToken: SESSION.refreshToken, user: { id: 'app-user-1' }, twoFactorRequired: false };

function buildController(result: Record<string, unknown>) {
  const calls = { setCookie: [] as any[], redirect: [] as any[], send: [] as any[] };
  const reply = {
    setCookie: (name: string, value: string, opts: unknown) => calls.setCookie.push({ name, value, opts }),
    status(code: number) {
      return {
        redirect(url: string) {
          calls.redirect.push({ code, url });
          return reply;
        },
      };
    },
    redirect(url: string) {
      calls.redirect.push({ code: 302, url });
      return reply;
    },
    send(payload: unknown) {
      calls.send.push(payload);
      return reply;
    },
  };

  const stateRow = { id: 'state-1', tenantId: 'tenant-1', redirectTo: null, expiresAt: new Date(Date.now() + 60_000) };
  const drizzle = {
    db: {
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [stateRow] }) }) }),
      delete: () => ({ where: async () => undefined }),
    },
  };

  const controller = new AuthController(
    { loginWithOauth: vi.fn(async () => result) } as never,
    {} as never, {} as never, {} as never, {} as never,
    drizzle as never, {} as never,
    {
      setAuthCookies: vi.fn((_r: any, a: string, t: string) => calls.setCookie.push({ name: 'cookies', value: a, opts: t })),
      setPending2faCookie: vi.fn((_r: any, token: string) => calls.setCookie.push({ name: 'pending-2fa', value: token })),
    } as never,
    { get: () => 'https://barootcnc.com' } as never,
    { enabled: true } as never,
    { log: vi.fn(async () => undefined) } as never,
  );

  return { controller, calls, reply };
}

// `user` is what AuthGuard('google') leaves on the request.
const req = (accept = 'text/html') => ({
  query: {},
  headers: { accept, 'user-agent': 'vitest' },
  ip: '127.0.0.1',
  tenant: { id: 'tenant-1' },
  user: profile,
});


describe('OAuth callback responses', () => {
  beforeAll(() => {
    // finishOauth reads the browser-facing origin from the environment.
    process.env.FRONTEND_URL = 'https://barootcnc.com';
  });

  it('sends exactly one response and sets the session cookies', async () => {
    const h = buildController(RESULT);
    await h.controller.googleAuthCallback(req(), 'a'.repeat(32), h.reply);
    // Reply was already sent: Nest answered the passthrough reply after the handler
    // had already redirected.
    expect(h.calls.redirect).toHaveLength(1);
    expect(h.calls.send).toHaveLength(0);
    expect(h.calls.redirect[0].url).toContain('https://barootcnc.com/auth/callback?provider=google');
    expect(h.calls.setCookie).toEqual([
      expect.objectContaining({ name: 'cookies', value: SESSION.accessToken }),
    ]);
  });

  it('returns the JSON body for non-browser clients', async () => {
    const h = buildController(RESULT);
    await h.controller.googleAuthCallback(req('application/json'), 'a'.repeat(32), h.reply);
    expect(h.calls.redirect).toHaveLength(0);
    expect(h.calls.send).toEqual([RESULT]);
  });

  it('refuses an unverified provider email before provisioning anything', async () => {
    const h = buildController(RESULT);
    const auth: any = (h.controller as any).auth;
    // An unverified mailbox must not become a credential-authority identity.
    await expect(
      (h.controller as any).finishOauth(req(), h.reply, 'google', 'a'.repeat(32), { ...profile, emailVerified: false }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(auth.loginWithOauth).not.toHaveBeenCalled();
    expect(h.calls.setCookie).toHaveLength(0);
    expect(h.calls.redirect).toHaveLength(0);
  });

  it('rejects a callback with no consumed state', async () => {
    const h = buildController(RESULT);
    await expect(
      (h.controller as any).finishOauth(req(), h.reply, 'google', undefined, profile),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(h.calls.setCookie).toHaveLength(0);
  });

  it('issues only the pending marker when a second factor is required', async () => {
    const h = buildController({ user: { id: 'app-user-1' }, twoFactorRequired: true });
    await h.controller.googleAuthCallback(req(), 'a'.repeat(32), h.reply);
    expect(h.calls.setCookie.map((c: any) => c.name)).toEqual(['pending-2fa']);
    expect(h.calls.redirect[0].url).toContain('/2fa/verify');
  });
});

/**
 * `POST /auth/login` in Supabase mode proved the password and then handed over cookies
 * without ever looking at `twoFactorEnabled`, so an account with 2FA enabled signed in
 * with the password alone.
 */
describe('Supabase password login and the second factor', () => {
  function buildLoginController(opts: { twoFactorEnabled: boolean }) {
    const calls = { setAuthCookies: [] as any[], pending: [] as any[], signOut: [] as string[] };
    const reply = {
      setCookie: (name: string) => calls.pending.push(name),
      status: () => ({ redirect: () => reply }),
      send: (payload: unknown) => payload,
    };
    const supabaseAuth = {
      enabled: true,
      signInWithPassword: vi.fn(async () => ({ ...SESSION })),
      signOut: vi.fn(async (token: string) => {
        calls.signOut.push(token);
      }),
    };
    const controller = new AuthController(
      {
        getProfile: vi.fn(async (id: string) => ({ id, email: SESSION.email, role: 'learner' })),
      } as never,
      {} as never, {} as never, {} as never, {} as never,
      {
        db: {
          query: {
            users: { findFirst: async () => ({ id: 'app-user-1', email: SESSION.email, tenantId: 'tenant-1', role: 'learner', authUserId: SESSION.userId, twoFactorEnabled: opts.twoFactorEnabled }) },
            tenants: { findFirst: async () => ({ id: 'tenant-1', slug: 'cnc-fundamentals' }) },
          },
        },
      } as never,
      {} as never,
      {
        setAuthCookies: vi.fn((_r: any, a: string, t: string) => calls.setAuthCookies.push({ access: a, refresh: t })),
        setPending2faCookie: vi.fn((_r: any, token: string) => calls.pending.push(token)),
      } as never,
      { get: () => undefined } as never,
      supabaseAuth as never,
      { log: vi.fn(async () => undefined) } as never,
    );
    return { controller, calls, reply };
  }

  const req = { query: {}, headers: {}, ip: '127.0.0.1', tenant: { id: 'tenant-1', slug: 'cnc-fundamentals' } };

  it('issues the pending marker instead of a session, and revokes the one it just made', async () => {
    const h = buildLoginController({ twoFactorEnabled: true });
    const res: any = await h.controller.login({ email: SESSION.email, password: 'pw' }, req, h.reply);
    expect(res.twoFactorRequired).toBe(true);
    expect(h.calls.setAuthCookies).toHaveLength(0);
    expect(h.calls.pending).toHaveLength(1);
    // The refused login must not leave usable credentials behind.
    expect(h.calls.signOut).toEqual([SESSION.refreshToken]);
  });

  it('signs in normally when no second factor is enabled', async () => {
    const h = buildLoginController({ twoFactorEnabled: false });
    const res: any = await h.controller.login({ email: SESSION.email, password: 'pw' }, req, h.reply);
    expect(res).toMatchObject({ twoFactorRequired: false, provider: 'supabase' });
    expect(res.user).toEqual({ id: 'app-user-1', email: SESSION.email, role: 'learner' });
    expect(h.calls.setAuthCookies).toEqual([
      { access: SESSION.accessToken, refresh: SESSION.refreshToken },
    ]);
    expect(h.calls.signOut).toHaveLength(0);
  });
});
