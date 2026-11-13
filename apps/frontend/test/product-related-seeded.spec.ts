import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The product detail page's "related" section used to be fetched only in the browser, so it
 * appeared after the first paint and the page grew by ~700px. The server now fetches it with
 * the product and seeds the query, so the section is in the server HTML.
 */
const root = join(__dirname, '..', 'src');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

describe('product detail related products', () => {
  it('fetches related products on the server and passes them down', () => {
    const page = read('app/(main)/(store)/products/[slug]/page.tsx');
    expect(page).toMatch(/fetchRelatedProducts\(tenantSlug, initialProduct\.id, locale\)/);
    expect(page).toMatch(/initialRelated=/);
  });

  it('seeds the related query only for the product the server answered for', () => {
    const hook = read('hooks/use-products.ts');
    expect(hook).toMatch(/initial\.productId === id \? initial\.products : undefined/);
    const client = read('app/(main)/(store)/products/[slug]/product-detail-client.tsx');
    expect(client).toMatch(/useRelatedProducts\(product\?\.id \?\? null, undefined, initialRelated\)/);
  });

  it('returns null on a failed server fetch so the browser still loads the list', () => {
    const lib = read('lib/products.ts');
    const fn = lib.slice(lib.indexOf('export async function fetchRelatedProducts'));
    expect(fn).toMatch(/if \(!res\.ok\) return null;/);
  });
});
