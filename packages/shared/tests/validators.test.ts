import { describe, expect, it } from 'vitest';
import { validatePageLayout, validateLayoutZones } from '../src/validators/page';
import { n, leaf, pack } from '../src/blocks/seeds';
import type { PageLayout, PuckNode } from '../src/types/page';

function layout(content: PuckNode[], zones?: Record<string, PuckNode[]>, schemaVersion?: 1 | 2): PageLayout {
  return { root: { props: {} }, content, ...(zones ? { zones } : {}), ...(schemaVersion ? { schemaVersion } : {}) };
}

describe('validatePageLayout', () => {
  it('accepts a valid layout', () => {
    const out = validatePageLayout(layout([n('hero', {}), n('faq', {})]));
    expect(out.ok).toBe(true);
  });

  it('rejects unknown block types', () => {
    const out = validatePageLayout(layout([n('not-a-block', {})]));
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.issues[0]).toContain('Unknown block type');
  });

  it('rejects invalid props per the block schema', () => {
    const out = validatePageLayout(layout([n('button', { icon: 'not-an-icon-key' })]));
    expect(out.ok).toBe(false);
  });

  it('accepts schemaVersion 2 and rejects version 3', () => {
    expect(validatePageLayout(layout([], undefined, 2)).ok).toBe(true);
    const out = validatePageLayout({ root: { props: {} }, content: [], schemaVersion: 3 });
    expect(out.ok).toBe(false);
  });

  it('validates nested section content', () => {
    const section = n('stats', { id: 's1' });
    const inner = n('stat-item', { id: 'inner' });
    const out = validatePageLayout(layout([section], { 's1:content': [inner] }));
    expect(out.ok).toBe(true);
  });
});

describe('validateLayoutZones (connectivity)', () => {
  it('enforces allow-lists on declared zones', () => {
    const item = pack(n('faq-item', { id: 'fi1' }), 'toggle', [leaf('card', {})]);
    const page = layout([item.node], item.zones);
    const violations = validateLayoutZones(page);
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('does not allow block type "card"');
  });

  it('allows allowed types in the toggle zone', () => {
    const item = pack(n('faq-item', { id: 'fi1' }), 'toggle', [leaf('heading', { text: 'Q' })]);
    expect(validateLayoutZones(layout([item.node], item.zones))).toHaveLength(0);
  });

  it('tolerates zone entries for unknown or undeclared nodes (legacy data)', () => {
    const page = layout([n('hero', { id: 'h1' })], {
      'ghost:content': [n('text', {})],
      'h1:content': [n('text', {})],
      'nonsense': [n('text', {})],
    });
    expect(validateLayoutZones(page)).toHaveLength(0);
  });

  it('surfaces zone violations through validatePageLayout', () => {
    const item = pack(n('faq-item', { id: 'fi2' }), 'toggle', [leaf('icon', { icon: 'search' })]);
    const out = validatePageLayout(layout([item.node], item.zones));
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.issues[0]).toContain('toggle');
  });
});

describe('per-block schema round-trips (precision builder props)', () => {
  it('accepts every new positioning/visual prop with current-default values', () => {
    const nodes = [
      n('nav', {
        topOffset: 16, widthPercent: 95, containerMaxWidth: 1280,
        containerPaddingX: 'px-6 md:px-8', containerPaddingY: 'py-2.5', containerRadius: 'rounded-2xl',
      }),
      n('hero', {
        backgroundOpacity: 20, gradientVeil: true, contentMaxWidth: 1024,
        contentPaddingX: 'px-margin-mobile', scrollIndicatorBottom: 40, parallaxFactor: 10, nonFullHeight: 480,
      }),
      n('stats', {
        overlap: 96, columnsMobile: 'grid-cols-1', columnsSm: 'sm:grid-cols-2', columnsLg: 'lg:grid-cols-4', gap: 'gap-6',
      }),
      n('stat-item', {
        padding: 'lg', bg: 'glass', radius: '2xl', border: true, hover: true, accent: true, accentColor: 'bg-primary',
      }),
      n('partner-logos', { logoGap: 'gap-12 md:gap-24', headerMarginBottom: 40 }),
      n('feature-tiles', {
        sectionBg: 'bg-surface-container-lowest', gap: 64, imageBorder: 8, decorativeCircles: true, imageFirstMobile: false,
      }),
      n('feature-item', { gap: 'gap-5' }),
      n('academy-grid', { headerMarginBottom: 64, cardsColumns: 'md:grid-cols-3', cardsGap: 'gap-8' }),
      n('academy-card', { contentPadding: 'p-8', radius: 'rounded-3xl', mediaAspect: 'aspect-[16/10]' }),
      n('cta-banner', {
        overlayColor: '#004ac6', overlayOpacity: 90, radialVeil: true, padding: 'p-12 md:p-24',
        gap: 64, radius: 'rounded-[3rem]', copyWidth: 'lg:w-3/5', sideWidth: 'lg:w-2/5',
      }),
      n('progress-card', { icon: 'verified', ticks: true, barHeight: 'h-3' }),
      n('faq', { maxWidth: 896, headerMarginBottom: 64, itemsGap: 'space-y-4', footerMarginTop: 64 }),
      n('faq-item', {
        buttonPaddingX: 'px-8', buttonPaddingY: 'py-6', answerPaddingX: 'px-8', answerPaddingBottom: 'pb-6', icon: 'add',
      }),
      n('footer', { gridGap: 'gap-12', columnsSm: 'sm:grid-cols-2', columnsLg: 'md:grid-cols-4', bottomGap: 'gap-8' }),
      n('footer-col', { gap: 'gap-4' }),
      n('avatar-stack', { size: 32, plainCircles: 2 }),
      n('badge', { iconSize: 12 }),
      n('card', { accentColor: 'bg-primary' }),
      n('grid', { columns: 6, gap: 'md-lg' }),
      n('section', { paddingTop: 96, paddingBottom: 96, minHeight: 480 }),
      n('heading', { paddingTop: 8, paddingRight: 8, paddingBottom: 8, paddingLeft: 8, minHeight: 40 }),
    ];
    const out = validatePageLayout(layout(nodes));
    expect(out.ok).toBe(true);
  });

  it('rejects out-of-range values for the new numeric props', () => {
    const bad = validatePageLayout(layout([n('hero', { backgroundOpacity: 101 })]));
    expect(bad.ok).toBe(false);
    const bad2 = validatePageLayout(layout([n('nav', { widthPercent: 10 })]));
    expect(bad2.ok).toBe(false);
    const bad3 = validatePageLayout(layout([n('grid', { columns: 7 })]));
    expect(bad3.ok).toBe(false);
    const bad4 = validatePageLayout(layout([n('cta-banner', { overlayColor: 'blue' })]));
    expect(bad4.ok).toBe(false);
  });

  it('accepts the new section block with a seeded zone', () => {
    const sec = pack(n('section', { id: 'sec1', className: 'bg-secondary/10' }), 'content', [leaf('heading', { as: 'h2', text: 'Hi' })]);
    expect(validatePageLayout(layout([sec.node], sec.zones)).ok).toBe(true);
  });
});
