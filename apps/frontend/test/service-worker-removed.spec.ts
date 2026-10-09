import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The service worker is gone. This pins that, so it cannot quietly come back.
 *
 * It produced blank pages four separate ways, each after a fix that appeared to work:
 * `respondWith` handed over `undefined`; cached HTML arrived without its scripts; `/offline`
 * failed because it is itself a Next page; and the catch-all branch rethrew on a network-and-
 * cache miss, which the browser reported as `ERR_CACHE_MISS` and "Failed to fetch".
 *
 * Removing registration matters more than editing the worker: a stale worker keeps
 * controlling a visitor's browser until every tab is closed, so the code path had to be
 * eliminated, not merely repaired.
 */
/**
 * Comments are stripped: the file documents the failures it is replacing, so `respondWith`
 * and `caches.match` appear in the prose describing the history.
 */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/**
 * The script must be real JavaScript that removes itself.
 *
 * Deleting it was tried, on the theory that a 404 makes the browser unregister. Next.js has no
 * `/sw.js` route, so it answers with its catch-all page: HTTP 200 with `text/html`. That only
 * unregisters via a per-engine MIME heuristic, so it is not dependable. A valid script that
 * unregisters itself does not depend on the heuristic.
 */
const swFile = resolve(__dirname, '../public/sw.js');
const sw = existsSync(swFile) ? stripComments(readFileSync(swFile, 'utf8')) : '';
const register = readFileSync(
  resolve(__dirname, '../src/components/pwa/pwa-register.tsx'),
  'utf8',
);

describe('the service worker is dismantled', () => {
  it('is a real script, so the browser can evaluate it rather than infer from a MIME type', () => {
    expect(existsSync(swFile)).toBe(true);
    expect(sw.length).toBeGreaterThan(0);
  });

  it('unregisters itself and clears every cache', () => {
    expect(sw).toContain('self.registration.unregister()');
    expect(sw).toContain('self.caches.keys()');
    expect(sw).toContain('self.caches.delete');
  });

  it('applies immediately instead of waiting for tabs to close', () => {
    expect(sw).toContain('self.skipWaiting()');
    expect(sw).toContain('self.clients.claim()');
  });

  it('serves nothing: no fetch handler remains', () => {
    expect(sw).not.toContain("addEventListener('fetch'");
    expect(sw).not.toContain('respondWith');
    expect(sw).not.toContain('caches.match');
  });

  it('never serves a request, so it cannot blank a page', () => {
    expect(sw).not.toContain("addEventListener('fetch'");
    expect(sw).not.toContain('respondWith');
  });

  it('registers no worker anywhere in the app', () => {
    expect(register).not.toMatch(/\.register\(/);
  });

  it('purges existing registrations and caches for current visitors', () => {
    expect(register).toContain('getRegistrations');
    expect(register).toContain('unregister()');
    expect(register).toContain('window.caches.delete');
  });
});
