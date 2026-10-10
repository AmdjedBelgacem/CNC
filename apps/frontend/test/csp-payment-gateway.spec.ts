import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The policy must permit the payment gateway's SDK and its iframe.
 *
 * `script-src` allowed only `'self'` and the per-request nonce, so `cdn.moyasar.com/sdk/v1/moyasar.js`
 * was refused and checkout reported "Could not load the payment form". The policy blocked the one
 * script the till depends on.
 *
 * The protection that actually matters is the nonce: an injected inline script cannot know it.
 * Allowing a named host for the gateway does not weaken that, and must not be "fixed" by
 * reintroducing `'unsafe-inline'`.
 */
const src = readFileSync(resolve(__dirname, '../src/middleware.ts'), 'utf8');
const body = src.slice(src.indexOf('function buildCsp'), src.indexOf('function buildCsp') + 5000);

describe('content security policy allows the payment gateway', () => {
  it('names the gateway CDN in script-src', () => {
    expect(body).toMatch(/cdn\.moyasar\.com/);
    const line = body.split('\n').find((l) => l.includes('script-src ${')) ?? '';
    expect(line).toMatch(/paymentHosts/);
  });

  it('permits the hosted form frame', () => {
    expect(body).toMatch(/frame-src/);
    expect(body).toMatch(/child-src/);
  });

  it('keeps the nonce so inline scripts stay protected', () => {
    expect(body).toMatch(/'nonce-\$\{nonce\}'/);
  });

  it('does not reintroduce unsafe-inline in production', () => {
    // It is allowed in dev only, behind `isDev`.
    expect(body).toMatch(/if \(isDev\) scriptSrc.push\("'unsafe-eval'", "'unsafe-inline'"\)/);
  });

  it('keeps object-src none and frame-ancestors none', () => {
    expect(body).toMatch(/object-src 'none'/);
    expect(body).toMatch(/frame-ancestors 'none'/);
  });

  it('the checkout page loads the SDK from that same host', () => {
    const checkout = readFileSync(
      resolve(__dirname, '../src/app/(main)/(store)/checkout/page.tsx'),
      'utf8',
    );
    expect(checkout).toMatch(/https:\/\/cdn\.moyasar\.com\/sdk\/v1\/moyasar\.js/);
  });

  /**
   * The CDN has served 403 on every path, so the loader falls back rather than taking checkout
   * down, and resets so a later retry can recover without a page reload. The first-party copy is
   * tried before the CDN; the CDN is no longer listed as a literal candidate URL.
   */
  it('falls back to the CDN and does not cache a failure forever', () => {
    const checkout = readFileSync(
      resolve(__dirname, '../src/app/(main)/(store)/checkout/page.tsx'),
      'utf8',
    );
    const local = checkout.indexOf('loadScript(MOYASAR_SDK_LOCAL, MOYASAR_SDK_SRI)');
    const cdn = checkout.indexOf('loadScript(MOYASAR_SDK_CDN)');
    expect(local).toBeGreaterThan(-1);
    expect(cdn).toBeGreaterThan(local);
    expect(checkout).toMatch(/moyasarScriptPromise = null/);
  });

  it('reports which host failed, rather than a bare "could not load"', () => {
    const checkout = readFileSync(
      resolve(__dirname, '../src/app/(main)/(store)/checkout/page.tsx'),
      'utf8',
    );
    expect(checkout).toMatch(/Could not load \$\{src\}/);
    expect(checkout).toMatch(/cause\?\.message|cause\.message/);
  });
});
