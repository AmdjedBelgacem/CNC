import 'reflect-metadata';
import { createHmac, generateKeyPairSync, sign as cryptoSign } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { HttpException, UnauthorizedException } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AuthController } from '../src/modules/auth/auth.controller';
import { SupabaseAuthGuard } from '../src/modules/auth/guards/supabase-auth.guard';
import { SupabaseTokenVerifier } from '../src/modules/auth/supabase-token.verifier';
import { UpdatePreferencesDto, UpdateProfileDto } from '../src/modules/auth/dto/profile.dto';
import { UserPreferencesService } from '../src/modules/auth/services/user-preferences.service';
import {
  TWO_FACTOR_MAX_FAILURES,
  TwoFactorAttemptsService,
} from '../src/modules/auth/services/two-factor-attempts.service';
import { safeRedirectPath } from '../src/modules/auth/safe-redirect';
import { assertAccountUsable } from '../src/modules/auth/account-status';

/* ------------------------------------------------------------------ helpers */

type Deps = Partial<{
  auth: any; totp: any; userPreferences: any; drizzle: any; cookie: any; supabase: any; attempts: any;
}>;

function controller(d: Deps = {}) {
  return new AuthController(
    d.auth ?? ({} as never),
    d.totp ?? ({} as never),
    {} as never,
    d.userPreferences ?? ({} as never),
    {} as never,
    d.drizzle ?? ({} as never),
    {} as never,
    d.cookie ??
      ({
        setAuthCookies: vi.fn(),
        clearAuthCookies: vi.fn(),
        clearPending2faCookie: vi.fn(),
        setPending2faCookie: vi.fn(),
        isRememberedSession: () => false,
      } as never),
    { get: () => undefined } as never,
    d.supabase ?? ({ enabled: false } as never),
    { log: vi.fn(async () => undefined) } as never,
    d.attempts,
  );
}

const errorsFor = async <T extends object>(cls: new () => T, plain: object) =>
  (await validate(plainToInstance(cls, plain), { whitelist: true, forbidNonWhitelisted: true })).map((e) => e.property);

const pendingCookie = (userId: string, expires = Date.now() + 60_000) => {
  const payload = `${userId}.${expires}`;
  const sig = createHmac('sha256', process.env.AUTH_SECRET || 'cookie-secret-change-me').update(payload).digest('hex');
  return `${Buffer.from(payload).toString('base64url')}.${sig}`;
};

/* ------------------------------------------------------------------ 1. oauth/link */

describe('POST /auth/oauth/link is gone', () => {
  it('has no handler or route', () => {
    expect((AuthController.prototype as any).linkOAuth).toBeUndefined();
    const paths = Object.getOwnPropertyNames(AuthController.prototype)
      .map((name) => Reflect.getMetadata(PATH_METADATA, (AuthController.prototype as any)[name]))
      .filter(Boolean);
    expect(paths).toContain('oauth/unlink');
    expect(paths).not.toContain('oauth/link');
  });
});

/* ------------------------------------------------------------------ 2. 2FA brute force */

