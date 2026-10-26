import { describe, expect, it } from 'vitest';
import { cardPrice, isQuoteOnly, lowestPositivePrice, pricingModeOf } from '@/lib/product-pricing';
import type { Product } from '@/lib/api/types';

const product = (overrides: Partial<Product> = {}): Product =>
  ({
    id: 'p1',
    slug: 'p1',
    title: 'QA product',
    ...overrides,
  }) as Product;

describe('product pricing modes on the storefront', () => {
  it('never publishes a figure for a quote-only product, even if one is stored', () => {
    const p = product({ pricingMode: 'request', price: 5000 });
    expect(cardPrice(p)).toBeNull();
    expect(isQuoteOnly(p)).toBe(true);
  });

  it('keeps a legitimate zero price as a fixed price', () => {
    const p = product({ pricingMode: 'fixed', price: 0 });
    expect(cardPrice(p)).toBe(0);
    expect(isQuoteOnly(p)).toBe(false);
  });

  it('shows the lowest positive figure for a "from" product', () => {
    const p = product({
      pricingMode: 'from',
      price: 9000,
      variants: [
        { id: 'v1', title: 'Small', price: 7000 },
        { id: 'v2', title: 'Large', price: 12000 },
      ] as Product['variants'],
    });
    expect(cardPrice(p)).toBe(7000);
    expect(lowestPositivePrice(p)).toBe(7000);
  });

  it('uses the first variant for a fixed product, matching the cart', () => {
    const p = product({
      pricingMode: 'fixed',
      price: 9000,
      variants: [{ id: 'v1', title: 'Default', price: 8500 }] as Product['variants'],
    });
    expect(cardPrice(p)).toBe(8500);
  });

  it('treats an unknown or missing mode as fixed', () => {
    expect(pricingModeOf(product())).toBe('fixed');
    expect(pricingModeOf(product({ pricingMode: 'starting' as never }))).toBe('fixed');
  });
});
