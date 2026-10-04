import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => JSON.parse(readFileSync(resolve(__dirname, path), 'utf8'));
const en = read('../../frontend/messages/en.json');
const ar = read('../../frontend/messages/ar.json');

const flatten = (value: unknown, prefix = ''): Map<string, string> => {
  const out = new Map<string, string>();
  if (typeof value === 'string') {
    out.set(prefix, value);
    return out;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      for (const [path, text] of flatten(child, prefix ? `${prefix}.${key}` : key)) {
        out.set(path, text);
      }
    }
  }
  return out;
};

const enFlat = flatten(en);
const arFlat = flatten(ar);

describe('message catalogs', () => {
  it('has the same namespaces in both locales', () => {
    expect(Object.keys(ar).sort()).toEqual(Object.keys(en).sort());
  });

  it('translates every English key into Arabic', () => {
    const missing = [...enFlat.keys()].filter((key) => !arFlat.has(key)).sort();
    expect(missing).toEqual([]);
  });

  it('has no Arabic file with keys English does not have', () => {
    // An orphan AR key means a rename happened on one side only.
    const extra = [...arFlat.keys()].filter((key) => !enFlat.has(key)).sort();
    expect(extra).toEqual([]);
  });

  it('never leaves a translation empty or as the dotted key', () => {
    const bad: string[] = [];
    for (const [key, text] of arFlat) {
      if (!text.trim()) bad.push(`${key} (empty)`);
      // A value that is just the key path is the silent-fallback shape.
      if (text === key) bad.push(`${key} (echoes the key)`);
    }
    expect(bad).toEqual([]);
  });

  it('has Arabic in every value except an explicit list of non-translatables', () => {
    /**
     * Some values must stay in Latin because translating them would break them:
     * a brand name, a format example, a keyboard shortcut, or a CSS/type token
     * the designer types. The list is exact on purpose: adding a forgotten
     * English string to it is a visible decision, and anything not on it has to
     * be Arabic.
     */
    const nonTranslatable = new Set([
      'auth.emailPlaceholder', // you@example.com - a format example
      'admin.gaPlaceholder', // G-XXXXXXXXXX - a measurement id
      'admin.snapchatPlaceholder', // 123456789012 - a pixel id
      'search.shortcut', // the command key
      'paymentsAdmin.moyasar', // brand
      'admin.certificatesPage.pdf', // PDF - a file format, not a word
      'builder.fieldLabels.2rem', 'builder.fieldLabels.3rem', 'builder.fieldLabels.4rem',
      'builder.fieldLabels.2xl', 'builder.fieldLabels.xl',
      'builder.fieldLabels.h1', 'builder.fieldLabels.h2', 'builder.fieldLabels.h3',
      'builder.fieldLabels.h4',
      'builder.fieldLabels.l', 'builder.fieldLabels.m', 'builder.fieldLabels.s',
      'builder.canvas.viewportTitle', // pure template: {label} ({width})

      // Font names are proper nouns: a designer picks "Playfair Display" and the
      // value stored on the template is that exact string, so translating it
      // would stop matching what is saved.
      'admin.certificateTemplates.font.Inter.label',
      'admin.certificateTemplates.font.Playfair Display.label',
      'admin.certificateTemplates.font.DM Sans.label',
      'admin.certificateTemplates.font.Georgia.label',
      'admin.roleSecurity.admin', // FIDO2 / 2FA — standards names
    ]);

    const hasArabic = (text) => /[\u0600-\u06FF]/.test(text);
    const untranslated = [...arFlat.entries()]
      .filter(([key, text]) => !hasArabic(text) && !nonTranslatable.has(key))
      .map(([key, text]) => `${key} = ${JSON.stringify(text)}`)
      .sort();
    expect(untranslated).toEqual([]);

    // The allowlist must not rot: every entry still has to exist.
    const stale = [...nonTranslatable].filter((key) => !arFlat.has(key)).sort();
    expect(stale).toEqual([]);
  });
});