describe('second-factor brute force', () => {
  it.each(['verify2fa', 'enable2fa', 'disable2fa', 'verifyPassword'])('%s is throttled to 5 per 5 minutes', (name) => {
    const handler = (AuthController.prototype as any)[name];
    expect(Reflect.getMetadata('THROTTLER:LIMITdefault', handler)).toBe(5);
    expect(Reflect.getMetadata('THROTTLER:TTLdefault', handler)).toBe(300_000);
  });

  it('locks an account after 10 wrong codes and clears on success (in-process fallback)', async () => {
    const attempts = new TwoFactorAttemptsService(undefined);
    for (let i = 0; i < TWO_FACTOR_MAX_FAILURES - 1; i++) await attempts.recordFailure('u1');
    await expect(attempts.assertNotLocked('u1')).resolves.toBeUndefined();
    await attempts.recordFailure('u1');
    await expect(attempts.assertNotLocked('u1')).rejects.toMatchObject({ status: 429 });
    // Other accounts are unaffected.
    await expect(attempts.assertNotLocked('u2')).resolves.toBeUndefined();
    await attempts.reset('u1');
    await expect(attempts.assertNotLocked('u1')).resolves.toBeUndefined();
  });

  it('uses Redis when available, setting a 15-minute expiry', async () => {
    const store = new Map<string, number>();
    const expire = vi.fn(async () => 1);
    const client = {
      get: async (k: string) => (store.has(k) ? String(store.get(k)) : null),
      incr: async (k: string) => {
        store.set(k, (store.get(k) ?? 0) + 1);
        return store.get(k)!;
      },
      expire,
      del: async (k: string) => store.delete(k),
    };
    const attempts = new TwoFactorAttemptsService({ client } as never);
    for (let i = 0; i < TWO_FACTOR_MAX_FAILURES; i++) await attempts.recordFailure('u1');
    expect(expire).toHaveBeenCalledWith('2fa_fail:u1', 900);
    await expect(attempts.assertNotLocked('u1')).rejects.toBeInstanceOf(HttpException);
  });

  function verifyHarness(opts: { totpValid: boolean; backupValid?: boolean; locked?: boolean }) {
    const attempts = {
      assertNotLocked: vi.fn(async () => {
        if (opts.locked) throw new HttpException('locked', 429);
      }),
      recordFailure: vi.fn(async () => 1),
      reset: vi.fn(async () => undefined),
    };
    const totp = {
      getSecret: vi.fn(async () => 'SECRET'),
      verifyToken: vi.fn(() => opts.totpValid),
      verifyBackupCode: vi.fn(async () => opts.backupValid ?? false),
    };
    const auth = {
      issueSessionForUserId: vi.fn(async () => ({ accessToken: 'a', refreshToken: 'r', provider: 'local' })),
      getProfile: vi.fn(async (id: string) => ({ id })),
      audit: { log: vi.fn(async () => undefined) },
    };
    const drizzle = { db: { query: { users: { findFirst: async () => ({ id: 'u1', accountStatus: 'active' }) } } } };
    const c = controller({ attempts, totp, auth, drizzle });
    return { c, attempts, totp, auth };
  }

  const req = (cookie: string) => ({ cookies: { 'pending-2fa': cookie }, headers: {}, ip: '1.2.3.4' });

  it('refuses a locked account before checking the code', async () => {
    const h = verifyHarness({ totpValid: true, locked: true });
    await expect(h.c.verify2fa({ userId: 'u1', token: '123456' }, req(pendingCookie('u1')), {})).rejects.toMatchObject({ status: 429 });
    expect(h.totp.verifyToken).not.toHaveBeenCalled();
  });

  it('counts a wrong code and resets the count after a right one', async () => {
    const bad = verifyHarness({ totpValid: false });
    await expect(bad.c.verify2fa({ userId: 'u1', token: '000000' }, req(pendingCookie('u1')), {})).rejects.toBeInstanceOf(UnauthorizedException);
    expect(bad.attempts.recordFailure).toHaveBeenCalledWith('u1');

    const good = verifyHarness({ totpValid: true });
    const result = await good.c.verify2fa({ userId: 'u1', token: '123456' }, req(pendingCookie('u1')), {});
    expect(result).toEqual({ verified: true, user: { id: 'u1' } });
    expect(good.attempts.reset).toHaveBeenCalledWith('u1');
    expect(JSON.stringify(result)).not.toContain('accessToken');
  });

  it('rejects a forged or truncated pending-2FA signature', async () => {
    const h = verifyHarness({ totpValid: true });
    const valid = pendingCookie('u1');
    const truncated = valid.slice(0, -2);
    const flipped = valid.slice(0, -1) + (valid.endsWith('0') ? '1' : '0');
    for (const cookie of [truncated, flipped]) {
      await expect(h.c.verify2fa({ userId: 'u1', token: '123456' }, req(cookie), {})).rejects.toThrow(/Invalid login session/);
    }
    expect(h.totp.getSecret).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ 3/4. token bodies */

describe('tokens are cookies only', () => {
  it('first-party login sets cookies and keeps tokens out of the body', async () => {
    const cookie = { setAuthCookies: vi.fn() };
    const auth = {
      login: vi.fn(async () => ({ accessToken: 'A', refreshToken: 'R', user: { id: 'u1' }, twoFactorRequired: false })),
    };
    const c = controller({ auth, cookie });
    (c as any).resolveTenant = async () => ({ id: 't1', slug: 's' });
    const result: any = await c.login({ email: 'a@b.co', password: 'x' } as never, { headers: {}, ip: '1' }, {});
    expect(cookie.setAuthCookies).toHaveBeenCalledWith({}, 'A', 'R', false);
    expect(result).toEqual({ user: { id: 'u1' }, twoFactorRequired: false });
  });

  it('first-party refresh rotates cookies and returns only the user', async () => {
    const cookie = { setAuthCookies: vi.fn() };
    const auth = {
      refreshAccessToken: vi.fn(async () => ({ accessToken: 'A', refreshToken: 'R', remember: true, user: { id: 'u1' } })),
    };
    const c = controller({ auth, cookie });
    const result = await c.refresh({}, { cookies: { 'refresh-token': 'old' }, headers: {} }, {});
    expect(cookie.setAuthCookies).toHaveBeenCalledWith({}, 'A', 'R', true);
    expect(result).toEqual({ user: { id: 'u1' } });
  });

  function supabaseRefresh(user: Record<string, unknown> | undefined) {
    const cookie = { setAuthCookies: vi.fn(), clearAuthCookies: vi.fn(), isRememberedSession: () => false };
    const supabase = {
      enabled: true,
      refreshSession: vi.fn(async () => ({ accessToken: 'SA', refreshToken: 'SR', userId: 'auth-1' })),
      signOut: vi.fn(async () => undefined),
    };
    const auth = { getProfile: vi.fn(async (id: string) => ({ id, safe: true })) };
    const drizzle = { db: { query: { users: { findFirst: async () => user } } } };
    return { c: controller({ cookie, supabase, auth, drizzle }), cookie, supabase, auth };
  }

  it('Supabase refresh returns the sanitized profile, not the raw users row', async () => {
    const h = supabaseRefresh({ id: 'u1', accountStatus: 'active', passwordHash: 'hash', lastLoginIp: '9.9.9.9' });
    const result: any = await h.c.refresh({}, { cookies: { 'refresh-token': 'old' }, headers: {} }, {});
    expect(result).toEqual({ user: { id: 'u1', safe: true }, provider: 'supabase' });
    expect(h.cookie.setAuthCookies).toHaveBeenCalled();
  });

  it('Supabase refresh returns null when no account is linked', async () => {
    const h = supabaseRefresh(undefined);
    expect(await h.c.refresh({}, { cookies: { 'refresh-token': 'old' }, headers: {} }, {})).toEqual({ user: null, provider: 'supabase' });
  });

  it('Supabase refresh does not renew a suspended account', async () => {
    const h = supabaseRefresh({ id: 'u1', accountStatus: 'suspended' });
    await expect(h.c.refresh({}, { cookies: { 'refresh-token': 'old' }, headers: {} }, {})).rejects.toBeInstanceOf(UnauthorizedException);
    expect(h.cookie.setAuthCookies).not.toHaveBeenCalled();
    expect(h.supabase.signOut).toHaveBeenCalledWith('SR');
  });
});

/* ------------------------------------------------------------------ 5. DTOs */

describe('preferences and profile bodies', () => {
  it('rejects userId and other unknown keys on preferences', async () => {
    expect(await errorsFor(UpdatePreferencesDto, { userId: 'victim', theme: 'dark' })).toEqual(['userId']);
  });

  it('accepts what the settings pages send', async () => {
    expect(await errorsFor(UpdatePreferencesDto, { theme: 'dark', density: 'compact' })).toEqual([]);
    expect(await errorsFor(UpdatePreferencesDto, { profileVisibility: 'followers', whoCanMessage: 'none', whoCanFollow: 'approval' })).toEqual([]);
    expect(await errorsFor(UpdatePreferencesDto, { inAppNotifications: { social: true }, emailNotifications: { security: false } })).toEqual([]);
    expect(await errorsFor(UpdatePreferencesDto, { themeTokens: null })).toEqual([]);
  });

  it('rejects values outside the enums, non-boolean maps and invalid theme tokens', async () => {
    expect(await errorsFor(UpdatePreferencesDto, { theme: 'hacker' })).toEqual(['theme']);
    expect(await errorsFor(UpdatePreferencesDto, { whoCanMessage: 'anyone' })).toEqual(['whoCanMessage']);
    expect(await errorsFor(UpdatePreferencesDto, { emailNotifications: { social: 'yes' } })).toEqual(['emailNotifications']);
    expect(await errorsFor(UpdatePreferencesDto, { themeTokens: { light: {} } })).toEqual(['themeTokens']);
  });

  it('the service never writes a userId from the body', async () => {
    const inserted: any[] = [];
    const drizzle = {
      db: {
        query: { userPreferences: { findFirst: async () => undefined } },
        insert: () => ({ values: (v: any) => ({ returning: async () => { inserted.push(v); return [v]; } }) }),
      },
    };
    const service = new UserPreferencesService(drizzle as never);
    await service.update('caller', { theme: 'dark', userId: 'victim', id: 'x' } as never);
    expect(inserted).toEqual([{ theme: 'dark', userId: 'caller' }]);
  });

  it('profile accepts the form fields and drops nothing it needs', async () => {
    expect(await errorsFor(UpdateProfileDto, { name: 'A', username: 'john.doe-2', headline: 'h', bio: 'b', location: 'l' })).toEqual([]);
    expect(await errorsFor(UpdateProfileDto, { name: 'A', username: 'a_b', language: 'ar', timezone: 'America/New_York' })).toEqual([]);
    // An account with no username sends '' back; that means "unchanged".
    const dto = plainToInstance(UpdateProfileDto, { username: '' });
    expect(dto.username).toBeUndefined();
  });

  it('profile rejects avatar/cover URLs and malformed usernames', async () => {
    expect(await errorsFor(UpdateProfileDto, { avatarUrl: 'https://evil.example/x.png' })).toEqual(['avatarUrl']);
    expect(await errorsFor(UpdateProfileDto, { coverImageUrl: 'javascript:alert(1)' })).toEqual(['coverImageUrl']);
    expect(await errorsFor(UpdateProfileDto, { username: 'Bad Name' })).toEqual(['username']);
    expect(await errorsFor(UpdateProfileDto, { headline: 'x'.repeat(201) })).toEqual(['headline']);
  });

  it('PATCH /auth/me forwards only the profile fields', async () => {
    const auth = { updateProfile: vi.fn(async () => ({})) };
    const c = controller({ auth });
    await c.updateProfile({ id: 'u1' }, { name: 'A', avatarUrl: 'https://evil' } as never);
    const sent = auth.updateProfile.mock.calls[0]![1] as Record<string, unknown>;
    expect(sent.name).toBe('A');
    expect('avatarUrl' in sent).toBe(false);
  });
});

/* ------------------------------------------------------------------ 6. suspension in Supabase mode */

describe('account status in Supabase mode', () => {
  it('assertAccountUsable mirrors JwtStrategy', () => {
    for (const accountStatus of ['deleted', 'suspended', 'pending_verification', 'locked']) {
      expect(() => assertAccountUsable({ accountStatus })).toThrow(UnauthorizedException);
    }
    expect(() => assertAccountUsable({ accountStatus: 'active' })).not.toThrow();
    expect(() => assertAccountUsable({ accountStatus: 'pending' })).not.toThrow();
    // An expired lock is not a lock: nothing clears it in Supabase mode.
    expect(() => assertAccountUsable({ accountStatus: 'locked', lockedUntil: new Date(Date.now() - 1000) })).not.toThrow();
    expect(() => assertAccountUsable({ accountStatus: 'locked', lockedUntil: new Date(Date.now() + 60_000) })).toThrow();
  });

  it('the guard refuses a suspended account', async () => {
    const guard = new SupabaseAuthGuard(
      { enabled: true, verify: async () => ({ sub: 'auth-1' }) } as never,
      { db: { query: { users: { findFirst: async () => ({ id: 'u1', accountStatus: 'suspended' }) } } } } as never,
      { resolvePermissions: async () => [] } as never,
    );
    const context = { switchToHttp: () => ({ getRequest: () => ({ headers: { authorization: 'Bearer t' } }) }) } as never;
    await expect(guard.canActivate(context)).rejects.toThrow(/not accessible/);
  });

  function supabaseLogin(accountStatus: string) {
    const cookie = { setAuthCookies: vi.fn() };
    const supabase = {
      enabled: true,
      signInWithPassword: vi.fn(async () => ({ accessToken: 'SA', refreshToken: 'SR', userId: 'auth-1' })),
      signOut: vi.fn(async () => undefined),
    };
    const drizzle = {
      db: {
        query: { users: { findFirst: async () => ({ id: 'u1', authUserId: 'auth-1', accountStatus, twoFactorEnabled: false }) } },
        insert: () => ({ values: () => ({ catch: async () => undefined }) }),
      },
    };
    const auth = { getProfile: vi.fn(async (id: string) => ({ id })) };
    const c = controller({ cookie, supabase, drizzle, auth });
    (c as any).resolveTenant = async () => ({ id: 't1', slug: 's' });
    return { c, cookie, supabase };
  }

  it('Supabase password login refuses a suspended account and revokes the new session', async () => {
    const h = supabaseLogin('suspended');
    await expect(h.c.login({ email: 'a@b.co', password: 'x' } as never, { headers: {}, ip: '1' }, {})).rejects.toBeInstanceOf(UnauthorizedException);
    expect(h.cookie.setAuthCookies).not.toHaveBeenCalled();
    expect(h.supabase.signOut).toHaveBeenCalledWith('SR');
  });

  it('Supabase password login keeps the verification message the login form recognises', async () => {
    const h = supabaseLogin('pending_verification');
    await expect(h.c.login({ email: 'a@b.co', password: 'x' } as never, { headers: {}, ip: '1' }, {})).rejects.toThrow(
      'Please verify your email address before logging in.',
    );
  });

  it('Supabase password login still works for an active account', async () => {
    const h = supabaseLogin('active');
    const result: any = await h.c.login({ email: 'a@b.co', password: 'x' } as never, { headers: {}, ip: '1' }, {});
    expect(result.user).toEqual({ id: 'u1' });
    expect(h.cookie.setAuthCookies).toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ 7. verifier claims */

describe('Supabase token claims', () => {
  const SECRET = 'super-secret-jwt-value-with-enough-entropy';
  const verifier = (over: Record<string, unknown> = {}) =>
    new SupabaseTokenVerifier({ get: (k: string) => ({ SUPABASE_JWT_SECRET: SECRET, ...over })[k] } as never);
  const sign = (claims: Record<string, unknown>) => {
    const h = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const p = Buffer.from(JSON.stringify(claims)).toString('base64url');
    return `${h}.${p}.${createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url')}`;
  };
  const exp = () => Math.floor(Date.now() / 1000) + 3600;

  it('requires exp', async () => {
    await expect(verifier().verify(sign({ sub: 'u', aud: 'authenticated' }))).rejects.toThrow(/expiry/);
  });

  it('requires aud "authenticated"', async () => {
    await expect(verifier().verify(sign({ sub: 'u', exp: exp() }))).rejects.toThrow(/audience/);
    await expect(verifier().verify(sign({ sub: 'u', exp: exp(), aud: 'anon' }))).rejects.toThrow(/audience/);
    await expect(verifier().verify(sign({ sub: 'u', exp: exp(), aud: ['authenticated'] }))).resolves.toMatchObject({ sub: 'u' });
  });

  it('checks iss against SUPABASE_URL when it is configured', async () => {
    const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const v = new SupabaseTokenVerifier({
      get: (k: string) => ({ SUPABASE_URL: 'https://proj.supabase.co/' })[k],
    } as never);
    (v as any).jwksCache = {
      keys: [{ ...(publicKey.export({ format: 'jwk' }) as object), kid: 'k1', alg: 'ES256', use: 'sig' }],
      fetchedAt: Date.now(),
    };
    const signEs = (claims: Record<string, unknown>) => {
      const h = Buffer.from(JSON.stringify({ alg: 'ES256', typ: 'JWT', kid: 'k1' })).toString('base64url');
      const p = Buffer.from(JSON.stringify(claims)).toString('base64url');
      const sig = cryptoSign('sha256', Buffer.from(`${h}.${p}`), { key: privateKey, dsaEncoding: 'ieee-p1363' });
      return `${h}.${p}.${sig.toString('base64url')}`;
    };
    const base = { sub: 'u', exp: exp(), aud: 'authenticated' };
    await expect(v.verify(signEs({ ...base, iss: 'https://proj.supabase.co/auth/v1' }))).resolves.toMatchObject({ sub: 'u' });
    await expect(v.verify(signEs({ ...base, iss: 'https://other.supabase.co/auth/v1' }))).rejects.toThrow(/issuer/);
    await expect(v.verify(signEs(base))).rejects.toThrow(/issuer/);
  });
});

/* ------------------------------------------------------------------ 8. redirects */

describe('post-sign-in redirects stay on this site', () => {
  it.each([
    ['/courses/abc?x=1#y', '/courses/abc?x=1#y'],
    ['/', '/'],
    ['//evil.com', null],
    ['/\\evil.com', null],
    ['https://evil.com', null],
    ['javascript:alert(1)', null],
    ['evil.com', null],
    ['/%2F%2Fevil.com', null],
    ['/a\nb', null],
    ['', null],
    [undefined, null],
    [42, null],
  ])('%j -> %j', (input, expected) => {
    expect(safeRedirectPath(input)).toBe(expected);
  });

  it('the OAuth state stores only a safe path', async () => {
    const values: any[] = [];
    const drizzle = { db: { insert: () => ({ values: async (v: any) => values.push(v) }) } };
    const c = controller({ drizzle });
    (c as any).resolveTenant = async () => ({ id: 't1', slug: 's' });
    await c.getOauthState({ query: { redirectTo: 'https://evil.com' } });
    await c.getOauthState({ query: { redirectTo: '/learn' } });
    expect(values.map((v) => v.redirectTo)).toEqual([null, '/learn']);
  });

  it('the OAuth callback drops an unsafe stored redirect', async () => {
    process.env.FRONTEND_URL = 'https://app.example';
    const redirects: string[] = [];
    const reply = { status: () => ({ redirect: (u: string) => redirects.push(u) }) };
    const stateRow = { id: 's', tenantId: 't1', redirectTo: '//evil.com', expiresAt: new Date(Date.now() + 60_000) };
    const drizzle = {
      db: {
        select: () => ({ from: () => ({ where: () => ({ limit: async () => [stateRow] }) }) }),
        delete: () => ({ where: async () => undefined }),
      },
    };
    const auth = { loginWithOauth: vi.fn(async () => ({ accessToken: 'a', refreshToken: 'r', user: { id: 'u' }, twoFactorRequired: false })) };
    const c = controller({ drizzle, auth });
    await (c as any).finishOauth(
      { query: {}, headers: { accept: 'text/html' }, tenant: { id: 't1' } },
      reply,
      'google',
      'a'.repeat(32),
      { email: 'a@b.co', emailVerified: true, providerAccountId: 'g1' },
    );
    expect(redirects).toHaveLength(1);
    expect(redirects[0]).not.toContain('returnTo');
    expect(redirects[0]).not.toContain('evil');
  });
});
