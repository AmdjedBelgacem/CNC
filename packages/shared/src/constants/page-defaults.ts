import type { PageLayout, BuilderPageSlug } from '../types/page';
import {
  seedHomeLayout,
  seedAcademyLandingLayout,
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
  about: seedAboutLayout(),
  privacy: seedPrivacyLayout(),
  refunds: seedRefundsLayout(),
  terms: seedTermsLayout(),
  'edu-purchases': seedEduPurchasesLayout(),
};

export function getDefaultLayout(slug: string): PageLayout {
  return (DEFAULT_LAYOUTS[slug] ?? { root: { props: {} }, content: [] }) as PageLayout;
}

export const BUILDER_PAGE_DEFS: Readonly<{ slug: BuilderPageSlug; title: string; description: string }[]> = [
  {
    slug: 'home',
    title: 'Homepage',
    description: 'The main marketing homepage.',
  },
  {
    slug: 'academy-landing',
    title: 'Academy Landing',
    description: 'The academy landing page.',
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