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

describe('site chrome and page metadata are localized', () => {
  const read = (p: string) => readFileSync(resolve(__dirname, '../src', p), 'utf8');
  const catalogs = ['en', 'ar'].map((l) => JSON.parse(readFileSync(resolve(__dirname, `../messages/${l}.json`), 'utf8')));

  it('the announcement bar, footer tagline and auth panel no longer hard-code English', () => {
    expect(read('components/layout/announcement-bar.tsx')).not.toMatch(/New academies are live/);
    expect(read('components/layout/footer.tsx')).not.toMatch(/Precision manufacturing education/);
    expect(read('components/layout/footer.tsx')).not.toMatch(/All rights reserved/);
    expect(read('app/(auth)/layout.tsx')).not.toMatch(/Platform Highlights|Skip to main content/);
  });

  it('every pageMeta key used by a page exists in both languages with a title', () => {
    const used = walk(appDir)
      .map((f) => readFileSync(f, 'utf8').match(/pageMeta\('([A-Za-z]+)'/)?.[1])
      .filter((k): k is string => !!k);
    expect(used.length).toBeGreaterThanOrEqual(11);
    for (const cat of catalogs) for (const k of used) expect(cat.pageMeta[k]?.title, k).toBeTruthy();
    // pages that ask for Open Graph need an ogDescription too
    for (const cat of catalogs) for (const k of ['feed', 'academy', 'events', 'products']) expect(cat.pageMeta[k].ogDescription).toBeTruthy();
  });

  it('chrome keys are present in both catalogs', () => {
    for (const cat of catalogs) {
      expect(cat.chrome.footerTagline && cat.chrome.rights && cat.chrome.auth.signIn).toBeTruthy();
      expect(Object.keys(cat.chrome.auth.highlights)).toHaveLength(4);
    }
  });
});

describe('the events and products islands read their text from the catalogs', () => {
  const read = (p: string) => readFileSync(resolve(__dirname, '../src', p), 'utf8');
  it('has no hard-coded English headings left in the events islands', () => {
    const events = read('components/events/events-islands.tsx');
    for (const literal of ['Board status', 'Recently past', 'Take it further', 'Academy pathways', 'Tool crib', 'Browse every event', 'Nothing scheduled yet', 'View &amp; register']) {
      expect(events, literal).not.toContain(literal);
    }
    const products = read('components/store/products-islands.tsx');
    for (const literal of ['Featured this week', 'Full catalog']) expect(products, literal).not.toContain(literal);
  });
  it('every key they use exists in both languages', () => {
    const cats = ['en', 'ar'].map((l) => JSON.parse(readFileSync(resolve(__dirname, `../messages/${l}.json`), 'utf8')));
    const events = read('components/events/events-islands.tsx');
    const keys = [...events.matchAll(/\bt\('([A-Za-z]+)'/g)].map((m) => m[1]!);
    expect(keys.length).toBeGreaterThan(20);
    for (const cat of cats) for (const k of keys) expect(cat.pages.events[k], k).toBeTruthy();
    for (const cat of cats) for (const k of ['featuredTitle', 'fullCatalog', 'featuredBadge']) expect(cat.pages.products[k], k).toBeTruthy();
  });
});
