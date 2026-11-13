import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(resolve(__dirname, '../src', p), 'utf8');

/**
 * The products layout carries English product-card blocks. On the Arabic page they were rendered
 * beside the translated storefront cards, so every seeded product appeared twice, while the
 * Arabic builder canvas showed the English blocks and English names. Both now show each product
 * once, translated.
 */
describe('Arabic product catalogue', () => {
  it('passes the English record blocks to the live page in English only', () => {
    const page = read('app/(main)/(store)/products/page.tsx');
    expect(page).toMatch(/records=\{locale === 'en' \? liveIslandSlot\(layout, 'products-inventory', 'records', locale\) : undefined\}/);
  });

  it('previews the Arabic canvas without the English record blocks', () => {
    const island = read('components/builder/blocks/live-island-block.tsx');
    expect(island).toMatch(/records=\{canvasLocale === 'en' \? puck\.renderSlot\('records'/);
    expect(island).toMatch(/recordIds=\{canvasLocale === 'en' \? recordIds : undefined\}/);
    expect(island).toMatch(/contentLocale=\{canvasLocale\}/);
  });

  it('refreshes the catalogue in the page language', () => {
    const catalog = read('components/store/products-catalog.tsx');
    expect(catalog).toMatch(/fetch\('\/api\/proxy\/products\?limit=200', \{ headers: \{ 'x-client-locale': locale \} \}\)/);
    expect(catalog).toMatch(/const locale = contentLocale \?\? uiLocale;/);
  });
});
