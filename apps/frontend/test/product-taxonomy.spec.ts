import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Products are classified on two axes: a category (the department) and a
 * product type (the kind of thing inside it). The store and the admin list
 * both have to agree on that shape, or a type filter in one place has no
 * matching field in the other.
 */
const repo = resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(resolve(repo, p), 'utf8');

describe('product category and type taxonomy', () => {
  it('stores a nullable product_type column and indexes it', () => {
    const schema = read('apps/backend/src/database/schema/products.ts');
    expect(schema).toMatch(/productType:\s*varchar\('product_type'/);
    expect(schema).toMatch(/prod_type_idx/);
    expect(existsSync(resolve(repo, 'apps/backend/src/database/migrations/042_product_type.sql'))).toBe(
      true,
    );
  });

  it('lets the API filter and write productType', () => {
    const service = read('apps/backend/src/modules/products/products.service.ts');
    expect(service).toMatch(/productType\?:\s*string/);
    expect(service).toMatch(/eq\(productsBundle\.productType, opts\.productType\)/);
    expect(service).toMatch(/productType:\s*true/);

    const controller = read('apps/backend/src/modules/products/products.controller.ts');
    expect(controller).toMatch(/@Query\('productType'\)/);
    expect(controller).toMatch(/productType:\s*productType \|\| type/);
  });

  it('carries the type through the admin form payload', () => {
    const form = read('apps/frontend/src/app/(admin)/admin/products/product-form.tsx');
    expect(form).toMatch(/productType:\s*string/);
    expect(form).toMatch(/productType:\s*value\.productType\.trim\(\) \|\| null/);
    expect(form).toMatch(/fieldProductType/);
  });

  it('filters the storefront by type and shows both labels on a card', () => {
    const catalog = read('apps/frontend/src/components/store/products-catalog.tsx');
    expect(catalog).toMatch(/readTypeFromSearch/);
    expect(catalog).toMatch(/productType !== ALL_TYPES/);
    expect(catalog).toMatch(/product\.productType !== productType/);
    expect(catalog).toMatch(/applyType/);

    const card = read('apps/frontend/src/components/store/product-card.tsx');
    expect(card).toMatch(/product\.productType/);
  });

  it('requests and renders the type in the admin product list', () => {
    const page = read('apps/frontend/src/app/(admin)/admin/products/page.tsx');
    expect(page).toMatch(/params\.get\('type'\)/);
    expect(page).toMatch(/qs\.set\('productType', productType\)/);
    expect(page).toMatch(/product\.productType/);
    expect(page).toMatch(/setParam\(\{ category: v \|\| null, type: null \}\)/);
  });
});
