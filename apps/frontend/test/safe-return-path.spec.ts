import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { safeReturnPath } from '../src/lib/safe-return-path';

/**
 * `?returnUrl=` on /login and `?returnTo=` on /auth/callback were passed straight to
 * `router.push`/`router.replace`, so `/login?returnUrl=https://evil.example` sent a user
 * who had just signed in to another site. Only same-origin paths are honoured now.
 */
describe('safeReturnPath', () => {
  it.each([
    ['/courses/abc?tab=1#top', '/courses/abc?tab=1#top'],
    ['/', '/'],
    ['/admin', '/admin'],
  ])('keeps the same-origin path %j', (input, expected) => {
    expect(safeReturnPath(input)).toBe(expected);
  });

  it.each([
    'https://evil.example',
    'http://evil.example/path',
    '//evil.example',
    '/\\evil.example',
    '\\\\evil.example',
    'javascript:alert(1)',
    'data:text/html,hi',
    'evil.example',
    '/%2F%2Fevil.example',
    '/%5Cevil.example',
    '/a\nb',
    '/\tfoo',
    '',
    null,
    undefined,
  ])('falls back for %j', (input) => {
    expect(safeReturnPath(input)).toBe('/');
    expect(safeReturnPath(input, '/dashboard')).toBe('/dashboard');
  });

  it('is what both sign-in pages use for their return parameter', () => {
    const root = join(__dirname, '../src/app/(auth)');
    const login = readFileSync(join(root, 'login/page.tsx'), 'utf8');
    const callback = readFileSync(join(root, 'auth/callback/page.tsx'), 'utf8');
    expect(login).toContain("safeReturnPath(searchParams.get('returnUrl'))");
    expect(callback).toContain("safeReturnPath(params.get('returnTo'))");
  });
});
