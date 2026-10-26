import type { PageLayout, BuilderPageSlug } from '../types/page';
import {
  seedHomeLayout,
  seedAcademyLandingLayout,
  seedProductsLayout,
  seedFeedLayout,
  seedEventsLayout,
  seedAboutLayout,
  seedPrivacyLayout,
  seedRefundsLayout,
  seedTermsLayout,
  seedEduPurchasesLayout,
} from '../blocks/seeds';

/** Fallback layout when no published layout exists for a page slug. */
export const DEFAULT_LAYOUTS: Readonly<Record<string, PageLayout>> = {
  home: seedHomeLayout(),
  'academy-landing': seedAcademyLandingLayout(),
  products: seedProductsLayout(),
  feed: seedFeedLayout(),
  events: seedEventsLayout(),
  about: seedAboutLayout(),
  privacy: seedPrivacyLayout(),
  refunds: seedRefundsLayout(),
  terms: seedTermsLayout(),
  'edu-purchases': seedEduPurchasesLayout(),
};

export function getDefaultLayout(slug: string): PageLayout {
  return (DEFAULT_LAYOUTS[slug] ?? { root: { props: {} }, content: [] }) as PageLayout;
}

/**
 * Repository-managed sections that are not tenant data.
 *
 * Published layouts authored before these sections existed cannot be mutated in
 * place (that would silently overwrite an admin's page). Instead both the public
 * renderer and the builder append the missing fixed islands at read time, in the
 * same position, so the canvas and the live page stay identical until the admin
 * chooses to save the draft.
 */
const PARITY_ISLANDS: Readonly<
  Record<string, ReadonlyArray<{ variant: string; label: string; id: string }>>
> = {
  home: [
    { variant: 'home-faq', label: 'Homepage FAQ — repository-managed', id: 'home-faq' },
    { variant: 'home-guides', label: 'CNC guides — repository-managed', id: 'home-guides' },
  ],
  about: [
    { variant: 'about-facts', label: 'About facts — repository-managed', id: 'about-facts' },
  ],
};

export function ensureParitySections(layout: PageLayout, slug: string): PageLayout {
  const defs = PARITY_ISLANDS[slug];
  if (!defs?.length) return layout;

  const content = layout.content ?? [];
  // The homepage always shows four academy cards. Older published layouts were
  // authored before the block had a `limit` prop, so normalise it here instead
  // of showing every academy in the builder while the public page shows four.
  let changed = false;
  const normalised =
    slug === 'home'
      ? content.map((node) => {
          if (node.type === 'academy-grid' && typeof node.props?.limit !== 'number') {
            changed = true;
            return { ...node, props: { ...node.props, limit: 4 } };
          }
          return node;
        })
      : content;
  const present = new Set(
    normalised
      .filter((node) => node.type === 'live-island')
      .map((node) => node.props?.variant)
      .filter((variant): variant is string => typeof variant === 'string'),
  );
  const missing = defs.filter((def) => !present.has(def.variant));
  if (missing.length === 0 && !changed) return layout;

  const nodes = missing.map((def) => ({
    type: 'live-island',
    props: {
      id: def.id,
      variant: def.variant,
      label: def.label,
      paddingTop: 64,
      paddingBottom: 64,
    },
  }));

  return { ...layout, content: [...normalised, ...nodes] };
}

export interface BuilderPageDef {
  slug: BuilderPageSlug;
  title: string;
  description: string;
  /** Public route path (for deep links from the editor). */
  path?: string;
}

export const BUILDER_PAGE_DEFS: Readonly<BuilderPageDef[]> = [
  {
    slug: 'home',
    title: 'Homepage',
    description: 'The main marketing homepage.',
  },
  {
    slug: 'academy-landing',
    title: 'Academy Landing',
    description: 'The academy landing page.',
    path: '/academy',
  },
  {
    slug: 'products',
    title: 'Products',
    description: 'Product catalog with live inventory and filters.',
    path: '/products',
  },
  {
    slug: 'feed',
    title: 'Community Feed',
    description: 'Social feed with posts, likes, and comments.',
    path: '/feed',
  },
  {
    slug: 'events',
    title: 'Events',
    description: 'Upcoming workshops, webinars, conferences, and meetups.',
    path: '/events',
  },
  {
    slug: 'about',
    title: 'About',
    description: 'Our story, DNA, journey, team and trust badges.',
  },
  {
    slug: 'privacy',
    title: 'Privacy Policy',
    description: 'How we collect, use, and protect personal information.',
  },
  {
    slug: 'refunds',
    title: 'Refund Policy',
    description: 'Our refund and return policy.',
  },
  {
    slug: 'terms',
    title: 'Terms of Service',
    description: 'Terms governing use of the platform.',
  },
  {
    slug: 'edu-purchases',
    title: 'Educational Purchases',
    description: 'Academic pricing and institutional licensing.',
  },
];

export function getBuilderPageDef(slug: string): BuilderPageDef | undefined {
  return BUILDER_PAGE_DEFS.find((d) => d.slug === slug);
}