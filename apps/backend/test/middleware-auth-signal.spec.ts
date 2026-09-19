import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Regression cover for the /login bounce on an expired access token.
 *
 * The Next middleware guards /admin, /account, /cart and /checkout, and it used to
 * decide purely on the presence of the ACCESS cookie:
 *
 *     const isAuthenticated = !!request.cookies.get('access-token')?.value;
 *     if (isProtected && !isAuthenticated) return NextResponse.redirect('/login');
 *
 * That cookie lives 15 minutes (`cookie.service.ts`) and the browser deletes it on
 * expiry, while the refresh cookie is good for 7 days. So every live session was
 * hard-bounced to /login the moment the access token aged out — server-side, before any
 * client code ran, which meant the rotation that would have fixed it never got a chance.
 * The user was signed in the whole time.
 *
 * The fix treats either cookie as "this session may still be valid" and lets the client
 * settle it (rotate on 401; the admin gate still redirects once hydration confirms there
 * is no session).
 *
 * These are static assertions because the middleware lives in the Next app, which has no
 * test runner of its own.
 */
describe('middleware session signal', () => {
  const src = readFileSync(resolve(__dirname, '../../frontend/src/middleware.ts'), 'utf8');

  it('consults the refresh cookie, not just the access cookie', () => {
    expect(src).toMatch(/request\.cookies\.get\('refresh-token'\)/);
    expect(src).toMatch(/request\.cookies\.get\('__Host-refresh'\)/);
  });

  it('no longer redirects on the access cookie alone', () => {
    // The exact shape that caused the bounce.
    expect(src).not.toMatch(/if \(isProtected && !isAuthenticated\)/);
    expect(src).not.toMatch(/const isAuthenticated = !!authCookie\?\.value/);
  });

  it('redirects only when neither cookie is present', () => {
    expect(src).toMatch(/if \(isProtected && !mayHaveSession\)/);
    expect(src).toMatch(/const mayHaveSession = !!\(accessCookie\?\.value \|\| refreshCookie\?\.value\)/);
  });

  it('still protects the same routes', () => {
    expect(src).toMatch(/const PROTECTED_ROUTES = \['\/account', '\/checkout', '\/cart', '\/admin'\]/);
  });
});

/**
 * The same bug had a second home. The admin layout runs a server-side "fast path" that
 * redirected with `returnUrl=/admin` — and unlike the middleware it fires during the
 * server render, so there is no chance for client code to intervene at all. Both sites
 * must key the redirect on "no session cookie at all", never on the access cookie alone.
 */
describe('admin layout server-side fast path', () => {
  const src = readFileSync(resolve(__dirname, '../../frontend/src/app/(admin)/admin/layout.tsx'), 'utf8');

  it('considers the refresh cookie before redirecting', () => {
    expect(src).toMatch(/store\.get\('refresh-token'\)\?\.value/);
    expect(src).toMatch(/store\.get\('__Host-refresh'\)\?\.value/);
  });

  it('redirects only when neither cookie is present', () => {
    expect(src).toMatch(/if \(!accessToken && !refreshToken\) redirect\('\/login\?returnUrl=\/admin'\)/);
    // The shape that caused the bounce.
    expect(src).not.toMatch(/if \(!token\) redirect\('\/login\?returnUrl=\/admin'\)/);
  });

  it('still delegates real role verification to AdminGate', () => {
    expect(src).toMatch(/<AdminGate>/);
  });
});
