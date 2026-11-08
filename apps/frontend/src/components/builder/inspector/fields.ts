import type {
  AcademyCardProps,
  AcademyGridProps,
  AvatarStackProps,
  BadgeProps,
  ButtonProps,
  CardProps,
  CardGridItemProps,
  CardGridProps,
  CatalogCtaProps,
  CatalogHeroProps,
  CatalogStatProps,
  ClosingCtaActionProps,
  ClosingCtaProps,
  ConsoleAxisDrawerProps,
  ConsoleAxisProps,
  ConsoleAuditProps,
  ConsoleFrameProps,
  ConsoleHeaderProps,
  ConsoleImageProps,
  ConsoleMetricProps,
  ConsoleModeBarProps,
  ConsoleModeProps,
  ConsoleScreenProps,
  ConsoleTelemetryProps,
  ConsoleTelemetryStackProps,
  CtaSignupProps,
  CtaBannerProps,
  FaqItemProps,
  FaqProps,
  FeatureItemProps,
  FeatureTilesProps,
  FooterColProps,
  FooterProps,
  GridProps,
  HeadingProps,
  HeroConsoleProps,
  HeroProps,
  IconProps,
  ProductCardProps,
  ProgramCardProps,
  ImageProps,
  LinkProps,
  LiveIslandProps,
  NavLinkProps,
  NavProps,
  PartnerLogosProps,
  ProgramCardsProps,
  ProgressCardProps,
  SectionProps,
  StackProps,
  StatItemProps,
  StatsProps,
  SpotlightCardProps,
  SpotlightCardsProps,
  TestimonialCardProps,
  TestimonialsProps,
  TextProps,
  TwinCodeLineProps,
  TwinReadoutProps,
  TwinSectionProps,
} from '@titan/shared';
import { LIVE_ISLAND_VARIANTS } from '@titan/shared';
import {
  Square,
  AlignLeft,
  Box,
  Braces,
  Columns3,
  Eye,
  Frame,
  Image as ImageIcon,
  Layers,
  LayoutTemplate,
  Link2,
  MousePointerClick,
  Palette,
  Rows3,
  Sparkles,
  Type,
  Users,
} from 'lucide-react';
import {
  defineInspector,
  LAYOUT_FIELDS,
  PADDING_FIELDS,
  type InspectorFieldDef,
  type InspectorGroup,
} from './types';
const spacingGroup = <T>(): InspectorGroup<T> => ({
  id: 'spacing',
  title: 'Spacing',
  titleKey: 'spacing',
  icon: Box,
  fields: [...PADDING_FIELDS, ...LAYOUT_FIELDS] as unknown as InspectorFieldDef<T>[],
});
/** Margin/size fields for blocks that already expose their own padding controls. */
const layoutOnlyGroup = <T>(): InspectorGroup<T> => ({
  id: 'layout-adjust',
  title: 'Layout',
  titleKey: 'layout',
  icon: Frame,
  fields: LAYOUT_FIELDS as unknown as InspectorFieldDef<T>[],
});

