import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Landmarks and a skip link, asserted at the layout level.
 *
 * These were found by auditing the live site: the auth group rendered a bare div tree with
 * no `<main>` and no `<footer>` on all seven of its screens, and no page anywhere had a skip
 * link — so a keyboard user tabbed through the announcement bar, logo, nav, locale switcher
 * and theme toggle on every single page before reaching content.
 */
const read = (p: string) => readFileSync(resolve(__dirname, '../src', p), 'utf8');
const main = read('app/(main)/layout.tsx');
const auth = read('app/(auth)/layout.tsx');
const settings = read('app/(main)/(academy)/settings/layout.tsx');

describe('every page offers a way past the navigation', () => {
  it('the main layout has a skip link targeting the content', () => {
    expect(main).toMatch(/href="#main"/);
    expect(main).toMatch(/sr-only[^"]*focus:not-sr-only/);
  });

  it('the auth layout has one too', () => {
    expect(auth).toMatch(/href="#main"/);
  });

  it('the skip target is focusable, so focus actually moves rather than only scrolling', () => {
    // `tabIndex={-1}` is what lets a non-interactive element take focus.
    expect(main).toMatch(/<main id="main" tabIndex=\{-1\}/);
    expect(auth).toMatch(/<main id="main" tabIndex=\{-1\}/);
  });

  it('the skip link precedes the announcement bar and navigation', () => {
    const skipAt = main.indexOf('href="#main"');
    const navAt = main.indexOf('<NavMain');
    const barAt = main.indexOf('<AnnouncementBar');
    expect(skipAt).toBeGreaterThan(-1);
    expect(navAt).toBeGreaterThan(skipAt);
    expect(barAt).toBeGreaterThan(skipAt);
  });

  it('the auth skip link precedes the back link and brand', () => {
    const skipAt = auth.indexOf('href="#main"');
    const backAt = auth.indexOf('&larr; Back');
    expect(skipAt).toBeGreaterThan(-1);
    expect(backAt).toBeGreaterThan(skipAt);
  });
});

describe('landmarks exist on the auth routes', () => {
  it('wraps the form in a main landmark', () => {
    expect(auth).toMatch(/<main id="main"/);
  });

  it('has a contentinfo landmark', () => {
    expect(auth).toMatch(/<footer/);
  });

  it('marks the marketing panel as complementary, not main content', () => {
    expect(auth).toMatch(/<aside[\s\S]{0,200}aria-label/);
  });

  it('the brand line is not a heading competing with the page h1', () => {
    // It was an <h2> before the form's own heading in the accessibility tree.
    expect(auth).not.toMatch(/<h2[^>]*>\s*Baroot/);
  });

  it('highlights are a real list', () => {
    expect(auth).toMatch(/<ul className="space-y-3"/);
    expect(auth).toMatch(/<li key=\{title\}/);
  });
});

describe('empty states still identify the page', () => {
  /**
   * `EmptyState` renders its title as a paragraph, so every branch that returned only an
   * empty state had no heading at all. These are real destinations: a signed-out visitor
   * lands on /learning with no cart, and an empty cart is a normal state.
   */
  const emptyBranches = [
    ['app/(main)/(store)/cart/page.tsx', 'cart'],
    ['app/(main)/learning/page.tsx', 'learning'],
  ] as const;

  for (const [path, name] of emptyBranches) {
    it(`${name} has a heading in its empty branch`, () => {
      const src = read(path);
      const branch = src.slice(src.indexOf('if (items.length === 0)') >= 0 ? src.indexOf('if (items.length === 0)') : 0);
      const empty = src.match(/return \([\s\S]{0,900}EmptyState[\s\S]{0,400}?\);/)?.[0] ?? '';
      expect(empty).toMatch(/<h1/);
      void branch;
    });
  }

  it('the cart empty state heading is visually hidden, not duplicate visible text', () => {
    expect(read('app/(main)/(store)/cart/page.tsx')).toMatch(/<h1 className="sr-only">/);
  });

  it('the learning empty state heading is visually hidden too', () => {
    expect(read('app/(main)/learning/page.tsx')).toMatch(/<h1 className="sr-only">/);
  });
});

describe('the account settings area has a landmark target', () => {
  it('main is addressable for the skip link', () => {
    expect(settings).toMatch(/<main id="main" tabIndex=\{-1\}/);
  });
});
