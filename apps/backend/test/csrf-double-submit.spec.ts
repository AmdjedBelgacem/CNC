import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CsrfGuard, CSRF_SKIP_KEY, CSRF_REQUIRE_KEY } from '../src/modules/auth/guards/csrf.guard';
import { CsrfService } from '../src/modules/auth/services/csrf.service';

/**
 * Regression cover for the double-submit CSRF contract.
 *
 * The guard is the authority: it rejects a request when the `csrf-token` cookie and
 * the `x-csrf-token` header disagree. A frontend proxy that mints its own header
 * value while forwarding the browser's pre-existing cookie therefore 403s every
 * mutation — which is precisely how the whole Course Studio (create / save / publish
 * / upload / reorder) was broken. These tests pin the guard side of that contract so
 * the proxy can be held to it.
 */

function ctx(req: any) {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as any;
}

function makeCsrf() {
  const svc = new CsrfService({ get: () => 'unit-test-auth-secret-at-least-16-chars' } as any);
  svc.onModuleInit();
  return svc;
}

function makeGuard(opts: { skip?: boolean; require?: boolean } = {}) {
  const csrf = makeCsrf();
  const reflector = {
    getAllAndOverride: (key: string) =>
      key === CSRF_SKIP_KEY ? !!opts.skip : key === CSRF_REQUIRE_KEY ? !!opts.require : undefined,
  } as any;
  return { guard: new CsrfGuard(reflector, csrf), csrf };
}

const AUTH_COOKIE = { cookies: { 'access-token': 'a.b.c' } };

describe('CSRF double-submit contract', () => {
  it('safe methods are never challenged', () => {
    const { guard } = makeGuard();
    expect(guard.canActivate(ctx({ method: 'GET', headers: {}, cookies: {} }))).toBe(true);
    expect(guard.canActivate(ctx({ method: 'HEAD', headers: {}, cookies: {} }))).toBe(true);
    expect(guard.canActivate(ctx({ method: 'OPTIONS', headers: {}, cookies: {} }))).toBe(true);
  });

  it('@SkipCsrf wins even when the pair is inconsistent', () => {
    const { guard } = makeGuard({ skip: true });
    const req = { method: 'POST', headers: { 'x-csrf-token': 'nope' }, ...AUTH_COOKIE };
    expect(guard.canActivate(ctx(req))).toBe(true);
  });

  it('anonymous mutation with nothing ambient is allowed', () => {
    const { guard } = makeGuard();
    expect(guard.canActivate(ctx({ method: 'POST', headers: {}, cookies: {} }))).toBe(true);
  });

  it('authenticated mutation with no csrf header → 403 "CSRF token missing"', () => {
    const { guard, csrf } = makeGuard();
    const req = {
      method: 'POST',
      headers: {},
      cookies: { 'access-token': 'a.b.c', 'csrf-token': csrf.generateToken() },
    };
    expect(() => guard.canActivate(ctx(req))).toThrow('CSRF token missing');
  });

  it('cookie and header disagreeing → 403 "CSRF token mismatch" (the Studio failure mode)', () => {
    const { guard, csrf } = makeGuard();
    const cookieToken = csrf.generateToken();
    const mintedElsewhere = csrf.generateToken();
    expect(cookieToken).not.toBe(mintedElsewhere);
    const req = {
      method: 'POST',
      headers: { 'x-csrf-token': mintedElsewhere },
      cookies: { 'access-token': 'a.b.c', 'csrf-token': cookieToken },
    };
    expect(() => guard.canActivate(ctx(req))).toThrow('CSRF token mismatch');
  });

  it('matching but forged signature → 403 "Invalid CSRF token"', () => {
    const { guard } = makeGuard();
    const req = {
      method: 'POST',
      headers: { 'x-csrf-token': 'forged.forged' },
      cookies: { 'access-token': 'a.b.c', 'csrf-token': 'forged.forged' },
    };
    expect(() => guard.canActivate(ctx(req))).toThrow('Invalid CSRF token');
  });

  it('matching, correctly signed pair → allowed', () => {
    const { guard, csrf } = makeGuard();
    const token = csrf.generateToken();
    const req = {
      method: 'POST',
      headers: { 'x-csrf-token': token },
      cookies: { 'access-token': 'a.b.c', 'csrf-token': token },
    };
    expect(guard.canActivate(ctx(req))).toBe(true);
  });

  it('Bearer-only client without an auth cookie stays exempt', () => {
    const { guard } = makeGuard();
    const req = { method: 'POST', headers: { authorization: 'Bearer x.y.z' }, cookies: {} };
    expect(guard.canActivate(ctx(req))).toBe(true);
  });

  it('Bearer is NOT exempt once an ambient auth cookie is also present', () => {
    const { guard } = makeGuard();
    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer x.y.z' },
      cookies: { 'access-token': 'a.b.c' },
    };
    expect(() => guard.canActivate(ctx(req))).toThrow('CSRF token missing');
  });

  it('a lone csrf cookie (no auth cookie, no header) still fails closed', () => {
    const { guard, csrf } = makeGuard();
    const req = {
      method: 'POST',
      headers: {},
      cookies: { 'csrf-token': csrf.generateToken() },
    };
    expect(() => guard.canActivate(ctx(req))).toThrow('CSRF token missing');
  });

  it('@RequireCsrf forces enforcement on an otherwise anonymous route', () => {
    const { guard } = makeGuard({ require: true });
    expect(() => guard.canActivate(ctx({ method: 'POST', headers: {}, cookies: {} }))).toThrow(
      'CSRF token missing',
    );
  });

  it('production access-cookie names are recognised', () => {
    const { guard, csrf } = makeGuard();
    const token = csrf.generateToken();
    const req = {
      method: 'POST',
      headers: { 'x-csrf-token': token },
      cookies: { '__Host-access': 'a.b.c', 'csrf-token': token },
    };
    expect(guard.canActivate(ctx(req))).toBe(true);
  });
});

