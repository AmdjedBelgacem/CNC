'use client';
import { createElement } from 'react';
import type { ComponentType } from 'react';
import type { ComponentConfig, Config } from '@measured/puck';
import {
  ICON_KEYS,
  getBlockDefinition,
  slotFieldsFor,
  academyCardDefaults,
  academyGridDefaults,
  avatarStackDefaults,
  badgeDefaults,
  buttonDefaults,
  cardDefaults,
  cardGridDefaults,
  catalogHeroDefaults,
  ctaBannerDefaults,
  ctaSignupDefaults,
  closingCtaDefaults,
  faqDefaults,
  faqItemDefaults,
  featureItemDefaults,
  featureTilesDefaults,
  footerColDefaults,
  footerDefaults,
  gridDefaults,
  headingDefaults,
  heroConsoleDefaults,
  heroDefaults,
  iconDefaults,
  imageDefaults,
  linkDefaults,
  liveIslandDefaults,
  logoItemDefaults,
  navDefaults,
  navLinkDefaults,
  partnerLogosDefaults,
  programCardDefaults,
  programCardsDefaults,
  progressCardDefaults,
  spotlightCardsDefaults,
  stackDefaults,
  statItemDefaults,
  statsDefaults,
  testimonialCardDefaults,
  testimonialsDefaults,
  textDefaults,
  twinSectionDefaults,
  LIVE_ISLAND_VARIANTS,
} from '@titan/shared';
import { BLOCK_COMPONENTS } from '@/components/builder/blocks'; // ---------------------------------------------------------------- helpers
const textField = (label: string, placeholder?: string) => ({
  type: 'text' as const,
  label,
  placeholder,
});
const textareaField = (label: string, placeholder?: string) => ({
  type: 'textarea' as const,
  label,
  placeholder,
});
const numberField = (label: string, min: number, max: number, step = 1) => ({
  type: 'number' as const,
  label,
  min,
  max,
  step,
});
const selectField = (label: string, options: { label: string; value: string | boolean }[]) => ({
  type: 'select' as const,
  label,
  options,
});
/** Puck 0.20 has no checkbox field type, so booleans are shown as Show/Hide selects. */
const booleanSelect = (label: string) =>
  selectField(label, [
    { label: 'Show', value: true },
    { label: 'Hide', value: false },
  ]);
