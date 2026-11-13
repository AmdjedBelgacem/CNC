import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(resolve(__dirname, '../src', p), 'utf8');

/**
 * Admin list skeletons used to draw a fixed number of rows, so their height was off from the
 * real page, which sizes itself to the data. Each list now records how many rows it rendered
 * and its skeleton draws that many next time. A key that differs between the two sides would
 * silently fall back to the fixed count, so the pairs are checked here.
 */
const LISTS: { key: string; component: string }[] = [
  { key: 'partners', component: 'app/(admin)/admin/partners/page.tsx' },
  { key: 'quotes', component: 'app/(admin)/admin/quotes/quotes-inbox.tsx' },
  { key: 'academies', component: 'app/(admin)/admin/academies/page.tsx' },
  { key: 'staff', component: 'app/(admin)/admin/staff/page.tsx' },
  { key: 'alerts', component: 'app/(admin)/admin/alerts/page.tsx' },
  { key: 'products', component: 'app/(admin)/admin/products/page.tsx' },
  { key: 'certificates', component: 'app/(admin)/admin/certificates/page.tsx' },
  { key: 'email', component: 'components/admin/email-templates-list.tsx' },
  // Integrations is a fixed set of four cards; only their "blocked" notices vary.
  { key: 'integrations-notices', component: 'app/(admin)/admin/integrations/integrations-panel.tsx' },
  { key: 'users', component: 'app/(admin)/admin/users/page.tsx' },
];

const skeletons = read('components/skeletons/admin-route-skeletons.tsx');

describe('admin list skeletons remember the list size', () => {
  it.each(LISTS)('$key: the list records its count and the skeleton reads it', ({ key, component }) => {
    expect(read(component)).toContain(`rememberListCount('${key}'`);
    expect(skeletons).toContain(`useRememberedListCount('${key}'`);
  });

  it('has no skeleton reading a key that no list records', () => {
    const read_ = [...skeletons.matchAll(/useRememberedListCount\('([^']+)'/g)].map((m) => m[1]);
    expect(new Set(read_)).toEqual(new Set(LISTS.map((l) => l.key)));
  });
});
