import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every admin screen must have a loading state that replicates it.
 *
 *  1. Each directory under app/(admin)/admin with a page.tsx has a loading.tsx
 *     beside it, so server navigation paints the page's shape at once.
 *  2. Each of those routes resolves to a replica in `adminSkeletonFor`, which
 *     `AdminGate` shows while the role check runs on a hard load. Without an
 *     entry the gate falls back to a generic placeholder.
 */

const ADMIN_ROOT = resolve(__dirname, '../src/app/(admin)/admin');
const SKELETONS = resolve(__dirname, '../src/components/skeletons/admin-route-skeletons.tsx');

function pageDirs(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...pageDirs(full));
  }
  if (existsSync(join(dir, 'page.tsx'))) out.push(dir);
  return out;
}

/** `/admin/products/[slug]/edit` → a concrete path the resolver would see. */
function routeOf(dir: string): string {
  // Route groups such as `(dashboard)` are not part of the URL.
  const rel = relative(ADMIN_ROOT, dir)
    .split('\\')
    .join('/')
    .split('/')
    .filter((part) => !/^\(.*\)$/.test(part))
    .join('/');
  const path = rel ? `/admin/${rel}` : '/admin';
  return path.replace(/\[[^\]]+\]/g, 'sample-id');
}

const dirs = pageDirs(ADMIN_ROOT);

describe('admin loading states', () => {
  it('finds the admin pages', () => {
    expect(dirs.length).toBeGreaterThan(20);
  });

  it.each(dirs.map((d) => [routeOf(d), d]))('%s has a loading.tsx', (_route, dir) => {
    expect(existsSync(join(dir, 'loading.tsx'))).toBe(true);
  });

  it.each(dirs.map((d) => [routeOf(d), d]))('%s loading.tsx renders a replica, not a generic shell', (_route, dir) => {
    const source = readFileSync(join(dir, 'loading.tsx'), 'utf8');
    expect(source).toMatch(/admin-route-skeletons|builder-shell/);
  });

  it.each(dirs.map((d) => [routeOf(d)]))('%s resolves to a replica in adminSkeletonFor', (route) => {
    const source = readFileSync(SKELETONS, 'utf8');
    const exact = [...source.matchAll(/^\s*'(\/admin[^']*)': \(\) =>/gm)].map((m) => m[1] ?? '');
    const patterns = [...source.matchAll(/^\s*\[\/(\^\\\/admin.*?)\/, \(\) =>/gm)]
      .map((m) => m[1])
      .filter((p): p is string => Boolean(p))
      .map((p) => new RegExp(p));
    expect(patterns.length).toBeGreaterThan(0);
    const covered = exact.includes(route) || patterns.some((p) => p.test(route));
    expect(covered).toBe(true);
  });
});