/**
 * The proxy half of the contract lives in the Next.js app, which has no test runner
 * of its own. These static checks pin the two properties whose absence caused the
 * outage: a client-supplied token must be forwarded verbatim, and the cookie must
 * never be left disagreeing with an injected header.
 */
describe('Next.js proxy CSRF forwarding invariants', () => {
  const proxySource = readFileSync(
    resolve(__dirname, '../../frontend/src/app/api/proxy/[...path]/route.ts'),
    'utf8',
  );

  it('forwards a client-supplied token verbatim instead of overwriting it from the cookie', () => {
    // Guards against reintroducing "cookie wins over header", which turned the proxy
    // into a CSRF oracle by silently correcting a forged header.
    expect(proxySource).toMatch(/if \(clientToken\) return \{ token: clientToken, cookieHeader \}/);
  });

  it('never derives the header from the cookie when the client sent one', () => {
    expect(proxySource).not.toMatch(/cookieToken \|\| clientToken/);
  });

  it('pairs an injected token into the cookie so the two values cannot disagree', () => {
    expect(proxySource).toMatch(/withCsrfCookie\(cookieHeader, token\)/);
    // Exactly one csrf-token entry must survive, or the backend may read the stale one.
    expect(proxySource).toMatch(/!p\.startsWith\('csrf-token='\)/);
  });

  it('only replays on 403 when the token was self-minted', () => {
    expect(proxySource).toMatch(/if \(synthesizedCsrf && response\.status === 403\)/);
  });
});

/**
 * The browser half of the same contract. `/auth/refresh` is a POST, so it needs the
 * double-submit pair too — and the csrf cookie outlives the access token, which is
 * exactly the window a cold page load lands in.
 *
 * The bug these pin: the refresh call only sent `x-csrf-token` when the in-memory token
 * was already populated, which it never is on a fresh load. The request went out with a
 * cookie and no header, the guard rejected it 403, and the session read as signed out —
 * the /login bounce. The refresh cookie was valid the whole time.
 */
describe('api-client refresh CSRF invariants', () => {
  const clientSource = readFileSync(
    resolve(__dirname, '../../frontend/src/lib/api-client.ts'),
    'utf8',
  );

  it('resolves a CSRF token from memory, then the cookie, then the server', () => {
    expect(clientSource).toMatch(/async function csrfHeaderToken\(\)/);
    expect(clientSource).toMatch(/if \(csrfToken\) return csrfToken/);
    expect(clientSource).toMatch(/const fromCookie = readCsrfCookie\(\)/);
  });

  it('never POSTs a refresh without consulting the token resolver', () => {
    // The regression: `if (csrfToken) headers['x-csrf-token'] = csrfToken` — which is a
    // silent no-op on a cold load.
    expect(clientSource).not.toMatch(/if \(csrfToken\) headers\['x-csrf-token'\] = csrfToken/);
    expect(clientSource).toMatch(/await post\(await csrfHeaderToken\(\)\)/);
  });

  it('retries the refresh once with a fresh token on 403', () => {
    expect(clientSource).toMatch(/if \(res\.status === 403\) \{\s*await fetchCsrfToken\(\)/);
  });

  it('writes the csrf cookie as a single line with an explicit path', () => {
    // A multi-line template literal embeds raw newlines, and a cookie written without
    // an explicit path is scoped to the current directory — so other routes would not
    // send it and the double-submit pair would silently break.
    expect(clientSource).toMatch(/document\.cookie = `csrf-token=\$\{csrfToken\}; path=\/; SameSite=Lax`/);
  });
});
