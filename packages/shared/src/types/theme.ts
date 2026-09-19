export const FONT_KEYS = ['outfit', 'inter', 'garamond', 'jetbrains-mono'] as const;
export type FontKey = (typeof FONT_KEYS)[number];

export const FONT_LABELS: Record<FontKey, string> = {
  outfit: 'Outfit',
  inter: 'Inter',
  garamond: 'EB Garamond',
  'jetbrains-mono': 'JetBrains Mono',
};

/** Material Symbols Outlined icon names (matches the landing page mockup). */
export const ICON_KEYS = [
  'search',
  'expand_more',
  'groups',
  'verified',
  'public',
  'monetization_on',
  'trending_up',
  'precision_manufacturing',
  'settings_suggest',
  'robot_2',
  'biotech',
  'history_edu',
  'terminal',
  'add',
  'arrow_forward',
  'factory',
  'cog',
  'cpu',
  'rocket',
  'graduation-cap',
  'moon',
  'school',
  'book',
  'wrench',
  'check',
  'star',
  'bolt',
  'menu',
] as const;
export type IconKey = (typeof ICON_KEYS)[number];

/** Aliases for deprecated or mistyped icon keys stored in old layouts. */
export const ICON_ALIASES: Record<string, IconKey> = {
  'graduation-cap': 'school',
};

/** Resolves a stored `icon` string to a valid Material Symbols ligature. */
export function resolveIconName(icon: string | undefined | null): string {
  if (!icon) return 'help';
  return (ICON_ALIASES[icon] as string | undefined) ?? icon;
}

export const ICON_LABELS: Record<IconKey, string> = {
  search: 'Search',
  expand_more: 'Expand More',
  groups: 'Groups',
  verified: 'Verified',
  public: 'Public / Globe',
  monetization_on: 'Monetization',
  trending_up: 'Trending Up',
  precision_manufacturing: 'Precision Manufacturing',
  settings_suggest: 'Settings Suggest',
  robot_2: 'Robot',
  biotech: 'Biotech',
  history_edu: 'History Edu',
  terminal: 'Terminal',
  add: 'Add / Plus',
  arrow_forward: 'Arrow Forward',
  factory: 'Factory',
  cog: 'Cog / Settings',
  cpu: 'CPU',
  rocket: 'Rocket',
  'graduation-cap': 'Graduation Cap',
  moon: 'Moon',
  school: 'School',
  book: 'Book',
  wrench: 'Wrench',
  check: 'Check',
  star: 'Star',
  bolt: 'Bolt',
  menu: 'Menu',
};

export interface ColorSet {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  primary: string;
  secondary: string;
  accent: string;
  ring: string;
}

export interface GlassTokens {
  blur: number;
  opacity: number;
}

export interface ThemeFonts {
  sans: FontKey;
  display: FontKey;
}

export interface ThemeTokens {
  light: ColorSet;
  dark: ColorSet;
  radius: number;
  glass: GlassTokens;
  fonts: ThemeFonts;
}

export type ThemeStatus = 'draft' | 'published';

export interface ThemeRecord {
  id: string;
  tenantId: string;
  name: string;
  tokens: ThemeTokens;
  status: ThemeStatus;
  version: number;
  isDefault: boolean;
  publishedAt: string | null;
  publishedById: string | null;
  updatedById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ThemeVersionRecord {
  id: string;
  themeId: string;
  tenantId: string;
  version: number;
  tokens: ThemeTokens;
  status: 'snapshot' | 'published';
  changedById: string | null;
  createdAt: string;
}
