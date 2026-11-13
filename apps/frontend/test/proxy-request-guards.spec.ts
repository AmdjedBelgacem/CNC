import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CSRF_EXEMPT_PATHS,
  MAX_PROXY_BODY_BYTES,
  crossSiteRejection,
  declaredBodyTooLarge,
  readBoundedText,
} from '../src/app/api/proxy/_lib/request-guards';

/**
 * The /api/proxy BFF buffered any non-GET body whole (`request.text()`) before auth,
 * and forwarded state changes from any site. These pin the body cap and the
 * same-origin gate, and that signature-verified webhooks still get through.
 */
const h = (init: Record<string, string>) => new Headers(init);
const env = { FRONTEND_URL: 'https://barootcnc.com' } as unknown as NodeJS.ProcessEnv;

describe('same-origin gate for state-changing proxy requests', () => {
  it('lets reads through untouched', () => {
    expect(crossSiteRejection('GET', ['auth', 'me'], h({ 'sec-fetch-site': 'cross-site' }), env)).toBeNull();
  });

  it('accepts same-origin browser requests', () => {
    expect(crossSiteRejection('POST', ['auth', 'login'], h({ 'sec-fetch-site': 'same-origin' }), env)).toBeNull();
  });

  it('refuses cross-site and same-site browser requests', () => {
    expect(crossSiteRejection('POST', ['orders'], h({ 'sec-fetch-site': 'cross-site' }), env)).toMatch(/refused/);
    expect(crossSiteRejection('DELETE', ['orders', '1'], h({ 'sec-fetch-site': 'same-site' }), env)).toMatch(/refused/);
  });

  it('without fetch metadata, falls back to Origin against the request host and FRONTEND_URL', () => {
    const host = { host: 'tenant.barootcnc.com', 'x-forwarded-proto': 'https' };
    expect(crossSiteRejection('POST', ['x'], h({ ...host, origin: 'https://tenant.barootcnc.com' }), env)).toBeNull();
    expect(crossSiteRejection('POST', ['x'], h({ host: 'internal:3000', origin: 'https://barootcnc.com' }), env)).toBeNull();
    expect(crossSiteRejection('POST', ['x'], h({ ...host, origin: 'https://evil.example' }), env)).toMatch(/mismatch/);
    expect(crossSiteRejection('POST', ['x'], h(host), env)).toMatch(/no Origin/);
  });

  it('exempts exactly the signature-verified payment webhooks', () => {
    expect([...CSRF_EXEMPT_PATHS].sort()).toEqual(['payments/moyasar/webhook', 'payments/webhook']);
    expect(crossSiteRejection('POST', ['payments', 'moyasar', 'webhook'], h({}), env)).toBeNull();
    expect(crossSiteRejection('POST', ['payments', 'webhook'], h({}), env)).toBeNull();
    expect(crossSiteRejection('POST', ['payments', 'moyasar', 'webhook', 'x'], h({}), env)).not.toBeNull();
    expect(crossSiteRejection('POST', ['payments', 'checkout'], h({}), env)).not.toBeNull();
  });
});

describe('proxy body ceiling', () => {
  it('rejects a declared Content-Length over the cap', () => {
    expect(declaredBodyTooLarge(h({ 'content-length': String(MAX_PROXY_BODY_BYTES + 1) }))).toBe(true);
    expect(declaredBodyTooLarge(h({ 'content-length': '512' }))).toBe(false);
    expect(declaredBodyTooLarge(h({}))).toBe(false);
  });

  it('bounds a streamed (chunked) body with no Content-Length', async () => {
    const chunk = new Uint8Array(1024 * 1024);
    let sent = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent++ < 10) controller.enqueue(chunk);
        else controller.close();
      },
    });
    expect(await readBoundedText(stream)).toEqual({ tooLarge: true });
    // Stopped soon after the cap rather than draining all 10 MB.
    expect(sent).toBeLessThanOrEqual(6);
  });

  it('returns the text of a body under the cap', async () => {
    const body = new Response('{"a":"é"}').body;
    expect(await readBoundedText(body)).toEqual({ tooLarge: false, text: '{"a":"é"}' });
  });
});

describe('the proxy route applies both guards before forwarding', () => {
  const fetchMock = vi.fn(async () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }));

  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockClear();
    vi.stubGlobal('fetch', fetchMock);
    vi.doMock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.doUnmock('next/headers');
  });

  const call = async (headers: Record<string, string>, body: string, path = ['courses']) => {
    const { NextRequest } = await import('next/server');
    const { POST } = await import('../src/app/api/proxy/[...path]/route');
    const req = new NextRequest('https://barootcnc.com/api/proxy/' + path.join('/'), {
      method: 'POST',
      headers: { host: 'barootcnc.com', 'x-csrf-token': 't', ...headers },
      body,
    });
    return POST(req, { params: Promise.resolve({ path }) });
  };

  it('403s a cross-site POST without contacting the backend', async () => {
    const res = await call({ 'sec-fetch-site': 'cross-site' }, '{}');
    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('413s an oversized body without contacting the backend', async () => {
    const res = await call({ 'sec-fetch-site': 'same-origin' }, 'x'.repeat(MAX_PROXY_BODY_BYTES + 1));
    expect(res.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards a same-origin POST with its body', async () => {
    const res = await call({ 'sec-fetch-site': 'same-origin' }, '{"title":"x"}');
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.body).toBe('{"title":"x"}');
  });

  it('forwards a webhook with no browser headers', async () => {
    const res = await call({}, '{"id":"evt"}', ['payments', 'moyasar', 'webhook']);
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('production build config', () => {
  it('does not publish browser source maps', () => {
    const config = readFileSync(resolve(__dirname, '../next.config.ts'), 'utf8');
    expect(config).toMatch(/productionBrowserSourceMaps: false/);
    expect(config).not.toMatch(/productionBrowserSourceMaps: true/);
  });
});
