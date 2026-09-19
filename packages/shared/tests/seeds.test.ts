import { describe, expect, it } from 'vitest';
import { validatePageLayout } from '../src/validators/page';
import type { PageLayout, PuckNode } from '../src/types/page';
import { getSlotChildren, walkLayoutNodes } from '../src/blocks/slots';
import type { SeedResult } from '../src/blocks/registry';
import {
  seedNav,
  seedHero,
  seedStats,
  seedPartnerLogos,
  seedFeatureTiles,
  seedAcademyGrid,
  seedCtaBanner,
  seedFaq,
  seedFooter,
  seedHomeLayout,
  seedAcademyLandingLayout,
  FAQ_ITEMS,
} from '../src/blocks/seeds';

function asLayout(seed: SeedResult): PageLayout {
  return { root: { props: {} }, content: [seed.node] };
}

/** Slot children of a node (inline shape). */
function slot(node: PuckNode, name: string): PuckNode[] {
  return getSlotChildren(node, name);
}

/** Collects every node id in a subtree so we can assert uniqueness. */
function collectIds(seed: SeedResult): string[] {
  const ids: string[] = [];
  walkLayoutNodes({ root: { props: {} }, content: [seed.node] }, (node) => {
    ids.push((node.props?.id as string | undefined) ?? '');
  });
  return ids;
}

const ALL_SEEDS = [
  seedNav(),
  seedHero(),
  seedStats(),
  seedPartnerLogos(),
  seedFeatureTiles(),
  seedAcademyGrid(),
  seedCtaBanner(),
  seedFaq(),
  seedFooter(),
];

