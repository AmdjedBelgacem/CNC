import { z } from 'zod';
import { ICON_KEYS, type IconKey } from '../types/theme';
import type { PuckNode } from '../types/page';

/**
 * Block registry — the single source of truth for the layout builder.
 *
 * The taxonomy mirrors the landing page mockup 1:1:
 *  - Chrome     nav, footer
 *  - Sections   hero, stats, partner-logos, feature-tiles, academy-grid, cta-banner, faq
 *  - Items      stat-item, logo-item, feature-item, academy-card, faq-item, footer-col
 *  - Layout     stack, grid, card
 *  - Content    heading, text, button, link, image, icon, badge, nav-link, avatar-stack, progress-card
 *
 * Every container block declares `zones` so the Puck editor offers a real
 * drop target and every element stays selectable, movable and embeddable.
 * The public renderer, the Puck editor config and the backend validation all
 * derive from this registry, so they can never drift apart.
 */

export const layoutPropsSchema = z.object({
  marginTop: z.number().int().min(0).max(320).optional(),
  marginBottom: z.number().int().min(0).max(320).optional(),
  maxWidth: z.number().int().min(0).max(2560).optional(),
  /** Universal box padding (px) — applies to the block's root element. */
  paddingTop: z.number().int().min(0).max(320).optional(),
  paddingRight: z.number().int().min(0).max(320).optional(),
  paddingBottom: z.number().int().min(0).max(320).optional(),
  paddingLeft: z.number().int().min(0).max(320).optional(),
  /** Minimum height (px) — applied to the block's root element. */
  minHeight: z.number().int().min(0).max(3000).optional(),
  /** Extra CSS class passthrough (used by seeds to pin exact mockup classes). */
  className: z.string().max(300).optional(),
});
export type LayoutProps = z.infer<typeof layoutPropsSchema>;

export const iconKeySchema = z.enum(ICON_KEYS);

// ------------------------------------------------------------------
// Content — primitives (leaf nodes: never nest other blocks)
// ------------------------------------------------------------------

export const textStyleSchema = z.object({
  align: z.enum(['left', 'center', 'right']).optional(),
  /** Named color class (`text-primary`, `text-text-muted`, ...) or a hex string. */
  color: z.string().max(100).optional(),
  /** Literal letter-spacing in em, rendered as tracking-[X] (mockup classes). */
  tracking: z.enum(['none', '0.025em', '0.05em', '0.1em', '0.15em', '0.2em']).optional(),
  weight: z.enum(['normal', 'medium', 'semibold', 'bold']).optional(),
  /** Text opacity (0-100). */
  opacity: z.number().int().min(0).max(100).optional(),
});
export type TextStyle = z.infer<typeof textStyleSchema>;

export const headingPropsSchema = layoutPropsSchema.extend({
  id: z.string().optional(),
  as: z.enum(['h1', 'h2', 'h3', 'h4', 'span', 'strong']).default('h2'),
  text: z.string().max(300).default('Heading'),
  align: z.enum(['left', 'center', 'right']).optional(),
  color: z.string().max(100).optional(),
  /** Mockup heading treatments. */
  size: z
    .enum(['hero', 'headline-lg', 'headline-md', 'stats', '2xl', 'xl', 'lg', 'md', 'sm', 'label', 'logo'])
    .optional(),
  /** Letter-spacing override (em). */
  tracking: z.enum(['none', '0.025em', '0.05em', '0.1em', '0.15em', '0.2em']).optional(),
  /** Line-height override. */
  leading: z.enum(['none', 'tight', 'snug', 'normal', 'relaxed', 'loose']).optional(),
});
export type HeadingProps = z.infer<typeof headingPropsSchema>;

export const headingDefaults: HeadingProps = { as: 'h2', text: 'Heading', size: 'headline-lg' };

export const textPropsSchema = layoutPropsSchema.extend({
  id: z.string().optional(),
  text: z.string().max(2000).default('Body text'),
  align: z.enum(['left', 'center', 'right']).optional(),
  color: z.string().max(100).optional(),
  /** 2xs = 10px, xs = 11px, sm = 12px, md = 16px, lg = 18px (mockup labels/body). */
  size: z.enum(['2xs', 'xs', 'sm', 'md', 'lg']).optional(),
  /** All-caps (label treatment). */
  uppercase: z.boolean().optional(),
  tracking: z.enum(['none', '0.025em', '0.05em', '0.1em', '0.15em', '0.2em']).optional(),
  weight: z.enum(['normal', 'medium', 'semibold', 'bold']).optional(),
  opacity: z.number().int().min(0).max(100).optional(),
  /** Line-height override. */
  leading: z.enum(['none', 'tight', 'snug', 'normal', 'relaxed', 'loose']).optional(),
});
export type TextProps = z.infer<typeof textPropsSchema>;

export const textDefaults: TextProps = { text: 'Body text' };

