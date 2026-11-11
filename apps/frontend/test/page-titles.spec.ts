import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const appDir = resolve(__dirname, '../src/app');
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

const keysUsed = walk(appDir)
  .filter((f) => f.endsWith('layout.tsx'))
  .map((f) => readFileSync(f, 'utf8').match(/pageTitle\('([A-Za-z]+)'\)/)?.[1])
  .filter((k): k is string => !!k);

describe('route titles for client-component pages', () => {
  const catalogs = {
    en: JSON.parse(readFileSync(resolve(__dirname, '../messages/en.json'), 'utf8')).pageTitles,
    ar: JSON.parse(readFileSync(resolve(__dirname, '../messages/ar.json'), 'utf8')).pageTitles,
  };

  it('covers the account, settings, checkout and auth routes', () => {
    expect(keysUsed.length).toBeGreaterThanOrEqual(26);
    expect(new Set(keysUsed).size).toBe(keysUsed.length); // two routes sharing a title would be a copy-paste slip
  });

  it.each(['en', 'ar'] as const)('every title key used has a %s translation', (locale) => {
    const missing = keysUsed.filter((k) => !catalogs[locale]?.[k]);
    expect(missing).toEqual([]);
  });

  it('no title in the catalog goes unused', () => {
    const unused = Object.keys(catalogs.en).filter((k) => !keysUsed.includes(k));
    expect(unused).toEqual([]);
  });
});

describe('title helper keeps the brand suffix for nested routes', () => {
  const helper = readFileSync(resolve(__dirname, '../src/lib/page-title.tsx'), 'utf8');
  it('sets default and template, because a plain string drops the template for descendants', () => {
    expect(helper).toMatch(/default: text, template: `%s \| \$\{BRAND_NAME\}`/);
  });
  it('the auth layout names screens "X | Brand", not "X | Sign in"', () => {
    const auth = readFileSync(resolve(__dirname, '../src/app/(auth)/layout.tsx'), 'utf8');
    expect(auth).not.toMatch(/%s \| Sign in/);
    expect(auth).toMatch(/template: `%s \| \$\{BRAND_NAME\}`/);
  });
});