const advancedGroup = <T>(): InspectorGroup<T> => ({
  id: 'advanced',
  title: 'Advanced',
  titleKey: 'advanced',
  icon: Braces,
  fields: [
    {
      key: 'className',
      label: 'Extra classes',
      labelKey: 'extra-classes',
      control: 'text',
      placeholder: 'e.g. leading-tight line-clamp-2',
      placeholderKey: 'leading-tight-line-clamp-2',
      hint: 'Raw Tailwind utility classes appended to the element.',
      hintKey: 'raw-tailwind-utility-classes-appended-to-the-ele',
    } as unknown as InspectorFieldDef<T>,
  ],
});
const alignOptions = [
  { label: 'Left', labelKey: 'left', value: 'left' },
  { label: 'Center', labelKey: 'center', value: 'center' },
  { label: 'Right', labelKey: 'right', value: 'right' },
];
const textColorOptions = [
  { label: 'Default (ink)', labelKey: 'default-ink', value: '' },
  { label: 'Primary', labelKey: 'primary', value: 'text-primary' },
  { label: 'Ink', labelKey: 'ink', value: 'text-text-primary' },
  { label: 'Muted', labelKey: 'muted', value: 'text-text-muted' },
  { label: 'Secondary', labelKey: 'secondary', value: 'text-secondary' },
  { label: 'Accent', labelKey: 'accent', value: 'text-accent' },
  { label: 'White', labelKey: 'white', value: 'text-white' },
];
const sectionBgOptions = [
  { label: 'Lowest surface', value: 'bg-surface-container-lowest' },
  { label: 'Low surface', value: 'bg-surface-container-low' },
  { label: 'Transparent', value: 'bg-transparent' },
  { label: 'Card', value: 'bg-card' },
  { label: 'Sunken', value: 'bg-surface-sunken' },
];
const gapOptions = [
  { label: 'None', labelKey: 'none', value: 'none' },
  { label: '8px', labelKey: '8px', value: 'sm' },
  { label: '16px', labelKey: '16px', value: 'md' },
  { label: '20px', labelKey: '20px', value: 'md-2' },
  { label: '24px', labelKey: '24px', value: 'md-lg' },
  { label: '32px', labelKey: '32px', value: 'lg' },
  { label: '48px', labelKey: '48px', value: 'xl' },
]; // ------------------------------------------------------------------ Content primitives
export const headingInspector = defineInspector<HeadingProps>().groups([
  {
    id: 'content',
    title: 'Content',
    titleKey: 'content',
    icon: Type,
    fields: [
      {
        key: 'as',
        label: 'Tag',
        labelKey: 'tag',
        control: 'segmented',
        options: [
          { label: 'H1', labelKey: 'h1', value: 'h1' },
          { label: 'H2', labelKey: 'h2', value: 'h2' },
          { label: 'H3', labelKey: 'h3', value: 'h3' },
          { label: 'H4', labelKey: 'h4', value: 'h4' },
        ],
      },
      { key: 'text', label: 'Text', control: 'textarea', hint: 'A newline creates a line break.' },
      {
        key: 'accentText',
        label: 'Accent phrase',
        control: 'text',
        hint: 'Italic primary phrase rendered after the heading text.',
      },
      {
        key: 'suffixText',
        label: 'Suffix text',
        control: 'text',
        hint: 'Plain text rendered after the accent phrase.',
      },
    ],
  },
  {
    id: 'typography',
    title: 'Typography',
    titleKey: 'typography',
    icon: Type,
    fields: [
      {
        key: 'size',
        label: 'Size',
        labelKey: 'size',
        control: 'select',
        options: [
          { label: 'Hero display', labelKey: 'hero-display', value: 'hero' },
          { label: 'Headline large', labelKey: 'headline-large', value: 'headline-lg' },
          { label: 'Headline medium', labelKey: 'headline-medium', value: 'headline-md' },
          { label: 'Stat number', labelKey: 'stat-number', value: 'stats' },
          { label: '2XL', labelKey: '2xl', value: '2xl' },
          { label: 'XL', labelKey: 'xl', value: 'xl' },
          { label: 'Large', labelKey: 'large', value: 'lg' },
          { label: 'Medium', labelKey: 'medium', value: 'md' },
          { label: 'Small', labelKey: 'small', value: 'sm' },
          { label: 'Label (11px caps)', labelKey: 'label-11px-caps', value: 'label' },
          { label: 'Logo', labelKey: 'logo', value: 'logo' },
        ],
      },
      { key: 'align', label: 'Alignment', control: 'segmented', options: alignOptions },
      { key: 'color', label: 'Color', control: 'select', options: textColorOptions },
      {
        key: 'tracking',
        label: 'Letter spacing',
        labelKey: 'letter-spacing',
        control: 'select',
        options: [
          { label: 'None', labelKey: 'none', value: 'none' },
          { label: 'Wide (0.025em)', labelKey: 'wide-0-025em', value: '0.025em' },
          { label: 'Wider (0.05em)', labelKey: 'wider-0-05em', value: '0.05em' },
          { label: '0.1em', labelKey: '0-1em', value: '0.1em' },
          { label: '0.15em', labelKey: '0-15em', value: '0.15em' },
          { label: '0.2em', labelKey: '0-2em', value: '0.2em' },
        ],
      },
      {
        key: 'leading',
        label: 'Line height',
        labelKey: 'line-height',
        control: 'select',
        options: [
          { label: 'Default', labelKey: 'default', value: 'none' },
          { label: 'Tight', labelKey: 'tight', value: 'tight' },
          { label: 'Snug', labelKey: 'snug', value: 'snug' },
          { label: 'Normal', labelKey: 'normal', value: 'normal' },
          { label: 'Relaxed', labelKey: 'relaxed', value: 'relaxed' },
          { label: 'Loose', labelKey: 'loose', value: 'loose' },
        ],
      },
    ],
  },
  spacingGroup<HeadingProps>(),
  advancedGroup<HeadingProps>(),
]);
export const textInspector = defineInspector<TextProps>().groups([
  {
    id: 'content',
    title: 'Content',
    titleKey: 'content',
    icon: Type,
    fields: [{ key: 'text', label: 'Text', control: 'textarea' }],
  },
  {
    id: 'typography',
    title: 'Typography',
    titleKey: 'typography',
    icon: Type,
    fields: [
      {
        key: 'size',
        label: 'Size',
        labelKey: 'size',
        control: 'select',
        options: [
          { label: '10px label', labelKey: '10px-label', value: '2xs' },
          { label: '11px label', labelKey: '11px-label', value: 'xs' },
          { label: '12px label', labelKey: '12px-label', value: 'sm' },
          { label: 'Medium (16px)', labelKey: 'medium-16px', value: 'md' },
          { label: 'Large (18px)', labelKey: 'large-18px', value: 'lg' },
        ],
      },
      { key: 'align', label: 'Alignment', control: 'segmented', options: alignOptions },
      { key: 'color', label: 'Color', control: 'select', options: textColorOptions },
      { key: 'uppercase', label: 'Uppercase', control: 'toggle' },
      {
        key: 'tracking',
        label: 'Letter spacing',
        labelKey: 'letter-spacing',
        control: 'select',
        options: [
          { label: 'None', labelKey: 'none', value: 'none' },
          { label: 'Wide (0.025em)', labelKey: 'wide-0-025em', value: '0.025em' },
          { label: 'Wider (0.05em)', labelKey: 'wider-0-05em', value: '0.05em' },
          { label: '0.1em', labelKey: '0-1em', value: '0.1em' },
          { label: '0.15em', labelKey: '0-15em', value: '0.15em' },
          { label: '0.2em', labelKey: '0-2em', value: '0.2em' },
        ],
      },
      {
        key: 'weight',
        label: 'Weight',
        labelKey: 'weight',
        control: 'segmented',
        options: [
          { label: 'N', value: 'normal' },
          { label: 'M', value: 'medium' },
          { label: 'SB', labelKey: 'sb', value: 'semibold' },
          { label: 'B', labelKey: 'b', value: 'bold' },
        ],
      },
      {
        key: 'opacity',
        label: 'Opacity',
        labelKey: 'opacity',
        control: 'slider',
        min: 0,
        max: 100,
        step: 5,
        hint: 'Percent',
        hintKey: 'percent',
      },
      {
        key: 'leading',
        label: 'Line height',
        labelKey: 'line-height',
        control: 'select',
        options: [
          { label: 'Default', labelKey: 'default', value: 'none' },
          { label: 'Tight', labelKey: 'tight', value: 'tight' },
          { label: 'Snug', labelKey: 'snug', value: 'snug' },
          { label: 'Normal', labelKey: 'normal', value: 'normal' },
          { label: 'Relaxed', labelKey: 'relaxed', value: 'relaxed' },
          { label: 'Loose', labelKey: 'loose', value: 'loose' },
        ],
      },
    ],
  },
  spacingGroup<TextProps>(),
  advancedGroup<TextProps>(),
]);
export const buttonInspector = defineInspector<ButtonProps>().groups([
  {
    id: 'content',
    title: 'Content',
    titleKey: 'content',
    icon: Type,
    fields: [
      { key: 'label', label: 'Label', control: 'text' },
      { key: 'icon', label: 'Icon', control: 'icon' },
      {
        key: 'iconPosition',
        label: 'Icon position',
        labelKey: 'icon-position',
        control: 'segmented',
        options: [
          { label: 'Left', labelKey: 'left', value: 'left' },
          { label: 'Right', labelKey: 'right', value: 'right' },
        ],
        showWhen: (p) => Boolean(p.icon),
      },
    ],
  },
  {
    id: 'style',
    title: 'Style',
    titleKey: 'style',
    icon: Palette,
    fields: [
      {
        key: 'variant',
        label: 'Variant',
        labelKey: 'variant',
        control: 'select',
        options: [
          { label: 'Primary (solid blue)', labelKey: 'primary-solid-blue', value: 'primary' },
          { label: 'Glass', labelKey: 'glass', value: 'glass' },
          { label: 'White', labelKey: 'white', value: 'white' },
          { label: 'White outline', labelKey: 'white-outline', value: 'white-outline' },
          { label: 'Pill (View All)', labelKey: 'pill-view-all', value: 'pill' },
          { label: 'Navbar CTA', labelKey: 'navbar-cta', value: 'nav-cta' },
          { label: 'Link', labelKey: 'link', value: 'link' },
          { label: 'Enroll', labelKey: 'enroll', value: 'enroll' },
        ],
      },
      {
        key: 'size',
        label: 'Size',
        labelKey: 'size',
        control: 'segmented',
        options: [
          { label: 'S', value: 'sm' },
          { label: 'M', value: 'md' },
          { label: 'L', labelKey: 'l', value: 'lg' },
        ],
      },
      {
        key: 'width',
        label: 'Width',
        labelKey: 'width',
        control: 'segmented',
        options: [
          { label: 'Auto', labelKey: 'auto', value: 'auto' },
          { label: 'Full', labelKey: 'full', value: 'full' },
        ],
      },
    ],
  },
  {
    id: 'behavior',
    title: 'Behavior',
    titleKey: 'behavior',
    icon: Link2,
    fields: [{ key: 'href', label: 'Link URL', control: 'text', placeholder: '/courses' }],
  },
  spacingGroup<ButtonProps>(),
  advancedGroup<ButtonProps>(),
]);
export const linkInspector = defineInspector<LinkProps>().groups([
  {
    id: 'content',
    title: 'Content',
    titleKey: 'content',
    icon: Type,
    fields: [
      {
        key: 'label',
        label: 'Label',
        labelKey: 'label',
        control: 'text',
        placeholder: 'Leave empty for an icon circle',
        placeholderKey: 'leave-empty-for-an-icon-circle',
      },
      { key: 'icon', label: 'Icon', control: 'icon' },
    ],
  },
  {
    id: 'behavior',
    title: 'Behavior',
    titleKey: 'behavior',
    icon: Link2,
    fields: [{ key: 'href', label: 'Link URL', control: 'text', placeholder: '#contact' }],
  },
  spacingGroup<LinkProps>(),
  advancedGroup<LinkProps>(),
]);
export const navLinkInspector = defineInspector<NavLinkProps>().groups([
  {
    id: 'content',
    title: 'Content',
    titleKey: 'content',
    icon: Type,
    fields: [
      { key: 'label', label: 'Label', control: 'text' },
      { key: 'active', label: 'Active (primary colour)', control: 'toggle' },
    ],
  },
  {
    id: 'behavior',
    title: 'Behavior',
    titleKey: 'behavior',
    icon: Link2,
    fields: [{ key: 'href', label: 'Link URL', control: 'text', placeholder: '/about' }],
  },
  spacingGroup<NavLinkProps>(),
  advancedGroup<NavLinkProps>(),
]);
export const imageInspector = defineInspector<ImageProps>().groups([
  {
    id: 'content',
    title: 'Content',
    titleKey: 'content',
    icon: ImageIcon,
    fields: [
      { key: 'src', label: 'Image', control: 'image-upload' },
      { key: 'alt', label: 'Alt text', control: 'text' },
    ],
  },
  {
    id: 'style',
    title: 'Style',
    titleKey: 'style',
    icon: Palette,
    fields: [
      {
        key: 'objectFit',
        label: 'Fit',
        labelKey: 'fit',
        control: 'segmented',
        options: [
          { label: 'Cover', labelKey: 'cover', value: 'cover' },
          { label: 'Contain', labelKey: 'contain', value: 'contain' },
          { label: 'Fill', labelKey: 'fill', value: 'fill' },
        ],
      },
      {
        key: 'radius',
        label: 'Corners',
        labelKey: 'corners',
        control: 'segmented',
        options: [
          { label: 'None', labelKey: 'none', value: 'none' },
          { label: 'S', labelKey: 's', value: 'sm' },
          { label: 'M', labelKey: 'm', value: 'md' },
          { label: 'L', labelKey: 'l', value: 'lg' },
          { label: 'Full', labelKey: 'full', value: 'full' },
        ],
      },
      {
        key: 'aspectRatio',
        label: 'Aspect ratio',
        labelKey: 'aspect-ratio',
        control: 'segmented',
        options: [
          { label: 'Auto', labelKey: 'auto', value: 'none' },
          { label: '4:3', labelKey: '4-3', value: '4/3' },
          { label: '16:10', labelKey: '16-10', value: '16/10' },
        ],
      },
    ],
  },
  {
    id: 'dimensions',
    title: 'Dimensions',
    titleKey: 'dimensions',
    icon: Frame,
    fields: [
      {
        key: 'width',
        label: 'Width',
        labelKey: 'width',
        control: 'slider',
        min: 0,
        max: 2560,
        step: 16,
        hint: 'Pixels',
        hintKey: 'pixels',
      },
      {
        key: 'height',
        label: 'Height',
        labelKey: 'height',
        control: 'slider',
        min: 0,
        max: 2560,
        step: 16,
        hint: 'Pixels',
        hintKey: 'pixels',
      },
    ],
  },
  spacingGroup<ImageProps>(),
  advancedGroup<ImageProps>(),
]);
export const iconInspector = defineInspector<IconProps>().groups([
  {
    id: 'content',
    title: 'Content',
    titleKey: 'content',
    icon: Sparkles,
    fields: [{ key: 'icon', label: 'Icon', control: 'icon' }],
  },
  {
    id: 'style',
    title: 'Style',
    titleKey: 'style',
    icon: Palette,
    fields: [
      { key: 'size', label: 'Size', control: 'slider', min: 8, max: 96, step: 2, hint: 'Pixels' },
      { key: 'color', label: 'Color', control: 'select', options: textColorOptions },
      {
        key: 'box',
        label: 'Tile',
        labelKey: 'tile',
        control: 'segmented',
        options: [
          { label: 'None', labelKey: 'none', value: 'none' },
          { label: 'Tinted', labelKey: 'tinted', value: 'tinted' },
          { label: 'White', labelKey: 'white', value: 'white' },
        ],
      },
    ],
  },
  {
    id: 'behavior',
    title: 'Behavior',
    titleKey: 'behavior',
    icon: Link2,
    fields: [
      { key: 'href', label: 'Link URL', control: 'text', placeholder: 'Optional anchor target' },
    ],
  },
  spacingGroup<IconProps>(),
  advancedGroup<IconProps>(),
]);
export const badgeInspector = defineInspector<BadgeProps>().groups([
  {
    id: 'content',
    title: 'Content',
    titleKey: 'content',
    icon: Type,
    fields: [
      { key: 'text', label: 'Text', control: 'text' },
      { key: 'icon', label: 'Icon', control: 'icon' },
      {
        key: 'iconSize',
        label: 'Icon size',
        labelKey: 'icon-size',
        control: 'slider',
        min: 4,
        max: 64,
        step: 2,
        hint: 'Pixels',
        hintKey: 'pixels',
        showWhen: (p) => Boolean(p.icon),
      },
    ],
  },
  {
    id: 'style',
    title: 'Style',
    titleKey: 'style',
    icon: Palette,
    fields: [
      {
        key: 'variant',
        label: 'Variant',
        labelKey: 'variant',
        control: 'select',
        options: [
          { label: 'Glow (hero eyebrow)', labelKey: 'glow-hero-eyebrow', value: 'glow' },
          { label: 'Primary', labelKey: 'primary', value: 'primary' },
          { label: 'Secondary (with icon)', labelKey: 'secondary-with-icon', value: 'secondary' },
          { label: 'Neutral', labelKey: 'neutral', value: 'neutral' },
          { label: 'Card level pill', labelKey: 'card-level-pill', value: 'card' },
        ],
      },
      {
        key: 'size',
        label: 'Size',
        labelKey: 'size',
        control: 'segmented',
        options: [
          { label: 'S (10px)', value: 'sm' },
          { label: 'M (12px)', value: 'md' },
        ],
      },
      { key: 'uppercase', label: 'Uppercase', control: 'toggle' },
      { key: 'pulse', label: 'Pulse dot', control: 'toggle' },
      { key: 'color', label: 'Color', control: 'select', options: textColorOptions },
    ],
  },
  spacingGroup<BadgeProps>(),
  advancedGroup<BadgeProps>(),
]);
export const avatarStackInspector = defineInspector<AvatarStackProps>().groups([
  {
    id: 'content',
    title: 'Content',
    titleKey: 'content',
    icon: Layers,
    fields: [
      { key: 'count', label: 'Count label', control: 'text', placeholder: '+80' },
      {
        key: 'size',
        label: 'Circle size',
        labelKey: 'circle-size',
        control: 'slider',
        min: 16,
        max: 128,
        step: 4,
        hint: 'Pixels',
        hintKey: 'pixels',
      },
      { key: 'plainCircles', label: 'Plain circles', control: 'slider', min: 0, max: 4, step: 1 },
    ],
  },
  spacingGroup<AvatarStackProps>(),
  advancedGroup<AvatarStackProps>(),
]);
export const progressCardInspector = defineInspector<ProgressCardProps>().groups([
  {
    id: 'content',
    title: 'Content',
    titleKey: 'content',
    icon: Type,
    fields: [
      { key: 'percent', label: 'Percent', control: 'slider', min: 0, max: 100, step: 1 },
      { key: 'title', label: 'Title', control: 'text' },
      { key: 'subtitle', label: 'Subtitle', control: 'text' },
      { key: 'label', label: 'Label', control: 'text' },
      { key: 'value', label: 'Value', control: 'text', placeholder: '85.4%' },
      { key: 'icon', label: 'Icon', control: 'icon' },
    ],
  },
  {
    id: 'style',
    title: 'Style',
    titleKey: 'style',
    icon: Palette,
    fields: [
      { key: 'ticks', label: 'Tick marks', control: 'toggle' },
      {
        key: 'barHeight',
        label: 'Bar height',
        labelKey: 'bar-height',
        control: 'segmented',
        options: [
          { label: 'S', value: 'h-2' },
          { label: 'M', value: 'h-3' },
          { label: 'L', labelKey: 'l', value: 'h-4' },
        ],
      },
    ],
  },
  spacingGroup<ProgressCardProps>(),
  advancedGroup<ProgressCardProps>(),
]); // ------------------------------------------------------------------ Layout containers
export const stackInspector = defineInspector<StackProps>().groups([
  {
    id: 'layout',
    title: 'Layout',
    titleKey: 'layout',
    icon: Rows3,
    fields: [
      {
        key: 'direction',
        label: 'Direction',
        labelKey: 'direction',
        control: 'segmented',
        options: [
          { label: 'Column', labelKey: 'column', value: 'column' },
          { label: 'Row', labelKey: 'row', value: 'row' },
        ],
      },
      {
        key: 'directionMobile',
        label: 'Mobile direction',
        labelKey: 'mobile-direction',
        control: 'segmented',
        options: [
          { label: 'Same', labelKey: 'same', value: 'none' },
          { label: 'Column', labelKey: 'column', value: 'column' },
          { label: 'Row', labelKey: 'row', value: 'row' },
        ],
        hint: 'Overrides the direction below 768px; desktop keeps the main direction.',
        hintKey: 'overrides-the-direction-below-768px-desktop-keep',
      },
      { key: 'gap', label: 'Gap', control: 'select', options: gapOptions },
      {
        key: 'align',
        label: 'Align',
        labelKey: 'align',
        control: 'segmented',
        options: [
          { label: 'Start', labelKey: 'start', value: 'start' },
          { label: 'Center', labelKey: 'center', value: 'center' },
          { label: 'End', labelKey: 'end', value: 'end' },
          { label: 'Stretch', labelKey: 'stretch', value: 'stretch' },
        ],
      },
      {
        key: 'justify',
        label: 'Justify',
        labelKey: 'justify',
        control: 'segmented',
        options: [
          { label: 'Start', labelKey: 'start', value: 'start' },
          { label: 'Center', labelKey: 'center', value: 'center' },
          { label: 'End', labelKey: 'end', value: 'end' },
          { label: 'Between', labelKey: 'between', value: 'between' },
        ],
      },
      { key: 'wrap', label: 'Wrap', control: 'toggle' },
    ],
  },
  {
    id: 'style',
    title: 'Style',
    titleKey: 'style',
    icon: Palette,
    fields: [
      {
        key: 'bg',
        label: 'Background',
        labelKey: 'background',
        control: 'segmented',
        options: [
          { label: 'None', labelKey: 'none', value: 'transparent' },
          { label: 'Glass', labelKey: 'glass', value: 'glass' },
        ],
      },
    ],
  },
  spacingGroup<StackProps>(),
  advancedGroup<StackProps>(),
]);
export const gridInspector = defineInspector<GridProps>().groups([
  {
    id: 'layout',
    title: 'Layout',
    titleKey: 'layout',
    icon: Columns3,
    fields: [
      { key: 'columns', label: 'Columns', control: 'slider', min: 1, max: 6, step: 1 },
      {
        key: 'gap',
        label: 'Gap',
        labelKey: 'gap',
        control: 'select',
        options: [
          { label: 'Small', labelKey: 'small', value: 'sm' },
          { label: '24px', labelKey: '24px', value: 'md' },
          { label: '28px', labelKey: '28px', value: 'md-lg' },
          { label: '32px', labelKey: '32px', value: 'lg' },
          { label: '48px', labelKey: '48px', value: 'xl' },
        ],
      },
    ],
  },
  spacingGroup<GridProps>(),
  advancedGroup<GridProps>(),
]);
const cardStyleFields: InspectorFieldDef<CardProps>[] = [
  {
    key: 'bg',
    label: 'Background',
    labelKey: 'background',
    control: 'segmented',
    options: [
      { label: 'None', labelKey: 'none', value: 'transparent' },
      { label: 'Muted', labelKey: 'muted', value: 'muted' },
      { label: 'Glass', labelKey: 'glass', value: 'glass' },
      { label: 'Gradient', labelKey: 'gradient', value: 'gradient' },
      { label: 'Soft', labelKey: 'soft', value: 'gradient-muted' },
    ],
  },
  {
    key: 'radius',
    label: 'Corners',
    labelKey: 'corners',
    control: 'select',
    options: [
      { label: 'None', labelKey: 'none', value: 'none' },
      { label: 'Small', labelKey: 'small', value: 'sm' },
      { label: 'Medium', labelKey: 'medium', value: 'md' },
      { label: 'Large', labelKey: 'large', value: 'lg' },
      { label: 'XL', labelKey: 'xl', value: 'xl' },
      { label: '2XL', labelKey: '2xl', value: '2xl' },
      { label: 'Full', labelKey: 'full', value: 'full' },
    ],
  },
  { key: 'border', label: 'Border', control: 'toggle' },
  { key: 'accent', label: 'Accent bar', control: 'toggle' },
  {
    key: 'accentColor',
    label: 'Accent bar color',
    labelKey: 'accent-bar-color',
    control: 'segmented',
    options: [
      { label: 'Primary', labelKey: 'primary', value: 'bg-primary' },
      { label: 'Secondary', labelKey: 'secondary', value: 'bg-secondary' },
      { label: 'Accent', labelKey: 'accent', value: 'bg-accent' },
    ],
    showWhen: (p: CardProps) => Boolean(p.accent),
  },
];
export const cardInspector = defineInspector<CardProps>().groups([
  { id: 'style', title: 'Style', icon: Palette, fields: cardStyleFields },
  {
    id: 'layout',
    title: 'Layout',
    titleKey: 'layout',
    icon: LayoutTemplate,
    fields: [
      {
        key: 'padding',
        label: 'Padding',
        labelKey: 'padding',
        control: 'segmented',
        options: [
          { label: 'None', labelKey: 'none', value: 'none' },
          { label: 'S', labelKey: 's', value: 'sm' },
          { label: 'M', labelKey: 'm', value: 'md' },
          { label: 'L', labelKey: 'l', value: 'lg' },
        ],
      },
      { key: 'align', label: 'Alignment', control: 'segmented', options: alignOptions },
      {
        key: 'shadow',
        label: 'Shadow',
        labelKey: 'shadow',
        control: 'select',
        options: [
          { label: 'None', labelKey: 'none', value: 'none' },
          { label: 'Small', labelKey: 'small', value: 'sm' },
          { label: 'Medium', labelKey: 'medium', value: 'md' },
          { label: 'Large', labelKey: 'large', value: 'lg' },
          { label: 'XL', labelKey: 'xl', value: 'xl' },
          { label: 'Glow', labelKey: 'glow', value: 'glow' },
        ],
      },
      { key: 'hover', label: 'Hover lift', control: 'toggle' },
    ],
  },
  spacingGroup<CardProps>(),
  advancedGroup<CardProps>(),
]); // ------------------------------------------------------------------ Items
const statItemStyleFields = cardStyleFields as unknown as InspectorFieldDef<StatItemProps>[];
export const statItemInspector = defineInspector<StatItemProps>().groups([
  { id: 'style', title: 'Style', icon: Palette, fields: statItemStyleFields },
  {
    id: 'layout',
    title: 'Layout',
    titleKey: 'layout',
    icon: LayoutTemplate,
    fields: [
      {
        key: 'padding',
        label: 'Padding',
        labelKey: 'padding',
        control: 'segmented',
        options: [
          { label: 'None', labelKey: 'none', value: 'none' },
          { label: 'S', labelKey: 's', value: 'sm' },
          { label: 'M', labelKey: 'm', value: 'md' },
          { label: 'L', labelKey: 'l', value: 'lg' },
        ],
      },
      { key: 'align', label: 'Alignment', control: 'segmented', options: alignOptions },
      { key: 'hover', label: 'Hover lift', control: 'toggle' },
      {
        key: 'shadow',
        label: 'Shadow',
        control: 'select',
        options: [
          { label: 'None', value: 'none' },
          { label: 'Small', value: 'sm' },
          { label: 'Medium', value: 'md' },
          { label: 'Large', value: 'lg' },
          { label: 'XL', value: 'xl' },
          { label: 'Glow', value: 'glow' },
        ],
      },
    ],
  },
  spacingGroup<StatItemProps>(),
  advancedGroup<StatItemProps>(),
]);
export const logoItemInspector = defineInspector<Record<string, never>>().groups([
  spacingGroup<Record<string, never>>(),
  advancedGroup<Record<string, never>>(),
]);
export const featureItemInspector = defineInspector<FeatureItemProps>().groups([
  {
    id: 'layout',
    title: 'Layout',
    titleKey: 'layout',
    icon: AlignLeft,
    fields: [
      {
        key: 'gap',
        label: 'Icon gap',
        labelKey: 'icon-gap',
        control: 'select',
        options: [
          { label: '16px', value: 'gap-4' },
          { label: '20px', value: 'gap-5' },
          { label: '24px', labelKey: '24px', value: 'gap-6' },
          { label: '32px', labelKey: '32px', value: 'gap-8' },
        ],
      },
    ],
  },
  spacingGroup<FeatureItemProps>(),
  advancedGroup<FeatureItemProps>(),
]);
export const academyCardInspector = defineInspector<AcademyCardProps>().groups([
  {
    id: 'content',
    title: 'Content',
    titleKey: 'content',
    icon: Link2,
    fields: [{ key: 'href', label: 'Link URL', control: 'text', placeholder: '/courses/…' }],
  },
  {
    id: 'style',
    title: 'Style',
    titleKey: 'style',
    icon: Palette,
    fields: [
      {
        key: 'radius',
        label: 'Corners',
        labelKey: 'corners',
        control: 'segmented',
        options: [
          { label: '2XL', value: 'rounded-2xl' },
          { label: '3XL', value: 'rounded-3xl' },
          { label: '2rem', labelKey: '2rem', value: 'rounded-[2rem]' },
        ],
      },
      {
        key: 'contentPadding',
        label: 'Content padding',
        labelKey: 'content-padding',
        control: 'segmented',
        options: [
          { label: '24', value: 'p-6' },
          { label: '32', value: 'p-8' },
          { label: '40', labelKey: '40', value: 'p-10' },
        ],
      },
      {
        key: 'mediaAspect',
        label: 'Media aspect',
        labelKey: 'media-aspect',
        control: 'segmented',
        options: [
          { label: '16:10', value: 'aspect-[16/10]' },
          { label: '16:9', value: 'aspect-video' },
          { label: '1:1', labelKey: '1-1', value: 'aspect-square' },
        ],
      },
    ],
  },
  spacingGroup<AcademyCardProps>(),
  advancedGroup<AcademyCardProps>(),
]);
export const faqItemInspector = defineInspector<FaqItemProps>().groups([
  {
    id: 'content',
    title: 'Content',
    titleKey: 'content',
    icon: Sparkles,
    fields: [{ key: 'icon', label: 'Toggle icon', control: 'icon' }],
  },
  {
    id: 'style',
    title: 'Style',
    titleKey: 'style',
    icon: Palette,
    fields: [
      {
        key: 'buttonPaddingX',
        label: 'Toggle padding X',
        labelKey: 'toggle-padding-x',
        control: 'segmented',
        options: [
          { label: '24', value: 'px-6' },
          { label: '32', value: 'px-8' },
          { label: '40', labelKey: '40', value: 'px-10' },
        ],
      },
      {
        key: 'buttonPaddingY',
        label: 'Toggle padding Y',
        labelKey: 'toggle-padding-y',
        control: 'segmented',
        options: [
          { label: '20', value: 'py-5' },
          { label: '24', value: 'py-6' },
          { label: '32', labelKey: '32', value: 'py-8' },
        ],
      },
      {
        key: 'answerPaddingX',
        label: 'Answer padding X',
        labelKey: 'answer-padding-x',
        control: 'segmented',
        options: [
          { label: '24', value: 'px-6' },
          { label: '32', value: 'px-8' },
          { label: '40', labelKey: '40', value: 'px-10' },
        ],
      },
      {
        key: 'answerPaddingBottom',
        label: 'Answer padding bottom',
        labelKey: 'answer-padding-bottom',
        control: 'segmented',
        options: [
          { label: '24', value: 'pb-6' },
          { label: '32', value: 'pb-8' },
          { label: '40', labelKey: '40', value: 'pb-10' },
        ],
      },
    ],
  },
  spacingGroup<FaqItemProps>(),
  advancedGroup<FaqItemProps>(),
]);
export const footerColInspector = defineInspector<FooterColProps>().groups([
  {
    id: 'layout',
    title: 'Layout',
    titleKey: 'layout',
    icon: Rows3,
    fields: [
      {
        key: 'gap',
        label: 'Column gap',
        labelKey: 'column-gap',
        control: 'select',
        options: [
          { label: '8px', value: 'gap-2' },
          { label: '16px', value: 'gap-4' },
          { label: '24px', labelKey: '24px', value: 'gap-6' },
        ],
      },
    ],
  },
  spacingGroup<FooterColProps>(),
  advancedGroup<FooterColProps>(),
]); // ------------------------------------------------------------------ Sections
export const sectionInspector = defineInspector<SectionProps>().groups([
  {
    id: 'style',
    title: 'Style',
    titleKey: 'style',
    icon: Palette,
    fields: [
      {
        key: 'bg',
        label: 'Background',
        labelKey: 'background',
        control: 'segmented',
        options: [
          { label: 'None', labelKey: 'none', value: 'transparent' },
          { label: 'White', labelKey: 'white', value: 'white' },
          { label: 'Muted', labelKey: 'muted', value: 'muted' },
          { label: 'Tint', labelKey: 'tint', value: 'secondary' },
          { label: 'Primary', labelKey: 'primary', value: 'primary' },
          { label: 'Gradient', labelKey: 'gradient', value: 'gradient-primary' },
          { label: 'Soft', labelKey: 'soft', value: 'gradient-muted' },
        ],
      },
    ],
  },
  {
    id: 'layout',
    title: 'Layout',
    titleKey: 'layout',
    icon: Frame,
    fields: [
      {
        key: 'maxWidth',
        label: 'Container width',
        labelKey: 'container-width',
        control: 'slider',
        min: 0,
        max: 2560,
        step: 16,
        hint: 'Pixels',
        hintKey: 'pixels',
      },
      {
        key: 'minHeight',
        label: 'Min height',
        labelKey: 'min-height',
        control: 'slider',
        min: 0,
        max: 3000,
        step: 16,
        hint: 'Pixels',
        hintKey: 'pixels',
      },
      {
        key: 'marginTop',
        label: 'Margin top',
        control: 'slider',
        min: 0,
        max: 320,
        step: 4,
        hint: 'Pixels',
        hintKey: 'pixels',
      },
      {
        key: 'marginBottom',
        label: 'Margin bottom',
        control: 'slider',
        min: 0,
        max: 320,
        step: 4,
        hint: 'Pixels',
        hintKey: 'pixels',
      },
    ],
  },
  { id: 'spacing', title: 'Spacing', icon: Box, fields: PADDING_FIELDS as never[] },
  {
    id: 'background',
    title: 'Background',
    titleKey: 'background',
    icon: Layers,
    fields: [
      { key: 'bgColor', label: 'Background', control: 'color' },
      {
        key: 'bgGradient',
        label: 'Gradient',
        control: 'text',
        hint: 'e.g. linear-gradient(135deg, #0ea5e9, #6366f1)',
      },
      {
        key: 'bgImage',
        label: 'Background image',
        control: 'image-upload',
        hint: 'Upload-only (no manual URL)',
      },
      { key: 'glass', label: 'Frosted glass', control: 'toggle' },
    ],
  },
  {
    id: 'border',
    title: 'Border',
    titleKey: 'border',
    icon: Square,
    fields: [
      { key: 'border', label: 'Width (px)', control: 'number', min: 0, max: 16 },
      { key: 'borderColor', label: 'Border colour', control: 'color' },
      { key: 'radius', label: 'Corner radius (px)', control: 'number', min: 0, max: 64 },
      {
        key: 'overflow',
        label: 'Overflow',
        control: 'select',
        options: [
          { value: 'hidden', label: 'Clip' },
          { value: 'visible', label: 'Visible' },
        ],
      },
    ],
  },
  {
    id: 'behavior',
    title: 'Visibility',
    titleKey: 'visibility',
    icon: Eye,
    fields: [
      {
        key: 'hidden',
        label: 'Hide section',
        labelKey: 'hide-section',
        control: 'toggle',
        hint: 'Hides the section on the page.',
        hintKey: 'hides-the-section-on-the-page',
      },
    ],
  },
  advancedGroup<SectionProps>(),
]);
export const navInspector = defineInspector<NavProps>().groups([
  {
    id: 'layout',
    title: 'Layout',
    titleKey: 'layout',
    icon: LayoutTemplate,
    fields: [
      {
        key: 'topOffset',
        label: 'Top offset',
        labelKey: 'top-offset',
        control: 'slider',
        min: 0,
        max: 320,
        step: 4,
        hint: 'Pixels',
        hintKey: 'pixels',
      },
      {
        key: 'widthPercent',
        label: 'Bar width',
        labelKey: 'bar-width',
        control: 'slider',
        min: 20,
        max: 100,
        step: 5,
        hint: '% of viewport',
        hintKey: 'of-viewport',
      },
      {
        key: 'containerMaxWidth',
        label: 'Max width',
        labelKey: 'max-width',
        control: 'slider',
        min: 320,
        max: 2560,
        step: 16,
        hint: 'Pixels',
        hintKey: 'pixels',
      },
    ],
  },
  {
    id: 'style',
    title: 'Style',
    titleKey: 'style',
    icon: Palette,
    fields: [
      {
        key: 'containerPaddingX',
        label: 'Padding X',
        labelKey: 'padding-x',
        control: 'select',
        options: [
          { label: 'Small (16/24px)', labelKey: 'small-16-24px', value: 'px-4 md:px-6' },
          { label: 'Medium (24/32px)', labelKey: 'medium-24-32px', value: 'px-6 md:px-8' },
          { label: 'Large (32/40px)', labelKey: 'large-32-40px', value: 'px-8 md:px-10' },
        ],
      },
      {
        key: 'containerPaddingY',
        label: 'Padding Y',
        labelKey: 'padding-y',
        control: 'select',
        options: [
          { label: '8px', value: 'py-2' },
          { label: '10px', value: 'py-2.5' },
          { label: '12px', labelKey: '12px', value: 'py-3' },
          { label: '16px', labelKey: '16px', value: 'py-4' },
        ],
      },
      {
        key: 'containerRadius',
        label: 'Corners',
        labelKey: 'corners',
        control: 'segmented',
        options: [
          { label: 'M', value: 'rounded-lg' },
          { label: 'L', value: 'rounded-xl' },
          { label: 'XL', labelKey: 'xl', value: 'rounded-2xl' },
          { label: '2XL', labelKey: '2xl', value: 'rounded-3xl' },
        ],
      },
    ],
  },
  spacingGroup<NavProps>(),
  advancedGroup<NavProps>(),
]);
export const heroInspector = defineInspector<HeroProps>().groups([
  {
    id: 'style',
    title: 'Style',
    titleKey: 'style',
    icon: ImageIcon,
    fields: [
      { key: 'imageUrl', label: 'Background image', control: 'image-upload' },
      { key: 'backgroundColor', label: 'Background color', control: 'color' },
      {
        key: 'backgroundOverlay',
        label: 'Overlay',
        labelKey: 'overlay',
        control: 'slider',
        min: 0,
        max: 100,
        step: 5,
        hint: '%',
        hintKey: 'value',
      },
      {
        key: 'backgroundOpacity',
        label: 'Image opacity',
        labelKey: 'image-opacity',
        control: 'slider',
        min: 0,
        max: 100,
        step: 5,
        hint: '%',
        hintKey: 'value',
      },
      { key: 'gradientVeil', label: 'Gradient veil', control: 'toggle' },
      {
        key: 'mesh',
        label: 'Gradient mesh',
        labelKey: 'gradient-mesh',
        control: 'toggle',
        hint: 'Animated color blobs behind the content',
        hintKey: 'animated-color-blobs-behind-the-content',
      },
    ],
  },
  {
    id: 'layout',
    title: 'Layout',
    titleKey: 'layout',
    icon: Frame,
    fields: [
      { key: 'fullHeight', label: 'Full height', control: 'toggle' },
      {
        key: 'nonFullHeight',
        label: 'Min height',
        labelKey: 'min-height',
        control: 'slider',
        min: 200,
        max: 3000,
        step: 16,
        hint: 'Pixels',
        hintKey: 'pixels',
        showWhen: (p) => !p.fullHeight,
      },
      {
        key: 'contentMaxWidth',
        label: 'Content width',
        labelKey: 'content-width',
        control: 'slider',
        min: 320,
        max: 2560,
        step: 16,
        hint: 'Pixels',
        hintKey: 'pixels',
      },
      {
        key: 'contentPaddingX',
        label: 'Content padding X',
        labelKey: 'content-padding-x',
        control: 'select',
        options: [
          {
            label: 'Theme mobile margin',
            labelKey: 'theme-mobile-margin',
            value: 'px-margin-mobile',
          },
          { label: '16px', labelKey: '16px', value: 'px-4' },
          { label: '24px', labelKey: '24px', value: 'px-6' },
          { label: '32px', labelKey: '32px', value: 'px-8' },
        ],
      },
    ],
  },
  {
    id: 'behavior',
    title: 'Behavior',
    titleKey: 'behavior',
    icon: MousePointerClick,
    fields: [
      { key: 'scrollIndicator', label: 'Scroll indicator', control: 'toggle' },
      {
        key: 'scrollIndicatorBottom',
        label: 'Indicator bottom',
        labelKey: 'indicator-bottom',
        control: 'slider',
        min: 0,
        max: 320,
        step: 4,
        hint: 'Pixels',
        hintKey: 'pixels',
        showWhen: (p) => Boolean(p.scrollIndicator),
      },
      {
        key: 'parallaxFactor',
        label: 'Parallax',
        labelKey: 'parallax',
        control: 'slider',
        min: 0,
        max: 100,
        step: 5,
        hint: '% (0 = off)',
        hintKey: '0-off',
        showWhen: (p) => Boolean(p.scrollIndicator),
      },
      {
        key: 'contentAlign',
        label: 'Content alignment',
        labelKey: 'content-alignment',
        control: 'segmented',
        options: [
          { label: 'Center', labelKey: 'center', value: 'center' },
          { label: 'Left', labelKey: 'left', value: 'left' },
        ],
      },
    ],
  },
  {
    id: 'trust',
    title: 'Trust Chips',
    titleKey: 'trust-chips',
    icon: Sparkles,
    fields: [
      {
        key: 'showTrustChips',
        label: 'Show trust chips',
        labelKey: 'show-trust-chips',
        control: 'toggle',
        hint: 'Avatars, rating and note under the CTAs',
        hintKey: 'avatars-rating-and-note-under-the-ctas',
      },
      {
        key: 'trustNote',
        label: 'Trust note',
        labelKey: 'trust-note',
        control: 'text',
        placeholder: 'Free manufacturing education for all',
        placeholderKey: 'free-manufacturing-education-for-all',
      },
      {
        key: 'trustNoteHref',
        label: 'Trust note link',
        labelKey: 'trust-note-link',
        control: 'text',
        placeholder: 'https://… (optional)',
        placeholderKey: 'https-optional',
      },
    ],
  },
  advancedGroup<HeroProps>(),
  spacingGroup<HeroProps>(),
]);
export const statsInspector = defineInspector<StatsProps>().groups([
  {
    id: 'layout',
    title: 'Layout',
    titleKey: 'layout',
    icon: LayoutTemplate,
    fields: [
      {
        key: 'overlap',
        label: 'Overlap',
        labelKey: 'overlap',
        control: 'slider',
        min: 0,
        max: 320,
        step: 4,
        hint: 'Pixels',
        hintKey: 'pixels',
      },
      {
        key: 'columnsMobile',
        label: 'Columns (mobile)',
        labelKey: 'columns-mobile',
        control: 'segmented',
        options: [
          { label: '1', value: 'grid-cols-1' },
          { label: '2', value: 'grid-cols-2' },
        ],
      },
      {
        key: 'columnsSm',
        label: 'Columns (sm+)',
        labelKey: 'columns-sm',
        control: 'segmented',
        options: [
          { label: '2', value: 'sm:grid-cols-2' },
          { label: '3', value: 'sm:grid-cols-3' },
        ],
      },
      {
        key: 'columnsLg',
        label: 'Columns (lg+)',
        labelKey: 'columns-lg',
        control: 'segmented',
        options: [
          { label: '2', value: 'lg:grid-cols-2' },
          { label: '3', value: 'lg:grid-cols-3' },
          { label: '4', labelKey: '4', value: 'lg:grid-cols-4' },
        ],
      },
      {
        key: 'gap',
        label: 'Gap',
        labelKey: 'gap',
        control: 'segmented',
        options: [
          { label: '16', value: 'gap-4' },
          { label: '24', value: 'gap-6' },
          { label: '32', labelKey: '32', value: 'gap-8' },
          { label: '48', labelKey: '48', value: 'gap-12' },
        ],
      },
    ],
  },
  advancedGroup<StatsProps>(),
  spacingGroup<StatsProps>(),
]);
export const partnerLogosInspector = defineInspector<PartnerLogosProps>().groups([
  {
    id: 'layout',
    title: 'Layout',
    titleKey: 'layout',
    icon: LayoutTemplate,
    fields: [
      {
        key: 'logoGap',
        label: 'Logo gap',
        labelKey: 'logo-gap',
        control: 'select',
        options: [
          { label: 'Small (32/64px)', labelKey: 'small-32-64px', value: 'gap-8 md:gap-16' },
          { label: 'Medium (48/96px)', labelKey: 'medium-48-96px', value: 'gap-12 md:gap-24' },
          { label: 'Large (64/128px)', labelKey: 'large-64-128px', value: 'gap-16 md:gap-32' },
        ],
      },
      {
        key: 'headerMarginBottom',
        label: 'Header bottom margin',
        labelKey: 'header-bottom-margin',
        control: 'slider',
        min: 0,
        max: 320,
        step: 4,
        hint: 'Pixels',
        hintKey: 'pixels',
      },
      {
        key: 'frame',
        label: 'Logo frame',
        control: 'segmented',
        options: [
          { label: 'Glass wall', value: 'wall' },
          { label: 'Bare strip', value: 'strip' },
        ],
      },
    ],
  },
  advancedGroup<PartnerLogosProps>(),
  spacingGroup<PartnerLogosProps>(),
]);
export const featureTilesInspector = defineInspector<FeatureTilesProps>().groups([
  {
    id: 'content',
    title: 'Content',
    titleKey: 'content',
    icon: ImageIcon,
    fields: [
      { key: 'imageUrl', label: 'Image', control: 'image-upload' },
      { key: 'imageAlt', label: 'Image alt text', control: 'text' },
    ],
  },
  {
    id: 'style',
    title: 'Style',
    titleKey: 'style',
    icon: Palette,
    fields: [
      {
        key: 'sectionBg',
        label: 'Section background',
        labelKey: 'section-background',
        control: 'segmented',
        options: [
          { label: 'White', labelKey: 'white', value: 'bg-surface-container-lowest' },
          { label: 'Grey', labelKey: 'grey', value: 'bg-surface-container-low' },
          { label: 'None', labelKey: 'none', value: 'bg-transparent' },
        ],
      },
      {
        key: 'imageBorder',
        label: 'Image border',
        labelKey: 'image-border',
        control: 'slider',
        min: 0,
        max: 64,
        step: 1,
        hint: 'Pixels',
        hintKey: 'pixels',
      },
      { key: 'decorativeCircles', label: 'Decorative circles', control: 'toggle' },
    ],
  },
  {
    id: 'layout',
    title: 'Layout',
    titleKey: 'layout',
    icon: LayoutTemplate,
    fields: [
      {
        key: 'gap',
        label: 'Column gap',
        labelKey: 'column-gap',
        control: 'slider',
        min: 0,
        max: 320,
        step: 4,
        hint: 'Pixels',
        hintKey: 'pixels',
      },
      { key: 'imageFirstMobile', label: 'Image first on mobile', control: 'toggle' },
    ],
  },
  advancedGroup<FeatureTilesProps>(),
  spacingGroup<FeatureTilesProps>(),
]);
export const academyGridInspector = defineInspector<AcademyGridProps>().groups([
  {
    id: 'content',
    title: 'Content',
    titleKey: 'content',
    icon: Link2,
    fields: [
      { key: 'viewAllHref', label: 'View all link', control: 'text', placeholder: '/courses' },
      {
        key: 'limit',
        label: 'Card limit',
        control: 'number',
        min: 1,
        max: 24,
        hint: 'Leave empty to show every published academy. The homepage uses 4.',
      },
    ],
  },
  {
    id: 'layout',
    title: 'Layout',
    titleKey: 'layout',
    icon: LayoutTemplate,
    fields: [
      {
        key: 'headerMarginBottom',
        label: 'Header bottom margin',
        labelKey: 'header-bottom-margin',
        control: 'slider',
        min: 0,
        max: 320,
        step: 4,
        hint: 'Pixels',
        hintKey: 'pixels',
      },
      {
        key: 'cardsColumns',
        label: 'Card columns (md+)',
        labelKey: 'card-columns-md',
        control: 'segmented',
        options: [
          { label: '2', value: 'md:grid-cols-2' },
          { label: '3', value: 'md:grid-cols-3' },
        ],
      },
      {
        key: 'cardsGap',
        label: 'Card gap',
        labelKey: 'card-gap',
        control: 'segmented',
        options: [
          { label: '24', value: 'gap-6' },
          { label: '32', value: 'gap-8' },
          { label: '40', labelKey: '40', value: 'gap-10' },
        ],
      },
    ],
  },
  advancedGroup<AcademyGridProps>(),
  spacingGroup<AcademyGridProps>(),
]);
export const ctaBannerInspector = defineInspector<CtaBannerProps>().groups([
  {
    id: 'content',
    title: 'Content',
    titleKey: 'content',
    icon: ImageIcon,
    fields: [{ key: 'imageUrl', label: 'Image', control: 'image-upload' }],
  },
  {
    id: 'style',
    title: 'Style',
    titleKey: 'style',
    icon: Palette,
    fields: [
      { key: 'overlayColor', label: 'Overlay color', control: 'color' },
      {
        key: 'overlayOpacity',
        label: 'Overlay opacity',
        labelKey: 'overlay-opacity',
        control: 'slider',
        min: 0,
        max: 100,
        step: 5,
        hint: '%',
        hintKey: 'value',
      },
      { key: 'radialVeil', label: 'Radial veil', control: 'toggle' },
      {
        key: 'padding',
        label: 'Banner padding',
        labelKey: 'banner-padding',
        control: 'select',
        options: [
          { label: 'Small (32/64px)', labelKey: 'small-32-64px', value: 'p-8 md:p-16' },
          { label: 'Medium (48/96px)', labelKey: 'medium-48-96px', value: 'p-12 md:p-24' },
          { label: 'Large (64/128px)', labelKey: 'large-64-128px', value: 'p-16 md:p-32' },
        ],
      },
      {
        key: 'radius',
        label: 'Corners',
        labelKey: 'corners',
        control: 'segmented',
        options: [
          { label: '3XL', value: 'rounded-3xl' },
          { label: '3rem', labelKey: '3rem', value: 'rounded-[3rem]' },
          { label: '4rem', labelKey: '4rem', value: 'rounded-[4rem]' },
        ],
      },
      {
        key: 'sectionBg',
        label: 'Section background',
        control: 'select',
        options: sectionBgOptions,
      },
    ],
  },
  {
    id: 'layout',
    title: 'Layout',
    titleKey: 'layout',
    icon: LayoutTemplate,
    fields: [
      {
        key: 'gap',
        label: 'Column gap',
        labelKey: 'column-gap',
        control: 'slider',
        min: 0,
        max: 320,
        step: 4,
        hint: 'Pixels',
        hintKey: 'pixels',
      },
      {
        key: 'copyWidth',
        label: 'Copy column (lg+)',
        labelKey: 'copy-column-lg',
        control: 'segmented',
        options: [
          { label: '1/2', value: 'lg:w-1/2' },
          { label: '3/5', value: 'lg:w-3/5' },
          { label: '2/3', labelKey: '2-3', value: 'lg:w-2/3' },
        ],
      },
      {
        key: 'sideWidth',
        label: 'Side column (lg+)',
        labelKey: 'side-column-lg',
        control: 'segmented',
        options: [
          { label: '1/3', value: 'lg:w-1/3' },
          { label: '2/5', value: 'lg:w-2/5' },
          { label: '1/2', labelKey: '1-2', value: 'lg:w-1/2' },
        ],
      },
    ],
  },
  advancedGroup<CtaBannerProps>(),
  spacingGroup<CtaBannerProps>(),
]);
export const faqInspector = defineInspector<FaqProps>().groups([
  {
    id: 'layout',
    title: 'Layout',
    titleKey: 'layout',
    icon: LayoutTemplate,
    fields: [
      {
        key: 'maxWidth',
        label: 'Inner max width',
        labelKey: 'inner-max-width',
        control: 'slider',
        min: 320,
        max: 2560,
        step: 16,
        hint: 'Pixels',
        hintKey: 'pixels',
      },
      {
        key: 'headerMarginBottom',
        label: 'Header bottom margin',
        labelKey: 'header-bottom-margin',
        control: 'slider',
        min: 0,
        max: 320,
        step: 4,
        hint: 'Pixels',
        hintKey: 'pixels',
      },
      {
        key: 'itemsGap',
        label: 'Items gap',
        labelKey: 'items-gap',
        control: 'select',
        options: [
          { label: '12px', value: 'flex flex-col gap-3' },
          { label: '16px', value: 'flex flex-col gap-4' },
          { label: '24px', labelKey: '24px', value: 'flex flex-col gap-6' },
        ],
      },
      {
        key: 'footerMarginTop',
        label: 'Footer top margin',
        labelKey: 'footer-top-margin',
        control: 'slider',
        min: 0,
        max: 320,
        step: 4,
        hint: 'Pixels',
        hintKey: 'pixels',
      },
      {
        key: 'sectionBg',
        label: 'Section background',
        control: 'select',
        options: sectionBgOptions,
      },
    ],
  },
  advancedGroup<FaqProps>(),
  spacingGroup<FaqProps>(),
]);
export const footerInspector = defineInspector<FooterProps>().groups([
  {
    id: 'layout',
    title: 'Layout',
    titleKey: 'layout',
    icon: LayoutTemplate,
    fields: [
      {
        key: 'columnsSm',
        label: 'Columns (sm+)',
        labelKey: 'columns-sm',
        control: 'segmented',
        options: [
          { label: '2', value: 'sm:grid-cols-2' },
          { label: '3', value: 'sm:grid-cols-3' },
        ],
      },
      {
        key: 'columnsLg',
        label: 'Columns (md+)',
        labelKey: 'columns-md',
        control: 'segmented',
        options: [
          { label: '3', value: 'md:grid-cols-3' },
          { label: '4', value: 'md:grid-cols-4' },
        ],
      },
      {
        key: 'gridGap',
        label: 'Column gap',
        labelKey: 'column-gap',
        control: 'select',
        options: [
          { label: '32px', value: 'gap-8' },
          { label: '48px', value: 'gap-12' },
          { label: '64px', labelKey: '64px', value: 'gap-16' },
        ],
      },
      {
        key: 'bottomGap',
        label: 'Bottom bar gap',
        labelKey: 'bottom-bar-gap',
        control: 'select',
        options: [
          { label: '16px', value: 'gap-4' },
          { label: '32px', value: 'gap-8' },
        ],
      },
    ],
  },
  advancedGroup<FooterProps>(),
  spacingGroup<FooterProps>(),
]); // ------------------------------------------------------------------ registry
import type { InspectorBlockDef } from './types';

