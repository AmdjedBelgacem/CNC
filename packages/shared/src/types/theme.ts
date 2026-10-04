export const FONT_KEYS = ['inter', 'space-grotesk', 'jetbrains-mono'] as const;
export type FontKey = (typeof FONT_KEYS)[number];

export const FONT_LABELS: Record<FontKey, string> = {
  inter: 'Inter',
  'space-grotesk': 'Space Grotesk',
  'jetbrains-mono': 'JetBrains Mono',
};

/**
 * Fonts retired by the Forge redesign. Old tenant themes may still store these
 * keys; resolve them onto the new families instead of crashing validation.
 */
export const FONT_ALIASES: Record<string, FontKey> = {
  outfit: 'space-grotesk',
  garamond: 'space-grotesk',
};

/** Resolve a stored font key (possibly retired) to a current FontKey. */
export function resolveFontKey(key: string | undefined | null): FontKey {
  if (!key) return 'inter';
  if ((FONT_KEYS as readonly string[]).includes(key)) return key as FontKey;
  return FONT_ALIASES[key] ?? 'inter';
}

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
  // Landing mockup glyphs (Machinist Pro homepage sections)
  'view_in_ar',
  'tune',
  'speed',
  'radar',
  'architecture',
  'memory',
  'sensors',
  'cloud_sync',
  'verified_user',
  'chevron_right',
  'north_east',
  'language',
  // Redesigned marketing sections (store / wire / events)
  'local_shipping',
  'inventory_2',
  'forum',
  'emoji_events',
  'event',
  'event_available',
  'confirmation_number',
  'monitor',
  'location_on',
  'clock',
  'auto_awesome',
  'radio',
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
  view_in_ar: 'View in AR / 3D',
  tune: 'Tune / Sliders',
  speed: 'Speed / Gauge',
  radar: 'Radar',
  architecture: 'Architecture / Ruler',
  memory: 'Memory / Chip',
  sensors: 'Sensors',
  cloud_sync: 'Cloud Sync',
  verified_user: 'Verified User / Shield',
  chevron_right: 'Chevron Right',
  north_east: 'North East Arrow',
  language: 'Language / Globe',
  local_shipping: 'Local Shipping / Truck',
  inventory_2: 'Inventory / Package',
  forum: 'Forum / Chat',
  emoji_events: 'Trophy',
  event: 'Calendar Event',
  event_available: 'Calendar Check',
  confirmation_number: 'Ticket',
  monitor: 'Monitor / Webinar',
  location_on: 'Location Pin',
  clock: 'Clock',
  auto_awesome: 'Sparkles',
  radio: 'Radio / Live',
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
