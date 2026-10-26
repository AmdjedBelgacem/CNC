import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A quote-only product must offer the request form, not a disabled cart.
 *
 * The card is the first place a shopper meets a machine, so the quote path has
 * to exist there as well as on the detail page. The related-products section used
 * to force `price ?? 0`, which turned every request-mode machine into a free one
 * on the detail page.
 */
const read = (p: string) => readFileSync(resolve(__dirname, '../src', p), 'utf8');

describe('quote-only product cards', () => {
  it('branches on pricingMode and opens the quote dialog', () => {
    const src = read('components/store/product-card.tsx');
    expect(src).toMatch(/isQuoteOnly\(product\)/);
    expect(src).toMatch(/QuoteRequestDialog/);
    expect(src).toMatch(/setQuoteOpen\(true\)/);
    expect(src).toMatch(/requestQuote/);
  });

  it('does not invent a zero price for related products', () => {
    const src = read('app/(main)/(store)/products/[slug]/product-detail-client.tsx');
    expect(src).not.toMatch(/price:\s*rp\.price\s*\?\?\s*0/);
    expect(src).toMatch(/<ProductCard key=\{rp\.id\} product=\{rp\}/);
  });

  it('preserves pricingMode when adapting academy products', () => {
    const src = read('app/(main)/academy/[slug]/page.tsx');
    expect(src).toMatch(/pricingMode:\s*product\.pricingMode/);
    expect(src).not.toMatch(/price:\s*product\.price\s*\?\?\s*0/);
  });
});
