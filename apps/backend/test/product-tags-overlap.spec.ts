import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { and, eq, arrayOverlaps, inArray } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { productsBundle as products } from '../src/database/schema/products';

const dialect = new PgDialect();

/**
 * Reproduces the intermittent 500 on the storefront product page:
 *
 *   GET /products/related/6897b207-… -> 500
 *   TypeError: value.map is not a function
 *     at PgArray.mapToDriverValue (drizzle-orm/pg-core/columns/common.cjs:211)
 *
 * `products.tags` is a Postgres `text[]`, and the related-products query filtered it with
 * `inArray` — the operator for a scalar column. Drizzle handed the array column to
 * `PgArray.mapToDriverValue` with a value that is not an array, and threw.
 *
 * It only looked intermittent because products with no tags return early, before the query is
 * ever built. Of five live products exactly one carries tags —
 * `3-axis-vertical-machining-center` — so only that product reached the broken line.
 */
describe('product tag matching', () => {
  it('inArray on the array column is what threw in production', () => {
    expect(() => dialect.sqlToQuery(inArray(products.tags as never, ['Milling'] as never))).toThrow(
      /value\.map is not a function/,
    );
  });

  it('renders a Postgres array literal with arrayOverlaps', () => {
    const { sql, params } = dialect.sqlToQuery(
      and(eq(products.isPublished, true), arrayOverlaps(products.tags, ['Milling', 'endmill'])),
    );
    expect(sql).toContain('&&');
    expect(sql).not.toMatch(/\bIN \(/i);
    // A properly serialised array literal, not a raw JS array handed to a PgArray column.
    expect(params).toEqual([true, '{"Milling","endmill"}']);
  });

  it('emits the overlap operator, which is what "shares any tag" means', () => {
    const { sql } = dialect.sqlToQuery(arrayOverlaps(products.tags, ['Milling']));
    expect(sql).toMatch(/&&/);
  });

  it('keeps both related-products queries on the array operator', () => {
    const src = readFileSync(
      new URL('../src/modules/products/products.service.ts', import.meta.url),
      'utf8',
    );
    expect(src).not.toMatch(/inArray\(\s*productsBundle\.tags/);
    expect((src.match(/arrayOverlaps\(productsBundle\.tags/g) || []).length).toBeGreaterThanOrEqual(2);
  });
});