/*
 * Definitions for blocks that previously had none.
 *
 * Twelve of the forty-one registered blocks had no entry in `BLOCK_INSPECTOR`, so selecting them
 * fell through to the "no editable properties" panel. Several of those hold the page's copy —
 * Spotlight Cards, Closing CTA, Card Grid, CTA Signup — and their headings, body text and button
 * labels could not be edited anywhere except raw JSON.
 *
 * `program-cards` and `testimonials` are deliberately absent: they render live records, so their
 * text belongs to the data, not the layout. They are covered by the dynamic-content notice.
 */
export const spotlightCardsInspector = defineInspector<SpotlightCardsProps>().groups([
  {
    id: 'content',
    title: 'Content',
    titleKey: 'content',
    icon: Type,
    fields: [
      { key: 'eyebrow', label: 'Eyebrow', control: 'text' },
      { key: 'title', label: 'Title', control: 'text' },
      { key: 'subtitle', label: 'Subtitle', control: 'textarea' },
    ],
  },
  {
    id: 'cards',
    title: 'Cards',
    icon: Rows3,
    fields: [
      {
        key: 'items',
        label: 'Spotlight cards',
        control: 'repeater',
        // Cards are child blocks in the `cards` slot now.
        showWhen: () => false,
        itemLabel: 'card',
        maxItems: 6,
        newItem: () => ({ tag: 'NEW', title: 'Spotlight card', href: '/academy' }),
        itemFields: [
          { key: 'tag', label: 'Tag', control: 'text' },
          { key: 'title', label: 'Title', control: 'text' },
          { key: 'meta', label: 'Meta line', control: 'text' },
          { key: 'href', label: 'Link', control: 'text', placeholder: '/academy' },
        ],
        getItemSummary: (item) => String(item.title ?? 'Spotlight card'),
      },
    ],
  },
  {
    id: 'style',
    title: 'Style',
    titleKey: 'style',
    icon: Palette,
    fields: [
      {
        key: 'band',
        label: 'Band',
        control: 'select',
        options: [
          { label: 'None', value: 'none' },
          { label: 'Sunken', value: 'sunken' },
        ],
      },
      {
        key: 'columns',
        label: 'Columns',
        control: 'select',
        options: [
          { label: '3 columns', value: 'md:grid-cols-3' },
          { label: '2 columns', value: 'md:grid-cols-2' },
        ],
      },
      { key: 'paddingTop', label: 'Padding top', control: 'number' },
      { key: 'paddingRight', label: 'Padding right', control: 'number' },
      { key: 'paddingBottom', label: 'Padding bottom', control: 'number' },
      { key: 'paddingLeft', label: 'Padding left', control: 'number' },
    ],
  },
  layoutOnlyGroup(),
  advancedGroup(),
]);

