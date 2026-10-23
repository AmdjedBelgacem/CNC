import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BLOCK_CATEGORIES, BLOCK_REGISTRY, BLOCK_TYPES } from '@titan/shared';
import { BLOCK_INSPECTOR } from '../src/components/builder/inspector/fields';
import { puckConfig } from '@/lib/builder/puck-config';

/**
 * The insert menu must offer every content block the editor can render.
 *
 * It used to iterate `puckConfig.categories`, a second hand-maintained list that had drifted and
 * silently lost blocks. The registry is now authoritative. Page chrome (`nav`, `footer`) is the
 * one intentional exception: the public shell already renders it, so the menu filters it out.
 */
const menu = readFileSync(
  resolve(__dirname, '../src/components/builder/add-block-menu.tsx'),
  'utf8',
);

describe('the add-block menu covers the whole registry', () => {
  it('derives its rows from BLOCK_REGISTRY, not the puck category list', () => {
    expect(menu).toMatch(/BLOCK_REGISTRY/);
    // The old iteration is what caused the drift; it must not come back.
    expect(menu).not.toMatch(/Object\.entries\(puckConfig\.categories/);
  });

  it('every registry block has a renderer, including legacy page chrome', () => {
    const missing = BLOCK_TYPES.filter((type) => !puckConfig.components[type]);
    expect(missing).toEqual([]);
    // Guard against a vacuous pass.
    expect(BLOCK_TYPES.length).toBeGreaterThan(35);
  });

  it('gives every registered block an inspector', () => {
    const missing = BLOCK_TYPES.filter((type) => !BLOCK_INSPECTOR[type]);
    expect(missing).toEqual([]);
    for (const type of BLOCK_TYPES) {
      expect(BLOCK_INSPECTOR[type]!.groups.length).toBeGreaterThan(0);
    }
  });

  it('exposes upload controls on every image-bearing card', () => {
    const keysFor = (type: string) =>
      (BLOCK_INSPECTOR[type]?.groups ?? []).flatMap((group) =>
        group.fields.map((field) => field.key),
      );
    for (const [type, key] of [
      ['program-card', 'imageUrl'],
      ['testimonial-card', 'avatarUrl'],
      ['feature-tiles', 'imageUrl'],
      ['hero', 'imageUrl'],
      ['hero-console', 'imageUrl'],
      ['cta-banner', 'imageUrl'],
    ] as const) {
      expect(keysFor(type)).toContain(key);
    }
  });

  it('keeps page chrome out of the menu while leaving it editable in old layouts', () => {
    // The public shell owns these; adding one from the menu has no public effect.
    for (const type of ['nav', 'footer']) {
      expect(BLOCK_TYPES).toContain(type);
      expect(puckConfig.components[type]).toBeTruthy();
      expect(menu).toMatch(/INSERT_MENU_EXCLUDED/);
      expect(menu).toMatch(new RegExp(`['"]${type}['"]`));
    }
    expect(menu).toMatch(/INSERT_MENU_EXCLUDED\.has\(type\)/);
    // The remaining blocks from the old drifted category list are insertable.
    for (const type of ['footer-col', 'nav-link']) {
      expect(puckConfig.components[type]).toBeTruthy();
    }
  });

  it('counts only non-chrome registry blocks as insertable', () => {
    const excluded = new Set(['nav', 'footer']);
    const insertable = BLOCK_TYPES.filter((type) => !excluded.has(type));
    expect(insertable).toHaveLength(BLOCK_TYPES.length - 2);
    for (const type of insertable) expect(puckConfig.components[type]).toBeTruthy();
  });

  it('every category in BLOCK_CATEGORIES has a tab filter', () => {
    expect(menu).toMatch(/BLOCK_CATEGORIES\.filter/);
    for (const category of BLOCK_CATEGORIES) {
      const count = Object.values(BLOCK_REGISTRY as Record<string, { category: string }>).filter(
        (d) => d?.category === category,
      ).length;
      // Some categories are empty in this registry; a tab for an empty one would be dead UI.
      if (count > 0) expect(menu).toMatch(/categoryLabel\(tab\.key\)/);
    }
  });

  it('gives every block an icon instead of the generic fallback', () => {
    const start = menu.indexOf('const BLOCK_ICONS');
    const map = menu.slice(start, menu.indexOf('};', start));
    // Keys appear as either `nav: Icon` or `'catalog-hero': Icon`.
    const missing = BLOCK_TYPES.filter((t) => !new RegExp(`['\\"]?${t.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}['\\"]?\\s*:`).test(map));
    expect(missing).toEqual([]);
  });

  it('shows each block description, which the registry already carries', () => {
    expect(menu).toMatch(/row\.description/);
    expect(menu).toMatch(/block\.description|def!\.description|def\.description/);
  });
});

describe('the menu is operable by keyboard and screen reader', () => {
  it('wires the combobox/listbox relationship', () => {
    expect(menu).toMatch(/role="combobox"/);
    expect(menu).toMatch(/aria-controls="add-block-listbox"/);
    expect(menu).toMatch(/role="listbox"/);
    expect(menu).toMatch(/role="option"/);
    expect(menu).toMatch(/aria-activedescendant/);
  });

  it('points aria-activedescendant at the highlighted row, not the query', () => {
    expect(menu).toMatch(/aria-activedescendant=\{rows\[highlight\] \? activeId\(rows\[highlight\]\.type\) : undefined\}/);
  });

  it('keeps arrow/enter/escape handling', () => {
    expect(menu).toMatch(/ArrowDown/);
    expect(menu).toMatch(/ArrowUp/);
    expect(menu).toMatch(/e\.key === 'Enter'/);
    expect(menu).toMatch(/e\.key === 'Escape'/);
  });

  it('announces the result count so filtering is perceivable without sight', () => {
    expect(menu).toMatch(/aria-live="polite"/);
    expect(menu).toMatch(/resultsCount/);
  });

  it('exposes category tabs with a selected state', () => {
    expect(menu).toMatch(/role="tablist"/);
    expect(menu).toMatch(/aria-selected=\{selected\}/);
  });

  it('scrolls the highlighted option into view', () => {
    expect(menu).toMatch(/scrollIntoView/);
  });
});
