import { describe, expect, it } from 'vitest';
import {
  BUILDER_PAGE_DEFS,
  DEFAULT_LAYOUTS,
  getDefaultLayout,
  getBuilderPageDef,
} from '../src/constants/page-defaults';

describe('BUILDER_PAGE_DEFS', () => {
  it('keeps academy, products, feed, and events builder-driven with public paths', () => {
    expect(getBuilderPageDef('academy-landing')?.path).toBe('/academy');
    expect(getBuilderPageDef('products')?.path).toBe('/products');
    expect(getBuilderPageDef('feed')?.path).toBe('/feed');
    expect(getBuilderPageDef('events')?.path).toBe('/events');
    for (const def of BUILDER_PAGE_DEFS) {
      expect(def.bespoke).toBeUndefined();
    }
  });

  it('keeps home and legal pages builder-driven without a deep-link path', () => {
    for (const slug of [
      'home',
      'about',
      'privacy',
      'refunds',
      'terms',
      'edu-purchases',
    ] as const) {
      expect(getBuilderPageDef(slug)?.path).toBeUndefined();
    }
  });

  it('every def slug still has a default layout for provisioning', () => {
    for (const def of BUILDER_PAGE_DEFS) {
      expect(DEFAULT_LAYOUTS[def.slug]).toBeDefined();
      expect(getDefaultLayout(def.slug).content.length).toBeGreaterThan(0);
    }
  });
});