export const buttonPropsSchema = layoutPropsSchema.extend({
  id: z.string().optional(),
  label: z.string().max(120).default('Button'),
  href: z.string().max(600).optional(),
  /** Mockup treatments: primary (solid blue), glass, white, white-outline, pill, nav-cta, link, enroll. */
  variant: z
    .enum(['primary', 'glass', 'white', 'white-outline', 'pill', 'nav-cta', 'link', 'enroll'])
    .default('primary'),
  icon: iconKeySchema.optional(),
  iconPosition: z.enum(['left', 'right']).default('right'),
  /** Size treatment (ignored by variants with fixed compact sizing). */
  size: z.enum(['sm', 'md', 'lg']).default('md'),
  /** Full-width button (block-level) vs. natural width. */
  width: z.enum(['auto', 'full']).default('auto'),
});
export type ButtonProps = z.infer<typeof buttonPropsSchema>;

export const buttonDefaults: ButtonProps = { label: 'Button', href: '/', variant: 'primary', iconPosition: 'right', size: 'md', width: 'auto' };

/** Simple text anchor (footer links, inline links, icon circles). */
export const linkPropsSchema = layoutPropsSchema.extend({
  id: z.string().optional(),
  label: z.string().max(120).default('Link'),
  href: z.string().max(600).optional(),
  /** When set (and no label), renders an icon-only circle anchor (social links). */
  icon: iconKeySchema.optional(),
});
export type LinkProps = z.infer<typeof linkPropsSchema>;

export const linkDefaults: LinkProps = { label: 'Link', href: '#' };

/** Nav bar link (uppercase small label). */
export const navLinkPropsSchema = layoutPropsSchema.extend({
  id: z.string().optional(),
  label: z.string().max(120).default('Link'),
  href: z.string().max(600).optional(),
  /** First/active link is primary-colored. */
  active: z.boolean().optional(),
});
export type NavLinkProps = z.infer<typeof navLinkPropsSchema>;

export const navLinkDefaults: NavLinkProps = { label: 'Link', href: '#', active: false };

export const imagePropsSchema = layoutPropsSchema.extend({
  id: z.string().optional(),
  src: z.string().max(1000).default(''),
  alt: z.string().max(300).default(''),
  width: z.number().int().min(0).max(2560).optional(),
  height: z.number().int().min(0).max(2560).optional(),
  objectFit: z.enum(['cover', 'contain', 'fill']).default('cover'),
  radius: z.enum(['none', 'sm', 'md', 'lg', 'full']).default('none'),
  /** Fixed aspect ratio (e.g. "4/3" for the feature image, "16/10" for academy cards). */
  aspectRatio: z.enum(['none', '4/3', '16/10']).default('none'),
});
export type ImageProps = z.infer<typeof imagePropsSchema>;

export const imageDefaults: ImageProps = { src: '', alt: '', objectFit: 'cover', radius: 'none', aspectRatio: 'none' };

/** Material Symbols glyph; optionally wrapped in a link. */
export const iconPropsSchema = layoutPropsSchema.extend({
  id: z.string().optional(),
  icon: iconKeySchema,
  size: z.number().int().min(8).max(96).default(24),
  color: z.string().max(100).optional(),
  /** When set, the icon renders inside an anchor (e.g. the navbar search). */
  href: z.string().max(600).optional(),
  /** Icon tile treatment: none (bare glyph), tinted (primary/10 rounded tile), white (white bordered tile). */
  box: z.enum(['none', 'tinted', 'white']).optional(),
});
export type IconProps = z.infer<typeof iconPropsSchema>;

export const iconDefaults: IconProps = { icon: 'verified', size: 24 };

export const badgePropsSchema = layoutPropsSchema.extend({
  id: z.string().optional(),
  text: z.string().max(200).default('Eyebrow'),
  color: z.string().max(100).optional(),
  /** Pill treatments from the mockup: glow (hero eyebrow), primary, secondary (with icon), neutral, card (level pill). */
  variant: z.enum(['glow', 'primary', 'secondary', 'neutral', 'card']).optional(),
  /** sm = 10px compact pill (stat tags / level pills), md = 12px pill (eyebrows). */
  size: z.enum(['sm', 'md']).optional(),
  uppercase: z.boolean().optional(),
  icon: iconKeySchema.optional(),
  /** Icon size in px (secondary variant only). */
  iconSize: z.number().int().min(4).max(64).optional(),
});
export type BadgeProps = z.infer<typeof badgePropsSchema>;

export const badgeDefaults: BadgeProps = { text: 'Eyebrow', variant: 'glow', size: 'md', iconSize: 12 };

/** Avatar stack (three overlapping circles + "+80" pill). */
export const avatarStackPropsSchema = layoutPropsSchema.extend({
  id: z.string().optional(),
  count: z.string().max(40).default('+80'),
  /** Circle diameter in px (all three circles). */
  size: z.number().int().min(16).max(128).optional(),
  /** Number of leading plain circles (mockup: 2). */
  plainCircles: z.number().int().min(0).max(4).optional(),
});
export type AvatarStackProps = z.infer<typeof avatarStackPropsSchema>;

export const avatarStackDefaults: AvatarStackProps = { count: '+80', size: 32, plainCircles: 2 };

