import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

/**
 * Reproduces the pair of console errors reported from the storefront:
 *
 *   The FetchEvent for "…/products/3-axis-vertical-machining-center" resulted in a network
 *   error response: the promise was rejected.
 *   Uncaught (in promise) TypeError: Failed to convert value to 'Response'.
 *
 * The navigation handler used to end in
 * `.catch(async () => (await caches.match(req)) || caches.match('/offline'))`. `caches.match`
 * resolves to `undefined` on a miss, so a network failure combined with an empty cache handed
 * `respondWith` a non-Response and blanked the page.
 *
 * These tests run the real `public/sw.js` in a sandbox with mocked browser globals, so a
 * regression in the shipped file fails here rather than in a customer's browser.
 */
const swSource = readFileSync(resolve(__dirname, '../public/sw.js'), 'utf8');

type Outcome = { responded: boolean; value: unknown };

function runNavigation(opts: {
  fetch: 'ok' | 'reject';
  cacheHit: boolean;
  offlineHit: boolean;
  cacheOpenThrows?: boolean;
}): Promise<Outcome> {
  const caches = {
    open: async () => {
      if (opts.cacheOpenThrows) throw new Error('cache unavailable');
      return {
        put: async () => undefined,
        match: async () => undefined,
        keys: async () => [],
        delete: async () => true,
      };
    },
    match: async (request: Request | string) => {
      const url = typeof request === 'string' ? request : request.url;
      if (url === '/offline') return opts.offlineHit ? new Response('offline') : undefined;
      return opts.cacheHit ? new Response('cached page') : undefined;
    },
    keys: async () => [],
    delete: async () => true,
  };

  let handler: ((event: unknown) => void) | undefined;
  const listeners: Record<string, (event: unknown) => void> = {};
  const sandbox: Record<string, unknown> = {
    console,
    URL,
    Request,
    Response,
    caches,
    fetch:
      opts.fetch === 'reject'
        ? async () => {
            throw new TypeError('Failed to fetch');
          }
        : async () => new Response('<html>fresh</html>', { status: 200, headers: { 'Content-Type': 'text/html' } }),
    self: {
      addEventListener: (type: string, fn: (event: unknown) => void) => {
        listeners[type] = fn;
      },
      skipWaiting: async () => undefined,
      clients: { claim: async () => undefined },
      location: { origin: 'https://example.test' },
    },
    Promise,
    JSON,
    Set,
  };
  vm.createContext(sandbox);
  vm.runInContext(swSource, sandbox);
  handler = listeners.fetch;

  const request = new Request('https://example.test/products/3-axis-vertical-machining-center', {
    headers: { accept: 'text/html' },
  });

  return new Promise<Outcome>((resolvePromise) => {
    const event = {
      request,
      respondWith(value: unknown) {
        resolvePromise(
          Promise.resolve(value as unknown).then(
            (v) => ({ responded: true, value: v }),
            (e) => ({ responded: true, value: e }),
          ),
        );
      },
    };
    if (!handler) throw new Error('sw.js registered no fetch listener');
    handler(event);
  });
}