describe('seeds', () => {
  it('nav seed produces logo, link row and actions', () => {
    const seed = seedNav();
    const content = slot(seed.node, 'content');
    expect(content.map((node) => node.type)).toEqual(['heading', 'stack', 'stack']);
    expect(content[0].props).toMatchObject({ as: 'span', size: 'logo', text: 'Ahmad CNC' });
    const links = slot(content[1], 'content');
    expect(links).toHaveLength(4);
    expect(links[0].props).toMatchObject({ active: true, label: 'ACADEMIES', href: '/academy' });
    expect(links[1].props).toMatchObject({ active: false, href: '/products' });
    const actions = slot(content[2], 'content');
    expect(actions.map((node) => node.type)).toEqual(['icon', 'link', 'button']);
    expect(actions[0].props).toMatchObject({ icon: 'search', href: '/products' });
    expect(actions[1].props).toMatchObject({ label: 'Sign In', href: '/login' });
    expect(actions[2].props).toMatchObject({ variant: 'nav-cta', label: 'Get Started', href: '/register' });
  });

  it('hero seed contains badge, h1 with line-break text, subtitle and two CTA buttons', () => {
    const seed = seedHero();
    const content = slot(seed.node, 'content');
    expect(content.map((node) => node.type)).toEqual(['badge', 'heading', 'text', 'stack']);
    expect(content[1].props).toMatchObject({ as: 'h1', size: 'hero', text: 'Engineering\nPrecision' });
    expect(content[2].props).toMatchObject({ size: 'lg', color: 'text-text-secondary' });
    const stack = slot(content[3], 'content');
    expect(stack.map((node) => node.type)).toEqual(['button', 'button']);
    expect(stack[0].props).toMatchObject({ variant: 'primary' });
    expect(stack[1].props).toMatchObject({ variant: 'glass' });
  });

  it('stats seed builds four stat-item cards with icon, tag, number and label', () => {
    const seed = seedStats();
    const items = slot(seed.node, 'content');
    expect(items).toHaveLength(4);
    for (const item of items) {
      expect(item.type).toBe('stat-item');
      const content = slot(item, 'content');
      expect(content.map((node) => node.type)).toEqual(['stack', 'heading', 'text']);
      expect(content[1].props).toMatchObject({ as: 'h3', size: 'stats' });
      expect(content[2].props).toMatchObject({ size: '2xs', uppercase: true, tracking: '0.2em' });
    }
    const firstRow = slot(items[0], 'content')[0];
    const firstRowKids = slot(firstRow, 'content');
    expect(firstRowKids.map((node) => node.type)).toEqual(['icon', 'badge']);
    expect(firstRowKids[0].props).toMatchObject({ icon: 'groups', box: 'tinted' });
    expect(firstRowKids[1].props).toMatchObject({ variant: 'secondary', icon: 'trending_up' });
  });

  it('partner-logos seed has an eyebrow header and five logo items', () => {
    const seed = seedPartnerLogos();
    const header = slot(seed.node, 'header');
    expect(header).toHaveLength(1);
    expect(header[0].props).toMatchObject({ text: 'Trusted by Global Leaders', size: 'xs', uppercase: true });
    const logos = slot(seed.node, 'logos');
    expect(logos).toHaveLength(5);
    expect(logos[0].type).toBe('logo-item');
    expect(slot(logos[0], 'content')[0].type).toBe('image');
    const wordmark = slot(logos[2], 'content');
    expect(wordmark[0].type).toBe('stack');
    const wordmarkKids = slot(wordmark[0], 'content');
    expect(wordmarkKids.map((node) => node.type)).toEqual(['icon', 'heading']);
    expect(wordmarkKids[1].props).toMatchObject({ text: 'DESOAN' });
  });

  it('feature-tiles seed has eyebrow, title and three feature rows', () => {
    const seed = seedFeatureTiles();
    const content = slot(seed.node, 'content');
    expect(content.map((node) => node.type)).toEqual(['text', 'heading', 'feature-item', 'feature-item', 'feature-item']);
    expect(content[0].props).toMatchObject({ text: 'The Machinist Advantage', color: 'text-primary', uppercase: true });
    const itemContent = slot(content[2], 'content');
    expect(itemContent.map((node) => node.type)).toEqual(['icon', 'stack']);
    expect(itemContent[0].props).toMatchObject({ box: 'white' });
  });

  it('academy-grid seed builds header row and three full academy cards', () => {
    const seed = seedAcademyGrid();
    const header = slot(seed.node, 'header');
    expect(header.map((node) => node.type)).toEqual(['stack', 'button']);
    expect(header[1].props).toMatchObject({ variant: 'pill', icon: 'arrow_forward' });
    const cards = slot(seed.node, 'cards');
    expect(cards).toHaveLength(3);
    const first = cards[0];
    expect(first.type).toBe('academy-card');
    const media = slot(first, 'media');
    expect(media).toHaveLength(1);
    expect(media[0].props).toMatchObject({ aspectRatio: '16/10' });
    const cardContent = slot(first, 'content');
    expect(cardContent.map((node) => node.type)).toEqual(['stack', 'heading', 'text', 'stack']);
    const pillRow = slot(cardContent[0], 'content');
    expect(pillRow.map((node) => node.type)).toEqual(['badge', 'text']);
    const footer = slot(cardContent[3], 'content');
    expect(footer.map((node) => node.type)).toEqual(['avatar-stack', 'button']);
    expect(footer[1].props).toMatchObject({ variant: 'enroll', label: 'Enroll Now' });
  });

  it('cta-banner seed has copy column and a progress card in the side column', () => {
    const seed = seedCtaBanner();
    const copy = slot(seed.node, 'copy');
    expect(copy.map((node) => node.type)).toEqual(['heading', 'text', 'stack']);
    expect(copy[0].props).toMatchObject({ color: 'text-white' });
    const side = slot(seed.node, 'side');
    expect(side).toHaveLength(1);
    expect(side[0].type).toBe('progress-card');
  });

  it('faq seed builds header, four static faq items and a support footer', () => {
    const seed = seedFaq();
    const header = slot(seed.node, 'header');
    expect(header.map((node) => node.type)).toEqual(['text', 'heading']);
    expect(header[0].props).toMatchObject({ text: 'Support Center', color: 'text-primary' });
    const items = slot(seed.node, 'items');
    expect(items).toHaveLength(4);
    const first = items[0];
    expect(slot(first, 'toggle')[0].props).toMatchObject({ text: FAQ_ITEMS[0].question });
    expect(slot(first, 'content')[0].type).toBe('text');
    const footer = slot(seed.node, 'footer');
    expect(footer.map((node) => node.type)).toEqual(['text', 'button']);
    expect(footer[1].props).toMatchObject({ variant: 'link', icon: 'arrow_forward' });
  });

  it('footer seed has brand column, three link columns and a bottom bar', () => {
    const seed = seedFooter();
    const cols = slot(seed.node, 'columns');
    expect(cols).toHaveLength(4);
    const brandKids = slot(cols[0], 'content');
    expect(brandKids.map((node) => node.type)).toEqual(['heading', 'text', 'stack']);
    expect(brandKids[2] && slot(brandKids[2], 'content').map((node) => node.type)).toEqual(['link', 'link']);
    const linkColKids = slot(cols[1], 'content');
    expect(linkColKids.map((node) => node.type)).toEqual(['heading', 'link', 'link', 'link', 'link']);
    const bottom = slot(seed.node, 'bottom');
    expect(bottom.map((node) => node.type)).toEqual(['text', 'stack']);
  });

  it('every seed produces unique ids and a valid page layout', () => {
    for (const seed of ALL_SEEDS) {
      const ids = collectIds(seed);
      expect(new Set(ids).size, `ids for "${seed.node.type}" should be unique`).toBe(ids.length);
      const result = validatePageLayout(asLayout(seed));
      expect(result.ok, `seed for "${seed.node.type}" should validate: ${result.ok ? '' : result.issues.join('; ')}`).toBe(true);
    }
  });

  it('home layout contains all eight sections in mockup order (floating nav lives in the app shell, not the seed)', () => {
    const layout = seedHomeLayout();
    expect(layout.content.map((node) => node.type)).toEqual([
      'hero',
      'stats',
      'partner-logos',
      'feature-tiles',
      'academy-grid',
      'cta-banner',
      'faq',
      'footer',
    ]);
    expect(validatePageLayout(layout).ok).toBe(true);
  });

  it('academy landing layout validates', () => {
    const layout = seedAcademyLandingLayout();
    expect(layout.content.map((node) => node.type)).toEqual(['hero', 'academy-grid']);
    expect(validatePageLayout(layout).ok).toBe(true);
  });
});
