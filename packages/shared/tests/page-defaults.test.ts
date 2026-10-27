import { describe, expect, it } from 'vitest';
import {
  BUILDER_PAGE_DEFS,
  DEFAULT_LAYOUTS,
  getDefaultLayout,
  getBuilderPageDef,
  ensureParitySections,
} from '../src/constants/page-defaults';
import type { PageLayout } from '../src/types/page';

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


describe('ensureParitySections', () => {
  const bareHome: PageLayout = {
    root: { props: {} },
    content: [{ type: 'hero-console', props: { id: 'hero' } }],
  };

  it('appends the repository-managed homepage islands to an older published layout', () => {
    const out = ensureParitySections(bareHome, 'home');
    expect(out.content.map((node) => node.props?.variant)).toEqual([
      undefined,
      'home-faq',
      'home-guides',
    ]);
    expect(out.content.slice(-2).map((node) => node.props?.id)).toEqual([
      'home-faq',
      'home-guides',
    ]);
  });

  it('normalises the homepage academy grid to four cards without overriding an explicit limit', () => {
    const withGrid: PageLayout = {
      root: { props: {} },
      content: [
        { type: 'academy-grid', props: { id: 'academies' } },
        { type: 'academy-grid', props: { id: 'explicit', limit: 6 } },
      ],
    };
    const out = ensureParitySections(withGrid, 'home');
    expect(out.content[0]?.props?.limit).toBe(4);
    expect(out.content[1]?.props?.limit).toBe(6);
  });

  it('does not duplicate an island that is already in the layout', () => {
    const once = ensureParitySections(bareHome, 'home');
    const twice = ensureParitySections(once, 'home');
    expect(twice).toBe(once);
    expect(twice.content.filter((node) => node.props?.variant === 'home-faq')).toHaveLength(1);
  });

  it('adds the About facts island and leaves other pages untouched', () => {
    const about = ensureParitySections(bareHome, 'about');
    expect(about.content.at(-1)?.props?.variant).toBe('about-facts');
    expect(ensureParitySections(bareHome, 'privacy')).toBe(bareHome);
  });

  it('normalises a published homepage snapshot without mutating it or un-hiding blocks', () => {
    // Mirrors the shape of a long-lived published layout: an academy grid
    // authored before `limit` existed, deliberately hidden, plus unrelated
    // sections. The read-time fallback must only add the missing fixed islands
    // and the limit — never mutate the stored snapshot or change visibility.
    const published: PageLayout = {
      root: { props: { title: 'Home' } },
      content: [
        { type: 'hero-console', props: { id: 'hero' } },
        {
          type: 'academy-grid',
          props: { id: 'academies', visible: false, paddingTop: 64, paddingBottom: 64 },
        },
        { type: 'program-cards', props: { id: 'curriculum' } },
      ],
    };
    const snapshot = structuredClone(published);

    const out = ensureParitySections(published, 'home');

    expect(published).toEqual(snapshot);
    expect(out.root).toBe(published.root);
    expect(out.content[1]?.props).toMatchObject({ visible: false, limit: 4 });
    expect(out.content.slice(-2).map((node) => node.props?.variant)).toEqual([
      'home-faq',
      'home-guides',
    ]);
    // Idempotent: loading the same page twice must not append a second copy.
    expect(ensureParitySections(out, 'home')).toBe(out);
  });

  it('still appends missing islands when the only change is a missing limit', () => {
    const partial: PageLayout = {
      root: { props: {} },
      content: [
        { type: 'academy-grid', props: { id: 'academies', limit: 0 } },
        { type: 'live-island', props: { id: 'home-faq', variant: 'home-faq' } },
      ],
    };
    const out = ensureParitySections(partial, 'home');
    expect(out.content[0]?.props?.limit).toBe(0);
    expect(out.content.map((node) => node.props?.variant)).toEqual([
      undefined,
      'home-faq',
      'home-guides',
    ]);
  });
});
