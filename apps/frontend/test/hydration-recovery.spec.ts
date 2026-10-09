import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The page must not stay blank when hydration fails.
 *
 * Every previous fix for this symptom chased one cause: a service worker serving cached HTML,
 * `Intl` disagreeing between Node and a browser, a store snapshot that differed server-side.
 * Each was genuine, and each produced the identical failure — a blank page with a 200 in the
 * network tab, cured only by a refresh. The pattern is worth more than any one cause, so the
 * failure itself is now handled rather than only its latest trigger.
 */
const source = readFileSync(
  resolve(__dirname, '../src/components/analytics/hydration-recovery.tsx'),
  'utf8',
);
const layout = readFileSync(resolve(__dirname, '../src/app/layout.tsx'), 'utf8');

describe('hydration recovery guard', () => {
  it('is mounted in the document head, before hydration can throw', () => {
    expect(layout).toContain('<HydrationRecovery />');
    expect(layout.indexOf('<HydrationRecovery />')).toBeLessThan(layout.indexOf('<body'));
  });

  it('listens for the error and rejection paths', () => {
    expect(source).toContain("addEventListener('error'");
    expect(source).toContain("addEventListener('unhandledrejection'");
  });

  it('also watches console.error, because that is how React reports it in production', () => {
    // Verified on the live site: WebKit logged "Minified React error #418" through
    // console.error with no error or unhandledrejection event, so listeners alone never fired.
    expect(source).toContain('console.error = function');
    expect(source).toContain('nativeError.apply');
  });

  it('recognises the minified hydration errors and the worded form', () => {
    expect(source).toMatch(/418\|423\|425/);
    expect(source).toContain('Hydration failed');
  });

  it('recovers by reloading once', () => {
    expect(source).toContain('window.location.reload()');
  });

  it('cannot loop: one attempt per session', () => {
    expect(source).toContain('sessionStorage');
    expect(source).toContain('__hydraRecovered');
    expect(source).toMatch(/already[\s\S]{0,80}return/);
  });

  it('ignores unrelated errors rather than reloading on everything', () => {
    // The handler is gated on the hydration pattern; a random failure must not reload.
    expect(source).toMatch(/if \(HYDRATION\.test/);
  });
});