describe('service worker navigation handler', () => {
  it('passes the network response straight through when the request succeeds', async () => {
    const out = await runNavigation({ fetch: 'ok', cacheHit: false, offlineHit: false });
    const value = out.value as Response;
    expect(value).toBeInstanceOf(Response);
    expect(value.status).toBe(200);
  });

  /**
   * The cached copy of the URL is deliberately not used as the offline fallback. Its scripts
   * are not reliably cached with it — a first visit runs before this worker takes control —
   * so offline it produced Next's "the app failed to start" boundary, with a Reload button
   * that cannot help while offline.
   */
  it('prefers the offline page over stale cached HTML, which lacks its scripts', async () => {
    const out = await runNavigation({ fetch: 'reject', cacheHit: true, offlineHit: true });
    const value = out.value as Response;
    expect(value).toBeInstanceOf(Response);
    const body = await value.text();
    expect(body).toContain('offline');
    expect(body).not.toContain('cached page');
  });

  it('falls back to the precached offline page when nothing matches', async () => {
    const out = await runNavigation({ fetch: 'reject', cacheHit: false, offlineHit: true });
    const value = out.value as Response;
    expect(value).toBeInstanceOf(Response);
    expect(await value.text()).toContain('offline');
  });

  /**
   * The two failures that produced the reported errors: `respondWith` received `undefined`,
   * and it received a rejected promise. Both must now be a Response.
   */
  it('returns a real Response even when the network fails and every cache miss misses', async () => {
    const out = await runNavigation({ fetch: 'reject', cacheHit: false, offlineHit: false });
    expect(out.value).toBeInstanceOf(Response);
    expect(out.value).not.toBeUndefined();
  });

  it('returns a real Response when the cache storage itself rejects', async () => {
    const out = await runNavigation({ fetch: 'reject', cacheHit: false, offlineHit: false, cacheOpenThrows: true });
    expect(out.value).toBeInstanceOf(Response);
  });

  it('never settles with a rejected promise', async () => {
    for (const opts of [
      { fetch: 'reject' as const, cacheHit: false, offlineHit: false },
      { fetch: 'reject' as const, cacheHit: true, offlineHit: false },
      { fetch: 'reject' as const, cacheHit: false, offlineHit: true },
    ]) {
      const out = await runNavigation(opts);
      expect(out.value).toBeInstanceOf(Response);
      expect(String(out.value)).not.toContain('rejected');
    }
  });

  it('serves a 503 HTML page rather than nothing when even the offline fallback is missing', async () => {
    const out = await runNavigation({ fetch: 'reject', cacheHit: false, offlineHit: false });
    const value = out.value as Response;
    expect(value.status).toBe(503);
    expect(value.headers.get('Content-Type')).toContain('text/html');
    expect(await value.text()).toContain('You are offline');
  });

  it('does not cache an error response, so a 500 cannot be pinned into the page cache', async () => {
    const put = { called: 0 };
    const caches = {
      open: async () => ({
        put: async () => {
          put.called += 1;
        },
        match: async () => undefined,
        keys: async () => [],
        delete: async () => true,
      }),
      match: async () => undefined,
      keys: async () => [],
      delete: async () => true,
    };
    const listeners: Record<string, (event: unknown) => void> = {};
    const sandbox: Record<string, unknown> = {
      console,
      URL,
      Request,
      Response,
      caches,
      fetch: async () => new Response('server error', { status: 500 }),
      self: {
        addEventListener: (t: string, fn: (e: unknown) => void) => {
          listeners[t] = fn;
        },
        skipWaiting: async () => undefined,
        clients: { claim: async () => undefined },
        location: { origin: 'https://example.test' },
      },
      Promise,
      JSON,
      Set,
    };
    vm.createContext(sandbox);
    vm.runInContext(swSource, sandbox);

    const event = {
      request: new Request('https://example.test/products', { headers: { accept: 'text/html' } }),
      respondWith: () => undefined,
    };
    listeners.fetch!(event);
    await new Promise((r) => setTimeout(r, 20));
    expect(put.called).toBe(0);
  });

  it('caches a successful navigation', async () => {
    const put = { called: 0 };
    const caches = {
      open: async () => ({
        put: async () => {
          put.called += 1;
        },
        match: async () => undefined,
        keys: async () => [],
        delete: async () => true,
      }),
      match: async () => undefined,
      keys: async () => [],
      delete: async () => true,
    };
    const listeners: Record<string, (event: unknown) => void> = {};
    const sandbox: Record<string, unknown> = {
      console,
      URL,
      Request,
      Response,
      caches,
      fetch: async () => new Response('<html>ok</html>', { status: 200 }),
      self: {
        addEventListener: (t: string, fn: (e: unknown) => void) => {
          listeners[t] = fn;
        },
        skipWaiting: async () => undefined,
        clients: { claim: async () => undefined },
        location: { origin: 'https://example.test' },
      },
      Promise,
      JSON,
      Set,
    };
    vm.createContext(sandbox);
    vm.runInContext(swSource, sandbox);

    const event = {
      request: new Request('https://example.test/products', { headers: { accept: 'text/html' } }),
      respondWith: () => undefined,
    };
    listeners.fetch!(event);
    await new Promise((r) => setTimeout(r, 20));
    expect(put.called).toBe(1);
  });
});