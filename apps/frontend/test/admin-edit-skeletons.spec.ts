import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The data-sized admin skeletons read a remembered count that the real screen writes. A key that
 * is only read (or only written) silently falls back forever, so each one must appear on both
 * sides: a `useRememberedListCount` in the skeletons and a `rememberListCount` in the screen.
 */

const src = resolve(__dirname, '../src');
const read = (path: string) => readFileSync(resolve(src, path), 'utf8');

const skeletons = read('components/skeletons/admin-route-skeletons.tsx');

const WRITERS: Record<string, string> = {
  'edit-academy-courses': 'app/(admin)/admin/academies/[slug]/edit/page.tsx',
  'edit-product-images': 'app/(admin)/admin/products/[slug]/edit/page.tsx',
  'edit-product-pinpoints': 'app/(admin)/admin/products/[slug]/edit/page.tsx',
  'edit-product-documents': 'app/(admin)/admin/products/[slug]/edit/page.tsx',
  'edit-product-thumbnail': 'app/(admin)/admin/products/[slug]/edit/page.tsx',
  'ai-assistant-orders': 'app/(admin)/admin/settings/ai-assistant/payment-settings-panel.tsx',
  'ai-assistant-paid-orders': 'app/(admin)/admin/settings/ai-assistant/payment-settings-panel.tsx',
  'ai-assistant-feedback': 'app/(admin)/admin/settings/ai-assistant/ai-learning-panel.tsx',
  'ai-assistant-eval-runs': 'app/(admin)/admin/settings/ai-assistant/ai-learning-panel.tsx',
  'staff-audit': 'app/(admin)/admin/staff/audit/audit-log.tsx',
  'staff-audit-details': 'app/(admin)/admin/staff/audit/audit-log.tsx',
  'dashboard-attention': 'components/admin/dashboard-view.tsx',
  'dashboard-attention-samples': 'components/admin/dashboard-view.tsx',
  'dashboard-top-courses': 'components/admin/dashboard-view.tsx',
  'dashboard-signups': 'components/admin/dashboard-view.tsx',
};

const escape = (key: string) => key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

describe('remembered shapes of the admin edit and data-sized screens', () => {
  for (const [key, writer] of Object.entries(WRITERS)) {
    it(`"${key}" is read by a skeleton and written by ${writer.split('/').slice(-2).join('/')}`, () => {
      expect(skeletons).toMatch(new RegExp(`(useRememberedListCount|useProductEditCount)\\(\\s*'${escape(key)}'`));
      // Written directly, or as a [key, count] entry the screen records in a loop.
      expect(read(writer)).toMatch(new RegExp(`(rememberListCount\\(\\s*|\\[\\s*)'${escape(key)}'`));
    });
  }

  it('has no editor, dashboard, AI settings or audit skeleton reading a key nothing writes', () => {
    const read = [...skeletons.matchAll(/(?:useRememberedListCount|useProductEditCount)\(\s*'([^']+)'/g)]
      .map((m) => m[1] ?? '')
      .filter((key) => /^(edit-|dashboard-|ai-assistant-|staff-audit)/.test(key));
    expect(new Set(read)).toEqual(new Set(Object.keys(WRITERS)));
  });

  it('only the audit log remembers its view when it is the unfiltered first page', () => {
    const audit = read('app/(admin)/admin/staff/audit/audit-log.tsx');
    expect(audit).toMatch(/!action && page === 0/);
  });
});

describe('product editor skeleton counts per product', () => {
  it('records each count per product and reads that first, then the last product opened', () => {
    const { readFileSync } = require('node:fs') as typeof import('node:fs');
    const { join } = require('node:path') as typeof import('node:path');
    const src = join(__dirname, '..', 'src');
    const page = readFileSync(join(src, 'app/(admin)/admin/products/[slug]/edit/page.tsx'), 'utf8');
    expect(page).toMatch(/rememberListCount\(`\$\{key\}:\$\{slug\}`, count\)/);
    const sk = readFileSync(join(src, 'components/skeletons/admin-route-skeletons.tsx'), 'utf8');
    expect(sk).toMatch(/useRememberedListCount\(`\$\{key\}:\$\{slug\}`, latest, max\)/);
  });
});