const ICON_OPTIONS = ICON_KEYS.map((key) => ({ label: key, value: key }));
const iconField = selectField('Icon', ICON_OPTIONS);
const alignField = selectField('Alignment', [
  { label: 'Left', value: 'left' },
  { label: 'Center', value: 'center' },
  { label: 'Right', value: 'right' },
]);
const trackingField = selectField('Letter spacing', [
  { label: 'None', value: 'none' },
  { label: '0.025em (tracking-wide)', value: '0.025em' },
  { label: '0.05em (tracking-wider)', value: '0.05em' },
  { label: '0.1em', value: '0.1em' },
  { label: '0.15em', value: '0.15em' },
  { label: '0.2em', value: '0.2em' },
]);
const weightField = selectField('Weight', [
  { label: 'Normal', value: 'normal' },
  { label: 'Medium', value: 'medium' },
  { label: 'Semibold', value: 'semibold' },
  { label: 'Bold', value: 'bold' },
]);
const layoutFields = {
  marginTop: numberField('Margin top (px)', 0, 320),
  marginBottom: numberField('Margin bottom (px)', 0, 320),
  paddingTop: numberField('Padding top (px)', 0, 320),
  paddingRight: numberField('Padding right (px)', 0, 320),
  paddingBottom: numberField('Padding bottom (px)', 0, 320),
  paddingLeft: numberField('Padding left (px)', 0, 320),
  maxWidth: numberField('Max width (px)', 0, 2560),
  minHeight: numberField('Min height (px)', 0, 3000),
  className: textField('Extra classes', 'e.g. leading-tight line-clamp-2'),
}; /** Adds the universal spacing/sizing fields to a block's field list. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const withLayoutFields = (fields: any) => ({
  ...layoutFields,
  ...fields,
}); /** Renders the shared block component with Puck's props+puck (same component the public renderer uses). * * In the editor Puck spreads the node's props flat (`{ ...props, puck, editMode }`), * with each declared Slot field replaced by its Slot *component*. Our block * components expect the `{ props, puck }` shape, so we re-wrap here: slot * components are exposed through the bridge's `renderSlot(name)` (same call * shape the public renderer implements), keeping the editor canvas identical * to the public renderer. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const render = (type: string) => (editorProps: any) => {
  const C = BLOCK_COMPONENTS[type] as ComponentType<{ props: unknown; puck: unknown }> | undefined;
  if (!C) return <></>;
  const { puck, editMode: _editMode, ...props } = editorProps ?? {};
  // Mirror the public renderer's `visible === false` gate so hidden blocks
  // don't render in the canvas either.
  if ((props as Record<string, unknown>)?.visible === false) return <></>;
  const definition = getBlockDefinition(type);
  const renderSlot = (slotName: string) => {
    const Slot = (editorProps as Record<string, unknown>)[slotName] as
      | ComponentType<{ allow?: string[]; minEmptyHeight?: number }>
      | undefined;
    if (!Slot || typeof Slot !== 'function') return null;
    // Enforce the registry `allow` list and keep empty slots compact so they
    // don't blow out flex/grid layouts (Puck default minEmptyHeight is 128).
    const allow = definition?.zones?.[slotName]?.allow;
    return createElement(Slot, {
      ...(allow ? { allow } : {}),
      minEmptyHeight: 48,
    });
  };
  return <C props={props} puck={{ ...puck, renderSlot }} />;
};
const def = (
  type: string,
  label: string,
  defaultProps: Record<string, unknown>,
  fields: Record<string, unknown>,
): ComponentConfig => ({
  label,
  defaultProps,
  fields: { ...withLayoutFields(fields), ...slotFieldsFor(type) },
  render: render(type),
}); // ---------------------------------------------------------------- blocks
const heading: ComponentConfig = def('heading', 'Heading', headingDefaults, {
  as: selectField('Tag', [
    { label: 'H1', value: 'h1' },
    { label: 'H2', value: 'h2' },
    { label: 'H3', value: 'h3' },
    { label: 'H4', value: 'h4' },
    { label: 'Span', value: 'span' },
    { label: 'Strong', value: 'strong' },
  ]),
  text: textareaField('Text', 'Use a newline for a hidden-on-mobile line break'),
  size: selectField('Size', [
    { label: 'Hero display', value: 'hero' },
    { label: 'Headline large', value: 'headline-lg' },
    { label: 'Headline medium', value: 'headline-md' },
    { label: 'Stat number', value: 'stats' },
    { label: '2XL', value: '2xl' },
    { label: 'XL', value: 'xl' },
    { label: 'Large', value: 'lg' },
    { label: 'Medium', value: 'md' },
    { label: 'Small', value: 'sm' },
    { label: 'Label (11px caps)', value: 'label' },
    { label: 'Logo', value: 'logo' },
  ]),
  align: alignField,
  color: textField('Color class or hex', 'text-text-primary / #ffffff'),
  accentText: textField('Accent text (italic, primary)'),
  suffixText: textField('Suffix text (after accent)'),
});
const text: ComponentConfig = def('text', 'Text', textDefaults, {
  text: textareaField('Text'),
  size: selectField('Size', [
    { label: '10px label', value: '2xs' },
    { label: '11px label', value: 'xs' },
    { label: '12px label', value: 'sm' },
    { label: 'Medium (16px)', value: 'md' },
    { label: 'Large (18px)', value: 'lg' },
  ]),
  align: alignField,
  color: textField('Color class or hex', 'text-text-muted / #6b7280'),
  uppercase: booleanSelect('Uppercase'),
  tracking: trackingField,
  weight: weightField,
  opacity: numberField('Opacity (%)', 0, 100),
});
const button: ComponentConfig = def('button', 'Button', buttonDefaults, {
  label: textField('Label'),
  href: textField('URL'),
  variant: selectField('Style', [
    { label: 'Primary (solid blue)', value: 'primary' },
    { label: 'Glass', value: 'glass' },
    { label: 'White', value: 'white' },
    { label: 'White outline', value: 'white-outline' },
    { label: 'Pill (View All)', value: 'pill' },
    { label: 'Navbar CTA', value: 'nav-cta' },
    { label: 'Link', value: 'link' },
    { label: 'Enroll', value: 'enroll' },
  ]),
  icon: iconField,
  iconPosition: selectField('Icon position', [
    { label: 'Left', value: 'left' },
    { label: 'Right', value: 'right' },
  ]),
});
const link: ComponentConfig = def('link', 'Link', linkDefaults, {
  label: textField('Label', 'Leave empty for an icon circle'),
  href: textField('URL'),
  icon: iconField,
});
const navLink: ComponentConfig = def('nav-link', 'Nav Link', navLinkDefaults, {
  label: textField('Label'),
  href: textField('URL'),
  active: booleanSelect('Active (primary colour)'),
});
const image: ComponentConfig = def('image', 'Image', imageDefaults, {
  src: textField('Image URL'),
  alt: textField('Alt text'),
  width: numberField('Width (px)', 0, 2560),
  height: numberField('Height (px)', 0, 2560),
  objectFit: selectField('Fit', [
    { label: 'Cover', value: 'cover' },
    { label: 'Contain', value: 'contain' },
    { label: 'Fill', value: 'fill' },
  ]),
  radius: selectField('Corners', [
    { label: 'None', value: 'none' },
    { label: 'Small', value: 'sm' },
    { label: 'Medium', value: 'md' },
    { label: 'Large', value: 'lg' },
    { label: 'Full', value: 'full' },
  ]),
  aspectRatio: selectField('Aspect ratio', [
    { label: 'Auto', value: 'none' },
    { label: '4:3', value: '4/3' },
    { label: '16:10', value: '16/10' },
  ]),
});
const icon: ComponentConfig = def('icon', 'Icon', iconDefaults, {
  icon: iconField,
  size: numberField('Size (px)', 8, 96),
  color: textField('Color class or hex', 'text-text-muted / #111827'),
  box: selectField('Tile', [
    { label: 'None', value: 'none' },
    { label: 'Tinted (stat tile)', value: 'tinted' },
    { label: 'White (feature tile)', value: 'white' },
  ]),
});
const badge: ComponentConfig = def('badge', 'Badge / Eyebrow', badgeDefaults, {
  text: textField('Text'),
  variant: selectField('Variant', [
    { label: 'Glow (hero eyebrow)', value: 'glow' },
    { label: 'Primary', value: 'primary' },
    { label: 'Secondary (with icon)', value: 'secondary' },
    { label: 'Neutral', value: 'neutral' },
    { label: 'Card level pill', value: 'card' },
  ]),
  size: selectField('Size', [
    { label: 'Small (10px)', value: 'sm' },
    { label: 'Medium (12px)', value: 'md' },
  ]),
  uppercase: booleanSelect('Uppercase'),
  icon: iconField,
  iconSize: numberField('Icon size (px)', 4, 64),
  pulse: booleanSelect('Pulsing dot'),
});
const avatarStack: ComponentConfig = def('avatar-stack', 'Avatar Stack', avatarStackDefaults, {
  count: textField('Count label', '+80'),
  size: numberField('Circle size (px)', 16, 128),
  plainCircles: numberField('Plain circles', 0, 4),
});
const progressCard: ComponentConfig = def('progress-card', 'Progress Card', progressCardDefaults, {
  percent: numberField('Percent', 0, 100),
  title: textField('Title'),
  subtitle: textField('Subtitle'),
  label: textField('Label'),
  value: textField('Value', '85.4%'),
  icon: iconField,
  ticks: booleanSelect('Tick marks'),
  barHeight: selectField('Bar height', [
    { label: 'Small (8px)', value: 'h-2' },
    { label: 'Medium 10px', value: 'h-2.5' },
    { label: 'Medium (12px)', value: 'h-3' },
    { label: 'Large (16px)', value: 'h-4' },
  ]),
});
const stack: ComponentConfig = def('stack', 'Stack', stackDefaults, {
  direction: selectField('Direction', [
    { label: 'Column', value: 'column' },
    { label: 'Row', value: 'row' },
  ]),
  gap: selectField('Gap', [
    { label: 'None', value: 'none' },
    { label: 'Small (8px)', value: 'sm' },
    { label: 'Medium (16px)', value: 'md' },
    { label: 'Medium 20px', value: 'md-2' },
    { label: 'Medium-large (24px)', value: 'md-lg' },
    { label: 'Large (32px)', value: 'lg' },
    { label: 'XL (48px)', value: 'xl' },
  ]),
  align: selectField('Align', [
    { label: 'Start', value: 'start' },
    { label: 'Center', value: 'center' },
    { label: 'End', value: 'end' },
    { label: 'Stretch', value: 'stretch' },
  ]),
  justify: selectField('Justify', [
    { label: 'Start', value: 'start' },
    { label: 'Center', value: 'center' },
    { label: 'End', value: 'end' },
    { label: 'Between', value: 'between' },
  ]),
  wrap: booleanSelect('Wrap'),
  bg: selectField('Background', [
    { label: 'Transparent', value: 'transparent' },
    { label: 'Glass', value: 'glass' },
  ]),
});
const grid: ComponentConfig = def('grid', 'Grid', gridDefaults, {
  columns: numberField('Columns', 1, 6),
  gap: selectField('Gap', [
    { label: 'Small', value: 'sm' },
    { label: 'Medium (24px)', value: 'md' },
    { label: 'Medium-large (28px)', value: 'md-lg' },
    { label: 'Large (32px)', value: 'lg' },
    { label: 'XL (48px)', value: 'xl' },
  ]),
});
const card: ComponentConfig = def('card', 'Card', cardDefaults, {
  padding: selectField('Padding', [
    { label: 'None', value: 'none' },
    { label: 'Small', value: 'sm' },
    { label: 'Medium', value: 'md' },
    { label: 'Large', value: 'lg' },
  ]),
  bg: selectField('Background', [
    { label: 'Transparent', value: 'transparent' },
    { label: 'Muted', value: 'muted' },
    { label: 'Glass', value: 'glass' },
    { label: 'Gradient', value: 'gradient' },
  ]),
  radius: selectField('Corners', [
    { label: 'None', value: 'none' },
    { label: 'Small', value: 'sm' },
    { label: 'Medium', value: 'md' },
    { label: 'Large', value: 'lg' },
    { label: 'XL', value: 'xl' },
    { label: '2XL', value: '2xl' },
    { label: 'Full', value: 'full' },
  ]),
  border: booleanSelect('Border'),
  align: alignField,
  hover: booleanSelect('Hover lift'),
  accent: booleanSelect('Accent bar'),
  accentColor: selectField('Accent bar color', [
    { label: 'Primary', value: 'bg-primary' },
    { label: 'Secondary', value: 'bg-secondary' },
    { label: 'Accent', value: 'bg-accent' },
  ]),
}); // ---------------------------------------------------------------- sections & items
const nav: ComponentConfig = def('nav', 'Navbar', navDefaults, {
  topOffset: numberField('Top offset (px)', 0, 320),
  widthPercent: numberField('Width (%)', 20, 100),
  containerMaxWidth: numberField('Max width (px)', 320, 2560),
  containerPaddingX: selectField('Container padding X', [
    { label: 'Small (16/24px)', value: 'px-4 md:px-6' },
    { label: 'Medium (24/32px)', value: 'px-6 md:px-8' },
    { label: 'Large (32/40px)', value: 'px-8 md:px-10' },
  ]),
  containerPaddingY: selectField('Container padding Y', [
    { label: '8px', value: 'py-2' },
    { label: '10px', value: 'py-2.5' },
    { label: '12px', value: 'py-3' },
    { label: '16px', value: 'py-4' },
  ]),
  containerRadius: selectField('Container corners', [
    { label: 'Medium (8px)', value: 'rounded-lg' },
    { label: 'Large (12px)', value: 'rounded-xl' },
    { label: 'XL (16px)', value: 'rounded-2xl' },
    { label: '2XL (24px)', value: 'rounded-3xl' },
  ]),
});
const hero: ComponentConfig = def('hero', 'Hero', heroDefaults, {
  imageUrl: textField('Background image URL'),
  backgroundColor: textField('Background color (hex)', '#1B4DB1'),
  backgroundOverlay: numberField('Background overlay (%)', 0, 100),
  backgroundOpacity: numberField('Background image opacity (%)', 0, 100),
  gradientVeil: booleanSelect('Gradient veil'),
  contentMaxWidth: numberField('Content max width (px)', 320, 2560),
  contentPaddingX: selectField('Content padding X', [
    { label: 'Theme mobile margin', value: 'px-margin-mobile' },
    { label: '16px', value: 'px-4' },
    { label: '24px', value: 'px-6' },
    { label: '32px', value: 'px-8' },
  ]),
  scrollIndicatorBottom: numberField('Indicator bottom (px)', 0, 320),
  parallaxFactor: numberField('Parallax factor (%)', 0, 100),
  nonFullHeight: numberField('Min height when not full (px)', 200, 3000),
  contentAlign: selectField('Content alignment', [
    { label: 'Center', value: 'center' },
    { label: 'Left', value: 'left' },
  ]),
  fullHeight: booleanSelect('Full height'),
  scrollIndicator: booleanSelect('Scroll indicator'),
  showTrustChips: booleanSelect('Trust chips'),
  trustNote: textField('Trust note'),
  trustNoteHref: textField('Trust note link'),
  mesh: booleanSelect('Gradient mesh'),
});
const stats: ComponentConfig = def('stats', 'Stats Bar', statsDefaults, {
  overlap: numberField('Overlap (px)', 0, 320),
  columnsMobile: selectField('Columns (mobile)', [
    { label: '1', value: 'grid-cols-1' },
    { label: '2', value: 'grid-cols-2' },
  ]),
  columnsSm: selectField('Columns (sm+)', [
    { label: '2', value: 'sm:grid-cols-2' },
    { label: '3', value: 'sm:grid-cols-3' },
  ]),
  columnsLg: selectField('Columns (lg+)', [
    { label: '2', value: 'lg:grid-cols-2' },
    { label: '3', value: 'lg:grid-cols-3' },
    { label: '4', value: 'lg:grid-cols-4' },
  ]),
  gap: selectField('Gap', [
    { label: '16px', value: 'gap-4' },
    { label: '24px', value: 'gap-6' },
    { label: '32px', value: 'gap-8' },
    { label: '48px', value: 'gap-12' },
  ]),
});
const statItem: ComponentConfig = def('stat-item', 'Stat Card', statItemDefaults, {
  padding: selectField('Padding', [
    { label: 'None', value: 'none' },
    { label: 'Small', value: 'sm' },
    { label: 'Medium', value: 'md' },
    { label: 'Large', value: 'lg' },
  ]),
  bg: selectField('Background', [
    { label: 'Transparent', value: 'transparent' },
    { label: 'Muted', value: 'muted' },
    { label: 'Glass', value: 'glass' },
    { label: 'Gradient', value: 'gradient' },
  ]),
  radius: selectField('Corners', [
    { label: 'None', value: 'none' },
    { label: 'Small', value: 'sm' },
    { label: 'Medium', value: 'md' },
    { label: 'Large', value: 'lg' },
    { label: 'XL', value: 'xl' },
    { label: '2XL', value: '2xl' },
    { label: '3XL', value: '3xl' },
    { label: 'Full', value: 'full' },
  ]),
  border: booleanSelect('Border'),
  hover: booleanSelect('Hover lift'),
  accent: booleanSelect('Accent bar'),
  accentColor: selectField('Accent bar color', [
    { label: 'Primary', value: 'bg-primary' },
    { label: 'Secondary', value: 'bg-secondary' },
    { label: 'Accent', value: 'bg-accent' },
  ]),
});
const partnerLogos: ComponentConfig = def('partner-logos', 'Partner Logos', partnerLogosDefaults, {
  logoGap: selectField('Logo gap', [
    { label: 'Small (32/64px)', value: 'gap-8 md:gap-16' },
    { label: 'Medium (48/96px)', value: 'gap-12 md:gap-24' },
    { label: 'Large (64/128px)', value: 'gap-16 md:gap-32' },
  ]),
  headerMarginBottom: numberField('Header bottom margin (px)', 0, 320),
  frame: selectField('Frame', [
    { label: 'Wall (rounded card)', value: 'wall' },
    { label: 'Strip (bare wordmarks)', value: 'strip' },
  ]),
});
const logoItem: ComponentConfig = def('logo-item', 'Logo Item', logoItemDefaults, {});
const featureTiles: ComponentConfig = def('feature-tiles', 'Feature Tiles', featureTilesDefaults, {
  imageUrl: textField('Image URL'),
  imageAlt: textField('Image alt text'),
  sectionBg: selectField('Section background', [
    { label: 'White', value: 'bg-surface-container-lowest' },
    { label: 'Light grey', value: 'bg-surface-container-low' },
    { label: 'Transparent', value: 'bg-transparent' },
  ]),
  gap: numberField('Column gap (px)', 0, 320),
  imageBorder: numberField('Image border (px)', 0, 64),
  decorativeCircles: booleanSelect('Decorative circles'),
  imageFirstMobile: booleanSelect('Image first on mobile'),
});
const featureItem: ComponentConfig = def('feature-item', 'Feature Row', featureItemDefaults, {
  gap: selectField('Gap', [
    { label: '16px', value: 'gap-4' },
    { label: '20px', value: 'gap-5' },
    { label: '24px', value: 'gap-6' },
    { label: '32px', value: 'gap-8' },
  ]),
});
const academyGrid: ComponentConfig = def('academy-grid', 'Academy Grid', academyGridDefaults, {
  viewAllHref: textField('View all link'),
  headerMarginBottom: numberField('Header bottom margin (px)', 0, 320),
  cardsColumns: selectField('Card columns (md+)', [
    { label: '2', value: 'md:grid-cols-2' },
    { label: '3', value: 'md:grid-cols-3' },
  ]),
  cardsGap: selectField('Card gap', [
    { label: '24px', value: 'gap-6' },
    { label: '32px', value: 'gap-8' },
    { label: '40px', value: 'gap-10' },
  ]),
});
const academyCard: ComponentConfig = def('academy-card', 'Academy Card', academyCardDefaults, {
  href: textField('Link URL'),
  contentPadding: selectField('Content padding', [
    { label: '24px', value: 'p-6' },
    { label: '32px', value: 'p-8' },
    { label: '40px', value: 'p-10' },
  ]),
  radius: selectField('Corners', [
    { label: '2XL (16px)', value: 'rounded-2xl' },
    { label: '3XL (24px)', value: 'rounded-3xl' },
    { label: '2rem', value: 'rounded-[2rem]' },
  ]),
  mediaAspect: selectField('Media aspect', [
    { label: '16:10', value: 'aspect-[16/10]' },
    { label: '16:9', value: 'aspect-video' },
    { label: 'Square', value: 'aspect-square' },
  ]),
});
const ctaBanner: ComponentConfig = def('cta-banner', 'CTA Banner', ctaBannerDefaults, {
  imageUrl: textField('Background image URL'),
  overlayColor: textField('Overlay color (hex)', '#1B4DB1'),
  overlayOpacity: numberField('Overlay opacity (%)', 0, 100),
  radialVeil: booleanSelect('Radial veil'),
  padding: selectField('Banner padding', [
    { label: 'Small (32/64px)', value: 'p-8 md:p-16' },
    { label: 'Medium (48/96px)', value: 'p-12 md:p-24' },
    { label: 'Large (64/128px)', value: 'p-16 md:p-32' },
  ]),
  gap: numberField('Column gap (px)', 0, 320),
  radius: selectField('Corners', [
    { label: '3XL (24px)', value: 'rounded-3xl' },
    { label: '3rem', value: 'rounded-[3rem]' },
    { label: '4rem', value: 'rounded-[4rem]' },
  ]),
  copyWidth: selectField('Copy column (lg+)', [
    { label: '1/2', value: 'lg:w-1/2' },
    { label: '3/5', value: 'lg:w-3/5' },
    { label: '2/3', value: 'lg:w-2/3' },
  ]),
  sideWidth: selectField('Side column (lg+)', [
    { label: '1/3', value: 'lg:w-1/3' },
    { label: '2/5', value: 'lg:w-2/5' },
    { label: '1/2', value: 'lg:w-1/2' },
  ]),
});
const faq: ComponentConfig = def('faq', 'FAQ', faqDefaults, {
  maxWidth: numberField('Inner max width (px)', 320, 2560),
  headerMarginBottom: numberField('Header bottom margin (px)', 0, 320),
  itemsGap: selectField('Items gap', [
    { label: '12px', value: 'space-y-3' },
    { label: '16px', value: 'space-y-4' },
    { label: '24px', value: 'space-y-6' },
  ]),
  footerMarginTop: numberField('Footer top margin (px)', 0, 320),
});
const faqItem: ComponentConfig = def('faq-item', 'FAQ Item', faqItemDefaults, {
  buttonPaddingX: selectField('Toggle padding X', [
    { label: '24px', value: 'px-6' },
    { label: '32px', value: 'px-8' },
    { label: '40px', value: 'px-10' },
  ]),
  buttonPaddingY: selectField('Toggle padding Y', [
    { label: '20px', value: 'py-5' },
    { label: '24px', value: 'py-6' },
    { label: '32px', value: 'py-8' },
  ]),
  answerPaddingX: selectField('Answer padding X', [
    { label: '24px', value: 'px-6' },
    { label: '32px', value: 'px-8' },
    { label: '40px', value: 'px-10' },
  ]),
  answerPaddingBottom: selectField('Answer padding bottom', [
    { label: '24px', value: 'pb-6' },
    { label: '32px', value: 'pb-8' },
    { label: '40px', value: 'pb-10' },
  ]),
  icon: iconField,
});
const footer: ComponentConfig = def('footer', 'Footer', footerDefaults, {
  gridGap: selectField('Column gap', [
    { label: '32px', value: 'gap-8' },
    { label: '48px', value: 'gap-12' },
    { label: '64px', value: 'gap-16' },
  ]),
  columnsSm: selectField('Columns (sm+)', [
    { label: '2', value: 'sm:grid-cols-2' },
    { label: '3', value: 'sm:grid-cols-3' },
  ]),
  columnsLg: selectField('Columns (md+)', [
    { label: '3', value: 'md:grid-cols-3' },
    { label: '4', value: 'md:grid-cols-4' },
  ]),
  bottomGap: selectField('Bottom bar gap', [
    { label: '16px', value: 'gap-4' },
    { label: '32px', value: 'gap-8' },
  ]),
});
const footerCol: ComponentConfig = def('footer-col', 'Footer Column', footerColDefaults, {
  gap: selectField('Column gap', [
    { label: '8px', value: 'gap-2' },
    { label: '16px', value: 'gap-4' },
    { label: '24px', value: 'gap-6' },
  ]),
});
const section: ComponentConfig = def(
  'section',
  'Section',
  {},
  { className: textField('Extra classes', 'e.g. bg-secondary/10 border-b') },
); // ---------------------------------------------------------------- config
const heroConsole: ComponentConfig = def('hero-console', 'Hero + Sim Console', heroConsoleDefaults, {
  imageUrl: textField('Viewport image URL'),
  imageAlt: textField('Image alt text'),
  fileName: textField('Console file name'),
  syncLabel: textField('Sync pill label'),
  feedLabel: textField('Feed label'),
  feedValue: textField('Feed value'),
  feedTag: textField('Feed tag'),
  spindleLabel: textField('Spindle label'),
  spindleValue: textField('Spindle value'),
  spindleTag: textField('Spindle tag'),
  auditTitle: textField('Audit title'),
  auditValue: textField('Audit value'),
  axesTitle: textField('Axes drawer title'),
  vibration: textField('Vibration note'),
  axes: {
    type: 'array',
    label: 'Axis readouts',
    arrayFields: {
      label: { type: 'text', label: 'Axis' },
      value: { type: 'text', label: 'Value' },
      tone: selectField('Tone', [
        { label: 'Normal', value: 'normal' },
        { label: 'Accent', value: 'accent' },
      ]),
    },
    getItemSummary: (item: { label?: string }) => item.label || 'Axis',
  },
  modes: {
    type: 'array',
    label: 'Mode buttons',
    arrayFields: { label: { type: 'text', label: 'Label' } },
    getItemSummary: (item: { label?: string }) => item.label || 'Mode',
  },
  controllerLabel: textField('Controller label'),
  floatIcon: iconField,
  floatLabel: textField('Floating badge label'),
  floatValue: textField('Floating badge value'),
  floatTag: textField('Floating badge tag'),
});
const programCards: ComponentConfig = def('program-cards', 'Program Cards', programCardsDefaults, {
  headerMarginBottom: numberField('Header bottom margin (px)', 0, 320),
  columnsLg: selectField('Columns (lg+)', [
    { label: '2', value: 'lg:grid-cols-2' },
    { label: '3', value: 'lg:grid-cols-3' },
  ]),
  cardsGap: selectField('Card gap', [
    { label: '24px', value: 'gap-6' },
    { label: '32px', value: 'gap-8' },
    { label: '40px', value: 'gap-10' },
  ]),
});
const programCard: ComponentConfig = def('program-card', 'Program Card', programCardDefaults, {
  imageUrl: textField('Image URL'),
  imageAlt: textField('Image alt text'),
  level: textField('Level pill'),
  levelTone: selectField('Level tone', [
    { label: 'Primary', value: 'primary' },
    { label: 'Secondary', value: 'secondary' },
    { label: 'Accent', value: 'accent' },
  ]),
  duration: textField('Duration chip', '24 Modules · 120 Hrs'),
  metaIcon: iconField,
  metaLabel: textField('Meta label'),
  title: textField('Title'),
  description: textareaField('Description'),
  tags: textField('Tags (comma separated)'),
  instructorInitials: textField('Instructor initials'),
  instructorName: textField('Instructor name'),
  ctaLabel: textField('CTA label'),
  href: textField('Card link URL'),
});
const twinSection: ComponentConfig = def('twin-section', 'Digital Twin', twinSectionDefaults, {
  sectionBg: selectField('Section background', [
    { label: 'Lowest', value: 'bg-surface-container-lowest' },
    { label: 'Low', value: 'bg-surface-container-low' },
    { label: 'Transparent', value: 'bg-transparent' },
    { label: 'Card', value: 'bg-card' },
    { label: 'Sunken', value: 'bg-surface-sunken' },
  ]),
  fileName: textField('Terminal file name'),
  statusLabel: textField('Status label'),
  codeLines: {
    type: 'array',
    label: 'Code lines',
    arrayFields: {
      text: { type: 'text', label: 'Line' },
      tone: selectField('Tone', [
        { label: 'Comment', value: 'comment' },
        { label: 'Code', value: 'code' },
        { label: 'Highlight', value: 'highlight' },
        { label: 'OK', value: 'ok' },
      ]),
    },
    getItemSummary: (item: { text?: string }) => (item.text || 'Line').slice(0, 40),
  },
  readouts: {
    type: 'array',
    label: 'Readout cells',
    arrayFields: {
      label: { type: 'text', label: 'Label' },
      value: { type: 'text', label: 'Value' },
      tone: selectField('Tone', [
        { label: 'Success', value: 'success' },
        { label: 'Normal', value: 'normal' },
        { label: 'Accent', value: 'accent' },
        { label: 'Primary', value: 'primary' },
      ]),
    },
    getItemSummary: (item: { label?: string }) => item.label || 'Readout',
  },
});
const testimonials: ComponentConfig = def('testimonials', 'Testimonials', testimonialsDefaults, {
  headerMarginBottom: numberField('Header bottom margin (px)', 0, 320),
  columnsMd: selectField('Columns (md+)', [
    { label: '2', value: 'md:grid-cols-2' },
    { label: '3', value: 'md:grid-cols-3' },
  ]),
  cardsGap: selectField('Card gap', [
    { label: '24px', value: 'gap-6' },
    { label: '32px', value: 'gap-8' },
    { label: '40px', value: 'gap-10' },
  ]),
});
const testimonialCard: ComponentConfig = def(
  'testimonial-card',
  'Testimonial Card',
  testimonialCardDefaults,
  {
    quote: textareaField('Quote'),
    name: textField('Name'),
    role: textField('Role / company'),
    avatarUrl: textField('Avatar URL'),
    rating: numberField('Rating (0-5)', 0, 5),
  },
);
const ctaSignup: ComponentConfig = def('cta-signup', 'CTA Signup Band', ctaSignupDefaults, {
  pill: textField('Pill label'),
  title: textareaField('Title'),
  subtitle: textareaField('Subtitle'),
  placeholder: textField('Input placeholder'),
  buttonLabel: textField('Button label'),
  note: textField('Fine print'),
  formAction: textField('Form target URL', '/register'),
});
const catalogHero: ComponentConfig = def('catalog-hero', 'Catalog Hero', catalogHeroDefaults, {
  eyebrow: textField('Eyebrow pill'),
  eyebrowIcon: iconField,
  metaLine: textField('Meta line (right of pill)'),
  title: textField('Headline'),
  titleAccent: textField('Accent line (primary)'),
  subtitle: textareaField('Subtitle'),
  stats: {
    type: 'array',
    label: 'Stats strip',
    arrayFields: {
      label: textField('Label'),
      value: textField('Value'),
    },
    getItemSummary: (item: { label?: string }) => item.label || 'Stat',
  },
  primaryCta: {
    type: 'object',
    label: 'Primary CTA',
    objectFields: {
      label: textField('Label'),
      href: textField('URL'),
      variant: selectField('Style', [
        { label: 'Primary', value: 'primary' },
        { label: 'Secondary', value: 'secondary' },
      ]),
      icon: iconField,
    },
  },
  secondaryCta: {
    type: 'object',
    label: 'Secondary CTA',
    objectFields: {
      label: textField('Label'),
      href: textField('URL'),
      variant: selectField('Style', [
        { label: 'Primary', value: 'primary' },
        { label: 'Secondary', value: 'secondary' },
      ]),
      icon: iconField,
    },
  },
  borderBottom: booleanSelect('Bottom border'),
});
const cardGrid: ComponentConfig = def('card-grid', 'Card Grid', cardGridDefaults, {
  eyebrow: textField('Eyebrow'),
  title: textField('Title'),
  subtitle: textareaField('Subtitle'),
  items: {
    type: 'array',
    label: 'Cards',
    arrayFields: {
      title: textField('Title'),
      body: textareaField('Body'),
      icon: iconField,
    },
    getItemSummary: (item: { title?: string }) => item.title || 'Card',
  },
  showNumbers: booleanSelect('Show numbers'),
  columns: selectField('Columns', [
    { label: '3 columns', value: 'md:grid-cols-3' },
    { label: '4 columns', value: 'sm:grid-cols-2 lg:grid-cols-4' },
  ]),
  band: selectField('Band', [
    { label: 'None', value: 'none' },
    { label: 'Sunken', value: 'sunken' },
  ]),
  note: textareaField('Note under grid'),
});
const spotlightCards: ComponentConfig = def(
  'spotlight-cards',
  'Spotlight Cards',
  spotlightCardsDefaults,
  {
    eyebrow: textField('Eyebrow'),
    title: textField('Title'),
    subtitle: textareaField('Subtitle'),
    items: {
      type: 'array',
      label: 'Spotlight cards',
      arrayFields: {
        tag: textField('Tag'),
        title: textField('Title'),
        meta: textField('Meta line'),
        href: textField('URL'),
      },
      getItemSummary: (item: { title?: string }) => item.title || 'Spotlight',
    },
    columns: selectField('Columns', [
      { label: '3 columns', value: 'md:grid-cols-3' },
      { label: '2 columns', value: 'md:grid-cols-2' },
    ]),
    band: selectField('Band', [
      { label: 'None', value: 'none' },
      { label: 'Sunken', value: 'sunken' },
    ]),
  },
);
const closingCta: ComponentConfig = def('closing-cta', 'Closing CTA', closingCtaDefaults, {
  eyebrow: textField('Eyebrow'),
  title: textField('Title'),
  body: textareaField('Body'),
  primaryLabel: textField('Primary label'),
  primaryHref: textField('Primary URL'),
  primaryIcon: iconField,
  secondaryLabel: textField('Secondary label'),
  secondaryHref: textField('Secondary URL'),
  secondaryIcon: iconField,
  borderTop: booleanSelect('Top border'),
});
const liveIsland: ComponentConfig = def('live-island', 'Live Island', liveIslandDefaults, {
  variant: selectField(
    'Island',
    LIVE_ISLAND_VARIANTS.map((v) => ({ label: v, value: v })),
  ),
  label: textField('Editor label'),
});

/**
 * Block names shown in the add-block menu.
 *
 * The `label` passed to `def()` is persisted with saved pages (it is the block's
 * stored name), so it must stay exactly as written. These helpers give the menu
 * a separate `builder.puck.*` key and keep the English label as the fallback,
 * so the stored name and the shown name can never drift apart.
 */
