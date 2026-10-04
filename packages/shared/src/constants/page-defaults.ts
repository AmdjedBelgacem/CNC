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