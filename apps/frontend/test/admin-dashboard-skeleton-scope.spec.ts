import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const admin = resolve(__dirname, '../src/app/(admin)/admin');

/**
 * A loading.tsx wraps its own page and every page below it. At the admin root, the dashboard's
 * skeleton was the fallback for every admin page that was opened without a prefetch.
 */
describe('dashboard skeleton scope', () => {
  it('has no loading boundary at the admin root', () => {
    expect(existsSync(resolve(admin, 'loading.tsx'))).toBe(false);
  });

  it('keeps the dashboard skeleton beside the dashboard page only', () => {
    expect(readFileSync(resolve(admin, '(dashboard)/loading.tsx'), 'utf8')).toMatch(/DashboardSkeleton/);
    expect(existsSync(resolve(admin, '(dashboard)/page.tsx'))).toBe(true);
  });
});