type LabelTranslator = (key: string, options: { default: string }) => string;
export function puckBlockLabel(t: LabelTranslator, type: string, fallback: string) {
  return t(`puck.blocks.${type}`, { default: fallback });
}
export function puckCategoryLabel(t: LabelTranslator, category: string, fallback: string) {
  return t(`puck.categories.${category.toLowerCase()}`, { default: fallback });
}

export const puckConfig: Config = {
  components: {
    nav,
    hero,
    'hero-console': heroConsole,
    stats,
    'stat-item': statItem,
    'partner-logos': partnerLogos,
    'logo-item': logoItem,
    'feature-tiles': featureTiles,
    'feature-item': featureItem,
    'academy-grid': academyGrid,
    'academy-card': academyCard,
    'program-cards': programCards,
    'program-card': programCard,
    'twin-section': twinSection,
    testimonials,
    'testimonial-card': testimonialCard,
    'cta-signup': ctaSignup,
    'cta-banner': ctaBanner,
    faq,
    'faq-item': faqItem,
    footer,
    'footer-col': footerCol,
    section,
    stack,
    grid,
    card,
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
    'catalog-hero': catalogHero,
    'card-grid': cardGrid,
    'spotlight-cards': spotlightCards,
    'closing-cta': closingCta,
    'live-island': liveIsland,
  },
  root: { fields: {} },
  categories: {
    Sections: {
      components: [
        'hero',
        'hero-console',
        'catalog-hero',
        'stats',
        'partner-logos',
        'feature-tiles',
        'academy-grid',
        'program-cards',
        'twin-section',
        'testimonials',
        'cta-banner',
        'cta-signup',
        'faq',
        'card-grid',
        'spotlight-cards',
        'closing-cta',
        'live-island',
        'section',
      ],
      defaultExpanded: true,
    },
    Items: {
      components: [
        'stat-item',
        'logo-item',
        'feature-item',
        'academy-card',
        'program-card',
        'testimonial-card',
        'faq-item',
      ],
    },
    Layout: { components: ['stack', 'grid', 'card'] },
    Content: {
      components: [
        'heading',
        'text',
        'button',
        'link',
        'image',
        'icon',
        'badge',
        'avatar-stack',
        'progress-card',
      ],
    },
  },
};
