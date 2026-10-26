import type { Product } from '@/lib/api/types';

export type PricingMode = 'fixed' | 'from' | 'request';

type PricedProduct = Pick<Product, 'price' | 'pricingMode' | 'variants'>;

/**
 * Read the admin-chosen pricing mode, tolerating old rows and unexpected values.
 *
 * The API validates the column, but the storefront still has to render a product
 * fetched from a cache written before the column existed. Anything that is not one
 * of the three known modes falls back to `fixed`, which is the pre-pricing-mode
 * behaviour.
 */
export function pricingModeOf(product: Pick<Product, 'pricingMode'>): PricingMode {
  const mode = String(product.pricingMode ?? 'fixed')
    .trim()
    .toLowerCase();
  return mode === 'from' || mode === 'request' ? mode : 'fixed';
}

/** Every positive figure a buyer could actually pay, in minor units. */
function positivePrices(product: Pick<Product, 'price' | 'variants'>): number[] {
  return [product.price, ...(product.variants ?? []).map((variant) => variant.price)].filter(
    (value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0,
  );
}

/**
 * The headline figure for a card, in minor units.
 *
 * `request` deliberately returns null even when a reference price is stored: the
 * whole point of the mode is that no number is published. `from` uses the lowest
 * figure across the product and its variants, matching the detail page. `fixed`
 * keeps the first variant price (the old card behaviour) and falls back to the
 * product price, including a legitimate zero.
 */
export function cardPrice(product: PricedProduct): number | null {
  const mode = pricingModeOf(product);
  if (mode === 'request') return null;
  if (mode === 'from') {
    const prices = positivePrices(product);
    return prices.length > 0 ? Math.min(...prices) : null;
  }
  const variant = product.variants?.[0]?.price;
  if (typeof variant === 'number' && Number.isFinite(variant)) return variant;
  return typeof product.price === 'number' && Number.isFinite(product.price) ? product.price : null;
}

/**
 * A quote-only product replaces the cart with a request form.
 *
 * Only the explicit mode qualifies. A `fixed` product with no price is an admin
 * omission, not a deliberate quote path — showing "Request a quote" there would
 * submit a request the API correctly refuses because the product is not marked
 * quote-only.
 */
export function isQuoteOnly(product: Pick<Product, 'pricingMode'>): boolean {
  return pricingModeOf(product) === 'request';
}

/** The lowest positive price on a product, used by the detail page's "From" figure. */
export function lowestPositivePrice(product: Pick<Product, 'price' | 'variants'>): number | null {
  const prices = positivePrices(product);
  return prices.length > 0 ? Math.min(...prices) : null;
}