export const closingCtaInspector = defineInspector<ClosingCtaProps>().groups([
  {
    id: 'content',
    title: 'Content',
    titleKey: 'content',
    icon: Type,
    fields: [
      { key: 'eyebrow', label: 'Eyebrow', control: 'text' },
      { key: 'title', label: 'Title', control: 'text' },
      { key: 'body', label: 'Body', control: 'textarea' },
    ],
  },
  {
    id: 'actions',
    title: 'Buttons',
    titleKey: 'actions',
    icon: MousePointerClick,
    fields: [
      // Buttons are child blocks in the `actions` slot now.
      { key: 'primaryLabel', label: 'Primary label', control: 'text', showWhen: () => false },
      {
        key: 'primaryHref',
        label: 'Primary link',
        control: 'text',
        placeholder: '/path',
        showWhen: () => false,
      },
      { key: 'primaryIcon', label: 'Primary icon', control: 'icon', showWhen: () => false },
      { key: 'secondaryLabel', label: 'Secondary label', control: 'text', showWhen: () => false },
      {
        key: 'secondaryHref',
        label: 'Secondary link',
        control: 'text',
        placeholder: '/path',
        showWhen: () => false,
      },
      { key: 'secondaryIcon', label: 'Secondary icon', control: 'icon', showWhen: () => false },
    ],
  },
  {
    id: 'style',
    title: 'Style',
    titleKey: 'style',
    icon: Palette,
    fields: [
      { key: 'borderTop', label: 'Top border', control: 'toggle' },
      { key: 'paddingTop', label: 'Padding top', control: 'number' },
      { key: 'paddingRight', label: 'Padding right', control: 'number' },
      { key: 'paddingBottom', label: 'Padding bottom', control: 'number' },
      { key: 'paddingLeft', label: 'Padding left', control: 'number' },
    ],
  },
  layoutOnlyGroup(),
  advancedGroup(),
]);

