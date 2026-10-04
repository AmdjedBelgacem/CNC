import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const read = (path: string) => JSON.parse(readFileSync(resolve(__dirname, path), 'utf8'));
const en = read('../../frontend/messages/en.json');
const ar = read('../../frontend/messages/ar.json');

/**
 * Every message must be valid ICU.
 *
 * `admin.overview.heroTitle` was `Welcome back{name, select, other {} other {,
 * {name}}}` — a `select` with two `other` branches. ICU permits exactly one, so
 * next-intl threw `INVALID_MESSAGE: DUPLICATE_SELECT_ARGUMENT_SELECTOR` on every
 * render of the admin dashboard, repeatedly, in the browser console.
 *
 * The audit that checks key parity cannot see this: the key exists in both
 * locales and is non-empty, so coverage stayed at 100% while the message was
 * unrenderable. Parsing each message is the only check that catches it.
 *
 * The local fix splits the greeting into `heroTitle` / `heroTitleNamed` rather
 * than reaching for a nested select: a single `other` cannot express "with a
 * name or without", and two messages let each locale own its own separator
 * (Arabic needs "، ", not a hardcoded ", ").
 */
describe('every catalog message is valid ICU', () => {
  // next-intl compiles messages with intl-messageformat, so use the same parser:
  // a hand-rolled regex would only ever catch the bug it was written for.
  let IntlMessageFormat: typeof import('intl-messageformat').default;
  try {
    IntlMessageFormat = require('intl-messageformat').default ?? require('intl-messageformat');
  } catch {
    IntlMessageFormat = null as never;
  }

  function collect(value: unknown, prefix = ''): Array<[string, string]> {
    if (typeof value === 'string') return [[prefix, value]];
    if (value && typeof value === 'object') {
      const out: Array<[string, string]> = [];
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        out.push(...collect(child, prefix ? `${prefix}.${key}` : key));
      }
      return out;
    }
    return [];
  }

  const locales: Array<[string, unknown]> = [
    ['en', en],
    ['ar', ar],
  ];

  for (const [locale, catalog] of locales) {
    it(`${locale}: every message compiles`, () => {
      expect(IntlMessageFormat, 'intl-messageformat must be resolvable for this guard to work').toBeTruthy();
      const broken: string[] = [];
      for (const [path, message] of collect(catalog)) {
        try {
          new IntlMessageFormat(message, locale as 'en');
        } catch (error) {
          broken.push(`${path}: ${(error as Error).message.split('\n')[0]} | ${JSON.stringify(message)}`);
        }
      }
      expect(broken, 'these messages throw at render time').toEqual([]);
    });
  }

  it('the regression is caught: a select with two `other` branches is invalid', () => {
    // Guards the guard: if the parser ever stopped rejecting this, the test
    // above would pass while the dashboard threw.
    const bad = 'Welcome back{name, select, other {} other {, {name}}}';
    expect(() => new IntlMessageFormat(bad, 'en')).toThrow();
  });

  it('the fixed greeting renders both ways', () => {
    const named = new IntlMessageFormat(en.admin.overview.heroTitleNamed, 'en');
    const plain = new IntlMessageFormat(en.admin.overview.heroTitle, 'en');
    expect(named.format({ name: 'Ahmed' })).toBe('Welcome back, Ahmed');
    expect(plain.format({})).toBe('Welcome back');
  });

  it('the Arabic greeting uses the Arabic separator, not a Latin comma', () => {
    const named = new IntlMessageFormat(ar.admin.overview.heroTitleNamed, 'ar');
    expect(named.format({ name: 'أحمد' })).toBe('مرحباً بعودتك، أحمد');
    expect(named.format({ name: 'أحمد' })).not.toContain(',');
  });

  it('the dashboard picks a message that exists', () => {
    const source = readFileSync(
      resolve(__dirname, '../../frontend/src/components/admin/dashboard-view.tsx'),
      'utf8',
    );
    const used = [...source.matchAll(/t\('(hero\w+)'/g)].map((m) => m[1]!);
    expect(used.length).toBeGreaterThan(0);
    for (const key of used) {
      expect(en.admin.overview[key], `en.admin.overview.${key}`).toBeTypeOf('string');
      expect(ar.admin.overview[key], `ar.admin.overview.${key}`).toBeTypeOf('string');
    }
  });
});
