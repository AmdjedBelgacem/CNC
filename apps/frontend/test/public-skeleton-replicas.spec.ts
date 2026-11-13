import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = resolve(__dirname, '../src');
const app = resolve(src, 'app');
const read = (path: string) => readFileSync(path, 'utf8');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(path);
  }
  return out;
}

/** The single component a loading.tsx returns. */
function renderedSkeleton(loadingFile: string): string {
  const match = read(loadingFile).match(/return\s*<(\w+)/);
  expect(match, loadingFile).not.toBeNull();
  return match?.[1] ?? '';
}

describe('static public pages each have their own replica', () => {
  const routes = ['about', 'privacy', 'terms', 'refunds', 'edu-purchases'];

  it('no two of about / privacy / terms / refunds / edu-purchases render the same skeleton', () => {
    const skeletons = routes.map((route) => renderedSkeleton(resolve(app, '(main)', route, 'loading.tsx')));
    expect(new Set(skeletons).size).toBe(routes.length);
    expect(skeletons).not.toContain('CmsBlockPageSkeleton');
  });

  it('the homepage no longer uses the generic landing skeleton', () => {
    expect(renderedSkeleton(resolve(app, '(public)', 'loading.tsx'))).toBe('HomePageSkeleton');
  });
});

describe('remembered list counts', () => {
  const files = walk(src);
  const keysOf = (pattern: RegExp) => {
    const keys = new Set<string>();
    for (const file of files) for (const m of read(file).matchAll(pattern)) if (m[1]) keys.add(m[1]);
    return keys;
  };
  const remembered = keysOf(/rememberListCount\(\s*'(public-[\w-]+)'/g);
  const read_ = keysOf(/useRememberedListCount\(\s*'(public-[\w-]+)'/g);

  it('wires the public lists', () => {
    for (const key of [
      'public-feed',
      'public-groups',
      'public-learning',
      'public-tags',
      'public-titan-tv',
      'public-cart',
      'public-courses',
      'public-course-academies',
      'public-account-enrollments',
      'public-account-certificates',
      'public-account-sessions',
      'public-profile-portfolio',
    ]) {
      expect(remembered, key).toContain(key);
    }
  });

  it('every remembered key is read by a skeleton, and every skeleton key is remembered', () => {
    expect([...read_].sort()).toEqual([...remembered].sort());
  });
});

describe('settings loading states', () => {
  const settings = resolve(app, '(main)/(academy)/settings');
  const loadings = walk(settings).filter((file) => file.endsWith('loading.tsx'));

  it('covers every settings route', () => {
    expect(loadings.length).toBeGreaterThanOrEqual(8);
  });

  it('every settings loading.tsx renders inside an aria-busy region', () => {
    const routeSkeletons = read(resolve(src, 'components/skeletons/route-skeletons.tsx'));
    const embedded = routeSkeletons.slice(
      routeSkeletons.indexOf('export function SettingsSkeleton'),
      routeSkeletons.indexOf('export function FormPageSkeleton'),
    );
    const region = read(resolve(src, 'components/ui/skeletons/region.tsx'));
    expect(region).toMatch(/role="status" aria-busy="true"/);
    // Both branches (embedded and full page) are wrapped in a live region.
    expect(embedded).toMatch(/if \(embedded\)[\s\S]*<SkeletonRegion/);
    expect(embedded).toMatch(/<LoadingShell/);

    for (const file of loadings) {
      const skeleton = renderedSkeleton(file);
      expect(skeleton, file).toBe('SettingsSkeleton');
    }
  });
});
