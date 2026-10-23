import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const controller = readFileSync(
  join(__dirname, '../src/modules/builder/builder.controller.ts'),
  'utf8',
);

describe('the admin builder always edits English', () => {
  it('loads the canonical page layout, not the request locale', () => {
    const method = controller.slice(
      controller.indexOf("  async getPage("),
      controller.indexOf('  @Put(', controller.indexOf("  async getPage(")),
    );
    expect(method).toMatch(/getPage\(this\.builder\.assertTenant\(tenant\), slug, 'en'\)/);
    expect(method).not.toMatch(/getPage\([^)]*req/);
  });
});
