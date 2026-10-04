import type { ThemeTokens, ColorSet } from '../types/theme';

/**
 * "Precision Forge" palette — safety-orange primary, steel secondary, kiln-teal
 * accent, warm paper light surfaces / machined-ink dark surfaces. Kept in sync
 * with `--color-*` / `--c-*` in the frontend's globals.css; these are the
 * fallback tokens used when a tenant has not published a theme, and the seed
 * the theme editor starts from.
 */
export const DEFAULT_LIGHT_COLORS: ColorSet = {
  background: '#F4F3EF',
  foreground: '#191B1F',
  card: '#FFFFFF',
  cardForeground: '#191B1F',
  muted: '#E9E7E1',
  mutedForeground: '#595E66',
  border: '#DCD9D2',
  primary: '#C2410C',
  secondary: '#333F4C',
  accent: '#0F766E',
  ring: '#C2410C',
};

export const DEFAULT_DARK_COLORS: ColorSet = {
  background: '#0F1113',
  foreground: '#EBECEE',
  card: '#17191D',
  cardForeground: '#EBECEE',
  muted: '#20242A',
  mutedForeground: '#9CA3AD',
  border: '#272B32',
  primary: '#C2410C',
  secondary: '#A8B3C0',
  accent: '#3BC9B7',
  ring: '#E86A1C',
};

export const DEFAULT_THEME_TOKENS: ThemeTokens = {
  light: DEFAULT_LIGHT_COLORS,
  dark: DEFAULT_DARK_COLORS,
  radius: 10,
  glass: { blur: 14, opacity: 78 },
  fonts: { sans: 'inter', display: 'space-grotesk' },
};

export const DEFAULT_THEME_NAME = 'Precision Forge';
