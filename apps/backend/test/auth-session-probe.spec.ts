import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The session probe is asked on every anonymous page load.
 *
 * It used to be `/auth/me`, which 401s when nobody is signed in. That produced a 401 in the
 * browser console and, because the API client answers a 401 by refreshing, a second doomed
 * request to `/auth/refresh` on every public page load. Lighthouse counts console errors under
 * Best Practices, so this shaped the score as well as the network.
 *
 * These assert the shape that keeps it clean: a 200 that answers the question, hosted on a
 * controller that does not inherit the JWT guard.
 */
const read = (p: string) => readFileSync(resolve(__dirname, '../src', p), 'utf8');
/** Strips comments so a guard named in prose is not mistaken for one applied in code. */
const code = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

describe('session probe answers without failing', () => {
  it('lives on its own controller, since Nest adds controller guards to method guards', () => {
    const controller = code('modules/auth/auth-session.controller.ts');
    // `@UseGuards(JwtAuthGuard, …)` on AuthController would still run alongside the optional
    // guard and 401 anyway, which is exactly what happened on the first attempt.
    expect(controller).toMatch(/@UseGuards\(OptionalAuthGuard\)/);
    expect(controller).not.toMatch(/JwtAuthGuard/);
    expect(controller).not.toMatch(/TenantGuard/);
  });

  it('reports unauthenticated as a 200, not a failure', () => {
    const controller = read('modules/auth/auth-session.controller.ts');
    expect(controller).toMatch(/@HttpCode\(HttpStatus\.OK\)/);
    expect(controller).toMatch(/authenticated: false/);
    expect(controller).toMatch(/authenticated: true/);
  });

  it('is registered, and /auth/me keeps its 401 for callers that need a subject', () => {
    const module = read('modules/auth/auth.module.ts');
    expect(module).toMatch(/AuthSessionController/);
    const authController = read('modules/auth/auth.controller.ts');
    expect(authController).not.toMatch(/@Get\('session'\)/);
  });

  it('tells the client when an expired session can be refreshed', () => {
    const controller = read('modules/auth/auth-session.controller.ts');
    expect(controller).toMatch(/refreshable/);
    // All three refresh cookie names the refresh endpoint accepts.
    for (const name of ['refresh-token', '__Host-refresh', '__refresh-fallback']) {
      expect(controller).toContain(name);
    }
  });

  it('hydrates from /auth/session, so an anonymous visitor makes no failing request', () => {
    const hydration = readFileSync(
      resolve(__dirname, '../../frontend/src/components/auth/auth-hydration.tsx'),
      'utf8',
    );
    expect(hydration).toMatch(/probeSession/);
    expect(hydration).not.toMatch(/'\/auth\/me'/);
    const probe = readFileSync(resolve(__dirname, '../../frontend/src/lib/session-probe.ts'), 'utf8');
    expect(probe).toMatch(/'\/auth\/session'/);
    // Rotates only when the server says there is something to rotate.
    // Rotates only when there is something to rotate, and a busy server is not a sign-out.
    expect(probe).toMatch(/if \(session\.refreshable\)/);
    expect(probe).toMatch(/refreshSessionOutcome\(\)/);
    expect(probe).toMatch(/outcome === 'unavailable'/);
  });

  it('does not try to refresh a session after a credential endpoint answers 401', () => {
    const client = readFileSync(resolve(__dirname, '../../frontend/src/lib/api-client.ts'), 'utf8');
    expect(client).toMatch(/isCredentialCall/);
    expect(client).toMatch(/res\.status === 401 && !_retry && !isCredentialCall/);
  });
});
