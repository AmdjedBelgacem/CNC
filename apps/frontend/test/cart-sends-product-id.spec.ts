import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A cart line must carry the product's UUID, never its slug.
 *
 * The order API resolves each line with `where id = $1`, so a slug can never become an order
 * line. Both add-to-cart paths stored `product.slug` in a field named `productId`, which made
 * every purchase fail validation with "refId must be a valid id" — the cart was the caller, and
 * it was calling wrongly.
 */
const read = (p: string) => readFileSync(resolve(__dirname, '../src', p), 'utf8');

describe('the cart sends a product id the checkout API can resolve', () => {
  it('the product detail add-to-cart stores p.id, not p.slug', () => {
    const src = read('app/(main)/(store)/products/[slug]/product-detail-client.tsx');
    const add = src.slice(src.indexOf('const add = () =>'), src.indexOf('const add = () =>') + 400);
    expect(add).toMatch(/productId:\s*p\.id\b/);
    expect(add).not.toMatch(/productId:\s*p\.slug\b/);
  });

  it('the product card add-to-cart stores product.id, not product.slug', () => {
    const src = read('components/store/product-card.tsx');
    const add = src.slice(src.indexOf('addItem({'), src.indexOf('addItem({') + 400);
    expect(add).toMatch(/productId:\s*product\.id\b/);
    expect(add).not.toMatch(/productId:\s*product\.slug\b/);
  });

  it('checkout resolves a legacy slug-only cart line before posting', () => {
    const src = read('app/(main)/(store)/checkout/page.tsx');
    // Returning shoppers have carts persisted with the old slug value; they must not be
    // told to empty their cart.
    expect(src).toMatch(/resolveProductRef/);
    expect(src).toMatch(/products\/\$\{encodeURIComponent\(slug\)\}/);
  });

  it('the cart item type documents that productId is an id', () => {
    const src = read('stores/cart-store.ts');
    expect(src).toMatch(/productId:\s*string/);
    expect(src).toMatch(/slug\?:\s*string/);
  });
});