export const closingCtaActionInspector = defineInspector<ClosingCtaActionProps>().groups([
  {
    id: 'content',
    title: 'Button',
    titleKey: 'content',
    icon: MousePointerClick,
    fields: [
      { key: 'label', label: 'Label', control: 'text' },
      { key: 'href', label: 'Link', control: 'text', placeholder: '/path' },
      {
        key: 'variant',
        label: 'Style',
        control: 'select',
        options: [
          { label: 'Primary', value: 'primary' },
          { label: 'Secondary', value: 'secondary' },
        ],
      },
      { key: 'icon', label: 'Icon', control: 'icon' },
    ],
  },
  layoutOnlyGroup(),
  advancedGroup(),
]);

export const cardGridInspector = defineInspector<CardGridProps>().groups([
  {
    id: 'content',
    title: 'Content',
    titleKey: 'content',
    icon: Type,
    fields: [
      { key: 'eyebrow', label: 'Eyebrow', control: 'text' },
      { key: 'title', label: 'Title', control: 'text' },
      { key: 'subtitle', label: 'Subtitle', control: 'textarea' },
    ],
  },
  {
    id: 'cards',
    title: 'Cards',
    icon: Rows3,
    fields: [
      {
        key: 'items',
        label: 'Cards',
        control: 'repeater',
        // Cards are child blocks in the `cards` slot now.
        showWhen: () => false,
        itemLabel: 'card',
        maxItems: 8,
        newItem: () => ({ title: 'New card', body: '', icon: 'school' }),
        itemFields: [
          { key: 'title', label: 'Title', control: 'text' },
          { key: 'body', label: 'Body', control: 'textarea' },
          { key: 'icon', label: 'Icon', control: 'icon' },
        ],
        getItemSummary: (item) => String(item.title ?? 'Card'),
      },
      { key: 'note', label: 'Note under grid', control: 'textarea' },
    ],
  },
  {
    id: 'style',
    title: 'Style',
    titleKey: 'style',
    icon: Palette,
    fields: [
      { key: 'showNumbers', label: 'Show numbers', control: 'toggle' },
      {
        key: 'columns',
        label: 'Columns',
        control: 'select',
        options: [
          { label: '3 columns', value: 'md:grid-cols-3' },
          { label: '4 columns', value: 'sm:grid-cols-2 lg:grid-cols-4' },
        ],
      },
      {
        key: 'band',
        label: 'Band',
        control: 'select',
        options: [
          { label: 'None', value: 'none' },
          { label: 'Sunken', value: 'sunken' },
        ],
      },
      { key: 'paddingTop', label: 'Padding top', control: 'number' },
      { key: 'paddingRight', label: 'Padding right', control: 'number' },
      { key: 'paddingBottom', label: 'Padding bottom', control: 'number' },
      { key: 'paddingLeft', label: 'Padding left', control: 'number' },
    ],
  },
  layoutOnlyGroup(),
  advancedGroup(),
]);

