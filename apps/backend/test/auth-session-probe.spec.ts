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

  it('is what the client probes, not /auth/me', () => {
    const hydration = readFileSync(
      resolve(__dirname, '../../frontend/src/components/auth/auth-hydration.tsx'),
      'utf8',
    );
    expect(hydration).toMatch(/\/auth\/session/);
    expect(hydration).not.toMatch(/api\.get<[^>]*>\('\/auth\/me'\)/);
  });
});
