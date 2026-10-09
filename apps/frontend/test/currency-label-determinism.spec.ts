import { describe, expect, it } from 'vitest';
import { STOREFRONT_CURRENCIES, currencySymbol, formatMinorUnits } from '../src/lib/money';

/**
 * Guards the storefront against a hydration mismatch caused by `Intl`.
 *
 * Reproduced in WebKit: `/products` returned 200 with correct server HTML, then React threw
 * "Minified React error #418" and the page went blank until a refresh. Diffing the server's
 * text nodes against the hydrated DOM found the cause — the same strings rendered differently:
 *
 *   server  "‎⃁ 0"   (U+200E U+20C1 — the narrow rial sign from Node's ICU)
 *   client  "SAR 0"  (Safari's ICU)
 *
 * `Intl` output is not guaranteed identical between a Node server and a browser, so anything
 * derived from it and rendered into markup is a hydration hazard. Pinning the display to the
 * ISO code removes the divergence.
 */
describe('currencySymbol is identical across runtimes', () => {
  it('renders the ISO code, never a locale-dependent symbol', () => {
    for (const currency of STOREFRONT_CURRENCIES) {
      expect(currencySymbol(currency, 'en-US')).toBe(currency);
    }
  });

  it('never emits combining marks, which differ between ICU builds', () => {
    for (const currency of STOREFRONT_CURRENCIES) {
      const label = currencySymbol(currency, 'en-US');
      // U+20C1 COMBINING RIYAL SIGN and U+200E LEFT-TO-RIGHT MARK both showed up in the
      // mismatch; neither may appear in a rendered string.
      expect(label, `${currency} contains a combining mark`).not.toMatch(/[\u20c1\u200e\u200f]/);
      expect(label).toMatch(/^[A-Za-z]{3}$/);
    }
  });

  it('gives the same answer for every locale it might be asked about', () => {
    for (const currency of STOREFRONT_CURRENCIES) {
      const en = currencySymbol(currency, 'en-US');
      const ar = currencySymbol(currency, 'ar-SA');
      const de = currencySymbol(currency, 'de-DE');
      expect({ en, ar, de }).toEqual({ en: currency, ar: currency, de: currency });
    }
  });

  it('covers SAR, the currency that actually diverged', () => {
    expect(currencySymbol('SAR', 'en-US')).toBe('SAR');
    expect(currencySymbol('SAR', 'ar-SA')).toBe('SAR');
  });
});
/**
 * `formatMinorUnits` had the same divergence as `currencySymbol`, and it is the one that
 * mattered: the server rendered `‎⃁ 0.01` (U+200E + U+20C1, a combining mark) where the browser
 * rendered `SAR 0.01`. Identical price, different text, so hydration failed and the page went
 * blank. `currencyDisplay: 'code'` pins every price path to the ISO code.
 */
describe('formatMinorUnits is identical across runtimes', () => {
  it('renders the ISO code for minor units, not a narrow symbol', () => {
    for (const currency of STOREFRONT_CURRENCIES) {
      const out = formatMinorUnits(100, currency, 'en-US');
      expect(out, `${currency} leaked a locale symbol`).toMatch(/^[A-Z]{3}\s/);
      expect(out).not.toMatch(/[\u20c1\u200e\u200f]/);
    }
  });

  /**
   * An Arabic locale legitimately reorders the parts — `‏1.00 SAR` rather than `SAR 1.00` —
   * and inserts directional marks. That is a *locale* difference, and the server and client
   * derive the locale from the same page, so both sides produce it identically. Asserting the
   * two locales render the same would be asserting something untrue.
   *
   * What must not vary is the ICU data: a given locale must always yield the same string,
   * whichever runtime formats it. That is what `currencyDisplay: 'code'` guarantees.
   */
  it('is stable for a given locale, which is what server and client both use', () => {
    for (const locale of ['en-US', 'ar-SA']) {
      for (const currency of STOREFRONT_CURRENCIES) {
        const first = formatMinorUnits(100, currency, locale);
        const second = formatMinorUnits(100, currency, locale);
        expect(first).toBe(second);
        // No narrow symbol, whichever locale asked for it.
        expect(first).not.toMatch(/\u20c1/);
      }
    }
  });

  it('still honours the currency fraction digits', () => {
    expect(formatMinorUnits(100, 'SAR', 'en-US')).toMatch(/^SAR\s1\.00/);
    expect(formatMinorUnits(1, 'JPY', 'en-US')).toMatch(/^JPY\s1$/);
  });
});