describe('builder inspector strings', () => {
  const fields = readFileSync(
    resolve(__dirname, '../../frontend/src/components/builder/inspector/fields.ts'),
    'utf8',
  );

  it('resolves every field label and group title through the catalog', () => {
    const labelKeys = [...fields.matchAll(/labelKey: '([^']+)'/g)].map((m) => m[1]);
    const titleKeys = [...fields.matchAll(/titleKey: '([^']+)'/g)].map((m) => m[1]);
    const hintKeys = [...fields.matchAll(/hintKey: '([^']+)'/g)].map((m) => m[1]);
    const placeholderKeys = [...fields.matchAll(/placeholderKey: '([^']+)'/g)].map((m) => m[1]);

    expect(labelKeys.length).toBeGreaterThan(100);
    for (const key of labelKeys) expect(ar.builder.fieldLabels[key], `fieldLabels.${key}`).toBeDefined();
    for (const key of titleKeys) expect(ar.builder.groups[key], `groups.${key}`).toBeDefined();
    for (const key of hintKeys) expect(ar.builder.fieldHints[key], `fieldHints.${key}`).toBeDefined();
    for (const key of placeholderKeys) {
      expect(ar.builder.fieldPlaceholders[key], `fieldPlaceholders.${key}`).toBeDefined();
    }
  });

  it('falls back to the English text rather than showing a dotted key', () => {
    const controls = readFileSync(
      resolve(__dirname, '../../frontend/src/components/builder/inspector/controls.tsx'),
      'utf8',
    );
    // `default: fallback` on every lookup is what keeps a missing key invisible.
    expect(controls).toMatch(/t\(`fieldLabels\.\$\{key\}`, \{ default: fallback \}\)/);
    expect(controls).toMatch(/t\(`fieldHints\.\$\{key\}`, \{ default: fallback \}\)/);
  });
});

/**
 * Keys built from a template string cannot be seen by a literal scan, which is
 * exactly how `builder.canvas.viewport*` went missing once already: the parent
 * block survived, its children were dropped, and every static check still
 * reported full coverage. The template names in the source are the source of
 * truth for which keys must exist.
 */
describe('template-suffixed page-manager keys', () => {
  const source = readFileSync(
    resolve(__dirname, '../../frontend/src/components/builder/page-manager.tsx'),
    'utf8',
  );
  const declared = source.match(/\['blank', 'landing', 'content'\] as (\w+)\[\]/);
  const names = declared ? ['blank', 'landing', 'content'] : [];

  it('finds the template list the keys are built from', () => {
    expect(names, 'the Template union drives tb(`pages.template.${value}`)').toHaveLength(3);
  });

  for (const locale of ['en', 'ar'] as const) {
    it(`${locale} has a label and a hint for every template`, () => {
      const catalog = locale === 'en' ? en : ar;
      const missing: string[] = [];
      for (const name of names) {
        for (const group of ['template', 'templateHint'] as const) {
          const value = catalog.builder.pages[group][name];
          if (typeof value !== 'string' || !value.trim()) {
            missing.push(`builder.pages.${group}.${name}`);
          }
        }
      }
      expect(missing).toEqual([]);
    });
  }

  it('hints describe the template rather than repeating its label', () => {
    for (const name of names) {
      expect(en.builder.pages.templateHint[name]).not.toBe(en.builder.pages.template[name]);
    }
  });
});

/**
 * Keys that are looked up dynamically must resolve to a *string*.
 *
 * `admin-rail` builds `tAdmin(tabKeyMap[href])` from a lookup table. Adding a
 * rail tab whose key is a namespace object (`admin.navigation`) made
 * next-intl throw `INSUFFICIENT_PATH` on every admin page render — the console
 * filled with the error and the rail title was blank, but the build, the audit
 * and every other test stayed green, because "the key exists" and "the key is a
 * string" are different questions.
 */
describe('dynamically addressed keys resolve to strings', () => {
  const rail = readFileSync(
    resolve(__dirname, '../../frontend/src/components/admin/admin-rail.tsx'),
    'utf8',
  );

  const pairs = [...rail.matchAll(/'([^']+)':\s*'([^']+)'/g)]
    .filter(([, path]) => path.startsWith('/'))
    .map(([, path, key]) => ({ path, key }));

  it('finds the rail lookup table', () => {
    expect(pairs.length, 'the rail tab table drives tAdmin()').toBeGreaterThan(5);
  });

  for (const locale of ['en', 'ar'] as const) {
    it(`${locale}: every rail tab title is a non-empty string`, () => {
      const catalog = locale === 'en' ? en : ar;
      const bad: string[] = [];
      for (const { path, key } of pairs) {
        let node: unknown = catalog.admin;
        for (const part of key.split('.')) {
          node = node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined;
        }
        if (typeof node !== 'string' || !node.trim()) {
          bad.push(`${path} -> admin.${key} is ${node === undefined ? 'missing' : typeof node}`);
        }
      }
      expect(bad).toEqual([]);
    });
  }

  it('no catalog namespace is addressed as if it were a string', () => {
    // The general shape of the bug: a namespace object used as a leaf key.
    const leaf = new Set<string>();
    const walk = (value: unknown, prefix: string) => {
      if (typeof value === 'string') {
        leaf.add(prefix);
        return;
      }
      if (value && typeof value === 'object') {
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
          walk(v, prefix ? `${prefix}.${k}` : k);
        }
      }
    };
    walk(ar, '');
    for (const { path, key } of pairs) {
      expect(leaf.has(`admin.${key}`), `admin.${key} (for ${path}) is not a string leaf`).toBe(true);
    }
  });
});