/** Certification progress card (CTA banner). */
export const progressCardPropsSchema = layoutPropsSchema.extend({
  id: z.string().optional(),
  percent: z.number().int().min(0).max(100).default(85),
  title: z.string().max(120).default('Certification Status'),
  subtitle: z.string().max(200).default('Industry Accredited'),
  label: z.string().max(200).default('Core Mastery Progress'),
  value: z.string().max(40).default('85.4%'),
  /** Material glyph in the icon tile. */
  icon: iconKeySchema.optional(),
  /** Show the three tick marks under the bar. */
  ticks: z.boolean().optional(),
  /** Progress bar height. */
  barHeight: z.enum(['h-2', 'h-2.5', 'h-3', 'h-4']).optional(),
});
export type ProgressCardProps = z.infer<typeof progressCardPropsSchema>;

export const progressCardDefaults: ProgressCardProps = {
  percent: 85,
  title: 'Certification Status',
  subtitle: 'Industry Accredited',
  label: 'Core Mastery Progress',
  value: '85.4%',
  icon: 'verified',
  ticks: true,
  barHeight: 'h-3',
};

// ------------------------------------------------------------------
// Layout — containers
// ------------------------------------------------------------------

export const stackPropsSchema = layoutPropsSchema.extend({
  id: z.string().optional(),
  direction: z.enum(['column', 'row']).default('column'),
  /** Mobile direction override; desktop keeps `direction`. */
  directionMobile: z.enum(['none', 'column', 'row']).optional(),
  gap: z.enum(['none', 'sm', 'md', 'md-2', 'md-lg', 'lg', 'xl']).default('md'),
  align: z.enum(['start', 'center', 'end', 'stretch']).default('center'),
  justify: z.enum(['start', 'center', 'end', 'between']).default('center'),
  wrap: z.boolean().default(false),
  bg: z.enum(['transparent', 'glass']).optional(),
});
export type StackProps = z.infer<typeof stackPropsSchema>;

export const stackDefaults: StackProps = { direction: 'column', gap: 'md', align: 'center', justify: 'center', wrap: false };

export const gridPropsSchema = layoutPropsSchema.extend({
  id: z.string().optional(),
  columns: z.number().int().min(1).max(6).default(3),
  gap: z.enum(['sm', 'md', 'md-lg', 'lg', 'xl']).default('lg'),
});
export type GridProps = z.infer<typeof gridPropsSchema>;

export const gridDefaults: GridProps = { columns: 3, gap: 'lg' };

