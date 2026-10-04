import { describe, it, expect } from 'vitest';
import {
  ALL_CATEGORIES,
  buildCategoryHref,
  readCategoryFromSearch,
} from '../src/lib/store-category';

/**
 * The store's category filter is URL-driven so a department is a shareable
 * link — the Machines navbar entry is `/products?category=Machines`, and the
 * department tiles emit the same shape.
 *
 * The rules that matter: a category survives a reload, `all` collapses to the
 * unfiltered URL rather than `?category=all`, and switching department does not
 * throw away the rest of the query string.
 */
describe('store category filter URLs', () => {
  it('reads the category named by the query string', () => {
    expect(readCategoryFromSearch('?category=Machines')).toBe('Machines');
    expect(readCategoryFromSearch('category=Machines')).toBe('Machines');
  });

  it('treats a missing or blank category as no filter', () => {
    expect(readCategoryFromSearch('')).toBe(ALL_CATEGORIES);
    expect(readCategoryFromSearch('?category=')).toBe(ALL_CATEGORIES);
    expect(readCategoryFromSearch('?category=%20%20')).toBe(ALL_CATEGORIES);
    expect(readCategoryFromSearch(null)).toBe(ALL_CATEGORIES);
    expect(readCategoryFromSearch(undefined)).toBe(ALL_CATEGORIES);
  });

  it('round-trips a category through build and read', () => {
    for (const name of ['Machines', 'Cutting Tools', 'Hand Tools']) {
      const href = buildCategoryHref('/products', '', name);
      expect(readCategoryFromSearch(href.slice('/products'.length))).toBe(name);
    }
  });

  it('collapses the all-category sentinel to the bare path', () => {
    expect(buildCategoryHref('/products', '', ALL_CATEGORIES)).toBe('/products');
    expect(buildCategoryHref('/products', '', '')).toBe('/products');
    expect(buildCategoryHref('/products', '?category=Machines', ALL_CATEGORIES)).toBe('/products');
  });

  it('replaces an existing category instead of appending a second one', () => {
    expect(buildCategoryHref('/products', '?category=Coolant', 'Machines')).toBe(
      '/products?category=Machines',
    );
  });

  it('preserves other query parameters', () => {
    // A shopper who searched and then picked a department keeps the search.
    expect(buildCategoryHref('/products', '?q=boring', 'Machines')).toBe(
      '/products?q=boring&category=Machines',
    );
    // ...and clearing the category leaves the search alone.
    expect(buildCategoryHref('/products', '?q=boring&category=Machines', ALL_CATEGORIES)).toBe(
      '/products?q=boring',
    );
  });

  it('encodes category names that need it', () => {
    const href = buildCategoryHref('/products', '', 'A&B Co');
    expect(href).toBe('/products?category=A%26B+Co');
    expect(readCategoryFromSearch(href.slice('/products'.length))).toBe('A&B Co');
  });

  it('never emits a doubled question mark or an empty query', () => {
    expect(buildCategoryHref('/products', '', ALL_CATEGORIES)).not.toContain('?');
    expect(buildCategoryHref('/products', '', 'Machines')).not.toContain('??');
  });
});