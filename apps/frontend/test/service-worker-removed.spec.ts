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
 * The script itself must not exist.
 *
 * A browser that fetches its worker script and receives a 404 unregisters the worker without
 * needing any cooperation from the page bundle — which matters, because a page the old worker
 * is already breaking may never run the code that would otherwise clean up after it.
 */
const swFile = resolve(__dirname, '../public/sw.js');
const sw = existsSync(swFile) ? stripComments(readFileSync(swFile, 'utf8')) : '';
const register = readFileSync(
  resolve(__dirname, '../src/components/pwa/pwa-register.tsx'),
  'utf8',
);

describe('the service worker is dismantled', () => {
  it('serves no worker script at all, so the browser unregisters on its own', () => {
    expect(existsSync(swFile)).toBe(false);
  });

  it('serves nothing: no fetch handler remains', () => {
    expect(sw).not.toContain("addEventListener('fetch'");
    expect(sw).not.toContain('respondWith');
    expect(sw).not.toContain('caches.match');
  });

  it('never contains a fetch or message handler, stub or otherwise', () => {
    expect(sw).not.toContain("addEventListener('fetch'");
    expect(sw).not.toContain("addEventListener('message'");
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