export const ctaSignupInspector = defineInspector<CtaSignupProps>().groups([
  {
    id: 'content',
    title: 'Content',
    titleKey: 'content',
    icon: Type,
    fields: [
      { key: 'pill', label: 'Pill', control: 'text' },
      { key: 'title', label: 'Title', control: 'text' },
      { key: 'subtitle', label: 'Subtitle', control: 'textarea' },
      { key: 'note', label: 'Small print', control: 'textarea' },
    ],
  },
  {
    id: 'form',
    title: 'Form',
    titleKey: 'form',
    icon: MousePointerClick,
    fields: [
      { key: 'placeholder', label: 'Input placeholder', control: 'text' },
      { key: 'buttonLabel', label: 'Button label', control: 'text' },
      { key: 'formAction', label: 'Form action', control: 'text', placeholder: '/register' },
    ],
  },
  {
    id: 'style',
    title: 'Style',
    titleKey: 'style',
    icon: Palette,
    fields: [
      { key: 'paddingTop', label: 'Padding top', control: 'number' },
      { key: 'paddingRight', label: 'Padding right', control: 'number' },
      { key: 'paddingBottom', label: 'Padding bottom', control: 'number' },
      { key: 'paddingLeft', label: 'Padding left', control: 'number' },
    ],
  },
  layoutOnlyGroup(),
  advancedGroup(),
]);

export const heroConsoleInspector = defineInspector<HeroConsoleProps>().groups([
  {
    id: 'content',
    title: 'Content',
    titleKey: 'content',
    icon: Type,
    fields: [
      { key: 'imageAlt', label: 'Background image alt text', control: 'text' },
      { key: 'fileName', label: 'File name', control: 'text' },
      { key: 'syncLabel', label: 'Sync label', control: 'text' },
      { key: 'auditTitle', label: 'Audit title', control: 'text' },
    ],
  },
  {
    id: 'media',
    title: 'Media',
    titleKey: 'media',
    icon: ImageIcon,
    fields: [{ key: 'imageUrl', label: 'Background image', control: 'image-upload' }],
  },
  {
    id: 'console',
    title: 'Console',
    titleKey: 'content',
    icon: Layers,
    fields: [
      {
        key: 'consoleMode',
        label: 'Console rendering',
        control: 'select',
        options: [
          { label: 'Auto (components when present)', value: 'auto' },
          { label: 'Component tree', value: 'composed' },
          { label: 'Legacy built-in console', value: 'legacy' },
        ],
      },
    ],
  },
  {
    id: 'legacy-console',
    title: 'Legacy console',
    icon: Layers,
    fields: [
      {
        key: 'feedLabel',
        label: 'Feed label',
        control: 'text',
        showWhen: (p) => p.consoleMode === 'legacy',
      },
      {
        key: 'feedValue',
        label: 'Feed value',
        control: 'text',
        showWhen: (p) => p.consoleMode === 'legacy',
      },
      {
        key: 'feedTag',
        label: 'Feed tag',
        control: 'text',
        showWhen: (p) => p.consoleMode === 'legacy',
      },
      {
        key: 'spindleLabel',
        label: 'Spindle label',
        control: 'text',
        showWhen: (p) => p.consoleMode === 'legacy',
      },
      {
        key: 'spindleValue',
        label: 'Spindle value',
        control: 'text',
        showWhen: (p) => p.consoleMode === 'legacy',
      },
      {
        key: 'spindleTag',
        label: 'Spindle tag',
        control: 'text',
        showWhen: (p) => p.consoleMode === 'legacy',
      },
      {
        key: 'auditValue',
        label: 'Audit value',
        control: 'text',
        showWhen: (p) => p.consoleMode === 'legacy',
      },
      {
        key: 'axesTitle',
        label: 'Axes title',
        control: 'text',
        showWhen: (p) => p.consoleMode === 'legacy',
      },
      {
        key: 'vibration',
        label: 'Vibration note',
        control: 'text',
        showWhen: (p) => p.consoleMode === 'legacy',
      },
      {
        key: 'controllerLabel',
        label: 'Controller label',
        control: 'text',
        showWhen: (p) => p.consoleMode === 'legacy',
      },
      {
        key: 'floatIcon',
        label: 'Floating metric icon',
        control: 'icon',
        showWhen: (p) => p.consoleMode === 'legacy',
      },
      {
        key: 'floatLabel',
        label: 'Floating metric label',
        control: 'text',
        showWhen: (p) => p.consoleMode === 'legacy',
      },
      {
        key: 'floatValue',
        label: 'Floating metric value',
        control: 'text',
        showWhen: (p) => p.consoleMode === 'legacy',
      },
      {
        key: 'floatTag',
        label: 'Floating metric tag',
        control: 'text',
        showWhen: (p) => p.consoleMode === 'legacy',
      },
      {
        key: 'axes',
        label: 'Axis readouts',
        control: 'repeater',
        itemLabel: 'axis',
        maxItems: 8,
        newItem: () => ({ label: 'X', value: '0', tone: 'normal' }),
        itemFields: [
          { key: 'label', label: 'Label', control: 'text' },
          { key: 'value', label: 'Value', control: 'text' },
          {
            key: 'tone',
            label: 'Tone',
            control: 'select',
            options: [
              { label: 'Normal', value: 'normal' },
              { label: 'Accent', value: 'accent' },
            ],
          },
        ],
        getItemSummary: (item) => String(item.label ?? 'Axis'),
        showWhen: (p) => p.consoleMode === 'legacy',
      },
      {
        key: 'modes',
        label: 'Mode buttons',
        control: 'repeater',
        itemLabel: 'mode',
        maxItems: 6,
        newItem: () => ({ label: 'Mode' }),
        itemFields: [{ key: 'label', label: 'Label', control: 'text' }],
        getItemSummary: (item) => String(item.label ?? 'Mode'),
        showWhen: (p) => p.consoleMode === 'legacy',
      },
    ],
  },
  spacingGroup(),
  advancedGroup(),
]);

export const consoleFrameInspector = defineInspector<ConsoleFrameProps>().groups([
  {
    id: 'style',
    title: 'Frame',
    titleKey: 'style',
    icon: Palette,
    fields: [
      {
        key: 'radius',
        label: 'Corner radius',
        control: 'select',
        options: [
          { label: 'None', value: 'none' },
          { label: 'Small', value: 'sm' },
          { label: 'Medium', value: 'md' },
          { label: 'Large', value: 'lg' },
          { label: 'Extra large', value: 'xl' },
          { label: '2XL', value: '2xl' },
          { label: '3XL', value: '3xl' },
        ],
      },
      { key: 'padding', label: 'Inner padding', control: 'slider', min: 0, max: 64, step: 2 },
      { key: 'glass', label: 'Glass treatment', control: 'toggle' },
    ],
  },
  spacingGroup(),
  advancedGroup(),
]);

export const consoleHeaderInspector = defineInspector<ConsoleHeaderProps>().groups([
  {
    id: 'content',
    title: 'Content',
    titleKey: 'content',
    icon: Type,
    fields: [
      { key: 'fileName', label: 'File name', control: 'text' },
      { key: 'syncLabel', label: 'Sync label', control: 'text' },
      { key: 'showTrafficLights', label: 'Traffic lights', control: 'toggle' },
    ],
  },
  spacingGroup(),
  advancedGroup(),
]);

export const consoleScreenInspector = defineInspector<ConsoleScreenProps>().groups([
  {
    id: 'style',
    title: 'Viewport',
    titleKey: 'style',
    icon: Palette,
    fields: [
      { key: 'height', label: 'Desktop height', control: 'slider', min: 160, max: 900, step: 10 },
      {
        key: 'mobileHeight',
        label: 'Mobile height',
        control: 'slider',
        min: 160,
        max: 900,
        step: 10,
      },
      { key: 'blueprint', label: 'Blueprint backdrop', control: 'toggle' },
    ],
  },
  spacingGroup(),
  advancedGroup(),
]);

export const consoleImageInspector = defineInspector<ConsoleImageProps>().groups([
  {
    id: 'media',
    title: 'Media',
    titleKey: 'media',
    icon: ImageIcon,
    fields: [
      { key: 'src', label: 'Console image', control: 'image-upload' },
      { key: 'alt', label: 'Image alt text', control: 'text' },
      {
        key: 'objectFit',
        label: 'Image fit',
        control: 'select',
        options: [
          { label: 'Cover', value: 'cover' },
          { label: 'Contain', value: 'contain' },
        ],
      },
      { key: 'opacity', label: 'Opacity', control: 'slider', min: 0, max: 100, step: 1 },
    ],
  },
  spacingGroup(),
  advancedGroup(),
]);

export const consoleTelemetryStackInspector = defineInspector<ConsoleTelemetryStackProps>().groups([
  {
    id: 'style',
    title: 'Stack',
    titleKey: 'style',
    icon: Palette,
    fields: [
      {
        key: 'placement',
        label: 'Placement',
        control: 'select',
        options: [
          { label: 'Top left', value: 'top-left' },
          { label: 'Top right', value: 'top-right' },
          { label: 'Bottom left', value: 'bottom-left' },
          { label: 'Bottom right', value: 'bottom-right' },
        ],
      },
      {
        key: 'gap',
        label: 'Gap',
        control: 'select',
        options: [
          { label: '6px', value: 'sm' },
          { label: '8px', value: 'md' },
          { label: '12px', value: 'lg' },
        ],
      },
    ],
  },
  spacingGroup(),
  advancedGroup(),
]);

