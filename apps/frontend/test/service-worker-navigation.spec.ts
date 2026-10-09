import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

/**
 * Guards the service worker's interaction with page loads.
 *
 * The reported symptom was a blank `/products/{slug}`:
 *
 *   The FetchEvent for "…" resulted in a network error response: the promise was rejected.
 *   Uncaught (in promise) TypeError: Failed to convert value to 'Response'.
 *
 * That worker owned navigations. Four successive fixes to its handler each still left a
 * blank page reachable: `respondWith` handed over `undefined` on a cache miss; cached HTML
 * was served without its scripts; and `/offline`, itself a Next page, failed the same way.
 *
 * The fix was to stop intercepting navigations at all. These tests run the real shipped
 * `public/sw.js` with mocked browser globals, so the behaviour is pinned rather than
 * described.
 */
const swSource = readFileSync(resolve(__dirname, '../public/sw.js'), 'utf8');

type Outcome = { intercepted: boolean; value: unknown };

function runHandler(opts: {
  request: Request;
  fetchImpl?: () => Promise<Response>;
  cacheMatch?: (req: Request) => Promise<Response | undefined>;
  cacheOpenRejects?: boolean;
}): Promise<Outcome> {
  const listeners: Record<string, (event: unknown) => void> = {};
  const sandbox: Record<string, unknown> = {
    console,
    URL,
    Request,
    Response,
    caches: {
      open: async () => {
        if (opts.cacheOpenRejects) throw new Error('cache unavailable');
        return {
          put: async () => undefined,
          match: async () => undefined,
          keys: async () => [],
          delete: async () => true,
        };
      },
      match: async (r: Request) => (opts.cacheMatch ? opts.cacheMatch(r) : undefined),
      keys: async () => [],
      delete: async () => true,
    },
    fetch:
      opts.fetchImpl ??
      (async () => new Response('ok', { status: 200, headers: { 'Content-Type': 'text/plain' } })),
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

  return new Promise<Outcome>((resolvePromise) => {
    let settled = false;
    const event = {
      request: opts.request,
      respondWith(value: unknown) {
        settled = true;
        resolvePromise(
          Promise.resolve(value).then(
            (v) => ({ intercepted: true, value: v }),
            (e) => ({ intercepted: true, value: e }),
          ),
        );
      },
    };
    listeners.fetch?.(event);
    // A handler that declines to respond leaves the browser to do the request itself.
    setTimeout(() => {
      if (!settled) resolvePromise({ intercepted: false, value: undefined });
    }, 5);
  });
}

const navigation = () =>
  new Request('https://example.test/products/3-axis-vertical-machining-center', {
    headers: { accept: 'text/html,application/xhtml+xml' },
  });

describe('service worker navigation handling', () => {
  it('does not intercept a document navigation', async () => {
    const out = await runHandler({ request: navigation() });
    expect(out.intercepted).toBe(false);
  });

  it('does not intercept even when the cached page is available', async () => {
    const out = await runHandler({
      request: navigation(),
      cacheMatch: async () => new Response('cached'),
    });
    expect(out.intercepted).toBe(false);
  });

  it('does not intercept when the network would fail', async () => {
    const out = await runHandler({
      request: navigation(),
      fetchImpl: async () => {
        throw new TypeError('Failed to fetch');
      },
    });
    expect(out.intercepted).toBe(false);
  });

  it('never reaches respondWith with undefined or a rejection for a navigation', async () => {
    for (const cacheOpenRejects of [false, true]) {
      const out = await runHandler({
        request: navigation(),
        cacheOpenRejects,
        cacheMatch: async () => undefined,
      });
      expect(out.intercepted).toBe(false);
      expect(out.value).toBeUndefined();
    }
  });
});

describe('service worker asset caching', () => {
  it('caches hashed static assets and returns them from cache when present', async () => {
    const out = await runHandler({
      request: new Request('https://example.test/_next/static/chunks/abc-123.js'),
      cacheMatch: async () => new Response('cached chunk'),
    });
    expect(out.intercepted).toBe(true);
    expect(out.value).toBeInstanceOf(Response);
  });

  it('still serves a static asset when cache storage rejects', async () => {
    const out = await runHandler({
      request: new Request('https://example.test/_next/static/chunks/abc-123.js'),
      cacheOpenRejects: true,
      fetchImpl: async () => new Response('from network', { status: 200 }),
    });
    expect(out.intercepted).toBe(true);
    const value = out.value as Response;
    expect(value).toBeInstanceOf(Response);
    expect(await value.text()).toBe('from network');
  });

  it('intercepts images so they are served while offline', async () => {
    const out = await runHandler({
      request: new Request('https://example.test/cover.jpg'),
      cacheMatch: async () => new Response('cached image'),
    });
    expect(out.intercepted).toBe(true);
    expect(out.value).toBeInstanceOf(Response);
  });

  it('rethrows a genuine network failure rather than resolving undefined', async () => {
    const out = await runHandler({
      request: new Request('https://example.test/robots.txt'),
      fetchImpl: async () => {
        throw new TypeError('Failed to fetch');
      },
      cacheMatch: async () => undefined,
    });
    expect(out.intercepted).toBe(true);
    // A rejection is legitimate here — the browser reports a network error. What must never
    // happen is resolving `undefined`, which is the "Failed to convert value to 'Response'" bug.
    expect(out.value).toBeInstanceOf(Error);
  });

  it('never resolves undefined for any intercepted request', async () => {
    const requests = [
      new Request('https://example.test/_next/static/chunks/x.js'),
      new Request('https://example.test/img.png'),
      new Request('https://example.test/data.json'),
      new Request('https://example.test/font.woff2'),
    ];
    for (const request of requests) {
      const out = await runHandler({
        request,
        cacheMatch: async () => undefined,
        fetchImpl: async () => new Response('body', { status: 200 }),
      });
      expect(out.value, `${request.url} resolved undefined`).toBeInstanceOf(Response);
    }
  });
});