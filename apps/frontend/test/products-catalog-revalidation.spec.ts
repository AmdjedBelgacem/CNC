import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guards the storefront catalog against destroying a list it already has.
 *
 * The reported symptom was "the product listing is blank / can't fetch the page". The
 * catalog mounted, refetched `/api/proxy/products?limit=200`, and on *any* failure did
 * `setProducts([])` — replacing a correct, fully server-rendered grid with an empty one.
 * An offline tab, a flaky connection or a blocked request therefore produced exactly the
 * blank page that was being reported, while the server had in fact rendered the page
 * correctly.
 *
 * These assert on the component source, matching this suite's convention: it runs in the
 * node environment with no DOM tooling, and checks the behaviour that was broken.
 */
const raw = readFileSync(
  resolve(__dirname, '../src/components/store/products-catalog.tsx'),
  'utf8',
);

/**
 * Comments are stripped before asserting.
 *
 * The fix documents the `setProducts([])` it removed, and a naive regex then matches the
 * prose describing the bug rather than the bug — a test that fails because someone wrote
 * down what they changed is worse than no test.
 */
const source = raw
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('products catalog: a failed revalidation is not destructive', () => {
  it('never empties the product list in the fetch failure path', () => {
    // No `setProducts([])` anywhere, and specifically none inside a catch handler.
    expect(source).not.toMatch(/setProducts\(\s*\[\]\s*\)/);
  });

  it('records the failure but leaves the products alone', () => {
    const catchBlock = source.match(/\.catch\(\(err[^)]*\)[\s\S]*?\}\);/);
    expect(catchBlock, 'expected a .catch handler on the catalog fetch').toBeTruthy();
    const body = catchBlock![0];
    expect(body).toContain('setError');
    expect(body).not.toMatch(/setProducts\(\s*\[\]\s*\)/);
  });

  it('shows the full failure panel only when there is genuinely nothing to display', () => {
    // The destructive panel must be gated on an empty result set.
    expect(source).toMatch(/error && !loading && filtered\.length === 0/);
  });

  it('reports a failure alongside the list instead of replacing it', () => {
    expect(source).toMatch(/error && !loading && filtered\.length > 0/);
  });

  it('still refetches for freshness, and still offers a retry', () => {
    expect(source).toContain('/api/proxy/products');
    expect(source).toContain('setReloadKey');
  });

  it('still guards the first load, when there is no server data yet', () => {
    // Skeletons are for the genuinely-empty case only; the comment records why.
    expect(source).toMatch(/setLoading\(products\.length === 0\)/);
  });
});