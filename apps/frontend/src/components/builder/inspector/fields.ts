import type {
  AcademyCardProps,
  AcademyGridProps,
  AvatarStackProps,
  BadgeProps,
  ButtonProps,
  CardProps,
  CtaBannerProps,
  FaqItemProps,
  FaqProps,
  FeatureItemProps,
  FeatureTilesProps,
  FooterColProps,
  FooterProps,
  GridProps,
  HeadingProps,
  HeroProps,
  IconProps,
  ImageProps,
  LinkProps,
  NavLinkProps,
  NavProps,
  PartnerLogosProps,
  ProgressCardProps,
  SectionProps,
  StackProps,
  StatItemProps,
  StatsProps,
  TextProps,
} from '@titan/shared';
import {
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
  icon: Box,
  fields: [...PADDING_FIELDS, ...LAYOUT_FIELDS] as unknown as InspectorFieldDef<T>[],
});
const advancedGroup = <T>(): InspectorGroup<T> => ({
  id: 'advanced',
  title: 'Advanced',
  icon: Braces,
  fields: [
    {
      key: 'className',
      label: 'Extra classes',
      control: 'text',
      placeholder: 'e.g. leading-tight line-clamp-2',
      hint: 'Raw Tailwind utility classes appended to the element.',
    } as unknown as InspectorFieldDef<T>,
  ],
});
const alignOptions = [
  { label: 'Left', value: 'left' },
  { label: 'Center', value: 'center' },
  { label: 'Right', value: 'right' },
];
const textColorOptions = [
  { label: 'Default (ink)', value: '' },
  { label: 'Primary', value: 'text-primary' },
  { label: 'Ink', value: 'text-text-primary' },
  { label: 'Muted', value: 'text-text-muted' },
  { label: 'Secondary', value: 'text-secondary' },
  { label: 'Accent', value: 'text-accent' },
  { label: 'White', value: 'text-white' },
];
const gapOptions = [
  { label: 'None', value: 'none' },
  { label: '8px', value: 'sm' },
  { label: '16px', value: 'md' },
  { label: '20px', value: 'md-2' },
  { label: '24px', value: 'md-lg' },
  { label: '32px', value: 'lg' },
  { label: '48px', value: 'xl' },
]; // ------------------------------------------------------------------ Content primitives
export const headingInspector = defineInspector<HeadingProps>().groups([
  {
    id: 'content',
    title: 'Content',
    icon: Type,
    fields: [
      {
        key: 'as',
        label: 'Tag',
        control: 'segmented',
        options: [
          { label: 'H1', value: 'h1' },
          { label: 'H2', value: 'h2' },
          { label: 'H3', value: 'h3' },
          { label: 'H4', value: 'h4' },
        ],
      },
      { key: 'text', label: 'Text', control: 'textarea', hint: 'A newline creates a line break.' },
    ],
  },
  {
    id: 'typography',
    title: 'Typography',
    icon: Type,
    fields: [
      {
        key: 'size',
        label: 'Size',
        control: 'select',
        options: [
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
        ],
      },
      { key: 'align', label: 'Alignment', control: 'segmented', options: alignOptions },
      { key: 'color', label: 'Color', control: 'select', options: textColorOptions },
      {
        key: 'tracking',
        label: 'Letter spacing',
        control: 'select',
        options: [
          { label: 'None', value: 'none' },
          { label: 'Wide (0.025em)', value: '0.025em' },
          { label: 'Wider (0.05em)', value: '0.05em' },
          { label: '0.1em', value: '0.1em' },
          { label: '0.15em', value: '0.15em' },
          { label: '0.2em', value: '0.2em' },
        ],
      },
      {
        key: 'leading',
        label: 'Line height',
        control: 'select',
        options: [
          { label: 'Default', value: 'none' },
          { label: 'Tight', value: 'tight' },
          { label: 'Snug', value: 'snug' },
          { label: 'Normal', value: 'normal' },
          { label: 'Relaxed', value: 'relaxed' },
          { label: 'Loose', value: 'loose' },
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
    icon: Type,
    fields: [{ key: 'text', label: 'Text', control: 'textarea' }],
  },
  {
    id: 'typography',
    title: 'Typography',
    icon: Type,
    fields: [
      {
        key: 'size',
        label: 'Size',
        control: 'select',
        options: [
          { label: '10px label', value: '2xs' },
          { label: '11px label', value: 'xs' },
          { label: '12px label', value: 'sm' },
          { label: 'Medium (16px)', value: 'md' },
          { label: 'Large (18px)', value: 'lg' },
        ],
      },
      { key: 'align', label: 'Alignment', control: 'segmented', options: alignOptions },
      { key: 'color', label: 'Color', control: 'select', options: textColorOptions },
      { key: 'uppercase', label: 'Uppercase', control: 'toggle' },
      {
        key: 'tracking',
        label: 'Letter spacing',
        control: 'select',
        options: [
          { label: 'None', value: 'none' },
          { label: 'Wide (0.025em)', value: '0.025em' },
          { label: 'Wider (0.05em)', value: '0.05em' },
          { label: '0.1em', value: '0.1em' },
          { label: '0.15em', value: '0.15em' },
          { label: '0.2em', value: '0.2em' },
        ],
      },
      {
        key: 'weight',
        label: 'Weight',
        control: 'segmented',
        options: [
          { label: 'N', value: 'normal' },
          { label: 'M', value: 'medium' },
          { label: 'SB', value: 'semibold' },
          { label: 'B', value: 'bold' },
        ],
      },
      {
        key: 'opacity',
        label: 'Opacity',
        control: 'slider',
        min: 0,
        max: 100,
        step: 5,
        hint: 'Percent',
      },
      {
        key: 'leading',
        label: 'Line height',
        control: 'select',
        options: [
          { label: 'Default', value: 'none' },
          { label: 'Tight', value: 'tight' },
          { label: 'Snug', value: 'snug' },
          { label: 'Normal', value: 'normal' },
          { label: 'Relaxed', value: 'relaxed' },
          { label: 'Loose', value: 'loose' },
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
    icon: Type,
    fields: [
      { key: 'label', label: 'Label', control: 'text' },
      { key: 'icon', label: 'Icon', control: 'icon' },
      {
        key: 'iconPosition',
        label: 'Icon position',
        control: 'segmented',
        options: [
          { label: 'Left', value: 'left' },
          { label: 'Right', value: 'right' },
        ],
        showWhen: (p) => Boolean(p.icon),
      },
    ],
  },
  {
    id: 'style',
    title: 'Style',
    icon: Palette,
    fields: [
      {
        key: 'variant',
        label: 'Variant',
        control: 'select',
        options: [
          { label: 'Primary (solid blue)', value: 'primary' },
          { label: 'Glass', value: 'glass' },
          { label: 'White', value: 'white' },
          { label: 'White outline', value: 'white-outline' },
          { label: 'Pill (View All)', value: 'pill' },
          { label: 'Navbar CTA', value: 'nav-cta' },
          { label: 'Link', value: 'link' },
          { label: 'Enroll', value: 'enroll' },
        ],
      },
      {
        key: 'size',
        label: 'Size',
        control: 'segmented',
        options: [
          { label: 'S', value: 'sm' },
          { label: 'M', value: 'md' },
          { label: 'L', value: 'lg' },
        ],
      },
      {
        key: 'width',
        label: 'Width',
        control: 'segmented',
        options: [
          { label: 'Auto', value: 'auto' },
          { label: 'Full', value: 'full' },
        ],
      },
    ],
  },
  {
    id: 'behavior',
    title: 'Behavior',
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
    icon: Type,
    fields: [
      {
        key: 'label',
        label: 'Label',
        control: 'text',
        placeholder: 'Leave empty for an icon circle',
      },
      { key: 'icon', label: 'Icon', control: 'icon' },
    ],
  },
  {
    id: 'behavior',
    title: 'Behavior',
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
    icon: Type,
    fields: [
      { key: 'label', label: 'Label', control: 'text' },
      { key: 'active', label: 'Active (primary colour)', control: 'toggle' },
    ],
  },
  {
    id: 'behavior',
    title: 'Behavior',
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
    icon: ImageIcon,
    fields: [
      { key: 'src', label: 'Image URL', control: 'text', placeholder: 'https://…' },
      { key: 'alt', label: 'Alt text', control: 'text' },
    ],
  },
  {
    id: 'style',
    title: 'Style',
    icon: Palette,
    fields: [
      {
        key: 'objectFit',
        label: 'Fit',
        control: 'segmented',
        options: [
          { label: 'Cover', value: 'cover' },
          { label: 'Contain', value: 'contain' },
          { label: 'Fill', value: 'fill' },
        ],
      },
      {
        key: 'radius',
        label: 'Corners',
        control: 'segmented',
        options: [
          { label: 'None', value: 'none' },
          { label: 'S', value: 'sm' },
          { label: 'M', value: 'md' },
          { label: 'L', value: 'lg' },
          { label: 'Full', value: 'full' },
        ],
      },
      {
        key: 'aspectRatio',
        label: 'Aspect ratio',
        control: 'segmented',
        options: [
          { label: 'Auto', value: 'none' },
          { label: '4:3', value: '4/3' },
          { label: '16:10', value: '16/10' },
        ],
      },
    ],
  },
  {
    id: 'dimensions',
    title: 'Dimensions',
    icon: Frame,
    fields: [
      {
        key: 'width',
        label: 'Width',
        control: 'slider',
        min: 0,
        max: 2560,
        step: 16,
        hint: 'Pixels',
      },
      {
        key: 'height',
        label: 'Height',
        control: 'slider',
        min: 0,
        max: 2560,
        step: 16,
        hint: 'Pixels',
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
    icon: Sparkles,
    fields: [{ key: 'icon', label: 'Icon', control: 'icon' }],
  },
  {
    id: 'style',
    title: 'Style',
    icon: Palette,
    fields: [
      { key: 'size', label: 'Size', control: 'slider', min: 8, max: 96, step: 2, hint: 'Pixels' },
      { key: 'color', label: 'Color', control: 'select', options: textColorOptions },
      {
        key: 'box',
        label: 'Tile',
        control: 'segmented',
        options: [
          { label: 'None', value: 'none' },
          { label: 'Tinted', value: 'tinted' },
          { label: 'White', value: 'white' },
        ],
      },
    ],
  },
  {
    id: 'behavior',
    title: 'Behavior',
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
    icon: Type,
    fields: [
      { key: 'text', label: 'Text', control: 'text' },
      { key: 'icon', label: 'Icon', control: 'icon' },
      {
        key: 'iconSize',
        label: 'Icon size',
        control: 'slider',
        min: 4,
        max: 64,
        step: 2,
        hint: 'Pixels',
        showWhen: (p) => Boolean(p.icon),
      },
    ],
  },
  {
    id: 'style',
    title: 'Style',
    icon: Palette,
    fields: [
      {
        key: 'variant',
        label: 'Variant',
        control: 'select',
        options: [
          { label: 'Glow (hero eyebrow)', value: 'glow' },
          { label: 'Primary', value: 'primary' },
          { label: 'Secondary (with icon)', value: 'secondary' },
          { label: 'Neutral', value: 'neutral' },
          { label: 'Card level pill', value: 'card' },
        ],
      },
      {
        key: 'size',
        label: 'Size',
        control: 'segmented',
        options: [
          { label: 'S (10px)', value: 'sm' },
          { label: 'M (12px)', value: 'md' },
        ],
      },
      { key: 'uppercase', label: 'Uppercase', control: 'toggle' },
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
    icon: Layers,
    fields: [
      { key: 'count', label: 'Count label', control: 'text', placeholder: '+80' },
      {
        key: 'size',
        label: 'Circle size',
        control: 'slider',
        min: 16,
        max: 128,
        step: 4,
        hint: 'Pixels',
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
    icon: Palette,
    fields: [
      { key: 'ticks', label: 'Tick marks', control: 'toggle' },
      {
        key: 'barHeight',
        label: 'Bar height',
        control: 'segmented',
        options: [
          { label: 'S', value: 'h-2' },
          { label: 'M', value: 'h-3' },
          { label: 'L', value: 'h-4' },
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
    icon: Rows3,
    fields: [
      {
        key: 'direction',
        label: 'Direction',
        control: 'segmented',
        options: [
          { label: 'Column', value: 'column' },
          { label: 'Row', value: 'row' },
        ],
      },
      {
        key: 'directionMobile',
        label: 'Mobile direction',
        control: 'segmented',
        options: [
          { label: 'Same', value: 'none' },
          { label: 'Column', value: 'column' },
          { label: 'Row', value: 'row' },
        ],
        hint: 'Overrides the direction below 768px; desktop keeps the main direction.',
      },
      { key: 'gap', label: 'Gap', control: 'select', options: gapOptions },
      {
        key: 'align',
        label: 'Align',
        control: 'segmented',
        options: [
          { label: 'Start', value: 'start' },
          { label: 'Center', value: 'center' },
          { label: 'End', value: 'end' },
          { label: 'Stretch', value: 'stretch' },
        ],
      },
      {
        key: 'justify',
        label: 'Justify',
        control: 'segmented',
        options: [
          { label: 'Start', value: 'start' },
          { label: 'Center', value: 'center' },
          { label: 'End', value: 'end' },
          { label: 'Between', value: 'between' },
        ],
      },
      { key: 'wrap', label: 'Wrap', control: 'toggle' },
    ],
  },
  {
    id: 'style',
    title: 'Style',
    icon: Palette,
    fields: [
      {
        key: 'bg',
        label: 'Background',
        control: 'segmented',
        options: [
          { label: 'None', value: 'transparent' },
          { label: 'Glass', value: 'glass' },
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
    icon: Columns3,
    fields: [
      { key: 'columns', label: 'Columns', control: 'slider', min: 1, max: 6, step: 1 },
      {
        key: 'gap',
        label: 'Gap',
        control: 'select',
        options: [
          { label: 'Small', value: 'sm' },
          { label: '24px', value: 'md' },
          { label: '28px', value: 'md-lg' },
          { label: '32px', value: 'lg' },
          { label: '48px', value: 'xl' },
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
    control: 'segmented',
    options: [
      { label: 'None', value: 'transparent' },
      { label: 'Muted', value: 'muted' },
      { label: 'Glass', value: 'glass' },
      { label: 'Gradient', value: 'gradient' },
      { label: 'Soft', value: 'gradient-muted' },
    ],
  },
  {
    key: 'radius',
    label: 'Corners',
    control: 'select',
    options: [
      { label: 'None', value: 'none' },
      { label: 'Small', value: 'sm' },
      { label: 'Medium', value: 'md' },
      { label: 'Large', value: 'lg' },
      { label: 'XL', value: 'xl' },
      { label: '2XL', value: '2xl' },
      { label: 'Full', value: 'full' },
    ],
  },
  { key: 'border', label: 'Border', control: 'toggle' },
  { key: 'accent', label: 'Accent bar', control: 'toggle' },
  {
    key: 'accentColor',
    label: 'Accent bar color',
    control: 'segmented',
    options: [
      { label: 'Primary', value: 'bg-primary' },
      { label: 'Secondary', value: 'bg-secondary' },
      { label: 'Accent', value: 'bg-accent' },
    ],
    showWhen: (p: CardProps) => Boolean(p.accent),
  },
];
export const cardInspector = defineInspector<CardProps>().groups([
  { id: 'style', title: 'Style', icon: Palette, fields: cardStyleFields },
  {
    id: 'layout',
    title: 'Layout',
    icon: LayoutTemplate,
    fields: [
      {
        key: 'padding',
        label: 'Padding',
        control: 'segmented',
        options: [
          { label: 'None', value: 'none' },
          { label: 'S', value: 'sm' },
          { label: 'M', value: 'md' },
          { label: 'L', value: 'lg' },
        ],
      },
      { key: 'align', label: 'Alignment', control: 'segmented', options: alignOptions },
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
    icon: LayoutTemplate,
    fields: [
      {
        key: 'padding',
        label: 'Padding',
        control: 'segmented',
        options: [
          { label: 'None', value: 'none' },
          { label: 'S', value: 'sm' },
          { label: 'M', value: 'md' },
          { label: 'L', value: 'lg' },
        ],
      },
      { key: 'align', label: 'Alignment', control: 'segmented', options: alignOptions },
      { key: 'hover', label: 'Hover lift', control: 'toggle' },
    ],
  },
  spacingGroup<StatItemProps>(),
  advancedGroup<StatItemProps>(),
]);
export const logoItemInspector = defineInspector<Record<string, never>>().groups([
  advancedGroup<Record<string, never>>(),
]);
export const featureItemInspector = defineInspector<FeatureItemProps>().groups([
  {
    id: 'layout',
    title: 'Layout',
    icon: AlignLeft,
    fields: [
      {
        key: 'gap',
        label: 'Icon gap',
        control: 'select',
        options: [
          { label: '16px', value: 'gap-4' },
          { label: '20px', value: 'gap-5' },
          { label: '24px', value: 'gap-6' },
          { label: '32px', value: 'gap-8' },
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
    icon: Link2,
    fields: [{ key: 'href', label: 'Link URL', control: 'text', placeholder: '/courses/…' }],
  },
  {
    id: 'style',
    title: 'Style',
    icon: Palette,
    fields: [
      {
        key: 'radius',
        label: 'Corners',
        control: 'segmented',
        options: [
          { label: '2XL', value: 'rounded-2xl' },
          { label: '3XL', value: 'rounded-3xl' },
          { label: '2rem', value: 'rounded-[2rem]' },
        ],
      },
      {
        key: 'contentPadding',
        label: 'Content padding',
        control: 'segmented',
        options: [
          { label: '24', value: 'p-6' },
          { label: '32', value: 'p-8' },
          { label: '40', value: 'p-10' },
        ],
      },
      {
        key: 'mediaAspect',
        label: 'Media aspect',
        control: 'segmented',
        options: [
          { label: '16:10', value: 'aspect-[16/10]' },
          { label: '16:9', value: 'aspect-video' },
          { label: '1:1', value: 'aspect-square' },
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
    icon: Sparkles,
    fields: [{ key: 'icon', label: 'Toggle icon', control: 'icon' }],
  },
  {
    id: 'style',
    title: 'Style',
    icon: Palette,
    fields: [
      {
        key: 'buttonPaddingX',
        label: 'Toggle padding X',
        control: 'segmented',
        options: [
          { label: '24', value: 'px-6' },
          { label: '32', value: 'px-8' },
          { label: '40', value: 'px-10' },
        ],
      },
      {
        key: 'buttonPaddingY',
        label: 'Toggle padding Y',
        control: 'segmented',
        options: [
          { label: '20', value: 'py-5' },
          { label: '24', value: 'py-6' },
          { label: '32', value: 'py-8' },
        ],
      },
      {
        key: 'answerPaddingX',
        label: 'Answer padding X',
        control: 'segmented',
        options: [
          { label: '24', value: 'px-6' },
          { label: '32', value: 'px-8' },
          { label: '40', value: 'px-10' },
        ],
      },
      {
        key: 'answerPaddingBottom',
        label: 'Answer padding bottom',
        control: 'segmented',
        options: [
          { label: '24', value: 'pb-6' },
          { label: '32', value: 'pb-8' },
          { label: '40', value: 'pb-10' },
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
    icon: Rows3,
    fields: [
      {
        key: 'gap',
        label: 'Column gap',
        control: 'select',
        options: [
          { label: '8px', value: 'gap-2' },
          { label: '16px', value: 'gap-4' },
          { label: '24px', value: 'gap-6' },
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
    icon: Palette,
    fields: [
      {
        key: 'bg',
        label: 'Background',
        control: 'segmented',
        options: [
          { label: 'None', value: 'transparent' },
          { label: 'White', value: 'white' },
          { label: 'Muted', value: 'muted' },
          { label: 'Tint', value: 'secondary' },
          { label: 'Primary', value: 'primary' },
          { label: 'Gradient', value: 'gradient-primary' },
          { label: 'Soft', value: 'gradient-muted' },
        ],
      },
    ],
  },
  {
    id: 'layout',
    title: 'Layout',
    icon: Frame,
    fields: [
      {
        key: 'maxWidth',
        label: 'Container width',
        control: 'slider',
        min: 0,
        max: 2560,
        step: 16,
        hint: 'Pixels',
      },
      {
        key: 'minHeight',
        label: 'Min height',
        control: 'slider',
        min: 0,
        max: 3000,
        step: 16,
        hint: 'Pixels',
      },
    ],
  },
  { id: 'spacing', title: 'Spacing', icon: Box, fields: PADDING_FIELDS as never[] },
  {
    id: 'behavior',
    title: 'Visibility',
    icon: Eye,
    fields: [
      {
        key: 'hidden',
        label: 'Hide section',
        control: 'toggle',
        hint: 'Hides the section on the page.',
      },
    ],
  },
  advancedGroup<SectionProps>(),
]);
export const navInspector = defineInspector<NavProps>().groups([
  {
    id: 'layout',
    title: 'Layout',
    icon: LayoutTemplate,
    fields: [
      {
        key: 'topOffset',
        label: 'Top offset',
        control: 'slider',
        min: 0,
        max: 320,
        step: 4,
        hint: 'Pixels',
      },
      {
        key: 'widthPercent',
        label: 'Bar width',
        control: 'slider',
        min: 20,
        max: 100,
        step: 5,
        hint: '% of viewport',
      },
      {
        key: 'containerMaxWidth',
        label: 'Max width',
        control: 'slider',
        min: 320,
        max: 2560,
        step: 16,
        hint: 'Pixels',
      },
    ],
  },
  {
    id: 'style',
    title: 'Style',
    icon: Palette,
    fields: [
      {
        key: 'containerPaddingX',
        label: 'Padding X',
        control: 'select',
        options: [
          { label: 'Small (16/24px)', value: 'px-4 md:px-6' },
          { label: 'Medium (24/32px)', value: 'px-6 md:px-8' },
          { label: 'Large (32/40px)', value: 'px-8 md:px-10' },
        ],
      },
      {
        key: 'containerPaddingY',
        label: 'Padding Y',
        control: 'select',
        options: [
          { label: '8px', value: 'py-2' },
          { label: '10px', value: 'py-2.5' },
          { label: '12px', value: 'py-3' },
          { label: '16px', value: 'py-4' },
        ],
      },
      {
        key: 'containerRadius',
        label: 'Corners',
        control: 'segmented',
        options: [
          { label: 'M', value: 'rounded-lg' },
          { label: 'L', value: 'rounded-xl' },
          { label: 'XL', value: 'rounded-2xl' },
          { label: '2XL', value: 'rounded-3xl' },
        ],
      },
    ],
  },
  advancedGroup<NavProps>(),
]);
export const heroInspector = defineInspector<HeroProps>().groups([
  {
    id: 'style',
    title: 'Style',
    icon: ImageIcon,
    fields: [
      { key: 'imageUrl', label: 'Background image', control: 'text', placeholder: 'https://…' },
      { key: 'backgroundColor', label: 'Background color', control: 'color' },
      {
        key: 'backgroundOverlay',
        label: 'Overlay',
        control: 'slider',
        min: 0,
        max: 100,
        step: 5,
        hint: '%',
      },
      {
        key: 'backgroundOpacity',
        label: 'Image opacity',
        control: 'slider',
        min: 0,
        max: 100,
        step: 5,
        hint: '%',
      },
      { key: 'gradientVeil', label: 'Gradient veil', control: 'toggle' },
      {
        key: 'mesh',
        label: 'Gradient mesh',
        control: 'toggle',
        hint: 'Animated color blobs behind the content',
      },
    ],
  },
  {
    id: 'layout',
    title: 'Layout',
    icon: Frame,
    fields: [
      { key: 'fullHeight', label: 'Full height', control: 'toggle' },
      {
        key: 'nonFullHeight',
        label: 'Min height',
        control: 'slider',
        min: 200,
        max: 3000,
        step: 16,
        hint: 'Pixels',
        showWhen: (p) => !p.fullHeight,
      },
      {
        key: 'contentMaxWidth',
        label: 'Content width',
        control: 'slider',
        min: 320,
        max: 2560,
        step: 16,
        hint: 'Pixels',
      },
      {
        key: 'contentPaddingX',
        label: 'Content padding X',
        control: 'select',
        options: [
          { label: 'Theme mobile margin', value: 'px-margin-mobile' },
          { label: '16px', value: 'px-4' },
          { label: '24px', value: 'px-6' },
          { label: '32px', value: 'px-8' },
        ],
      },
    ],
  },
  {
    id: 'behavior',
    title: 'Behavior',
    icon: MousePointerClick,
    fields: [
      { key: 'scrollIndicator', label: 'Scroll indicator', control: 'toggle' },
      {
        key: 'scrollIndicatorBottom',
        label: 'Indicator bottom',
        control: 'slider',
        min: 0,
        max: 320,
        step: 4,
        hint: 'Pixels',
        showWhen: (p) => Boolean(p.scrollIndicator),
      },
      {
        key: 'parallaxFactor',
        label: 'Parallax',
        control: 'slider',
        min: 0,
        max: 100,
        step: 5,
        hint: '% (0 = off)',
        showWhen: (p) => Boolean(p.scrollIndicator),
      },
      {
        key: 'contentAlign',
        label: 'Content alignment',
        control: 'segmented',
        options: [
          { label: 'Center', value: 'center' },
          { label: 'Left', value: 'left' },
        ],
      },
    ],
  },
  {
    id: 'trust',
    title: 'Trust Chips',
    icon: Sparkles,
    fields: [
      {
        key: 'showTrustChips',
        label: 'Show trust chips',
        control: 'toggle',
        hint: 'Avatars, rating and note under the CTAs',
      },
      {
        key: 'trustNote',
        label: 'Trust note',
        control: 'text',
        placeholder: 'Free manufacturing education for all',
      },
      {
        key: 'trustNoteHref',
        label: 'Trust note link',
        control: 'text',
        placeholder: 'https://… (optional)',
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
    icon: LayoutTemplate,
    fields: [
      {
        key: 'overlap',
        label: 'Overlap',
        control: 'slider',
        min: 0,
        max: 320,
        step: 4,
        hint: 'Pixels',
      },
      {
        key: 'columnsMobile',
        label: 'Columns (mobile)',
        control: 'segmented',
        options: [
          { label: '1', value: 'grid-cols-1' },
          { label: '2', value: 'grid-cols-2' },
        ],
      },
      {
        key: 'columnsSm',
        label: 'Columns (sm+)',
        control: 'segmented',
        options: [
          { label: '2', value: 'sm:grid-cols-2' },
          { label: '3', value: 'sm:grid-cols-3' },
        ],
      },
      {
        key: 'columnsLg',
        label: 'Columns (lg+)',
        control: 'segmented',
        options: [
          { label: '2', value: 'lg:grid-cols-2' },
          { label: '3', value: 'lg:grid-cols-3' },
          { label: '4', value: 'lg:grid-cols-4' },
        ],
      },
      {
        key: 'gap',
        label: 'Gap',
        control: 'segmented',
        options: [
          { label: '16', value: 'gap-4' },
          { label: '24', value: 'gap-6' },
          { label: '32', value: 'gap-8' },
          { label: '48', value: 'gap-12' },
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
    icon: LayoutTemplate,
    fields: [
      {
        key: 'logoGap',
        label: 'Logo gap',
        control: 'select',
        options: [
          { label: 'Small (32/64px)', value: 'gap-8 md:gap-16' },
          { label: 'Medium (48/96px)', value: 'gap-12 md:gap-24' },
          { label: 'Large (64/128px)', value: 'gap-16 md:gap-32' },
        ],
      },
      {
        key: 'headerMarginBottom',
        label: 'Header bottom margin',
        control: 'slider',
        min: 0,
        max: 320,
        step: 4,
        hint: 'Pixels',
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
    icon: ImageIcon,
    fields: [
      { key: 'imageUrl', label: 'Image URL', control: 'text', placeholder: 'https://…' },
      { key: 'imageAlt', label: 'Image alt text', control: 'text' },
    ],
  },
  {
    id: 'style',
    title: 'Style',
    icon: Palette,
    fields: [
      {
        key: 'sectionBg',
        label: 'Section background',
        control: 'segmented',
        options: [
          { label: 'White', value: 'bg-surface-container-lowest' },
          { label: 'Grey', value: 'bg-surface-container-low' },
          { label: 'None', value: 'bg-transparent' },
        ],
      },
      {
        key: 'imageBorder',
        label: 'Image border',
        control: 'slider',
        min: 0,
        max: 64,
        step: 1,
        hint: 'Pixels',
      },
      { key: 'decorativeCircles', label: 'Decorative circles', control: 'toggle' },
    ],
  },
  {
    id: 'layout',
    title: 'Layout',
    icon: LayoutTemplate,
    fields: [
      {
        key: 'gap',
        label: 'Column gap',
        control: 'slider',
        min: 0,
        max: 320,
        step: 4,
        hint: 'Pixels',
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
    icon: Link2,
    fields: [
      { key: 'viewAllHref', label: 'View all link', control: 'text', placeholder: '/courses' },
    ],
  },
  {
    id: 'layout',
    title: 'Layout',
    icon: LayoutTemplate,
    fields: [
      {
        key: 'headerMarginBottom',
        label: 'Header bottom margin',
        control: 'slider',
        min: 0,
        max: 320,
        step: 4,
        hint: 'Pixels',
      },
      {
        key: 'cardsColumns',
        label: 'Card columns (md+)',
        control: 'segmented',
        options: [
          { label: '2', value: 'md:grid-cols-2' },
          { label: '3', value: 'md:grid-cols-3' },
        ],
      },
      {
        key: 'cardsGap',
        label: 'Card gap',
        control: 'segmented',
        options: [
          { label: '24', value: 'gap-6' },
          { label: '32', value: 'gap-8' },
          { label: '40', value: 'gap-10' },
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
    icon: ImageIcon,
    fields: [
      { key: 'imageUrl', label: 'Background image', control: 'text', placeholder: 'https://…' },
    ],
  },
  {
    id: 'style',
    title: 'Style',
    icon: Palette,
    fields: [
      { key: 'overlayColor', label: 'Overlay color', control: 'color' },
      {
        key: 'overlayOpacity',
        label: 'Overlay opacity',
        control: 'slider',
        min: 0,
        max: 100,
        step: 5,
        hint: '%',
      },
      { key: 'radialVeil', label: 'Radial veil', control: 'toggle' },
      {
        key: 'padding',
        label: 'Banner padding',
        control: 'select',
        options: [
          { label: 'Small (32/64px)', value: 'p-8 md:p-16' },
          { label: 'Medium (48/96px)', value: 'p-12 md:p-24' },
          { label: 'Large (64/128px)', value: 'p-16 md:p-32' },
        ],
      },
      {
        key: 'radius',
        label: 'Corners',
        control: 'segmented',
        options: [
          { label: '3XL', value: 'rounded-3xl' },
          { label: '3rem', value: 'rounded-[3rem]' },
          { label: '4rem', value: 'rounded-[4rem]' },
        ],
      },
    ],
  },
  {
    id: 'layout',
    title: 'Layout',
    icon: LayoutTemplate,
    fields: [
      {
        key: 'gap',
        label: 'Column gap',
        control: 'slider',
        min: 0,
        max: 320,
        step: 4,
        hint: 'Pixels',
      },
      {
        key: 'copyWidth',
        label: 'Copy column (lg+)',
        control: 'segmented',
        options: [
          { label: '1/2', value: 'lg:w-1/2' },
          { label: '3/5', value: 'lg:w-3/5' },
          { label: '2/3', value: 'lg:w-2/3' },
        ],
      },
      {
        key: 'sideWidth',
        label: 'Side column (lg+)',
        control: 'segmented',
        options: [
          { label: '1/3', value: 'lg:w-1/3' },
          { label: '2/5', value: 'lg:w-2/5' },
          { label: '1/2', value: 'lg:w-1/2' },
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
    icon: LayoutTemplate,
    fields: [
      {
        key: 'maxWidth',
        label: 'Inner max width',
        control: 'slider',
        min: 320,
        max: 2560,
        step: 16,
        hint: 'Pixels',
      },
      {
        key: 'headerMarginBottom',
        label: 'Header bottom margin',
        control: 'slider',
        min: 0,
        max: 320,
        step: 4,
        hint: 'Pixels',
      },
      {
        key: 'itemsGap',
        label: 'Items gap',
        control: 'select',
        options: [
          { label: '12px', value: 'flex flex-col gap-3' },
          { label: '16px', value: 'flex flex-col gap-4' },
          { label: '24px', value: 'flex flex-col gap-6' },
        ],
      },
      {
        key: 'footerMarginTop',
        label: 'Footer top margin',
        control: 'slider',
        min: 0,
        max: 320,
        step: 4,
        hint: 'Pixels',
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
    icon: LayoutTemplate,
    fields: [
      {
        key: 'columnsSm',
        label: 'Columns (sm+)',
        control: 'segmented',
        options: [
          { label: '2', value: 'sm:grid-cols-2' },
          { label: '3', value: 'sm:grid-cols-3' },
        ],
      },
      {
        key: 'columnsLg',
        label: 'Columns (md+)',
        control: 'segmented',
        options: [
          { label: '3', value: 'md:grid-cols-3' },
          { label: '4', value: 'md:grid-cols-4' },
        ],
      },
      {
        key: 'gridGap',
        label: 'Column gap',
        control: 'select',
        options: [
          { label: '32px', value: 'gap-8' },
          { label: '48px', value: 'gap-12' },
          { label: '64px', value: 'gap-16' },
        ],
      },
      {
        key: 'bottomGap',
        label: 'Bottom bar gap',
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
};