export const consoleTelemetryInspector = defineInspector<ConsoleTelemetryProps>().groups([
  {
    id: 'content',
    title: 'Readout',
    titleKey: 'content',
    icon: Type,
    fields: [
      { key: 'label', label: 'Label', control: 'text' },
      { key: 'value', label: 'Value', control: 'text' },
      { key: 'tag', label: 'Tag', control: 'text' },
      {
        key: 'tagTone',
        label: 'Tag style',
        control: 'select',
        options: [
          { label: 'Success badge', value: 'success' },
          { label: 'Muted text', value: 'muted' },
        ],
      },
    ],
  },
  spacingGroup(),
  advancedGroup(),
]);

export const consoleAuditInspector = defineInspector<ConsoleAuditProps>().groups([
  {
    id: 'content',
    title: 'Audit',
    titleKey: 'content',
    icon: Type,
    fields: [
      { key: 'title', label: 'Title', control: 'text' },
      { key: 'value', label: 'Value', control: 'text' },
    ],
  },
  {
    id: 'style',
    title: 'Style',
    titleKey: 'style',
    icon: Palette,
    fields: [
      { key: 'icon', label: 'Icon', control: 'icon' },
      {
        key: 'placement',
        label: 'Placement',
        control: 'select',
        options: [
          { label: 'Top left', value: 'top-left' },
          { label: 'Top right', value: 'top-right' },
          { label: 'Bottom left', value: 'bottom-left' },
          { label: 'Bottom right', value: 'bottom-right' },
        ],
      },
    ],
  },
  spacingGroup(),
  advancedGroup(),
]);

export const consoleAxisDrawerInspector = defineInspector<ConsoleAxisDrawerProps>().groups([
  {
    id: 'content',
    title: 'Drawer',
    titleKey: 'content',
    icon: Type,
    fields: [
      { key: 'title', label: 'Title', control: 'text' },
      { key: 'vibration', label: 'Vibration note', control: 'text' },
      {
        key: 'placement',
        label: 'Placement',
        control: 'select',
        options: [
          { label: 'Bottom', value: 'bottom' },
          { label: 'Top', value: 'top' },
        ],
      },
    ],
  },
  spacingGroup(),
  advancedGroup(),
]);

export const consoleAxisInspector = defineInspector<ConsoleAxisProps>().groups([
  {
    id: 'content',
    title: 'Axis',
    titleKey: 'content',
    icon: Type,
    fields: [
      { key: 'label', label: 'Axis label', control: 'text' },
      { key: 'value', label: 'Value', control: 'text' },
      {
        key: 'tone',
        label: 'Tone',
        control: 'select',
        options: [
          { label: 'Normal', value: 'normal' },
          { label: 'Accent', value: 'accent' },
        ],
      },
    ],
  },
  spacingGroup(),
  advancedGroup(),
]);

export const consoleModeBarInspector = defineInspector<ConsoleModeBarProps>().groups([
  {
    id: 'content',
    title: 'Mode bar',
    titleKey: 'content',
    icon: Type,
    fields: [{ key: 'controllerLabel', label: 'Controller label', control: 'text' }],
  },
  spacingGroup(),
  advancedGroup(),
]);

export const consoleModeInspector = defineInspector<ConsoleModeProps>().groups([
  {
    id: 'content',
    title: 'Mode button',
    titleKey: 'content',
    icon: Type,
    fields: [
      { key: 'label', label: 'Label', control: 'text' },
      { key: 'active', label: 'Active', control: 'toggle' },
      { key: 'hideOnMobile', label: 'Hide on mobile', control: 'toggle' },
    ],
  },
  spacingGroup(),
  advancedGroup(),
]);

export const consoleMetricInspector = defineInspector<ConsoleMetricProps>().groups([
  {
    id: 'content',
    title: 'Metric',
    titleKey: 'content',
    icon: Type,
    fields: [
      { key: 'label', label: 'Label', control: 'text' },
      { key: 'value', label: 'Value', control: 'text' },
      { key: 'tag', label: 'Tag', control: 'text' },
    ],
  },
  {
    id: 'style',
    title: 'Style',
    titleKey: 'style',
    icon: Palette,
    fields: [
      { key: 'icon', label: 'Icon', control: 'icon' },
      {
        key: 'placement',
        label: 'Placement',
        control: 'select',
        options: [
          { label: 'Top left', value: 'top-left' },
          { label: 'Top right', value: 'top-right' },
          { label: 'Bottom left', value: 'bottom-left' },
          { label: 'Bottom right', value: 'bottom-right' },
        ],
      },
    ],
  },
  spacingGroup(),
  advancedGroup(),
]);

export const twinSectionInspector = defineInspector<TwinSectionProps>().groups([
  {
    id: 'content',
    title: 'Content',
    titleKey: 'content',
    icon: Type,
    fields: [
      { key: 'fileName', label: 'File name', control: 'text' },
      { key: 'statusLabel', label: 'Status label', control: 'text' },
    ],
  },
  {
    id: 'terminal',
    title: 'Terminal',
    icon: Rows3,
    fields: [
      {
        key: 'codeLines',
        label: 'Code lines',
        control: 'repeater',
        // Code lines are child blocks in the `code` slot now.
        showWhen: () => false,
        itemLabel: 'line',
        maxItems: 24,
        newItem: () => ({ text: 'G01 X0 Y0', tone: 'code' }),
        itemFields: [
          { key: 'text', label: 'Line', control: 'textarea' },
          {
            key: 'tone',
            label: 'Tone',
            control: 'select',
            options: [
              { label: 'Comment', value: 'comment' },
              { label: 'Code', value: 'code' },
              { label: 'Highlight', value: 'highlight' },
              { label: 'OK', value: 'ok' },
            ],
          },
        ],
        getItemSummary: (item) => String(item.text ?? 'Line'),
      },
      {
        key: 'readouts',
        label: 'Readout cells',
        control: 'repeater',
        // Readout cells are child blocks in the `readoutCells` slot now.
        showWhen: () => false,
        itemLabel: 'readout',
        maxItems: 8,
        newItem: () => ({ label: 'Readout', value: '0', tone: 'normal' }),
        itemFields: [
          { key: 'label', label: 'Label', control: 'text' },
          { key: 'value', label: 'Value', control: 'text' },
          {
            key: 'tone',
            label: 'Tone',
            control: 'select',
            options: [
              { label: 'Success', value: 'success' },
              { label: 'Normal', value: 'normal' },
              { label: 'Accent', value: 'accent' },
              { label: 'Primary', value: 'primary' },
            ],
          },
        ],
        getItemSummary: (item) => String(item.label ?? 'Readout'),
      },
    ],
  },
  {
    id: 'style',
    title: 'Style',
    titleKey: 'style',
    icon: Palette,
    fields: [
      { key: 'sectionBg', label: 'Section background', control: 'select', options: sectionBgOptions },
      { key: 'paddingTop', label: 'Padding top', control: 'number' },
      { key: 'paddingRight', label: 'Padding right', control: 'number' },
      { key: 'paddingBottom', label: 'Padding bottom', control: 'number' },
      { key: 'paddingLeft', label: 'Padding left', control: 'number' },
    ],
  },
  layoutOnlyGroup(),
  advancedGroup(),
]);

export const programCardInspector = defineInspector<ProgramCardProps>().groups([
  {
    id: 'content',
    title: 'Content',
    titleKey: 'content',
    icon: Type,
    fields: [
      { key: 'level', label: 'Level', control: 'text' },
      { key: 'title', label: 'Title', control: 'text' },
      { key: 'description', label: 'Description', control: 'textarea' },
      { key: 'tags', label: 'Tags', control: 'text' },
      { key: 'duration', label: 'Duration', control: 'text' },
      { key: 'metaLabel', label: 'Meta line', control: 'text' },
      { key: 'metaIcon', label: 'Meta icon', control: 'icon' },
    ],
  },
  {
    id: 'media',
    title: 'Media',
    titleKey: 'media',
    icon: ImageIcon,
    fields: [
      { key: 'imageUrl', label: 'Image', control: 'image-upload' },
      { key: 'imageAlt', label: 'Image alt text', control: 'text' },
      {
        key: 'levelTone',
        label: 'Level colour',
        control: 'select',
        options: [
          { label: 'Primary', value: 'primary' },
          { label: 'Secondary', value: 'secondary' },
          { label: 'Accent', value: 'accent' },
        ],
      },
    ],
  },
  {
    id: 'instructor',
    title: 'Instructor',
    titleKey: 'instructor',
    icon: Users,
    fields: [
      { key: 'instructorInitials', label: 'Initials', control: 'text' },
      { key: 'instructorName', label: 'Name', control: 'text' },
    ],
  },
  {
    id: 'actions',
    title: 'Button',
    titleKey: 'actions',
    icon: MousePointerClick,
    fields: [
      { key: 'ctaLabel', label: 'Label', control: 'text' },
      { key: 'href', label: 'Link', control: 'text', placeholder: '/path' },
    ],
  },
  spacingGroup(),
  advancedGroup(),
]);

export const testimonialCardInspector = defineInspector<TestimonialCardProps>().groups([
  {
    id: 'content',
    title: 'Content',
    titleKey: 'content',
    icon: Type,
    fields: [
      { key: 'quote', label: 'Quote', control: 'textarea' },
      { key: 'name', label: 'Name', control: 'text' },
      { key: 'role', label: 'Role', control: 'text' },
      { key: 'rating', label: 'Rating', control: 'number', min: 0, max: 5 },
    ],
  },
  {
    id: 'media',
    title: 'Avatar',
    titleKey: 'avatar',
    icon: ImageIcon,
    fields: [{ key: 'avatarUrl', label: 'Avatar image', control: 'image-upload' }],
  },
  spacingGroup(),
  advancedGroup(),
]);

export const programCardsInspector = defineInspector<ProgramCardsProps>().groups([
  {
    id: 'layout',
    title: 'Layout',
    titleKey: 'layout',
    icon: LayoutTemplate,
    fields: [
      {
        key: 'columnsLg',
        label: 'Columns (lg+)',
        labelKey: 'columns-lg',
        control: 'segmented',
        options: [
          { label: '2', value: 'lg:grid-cols-2' },
          { label: '3', value: 'lg:grid-cols-3' },
        ],
      },
      {
        key: 'cardsGap',
        label: 'Card gap',
        labelKey: 'card-gap',
        control: 'select',
        options: [
          { label: '24px', value: 'gap-6' },
          { label: '32px', value: 'gap-8' },
          { label: '40px', value: 'gap-10' },
        ],
      },
      {
        key: 'headerMarginBottom',
        label: 'Header space',
        labelKey: 'header-bottom-margin',
        control: 'slider',
        min: 0,
        max: 320,
        step: 4,
        hint: 'Pixels',
        hintKey: 'pixels',
      },
      {
        key: 'limit',
        label: 'Maximum cards',
        control: 'slider',
        min: 1,
        max: 24,
        step: 1,
        hint: 'Unset shows every published academy.',
      },
    ],
  },
  advancedGroup<ProgramCardsProps>(),
  spacingGroup<ProgramCardsProps>(),
]);

export const testimonialsInspector = defineInspector<TestimonialsProps>().groups([
  {
    id: 'layout',
    title: 'Layout',
    titleKey: 'layout',
    icon: LayoutTemplate,
    fields: [
      {
        key: 'columnsMd',
        label: 'Columns (md+)',
        labelKey: 'columns-md',
        control: 'segmented',
        options: [
          { label: '2', value: 'md:grid-cols-2' },
          { label: '3', value: 'md:grid-cols-3' },
        ],
      },
      {
        key: 'cardsGap',
        label: 'Card gap',
        labelKey: 'card-gap',
        control: 'select',
        options: [
          { label: '24px', value: 'gap-6' },
          { label: '32px', value: 'gap-8' },
          { label: '40px', value: 'gap-10' },
        ],
      },
      {
        key: 'headerMarginBottom',
        label: 'Header space',
        labelKey: 'header-bottom-margin',
        control: 'slider',
        min: 0,
        max: 320,
        step: 4,
        hint: 'Pixels',
        hintKey: 'pixels',
      },
      {
        key: 'limit',
        label: 'Maximum cards',
        control: 'slider',
        min: 1,
        max: 24,
        step: 1,
        hint: 'Unset shows every published testimonial.',
      },
    ],
  },
  advancedGroup<TestimonialsProps>(),
  spacingGroup<TestimonialsProps>(),
]);

