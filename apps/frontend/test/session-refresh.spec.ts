import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * "The website keeps logging me off."
 *
 * The refresh token is single-use. Two refreshes at the same moment (two tabs, a page and its
 * prefetch) meant one was refused, and the refused one was read as "signed out". Separately, the
 * admin's fetch helper never refreshed at all, so admin screens failed a quarter of an hour into
 * a session. These pin both fixes.
 */
type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function installBrowser(handler: Handler) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
    handler(typeof input === 'string' ? input : input.toString(), init),
  );
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('window', { location: { pathname: '/admin' } });
  vi.stubGlobal('document', { cookie: 'csrf-token=abc' });
  // A Web Lock implementation that serialises callbacks, like the browser's.
  let tail: Promise<unknown> = Promise.resolve();
  vi.stubGlobal('navigator', {
    locks: {
      request: (_name: string, fn: () => Promise<unknown>) => {
        const next = tail.then(fn);
        tail = next.catch(() => undefined);
        return next;
      },
    },
  });
  return fetchMock;
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setTimeout'] });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('session refresh', () => {
  it('treats a refresh that lost a race as success when the session is live', async () => {
    let sessionLive = false;
    installBrowser((url) => {
      if (url.endsWith('/auth/session')) return json(200, { authenticated: sessionLive });
      if (url.endsWith('/auth/refresh')) {
        // Another tab won: our token was already rotated, but its cookies are now ours too.
        sessionLive = true;
        return json(401, { message: 'Refresh token has been revoked' });
      }
      return json(404, {});
    });
    const { refreshSession } = await import('../src/lib/api-client');
    const pending = refreshSession();
    await vi.runAllTimersAsync();
    await expect(pending).resolves.toBe(true);
  });

  it('skips the refresh entirely when another tab already renewed the session', async () => {
    const fetchMock = installBrowser((url) => {
      if (url.endsWith('/auth/session')) return json(200, { authenticated: true });
      return json(500, {});
    });
    const { refreshSession } = await import('../src/lib/api-client');
    await expect(refreshSession()).resolves.toBe(true);
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/auth/refresh'))).toBe(false);
  });

  it('still signs out when the session really is gone', async () => {
    installBrowser((url) => {
      if (url.endsWith('/auth/session')) return json(200, { authenticated: false });
      if (url.endsWith('/auth/refresh')) return json(401, {});
      return json(404, {});
    });
    const { refreshSession } = await import('../src/lib/api-client');
    const pending = refreshSession();
    await vi.runAllTimersAsync();
    await expect(pending).resolves.toBe(false);
  });
});

describe('admin fetch helper', () => {
  it('refreshes and replays a request that failed with 401', async () => {
    let refreshed = false;
    const fetchMock = installBrowser((url) => {
      if (url.endsWith('/auth/session')) return json(200, { authenticated: refreshed });
      if (url.endsWith('/auth/refresh')) {
        refreshed = true;
        return json(200, { ok: true });
      }
      if (url.endsWith('/admin/products')) return refreshed ? json(200, { data: [] }) : json(401, {});
      return json(404, {});
    });
    const { apiProxyFetch } = await import('../src/hooks/use-api-proxy');
    const res = await apiProxyFetch('/api/proxy/admin/products');
    expect(res.status).toBe(200);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/admin/products'))).toHaveLength(2);
  });

  it('never refreshes on a wrong password', async () => {
    const fetchMock = installBrowser(() => json(401, {}));
    const { apiProxyFetch } = await import('../src/hooks/use-api-proxy');
    const res = await apiProxyFetch('/api/proxy/auth/login', { method: 'POST', body: '{}' });
    expect(res.status).toBe(401);
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/auth/refresh'))).toBe(false);
  });
});