export const cardPropsSchema = layoutPropsSchema.extend({
  id: z.string().optional(),
  padding: z.enum(['none', 'sm', 'md', 'lg']).default('md'),
  bg: z.enum(['transparent', 'muted', 'glass', 'gradient', 'gradient-muted']).default('transparent'),
  radius: z.enum(['none', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', 'full']).default('lg'),
  border: z.boolean().default(true),
  align: z.enum(['left', 'center', 'right']).default('left'),
  /** Richer drop shadow (outside the hover state). */
  shadow: z.enum(['none', 'sm', 'md', 'lg', 'xl', 'glow']).optional().default('none'),
  hover: z.boolean().optional().default(false),
  accent: z.boolean().optional().default(false),
  /** Accent bar color (accent mode only). */
  accentColor: z.enum(['bg-primary', 'bg-secondary', 'bg-accent']).optional(),
});
export type CardProps = z.infer<typeof cardPropsSchema>;

export const cardDefaults: CardProps = { padding: 'md', bg: 'transparent', radius: 'lg', border: true, align: 'left', shadow: 'none', hover: false, accent: false, accentColor: 'bg-primary' };

// ------------------------------------------------------------------
// Items — small domain containers
// ------------------------------------------------------------------

export const statItemPropsSchema = cardPropsSchema.extend({
  id: z.string().optional(),
});
export type StatItemProps = z.infer<typeof statItemPropsSchema>;

export const statItemDefaults: StatItemProps = {
  padding: 'lg',
  bg: 'glass',
  radius: '3xl',
  border: false,
  align: 'left',
  shadow: 'none',
  hover: true,
  accent: true,
};

export const logoItemPropsSchema = layoutPropsSchema.extend({
  id: z.string().optional(),
});
export type LogoItemProps = z.infer<typeof logoItemPropsSchema>;

export const logoItemDefaults: LogoItemProps = {};

export const featureItemPropsSchema = layoutPropsSchema.extend({
  id: z.string().optional(),
  /** Horizontal gap between icon tile and text. */
  gap: z.enum(['gap-4', 'gap-5', 'gap-6', 'gap-8']).optional(),
});
export type FeatureItemProps = z.infer<typeof featureItemPropsSchema>;

export const featureItemDefaults: FeatureItemProps = { gap: 'gap-5' };

export const academyCardPropsSchema = layoutPropsSchema.extend({
  id: z.string().optional(),
  /** Wraps the whole card in an anchor when set. */
  href: z.string().max(600).optional(),
  /** Content column padding. */
  contentPadding: z.enum(['p-6', 'p-8', 'p-10']).optional(),
  /** Card corner radius. */
  radius: z.enum(['rounded-2xl', 'rounded-3xl', 'rounded-[2rem]']).optional(),
  /** Media region aspect ratio. Only wraps the media when set. */
  mediaAspect: z.enum(['aspect-[16/10]', 'aspect-video', 'aspect-square']).optional(),
});
export type AcademyCardProps = z.infer<typeof academyCardPropsSchema>;

export const academyCardDefaults: AcademyCardProps = { contentPadding: 'p-8', radius: 'rounded-3xl' };

export const faqItemPropsSchema = layoutPropsSchema.extend({
  id: z.string().optional(),
  /** Toggle row horizontal padding. */
  buttonPaddingX: z.enum(['px-6', 'px-8', 'px-10']).optional(),
  /** Toggle row vertical padding. */
  buttonPaddingY: z.enum(['py-5', 'py-6', 'py-8']).optional(),
  /** Answer panel horizontal padding. */
  answerPaddingX: z.enum(['px-6', 'px-8', 'px-10']).optional(),
  /** Answer panel bottom padding. */
  answerPaddingBottom: z.enum(['pb-6', 'pb-8', 'pb-10']).optional(),
  /** Toggle icon glyph. */
  icon: iconKeySchema.optional(),
});
export type FaqItemProps = z.infer<typeof faqItemPropsSchema>;

export const faqItemDefaults: FaqItemProps = { buttonPaddingX: 'px-8', buttonPaddingY: 'py-6', answerPaddingX: 'px-8', answerPaddingBottom: 'pb-6', icon: 'add' };

export const footerColPropsSchema = layoutPropsSchema.extend({
  id: z.string().optional(),
  /** Vertical gap between column entries. */
  gap: z.enum(['gap-2', 'gap-4', 'gap-6']).optional(),
});
export type FooterColProps = z.infer<typeof footerColPropsSchema>;

export const footerColDefaults: FooterColProps = { gap: 'gap-4' };

// ------------------------------------------------------------------
// Sections
// ------------------------------------------------------------------

export const navPropsSchema = layoutPropsSchema.extend({
  id: z.string().optional(),
  /** Distance from the top of the viewport (px). */
  topOffset: z.number().int().min(0).max(320).optional(),
  /** Floating bar width as a percentage of the viewport. */
  widthPercent: z.number().int().min(20).max(100).optional(),
  /** Floating bar max width (px). */
  containerMaxWidth: z.number().int().min(320).max(2560).optional(),
  /** Glass container horizontal padding. */
  containerPaddingX: z.enum(['px-4 md:px-6', 'px-6 md:px-8', 'px-8 md:px-10']).optional(),
  /** Glass container vertical padding. */
  containerPaddingY: z.enum(['py-2', 'py-2.5', 'py-3', 'py-4']).optional(),
  /** Glass container corner radius. */
  containerRadius: z.enum(['rounded-lg', 'rounded-xl', 'rounded-2xl', 'rounded-3xl']).optional(),
});
export type NavProps = z.infer<typeof navPropsSchema>;

export const navDefaults: NavProps = { topOffset: 16, widthPercent: 95, containerMaxWidth: 1440, containerPaddingX: 'px-6 md:px-8', containerPaddingY: 'py-2.5', containerRadius: 'rounded-2xl' };

export const heroPropsSchema = layoutPropsSchema.extend({
  id: z.string().optional(),
  imageUrl: z.string().max(1000).optional(),
  fullHeight: z.boolean().optional().default(true),
  scrollIndicator: z.boolean().optional().default(true),
  backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  /** Opacity (0-100) of the veil drawn over the background image. */
  backgroundOverlay: z.number().int().min(0).max(100).optional(),
  /** Opacity (0-100) of the background image itself. */
  backgroundOpacity: z.number().int().min(0).max(100).optional(),
  /** Soft gradient veil over the background image. */
  gradientVeil: z.boolean().optional(),
  /** Content column max width (px). */
  contentMaxWidth: z.number().int().min(320).max(2560).optional(),
  /** Content column horizontal padding. */
  contentPaddingX: z.enum(['px-margin-mobile', 'px-4', 'px-6', 'px-8']).optional(),
  /** Distance of the scroll indicator from the bottom (px). */
  scrollIndicatorBottom: z.number().int().min(0).max(320).optional(),
  /** Scroll parallax factor, percent (0 disables). */
  parallaxFactor: z.number().int().min(0).max(100).optional(),
  /** Min height (px) when fullHeight is off. */
  nonFullHeight: z.number().int().min(200).max(3000).optional(),
  contentAlign: z.enum(['center', 'left']).optional(),
  /** Trust chips row (avatars + rating + note) under the content zone. */
  showTrustChips: z.boolean().optional().default(true),
  /** Trust chips note text. */
  trustNote: z.string().max(120).optional(),
  /** When set, the trust chips note renders as a link. */
  trustNoteHref: z.string().max(600).optional(),
  /** Animated gradient mesh behind the content. */
  mesh: z.boolean().optional().default(true),
});
export type HeroProps = z.infer<typeof heroPropsSchema>;

export const heroDefaults: HeroProps = {
  imageUrl:
    '',
  fullHeight: true,
  scrollIndicator: true,
  backgroundOverlay: 80,
  backgroundOpacity: 20,
  gradientVeil: true,
  contentMaxWidth: 1024,
  contentPaddingX: 'px-margin-mobile',
  scrollIndicatorBottom: 40,
  parallaxFactor: 10,
  nonFullHeight: 480,
  contentAlign: 'center',
  paddingTop: 96,
  showTrustChips: true,
  trustNote: 'Free manufacturing education for all',
  mesh: true,
};

export const statsPropsSchema = layoutPropsSchema.extend({
  id: z.string().optional(),
  /** Negative top margin pulling the grid over the previous section (px). */
  overlap: z.number().int().min(0).max(320).optional(),
  /** Column count on mobile. */
  columnsMobile: z.enum(['grid-cols-1', 'grid-cols-2']).optional(),
  /** Column count on sm+. */
  columnsSm: z.enum(['sm:grid-cols-2', 'sm:grid-cols-3']).optional(),
  /** Column count on lg+. */
  columnsLg: z.enum(['lg:grid-cols-2', 'lg:grid-cols-3', 'lg:grid-cols-4']).optional(),
  /** Grid gap. */
  gap: z.enum(['gap-4', 'gap-6', 'gap-8', 'gap-12']).optional(),
});
export type StatsProps = z.infer<typeof statsPropsSchema>;

export const statsDefaults: StatsProps = { overlap: 64, columnsMobile: 'grid-cols-1', columnsSm: 'sm:grid-cols-2', columnsLg: 'lg:grid-cols-4', gap: 'gap-6', paddingBottom: 64 };

export const partnerLogosPropsSchema = layoutPropsSchema.extend({
  id: z.string().optional(),
  /** Horizontal gap between logos (mobile/desktop). */
  logoGap: z.enum(['gap-8 md:gap-16', 'gap-12 md:gap-24', 'gap-16 md:gap-32']).optional(),
  /** Space below the header zone. */
  headerMarginBottom: z.number().int().min(0).max(320).optional(),
});
export type PartnerLogosProps = z.infer<typeof partnerLogosPropsSchema>;

export const partnerLogosDefaults: PartnerLogosProps = { logoGap: 'gap-12 md:gap-24', headerMarginBottom: 40, paddingTop: 96, paddingBottom: 96 };

export const featureTilesPropsSchema = layoutPropsSchema.extend({
  id: z.string().optional(),
  imageUrl: z.string().max(1000).optional(),
  imageAlt: z.string().max(300).optional(),
  /** Section background. */
  sectionBg: z.enum(['bg-surface-container-lowest', 'bg-surface-container-low', 'bg-transparent']).optional(),
  /** Gap between the image and content columns (px). */
  gap: z.number().int().min(0).max(320).optional(),
  /** Image frame border width (px). */
  imageBorder: z.number().int().min(0).max(64).optional(),
  /** Decorative blurred circles around the image. */
  decorativeCircles: z.boolean().optional(),
  /** Image column first on mobile (currently second, then lg order flips). */
  imageFirstMobile: z.boolean().optional(),
});
export type FeatureTilesProps = z.infer<typeof featureTilesPropsSchema>;

export const featureTilesDefaults: FeatureTilesProps = {
  imageUrl:
    '',
  imageAlt: 'Precision machining detail',
  sectionBg: 'bg-surface-container-lowest',
  gap: 64,
  imageBorder: 8,
  decorativeCircles: true,
  imageFirstMobile: false,
  paddingTop: 96,
  paddingBottom: 96,
};

export const academyGridPropsSchema = layoutPropsSchema.extend({
  id: z.string().optional(),
  viewAllHref: z.string().max(600).optional(),
  /** Space below the header row. */
  headerMarginBottom: z.number().int().min(0).max(320).optional(),
  /** Card columns on md+. */
  cardsColumns: z.enum(['md:grid-cols-2', 'md:grid-cols-3']).optional(),
  /** Gap between cards. */
  cardsGap: z.enum(['gap-6', 'gap-8', 'gap-10']).optional(),
});
export type AcademyGridProps = z.infer<typeof academyGridPropsSchema>;

export const academyGridDefaults: AcademyGridProps = { viewAllHref: '/courses', headerMarginBottom: 64, cardsColumns: 'md:grid-cols-3', cardsGap: 'gap-8', paddingTop: 64, paddingBottom: 64 };

export const ctaBannerPropsSchema = layoutPropsSchema.extend({
  id: z.string().optional(),
  imageUrl: z.string().max(1000).optional(),
  /** Overlay color (hex). */
  overlayColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  /** Overlay opacity (0-100). */
  overlayOpacity: z.number().int().min(0).max(100).optional(),
  /** Radial white veil over the banner. */
  radialVeil: z.boolean().optional(),
  /** Banner padding (mobile / desktop). */
  padding: z.enum(['p-8 md:p-16', 'p-12 md:p-24', 'p-16 md:p-32']).optional(),
  /** Gap between copy and side columns (px). */
  gap: z.number().int().min(0).max(320).optional(),
  /** Banner corner radius. */
  radius: z.enum(['rounded-3xl', 'rounded-[3rem]', 'rounded-[4rem]']).optional(),
  /** Copy column width on lg+. */
  copyWidth: z.enum(['lg:w-1/2', 'lg:w-3/5', 'lg:w-2/3']).optional(),
  /** Side column width on lg+. */
  sideWidth: z.enum(['lg:w-1/3', 'lg:w-2/5', 'lg:w-1/2']).optional(),
});
export type CtaBannerProps = z.infer<typeof ctaBannerPropsSchema>;

export const ctaBannerDefaults: CtaBannerProps = {
  imageUrl:
    '',
  overlayColor: '#5b21b6',
  overlayOpacity: 90,
  radialVeil: true,
  padding: 'p-12 md:p-24',
  gap: 64,
  radius: 'rounded-[3rem]',
  copyWidth: 'lg:w-3/5',
  sideWidth: 'lg:w-2/5',
  paddingTop: 96,
  paddingBottom: 96,
};

export const faqPropsSchema = layoutPropsSchema.extend({
  id: z.string().optional(),
  /** Inner column max width (px). */
  maxWidth: z.number().int().min(320).max(2560).optional(),
  /** Space below the header zone. */
  headerMarginBottom: z.number().int().min(0).max(320).optional(),
  /** Vertical gap between items. */
  itemsGap: z.enum(['space-y-3', 'space-y-4', 'space-y-6', 'flex flex-col gap-3', 'flex flex-col gap-4', 'flex flex-col gap-6']).optional(),
  /** Space above the footer zone. */
  footerMarginTop: z.number().int().min(0).max(320).optional(),
});
export type FaqProps = z.infer<typeof faqPropsSchema>;

export const faqDefaults: FaqProps = { maxWidth: 1280, headerMarginBottom: 64, itemsGap: 'flex flex-col gap-4', footerMarginTop: 64, paddingTop: 96, paddingBottom: 96 };

export const footerPropsSchema = layoutPropsSchema.extend({
  id: z.string().optional(),
  /** Gap between footer columns. */
  gridGap: z.enum(['gap-8', 'gap-12', 'gap-16']).optional(),
  /** Column count on sm+. */
  columnsSm: z.enum(['sm:grid-cols-2', 'sm:grid-cols-3']).optional(),
  /** Column count on md+. */
  columnsLg: z.enum(['md:grid-cols-3', 'md:grid-cols-4']).optional(),
  /** Gap between bottom bar children. */
  bottomGap: z.enum(['gap-4', 'gap-8']).optional(),
});
export type FooterProps = z.infer<typeof footerPropsSchema>;

export const footerDefaults: FooterProps = { gridGap: 'gap-12', columnsSm: 'sm:grid-cols-2', columnsLg: 'md:grid-cols-4', bottomGap: 'gap-8', paddingTop: 96, paddingBottom: 48 };

// ------------------------------------------------------------------
// Composition support
// ------------------------------------------------------------------

/** Describes a named slot a block exposes for nested nodes (a Puck Slot field). */
export interface ZoneSpec {
  /** Block types allowed in this slot. Absent = any registered type. */
  allow?: string[];
  max?: number;
  required?: boolean;
}

/** A self-contained subtree: the node with its slot children inline. */
export interface SeedResult {
  node: PuckNode;
}

export type SeedFn = (overrides?: Record<string, unknown>) => SeedResult;

export interface BlockDefinition {
  type: string;
  label: string;
  description: string;
  category: string;
  schema: z.ZodType;
  defaultProps: Record<string, unknown>;
  zones?: Record<string, ZoneSpec>;
  /** Builds the default subtree when the block is inserted or a page is reset. */
  seed?: SeedFn;
}

const nav: BlockDefinition = {
  type: 'nav',
  label: 'Navbar',
  description: 'Floating glass navbar with logo, links and actions.',
  category: 'Chrome',
  schema: navPropsSchema,
  defaultProps: navDefaults,
  zones: { content: { allow: ['heading', 'text', 'nav-link', 'link', 'button', 'icon', 'stack'] } },
};

const hero: BlockDefinition = {
  type: 'hero',
  label: 'Hero',
  description: 'Full-screen hero with background image, badge, headline and CTAs.',
  category: 'Sections',
  schema: heroPropsSchema,
  defaultProps: heroDefaults,
  zones: { content: { allow: ['badge', 'heading', 'text', 'stack', 'button'] } },
};

const stats: BlockDefinition = {
  type: 'stats',
  label: 'Stats Bar',
  description: 'Overlapping row of stat cards with icons, values and labels.',
  category: 'Sections',
  schema: statsPropsSchema,
  defaultProps: statsDefaults,
  zones: { content: { allow: ['stat-item'] } },
};

const statItem: BlockDefinition = {
  type: 'stat-item',
  label: 'Stat Card',
  description: 'A single stat card: icon, tag, number and label.',
  category: 'Items',
  schema: statItemPropsSchema,
  defaultProps: statItemDefaults,
  zones: { content: { allow: ['icon', 'badge', 'heading', 'text', 'stack'] } },
};

const partnerLogos: BlockDefinition = {
  type: 'partner-logos',
  label: 'Partner Logos',
  description: 'Eyebrow plus a glass logo wall.',
  category: 'Sections',
  schema: partnerLogosPropsSchema,
  defaultProps: partnerLogosDefaults,
  zones: {
    header: { allow: ['text', 'heading'] },
    logos: { allow: ['logo-item'] },
  },
};

const logoItem: BlockDefinition = {
  type: 'logo-item',
  label: 'Logo Item',
  description: 'A partner logo: image, or icon + wordmark.',
  category: 'Items',
  schema: logoItemPropsSchema,
  defaultProps: logoItemDefaults,
  zones: { content: { allow: ['image', 'icon', 'text', 'stack'] } },
};

const featureTiles: BlockDefinition = {
  type: 'feature-tiles',
  label: 'Feature Tiles',
  description: 'Two-column section: supporting image beside a feature list.',
  category: 'Sections',
  schema: featureTilesPropsSchema,
  defaultProps: featureTilesDefaults,
  zones: { content: { allow: ['heading', 'text', 'feature-item'] } },
};

const featureItem: BlockDefinition = {
  type: 'feature-item',
  label: 'Feature Row',
  description: 'Icon tile with a title and description.',
  category: 'Items',
  schema: featureItemPropsSchema,
  defaultProps: featureItemDefaults,
  zones: { content: { allow: ['icon', 'heading', 'text', 'stack'] } },
};

const academyGrid: BlockDefinition = {
  type: 'academy-grid',
  label: 'Academy Grid',
  description: 'Header row plus a grid of academy cards.',
  category: 'Sections',
  schema: academyGridPropsSchema,
  defaultProps: academyGridDefaults,
  zones: {
    header: { allow: ['heading', 'text', 'button', 'stack'] },
    cards: { allow: ['academy-card'] },
  },
};

const academyCard: BlockDefinition = {
  type: 'academy-card',
  label: 'Academy Card',
  description: 'Course card: image, level pill, title, description, avatar stack and enroll link.',
  category: 'Items',
  schema: academyCardPropsSchema,
  defaultProps: academyCardDefaults,
  zones: {
    media: { allow: ['image'], max: 1 },
    content: { allow: ['badge', 'text', 'heading', 'avatar-stack', 'button', 'link', 'stack'] },
  },
};

const ctaBanner: BlockDefinition = {
  type: 'cta-banner',
  label: 'CTA Banner',
  description: 'Gradient banner with headline, buttons and a certification progress card.',
  category: 'Sections',
  schema: ctaBannerPropsSchema,
  defaultProps: ctaBannerDefaults,
  zones: {
    copy: { allow: ['heading', 'text', 'stack', 'button'] },
    side: { allow: ['progress-card', 'card', 'stack', 'image'] },
  },
};

const faq: BlockDefinition = {
  type: 'faq',
  label: 'FAQ',
  description: 'Centered FAQ list with a support link.',
  category: 'Sections',
  schema: faqPropsSchema,
  defaultProps: faqDefaults,
  zones: {
    header: { allow: ['text', 'heading'] },
    items: { allow: ['faq-item'] },
    footer: { allow: ['text', 'button', 'stack'] },
  },
};

const faqItem: BlockDefinition = {
  type: 'faq-item',
  label: 'FAQ Item',
  description: 'Question row plus an answer panel (static, per the mockup).',
  category: 'Items',
  schema: faqItemPropsSchema,
  defaultProps: faqItemDefaults,
  zones: {
    toggle: { allow: ['heading', 'text'], max: 1 },
    content: { allow: ['text', 'heading'], max: 1 },
  },
};

const footer: BlockDefinition = {
  type: 'footer',
  label: 'Footer',
  description: 'Four-column footer with a bottom bar.',
  category: 'Chrome',
  schema: footerPropsSchema,
  defaultProps: footerDefaults,
  zones: {
    columns: { allow: ['footer-col'] },
    bottom: { allow: ['text', 'stack'] },
  },
};

const footerCol: BlockDefinition = {
  type: 'footer-col',
  label: 'Footer Column',
  description: 'A heading plus a list of links.',
  category: 'Items',
  schema: footerColPropsSchema,
  defaultProps: footerColDefaults,
  zones: { content: { allow: ['heading', 'link', 'text', 'stack'] } },
};

const stack: BlockDefinition = {
  type: 'stack',
  label: 'Stack',
  description: 'Flex column/row that lays out nested blocks with a gap.',
  category: 'Layout',
  schema: stackPropsSchema,
  defaultProps: stackDefaults,
  zones: { content: {} },
};

export const sectionPropsSchema = layoutPropsSchema.extend({
  id: z.string().optional(),
  /** Section background treatment. */
  bg: z.enum(['transparent', 'white', 'muted', 'secondary', 'primary', 'gradient-primary', 'gradient-muted']).optional(),
  /** Visibility toggle (renders the section hidden). */
  hidden: z.boolean().optional(),
});
export type SectionProps = z.infer<typeof sectionPropsSchema>;

const section: BlockDefinition = {
  type: 'section',
  label: 'Section',
  description: 'A full-width page section wrapper with a single content zone.',
  category: 'Sections',
  schema: sectionPropsSchema,
  defaultProps: {},
  zones: { content: {} },
};

const grid: BlockDefinition = {
  type: 'grid',
  label: 'Grid',
  description: 'A responsive grid of nested blocks.',
  category: 'Layout',
  schema: gridPropsSchema,
  defaultProps: gridDefaults,
  zones: { items: {} },
};

const card: BlockDefinition = {
  type: 'card',
  label: 'Card',
  description: 'A box that groups nested blocks with padding, background and border.',
  category: 'Layout',
  schema: cardPropsSchema,
  defaultProps: cardDefaults,
  zones: { content: {} },
};

const heading: BlockDefinition = {
  type: 'heading',
  label: 'Heading',
  description: 'A heading (h1-h4) or inline title.',
  category: 'Content',
  schema: headingPropsSchema,
  defaultProps: headingDefaults,
};

const text: BlockDefinition = {
  type: 'text',
  label: 'Text',
  description: 'A paragraph of body text.',
  category: 'Content',
  schema: textPropsSchema,
  defaultProps: textDefaults,
};

const button: BlockDefinition = {
  type: 'button',
  label: 'Button',
  description: 'A call-to-action button with mockup treatments.',
  category: 'Content',
  schema: buttonPropsSchema,
  defaultProps: buttonDefaults,
};

const link: BlockDefinition = {
  type: 'link',
  label: 'Link',
  description: 'A plain text anchor (footer links, inline links).',
  category: 'Content',
  schema: linkPropsSchema,
  defaultProps: linkDefaults,
};

const navLink: BlockDefinition = {
  type: 'nav-link',
  label: 'Nav Link',
  description: 'A small uppercase navbar link.',
  category: 'Content',
  schema: navLinkPropsSchema,
  defaultProps: navLinkDefaults,
};

const image: BlockDefinition = {
  type: 'image',
  label: 'Image',
  description: 'An image with fit, aspect and radius controls.',
  category: 'Content',
  schema: imagePropsSchema,
  defaultProps: imageDefaults,
};

const icon: BlockDefinition = {
  type: 'icon',
  label: 'Icon',
  description: 'A single Material Symbol glyph.',
  category: 'Content',
  schema: iconPropsSchema,
  defaultProps: iconDefaults,
};

const badge: BlockDefinition = {
  type: 'badge',
  label: 'Badge / Eyebrow',
  description: 'A small pill label (hero eyebrow, stat tags, level pills).',
  category: 'Content',
  schema: badgePropsSchema,
  defaultProps: badgeDefaults,
};

const avatarStack: BlockDefinition = {
  type: 'avatar-stack',
  label: 'Avatar Stack',
  description: 'Overlapping avatars with a "+80" pill.',
  category: 'Content',
  schema: avatarStackPropsSchema,
  defaultProps: avatarStackDefaults,
};

const progressCard: BlockDefinition = {
  type: 'progress-card',
  label: 'Progress Card',
  description: 'Certification progress card with an 85.4% bar.',
  category: 'Content',
  schema: progressCardPropsSchema,
  defaultProps: progressCardDefaults,
};

export const BLOCK_REGISTRY: Readonly<Record<string, BlockDefinition>> = {
  nav,
  hero,
  stats,
  'stat-item': statItem,
  'partner-logos': partnerLogos,
  'logo-item': logoItem,
  'feature-tiles': featureTiles,
  'feature-item': featureItem,
  'academy-grid': academyGrid,
  'academy-card': academyCard,
  'cta-banner': ctaBanner,
  faq,
  'faq-item': faqItem,
  footer,
  'footer-col': footerCol,
  stack,
  grid,
  card,
  section,
  heading,
  text,
  button,
  link,
  'nav-link': navLink,
  image,
  icon,
  badge,
  'avatar-stack': avatarStack,
  'progress-card': progressCard,
};

export const BLOCK_TYPES = Object.keys(BLOCK_REGISTRY) as readonly string[];

export const BLOCK_CATEGORIES = ['Chrome', 'Sections', 'Items', 'Layout', 'Content'] as const;

export function getBlockDefinition(type: string): BlockDefinition | undefined {
  return (BLOCK_REGISTRY as Record<string, BlockDefinition>)[type];
}

export function isKnownBlockType(type: string): boolean {
  return type in BLOCK_REGISTRY;
}

/**
 * Puck Slot field definitions derived from a block's declared zones, so the
 * editor config can never drift from the registry. `allow` gates the insert
 * menu and drag targets per slot; everything else (labels, layout fields)
 * lives in the editor config.
 */
export function slotFieldsFor(type: string): Record<string, { type: 'slot'; allow?: string[] }> {
  const zones = getBlockDefinition(type)?.zones ?? {};
  const out: Record<string, { type: 'slot'; allow?: string[] }> = {};
  for (const [name, spec] of Object.entries(zones)) {
    out[name] = spec.allow ? { type: 'slot', allow: [...spec.allow] } : { type: 'slot' };
  }
  return out;
}

/** Lookup helper used by the renderer to fill in default props for partial data. */
export function mergeBlockProps(type: string, props: Record<string, unknown> | undefined): Record<string, unknown> {
  const def = getBlockDefinition(type);
  return { ...(def?.defaultProps ?? {}), ...(props ?? {}) };
}

export type { IconKey };
