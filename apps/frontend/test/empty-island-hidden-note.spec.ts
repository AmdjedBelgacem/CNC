import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A live island with no records is dropped from the public page. The canvas collapses it to no
 * height as well, and must say it is hidden on the live site, as the partner and academy blocks do.
 */
describe('empty live island on the canvas', () => {
  const src = readFileSync(join(__dirname, '..', 'src/components/builder/blocks/live-island-block.tsx'), 'utf8');
  it('notes that an empty island is hidden on the live site', () => {
    expect(src).toMatch(/\{empty \? \(/);
    expect(src).toMatch(/hidden on the live site/);
  });
  it('keeps an empty island at no height', () => {
    expect(src).toMatch(/data-builder-empty-island="true"/);
  });
});
