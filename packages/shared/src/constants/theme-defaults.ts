import type { ThemeTokens, ColorSet } from '../types/theme';

/** Machinist Pro palette — light blue marketing theme (mockup). */
export const DEFAULT_LIGHT_COLORS: ColorSet = {
  background: '#f8f9fa',
  foreground: '#111827',
  card: '#ffffff',
  cardForeground: '#111827',
  muted: '#f3f4f5',
  mutedForeground: '#6B7280',
  border: '#e1e3e4',
  primary: '#004ac6',
  secondary: '#006d30',
  accent: '#2563eb',
  ring: '#004ac6',
};

export const DEFAULT_DARK_COLORS: ColorSet = {
  background: '#0b1120',
  foreground: '#e5e7eb',
  card: '#111827',
  cardForeground: '#e5e7eb',
  muted: '#1f2937',
  mutedForeground: '#9ca3af',
  border: '#273244',
  primary: '#b4c5ff',
  secondary: '#79db8d',
  accent: '#93c5fd',
  ring: '#b4c5ff',
};

export const DEFAULT_THEME_TOKENS: ThemeTokens = {
  light: DEFAULT_LIGHT_COLORS,
  dark: DEFAULT_DARK_COLORS,
  radius: 8,
  glass: { blur: 16, opacity: 70 },
  fonts: { sans: 'outfit', display: 'garamond' },
};

export const DEFAULT_THEME_NAME = 'Default Theme';
