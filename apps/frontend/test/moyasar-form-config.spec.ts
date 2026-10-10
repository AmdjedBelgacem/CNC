import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The form config must match what Moyasar's SDK actually accepts.
 *
 * Two separate defects hid behind "the form does not appear":
 *
 *  1. The SDK has no `createPaymentForm`. That method belongs to QIWI, ConnexPay and myPOS.
 *     Moyasar exposes `init` and `setAmount`, so the call was reaching for `undefined`.
 *  2. `methods: ['creditcard', 'applepay', 'stcpay']` renders "Form configuration issue!".
 *     Verified: `methods` is required, and `creditcard` cannot be combined with `applepay` or
 *     `stcpay`; `applepay` alone is rejected as well.
 */
const checkout = readFileSync(
  resolve(__dirname, '../src/app/(main)/(store)/checkout/page.tsx'),
  'utf8',
);
const config = checkout.slice(checkout.indexOf('Moyasar.init('), checkout.indexOf('Moyasar.init(') + 2600);
/** Comments explain why `createPaymentForm` is wrong; only executable code is asserted on. */
const code = checkout.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('the payment form uses the real Moyasar API', () => {
  it('calls Moyasar.init, which exists', () => {
    expect(config).toMatch(/Moyasar\.init\(\{/);
  });

  it('never calls createPaymentForm, a different gateway’s API', () => {
    expect(code).not.toMatch(/createPaymentForm/);
  });

  it('passes the container as a CSS selector', () => {
    // Moyasar documents that an Element instance is accepted, but this build rejects it with
    // "Form configuration issue!" while the selector renders the card fields.
    expect(config).toMatch(/element:\s*'#moyasar-form'/);
    expect(config).not.toMatch(/element:\s*formRef\.current/);
  });

  it('the container the selector points at exists', () => {
    expect(checkout).toMatch(/id="moyasar-form"/);
  });

  it('refuses a total below the gateway minimum, with a price-shaped message', () => {
    expect(config).toMatch(/amount < MINIMUM_CHARGE/);
    expect(checkout).toMatch(/below the \$\{MINIMUM_CHARGE\}/);
    expect(checkout).toMatch(/Raise the product price/);
  });

  it('uses publishable_api_key, the name the SDK expects', () => {
    expect(config).toMatch(/publishable_api_key:/);
    expect(config).not.toMatch(/\bpublishableKey:/);
  });

  it('requests only method combinations the SDK accepts', () => {
    // `creditcard` + `applepay` or `stcpay` renders a configuration error.
    const methods = config.match(/methods:\s*\[([^\]]*)\]/)?.[1] ?? '';
    const list = methods.split(',').map((s) => s.trim().replace(/["']/g, '')).filter(Boolean);
    expect(list).toContain('creditcard');
    expect(list).not.toContain('applepay');
    expect(list).not.toContain('stcpay');
  });

  it('lists mada, since that is the local card network', () => {
    expect(config).toMatch(/methods:\s*\[[^\]]*'mada'/);
  });

  it('keeps the supported card networks', () => {
    expect(config).toMatch(/supported_networks:\s*\[[^\]]*'visa'/);
    expect(config).toMatch(/supported_networks:\s*\[[^\]]*'mastercard'/);
  });
});

describe('the SDK is vendored so a vendor CDN outage cannot stop checkout', () => {
  it('tries the first-party copy before the CDN', () => {
    expect(checkout).toMatch(/\/vendor\/moyasar\/moyasar\.umd\.js/);
    const local = checkout.indexOf('MOYASAR_SDK_LOCAL, MOYASAR_SDK_SRI');
    const cdn = checkout.indexOf('loadScript(MOYASAR_SDK_CDN)');
    expect(local).toBeGreaterThan(-1);
    expect(cdn).toBeGreaterThan(local);
  });

  it('pins the vendored file with an integrity hash', () => {
    expect(checkout).toMatch(/MOYASAR_SDK_SRI\s*=\s*'sha384-[A-Za-z0-9+/=]+'/);
  });

  /**
   * The digest must actually match the shipped bytes.
   *
   * The first attempt wrapped `shasum`'s hex output as if it were SRI, which is base64. The file
   * was correct and the hash was wrong, so the browser refused the script — and because the loader
   * falls back on failure, it silently degraded to the broken CDN instead of reporting anything.
   * Recomputing the digest here means a wrong constant fails the suite rather than production.
   */
  it('the integrity digest matches the bytes we ship', () => {
    const declared = checkout.match(/MOYASAR_SDK_SRI\s*=\s*'sha384-([^']+)'/)?.[1];
    expect(declared).toBeTruthy();
    const bytes = readFileSync(
      resolve(__dirname, '../public/vendor/moyasar/moyasar.umd.js'),
    );
    const actual = createHash('sha384').update(bytes).digest('base64');
    expect(declared).toBe(actual);
  });

  it('ships the bundle and its stylesheet, with provenance documented', () => {
    const dir = resolve(__dirname, '../public/vendor/moyasar');
    expect(readFileSync(`${dir}/README.md`, 'utf8')).toMatch(/moyasar-payment-form@/);
    expect(readFileSync(`${dir}/LICENSE.md`, 'utf8')).toMatch(/MIT/i);
    expect(readFileSync(`${dir}/moyasar.umd.js`, 'utf8').length).toBeGreaterThan(10000);
  });

  it('does not cache a failed load, so a transient outage recovers', () => {
    expect(checkout).toMatch(/moyasarScriptPromise = null/);
  });
});