const LIVE_ISLAND_OPTIONS = LIVE_ISLAND_VARIANTS.map((value) => ({
  label: value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' '),
  value,
}));

export const liveIslandInspector = defineInspector<LiveIslandProps>().groups([
  {
    id: 'content',
    title: 'Content',
    titleKey: 'content',
    icon: LayoutTemplate,
    fields: [
      {
        key: 'variant',
        label: 'Data source',
        control: 'select',
        options: LIVE_ISLAND_OPTIONS,
        hint: 'Live variants read tenant data. Homepage FAQ/Guides and About facts are fixed repository-managed sections.',
      },
      {
        key: 'label',
        label: 'Editor label',
        control: 'text',
        hint: 'Shown on the canvas badge and used as the fallback heading.',
      },
    ],
  },
  advancedGroup<LiveIslandProps>(),
  spacingGroup<LiveIslandProps>(),
]);

const catalogCtaFields: InspectorFieldDef<Record<string, unknown>>[] = [
  { key: 'label', label: 'Label', control: 'text' },
  { key: 'href', label: 'Link', control: 'text', placeholder: '/path' },
  {
    key: 'variant',
    label: 'Style',
    control: 'select',
    options: [
      { label: 'Primary', value: 'primary' },
      { label: 'Secondary', value: 'secondary' },
    ],
  },
  { key: 'icon', label: 'Icon', control: 'icon' },
];

export const catalogHeroInspector = defineInspector<CatalogHeroProps>().groups([
  {
    id: 'content',
    title: 'Content',
    titleKey: 'content',
    icon: Type,
    fields: [
      { key: 'eyebrow', label: 'Eyebrow', control: 'text' },
      { key: 'eyebrowIcon', label: 'Eyebrow icon', control: 'icon' },
      { key: 'metaLine', label: 'Meta line', control: 'text' },
      { key: 'title', label: 'Title', control: 'text' },
      { key: 'titleAccent', label: 'Title accent', control: 'text' },
      { key: 'subtitle', label: 'Subtitle', control: 'textarea' },
    ],
  },
  {
    id: 'stats',
    title: 'Stats strip',
    icon: Rows3,
    fields: [
      {
        key: 'stats',
        label: 'Stats',
        control: 'repeater',
        // Stats are child blocks in the `statItems` slot now.
        showWhen: () => false,
        itemLabel: 'stat',
        maxItems: 6,
        newItem: () => ({ label: 'Label', value: '0' }),
        itemFields: [
          { key: 'label', label: 'Label', control: 'text' },
          { key: 'value', label: 'Value', control: 'text' },
        ],
        getItemSummary: (item) => String(item.label ?? 'Stat'),
      },
    ],
  },
  {
    id: 'ctas',
    title: 'Buttons',
    titleKey: 'actions',
    icon: MousePointerClick,
    fields: [
      {
        key: 'primaryCta',
        label: 'Primary CTA',
        control: 'object',
        // CTAs are child blocks in the `actions` slot now.
        showWhen: () => false,
        objectFields: catalogCtaFields,
      },
      {
        key: 'secondaryCta',
        label: 'Secondary CTA',
        control: 'object',
        // CTAs are child blocks in the `actions` slot now.
        showWhen: () => false,
        objectFields: catalogCtaFields,
      },
    ],
  },
  {
    id: 'style',
    title: 'Style',
    titleKey: 'style',
    icon: Palette,
    fields: [{ key: 'borderBottom', label: 'Bottom border', control: 'toggle' }],
  },
  spacingGroup(),
  advancedGroup(),
]);

export const catalogStatInspector = defineInspector<CatalogStatProps>().groups([
  {
    id: 'content',
    title: 'Content',
    titleKey: 'content',
    icon: Type,
    fields: [
      { key: 'label', label: 'Label', control: 'text' },
      { key: 'value', label: 'Value', control: 'text' },
    ],
  },
  spacingGroup(),
  advancedGroup(),
]);

export const catalogCtaInspector = defineInspector<CatalogCtaProps>().groups([
  {
    id: 'content',
    title: 'Content',
    titleKey: 'content',
    icon: MousePointerClick,
    fields: [
      { key: 'label', label: 'Label', control: 'text' },
      { key: 'href', label: 'Link', control: 'text', placeholder: '/path' },
      {
        key: 'variant',
        label: 'Style',
        control: 'select',
        options: [
          { label: 'Primary', value: 'primary' },
          { label: 'Secondary', value: 'secondary' },
        ],
      },
      { key: 'icon', label: 'Icon', control: 'icon' },
    ],
  },
  spacingGroup(),
  advancedGroup(),
]);

export const cardGridItemInspector = defineInspector<CardGridItemProps>().groups([
  {
    id: 'content',
    title: 'Content',
    titleKey: 'content',
    icon: Type,
    fields: [
      { key: 'title', label: 'Title', control: 'text' },
      { key: 'body', label: 'Body', control: 'textarea' },
      { key: 'icon', label: 'Icon', control: 'icon' },
    ],
  },
  spacingGroup(),
  advancedGroup(),
]);

/**
 * A live product card. Price, stock, image and link are resolved from the
 * catalogue at render time; only the copy that is safe to author is exposed.
 */
export const productCardInspector = defineInspector<ProductCardProps>().groups([
  {
    id: 'content',
    title: 'Content',
    titleKey: 'content',
    icon: Type,
    fields: [
      { key: 'title', label: 'Title', control: 'text' },
      { key: 'tagline', label: 'Tagline', control: 'textarea' },
    ],
  },
  spacingGroup(),
  advancedGroup(),
]);

export const spotlightCardInspector = defineInspector<SpotlightCardProps>().groups([
  {
    id: 'content',
    title: 'Content',
    titleKey: 'content',
    icon: Type,
    fields: [
      { key: 'tag', label: 'Tag', control: 'text' },
      { key: 'title', label: 'Title', control: 'text' },
      { key: 'meta', label: 'Meta line', control: 'text' },
      { key: 'href', label: 'Link', control: 'text', placeholder: '/academy' },
    ],
  },
  spacingGroup(),
  advancedGroup(),
]);

export const twinCodeLineInspector = defineInspector<TwinCodeLineProps>().groups([
  {
    id: 'content',
    title: 'Content',
    titleKey: 'content',
    icon: Type,
    fields: [
      { key: 'text', label: 'Line', control: 'textarea' },
      {
        key: 'tone',
        label: 'Tone',
        control: 'select',
        options: [
          { label: 'Comment', value: 'comment' },
          { label: 'Code', value: 'code' },
          { label: 'Highlight', value: 'highlight' },
          { label: 'OK', value: 'ok' },
        ],
      },
    ],
  },
  spacingGroup(),
  advancedGroup(),
]);

export const twinReadoutInspector = defineInspector<TwinReadoutProps>().groups([
  {
    id: 'content',
    title: 'Content',
    titleKey: 'content',
    icon: Type,
    fields: [
      { key: 'label', label: 'Label', control: 'text' },
      { key: 'value', label: 'Value', control: 'text' },
      {
        key: 'tone',
        label: 'Tone',
        control: 'select',
        options: [
          { label: 'Success', value: 'success' },
          { label: 'Normal', value: 'normal' },
          { label: 'Accent', value: 'accent' },
          { label: 'Primary', value: 'primary' },
        ],
      },
    ],
  },
  spacingGroup(),
  advancedGroup(),
]);

export const BLOCK_INSPECTOR: Record<string, InspectorBlockDef> = {
  heading: { label: 'Heading', groups: headingInspector.groups },
  text: { label: 'Text', groups: textInspector.groups },
  button: { label: 'Button', groups: buttonInspector.groups },
  link: { label: 'Link', groups: linkInspector.groups },
  'nav-link': { label: 'Nav Link', groups: navLinkInspector.groups },
  image: { label: 'Image', groups: imageInspector.groups },
  icon: { label: 'Icon', groups: iconInspector.groups },
  badge: { label: 'Badge / Eyebrow', groups: badgeInspector.groups },
  'avatar-stack': { label: 'Avatar Stack', groups: avatarStackInspector.groups },
  'progress-card': { label: 'Progress Card', groups: progressCardInspector.groups },
  stack: { label: 'Stack', groups: stackInspector.groups },
  grid: { label: 'Grid', groups: gridInspector.groups },
  card: { label: 'Card', groups: cardInspector.groups },
  'stat-item': { label: 'Stat Card', groups: statItemInspector.groups },
  'logo-item': { label: 'Logo Item', groups: logoItemInspector.groups },
  'feature-item': { label: 'Feature Row', groups: featureItemInspector.groups },
  'academy-card': { label: 'Academy Card', groups: academyCardInspector.groups },
  'faq-item': { label: 'FAQ Item', groups: faqItemInspector.groups },
  'footer-col': { label: 'Footer Column', groups: footerColInspector.groups },
  section: { label: 'Section', groups: sectionInspector.groups },
  nav: { label: 'Navbar', groups: navInspector.groups },
  hero: { label: 'Hero', groups: heroInspector.groups },
  stats: { label: 'Stats Bar', groups: statsInspector.groups },
  'partner-logos': { label: 'Partner Logos', groups: partnerLogosInspector.groups },
  'feature-tiles': { label: 'Feature Tiles', groups: featureTilesInspector.groups },
  'academy-grid': { label: 'Academy Grid', groups: academyGridInspector.groups },
  'cta-banner': { label: 'CTA Banner', groups: ctaBannerInspector.groups },
  faq: { label: 'FAQ', groups: faqInspector.groups },
  footer: { label: 'Footer', groups: footerInspector.groups },
  'spotlight-cards': { label: 'Spotlight Cards', groups: spotlightCardsInspector.groups },
  'closing-cta-action': {
    label: 'Closing CTA Button',
    groups: closingCtaActionInspector.groups,
  },
  'closing-cta': { label: 'Closing CTA', groups: closingCtaInspector.groups },
  'card-grid': { label: 'Card Grid', groups: cardGridInspector.groups },
  'cta-signup': { label: 'CTA Signup Band', groups: ctaSignupInspector.groups },
  'hero-console': { label: 'Hero + Sim Console', groups: heroConsoleInspector.groups },
  'console-frame': { label: 'Console Frame', groups: consoleFrameInspector.groups },
  'console-header': { label: 'Console Header', groups: consoleHeaderInspector.groups },
  'console-screen': { label: 'Console Screen', groups: consoleScreenInspector.groups },
  'console-image': { label: 'Console Image', groups: consoleImageInspector.groups },
  'console-telemetry-stack': {
    label: 'Telemetry Stack',
    groups: consoleTelemetryStackInspector.groups,
  },
  'console-telemetry': { label: 'Telemetry Badge', groups: consoleTelemetryInspector.groups },
  'console-audit': { label: 'Audit Status', groups: consoleAuditInspector.groups },
  'console-axis-drawer': {
    label: 'Axis Drawer',
    groups: consoleAxisDrawerInspector.groups,
  },
  'console-axis': { label: 'Axis Readout', groups: consoleAxisInspector.groups },
  'console-mode-bar': { label: 'Mode Bar', groups: consoleModeBarInspector.groups },
  'console-mode': { label: 'Mode Button', groups: consoleModeInspector.groups },
  'console-metric': { label: 'Floating Metric', groups: consoleMetricInspector.groups },
  'twin-section': { label: 'Digital Twin', groups: twinSectionInspector.groups },
  'program-cards': { label: 'Program Cards', groups: programCardsInspector.groups },
  'program-card': { label: 'Program Card', groups: programCardInspector.groups },
  testimonials: { label: 'Testimonials', groups: testimonialsInspector.groups },
  'testimonial-card': { label: 'Testimonial Card', groups: testimonialCardInspector.groups },
  'live-island': { label: 'Live Data Island', groups: liveIslandInspector.groups },
  'catalog-hero': { label: 'Catalog Hero', groups: catalogHeroInspector.groups },
  'catalog-stat': { label: 'Catalog Stat', groups: catalogStatInspector.groups },
  'catalog-cta': { label: 'Catalog Button', groups: catalogCtaInspector.groups },
  'card-grid-item': { label: 'Card Grid Item', groups: cardGridItemInspector.groups },
  'product-card': { label: 'Product Card', groups: productCardInspector.groups },
  'spotlight-card': { label: 'Spotlight Card', groups: spotlightCardInspector.groups },
  'twin-code-line': { label: 'Code Line', groups: twinCodeLineInspector.groups },
  'twin-readout': { label: 'Readout Cell', groups: twinReadoutInspector.groups },
};
