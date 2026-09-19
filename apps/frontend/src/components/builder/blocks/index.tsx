import type { ComponentType, ReactNode } from 'react';
import type { PuckNode } from '@titan/shared';
import { HeadingBlock } from './heading-block';
import { TextBlock } from './text-block';
import { ButtonBlock } from './button-block';
import { LinkBlock } from './link-block';
import { NavLinkBlock } from './nav-link-block';
import { ImageBlock } from './image-block';
import { IconBlock } from './icon-block';
import { BadgeBlock } from './badge-block';
import { AvatarStackBlock } from './avatar-stack-block';
import { ProgressCardBlock } from './progress-card-block';
import { StackBlock } from './stack-block';
import { GridBlock } from './grid-block';
import { CardBlock } from './card-block';
import { SectionBlock } from './section-block';
import { NavBlock } from './nav-block';
import { HeroBlock } from './hero-block';
import { StatsBlock } from './stats-block';
import { StatItemBlock } from './stat-item-block';
import { PartnerLogosBlock } from './partner-logos-block';
import { LogoItemBlock } from './logo-item-block';
import { FeatureTilesBlock } from './feature-tiles-block';
import { FeatureItemBlock } from './feature-item-block';
import { AcademyGridBlock } from './academy-grid-block';
import { AcademyCardBlock } from './academy-card-block';
import { CtaBannerBlock } from './cta-banner-block';
import { FaqBlock } from './faq-block';
import { FaqItemBlock } from './faq-item-block';
import { FooterBlock } from './footer-block';
import { FooterColBlock } from './footer-col-block'; /** Puck-like slot bridge injected by the public renderer (or Puck itself in the editor). */
export interface PuckBridge {
  renderSlot: (slot: string) => ReactNode;
  /** Raw children of a slot (only the public renderer provides this). */ getSlotData?: (
    slot: string,
  ) => PuckNode[];
} /** Every block component receives `props` (its schema props) and `puck` (to render slots). */
export interface BlockComponentProps<T = Record<string, unknown>> {
  props: T;
  puck: PuckBridge;
} /** The single component map shared by the public renderer and the Puck editor config. */
export const BLOCK_COMPONENTS: Record<string, ComponentType<BlockComponentProps<any>>> = {
  nav: NavBlock,
  hero: HeroBlock,
  stats: StatsBlock,
  'stat-item': StatItemBlock,
  'partner-logos': PartnerLogosBlock,
  'logo-item': LogoItemBlock,
  'feature-tiles': FeatureTilesBlock,
  'feature-item': FeatureItemBlock,
  'academy-grid': AcademyGridBlock,
  'academy-card': AcademyCardBlock,
  'cta-banner': CtaBannerBlock,
  faq: FaqBlock,
  'faq-item': FaqItemBlock,
  footer: FooterBlock,
  'footer-col': FooterColBlock,
  stack: StackBlock,
  grid: GridBlock,
  card: CardBlock,
  section: SectionBlock,
  heading: HeadingBlock,
  text: TextBlock,
  button: ButtonBlock,
  link: LinkBlock,
  'nav-link': NavLinkBlock,
  image: ImageBlock,
  icon: IconBlock,
  badge: BadgeBlock,
  'avatar-stack': AvatarStackBlock,
  'progress-card': ProgressCardBlock,
};
