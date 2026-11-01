import type { ThemeTokens, ColorSet } from '../types/theme';

/**
 * "Ivory & Clay" palette — the house look. Warm ivory paper surfaces, a clay
 * (terracotta) primary, deep slate secondary and a sage accent in light mode;
 * warm charcoal surfaces in dark mode. Headlines are set in a book serif, UI in
 * a neutral sans. Kept in sync with `--color-*` / `--c-*` in the frontend's
 * globals.css; these are the fallback tokens used when a tenant has not
 * published a theme, and the seed the theme editor starts from.
 *
 * Contrast notes (WCAG 2.1):
 *  - light primary #B65433 carries white text at 4.9:1 (AA body text).
 *  - dark primary #C15F3C carries white text at 4.2:1; buttons use semibold
 *    14px+ labels, and the brighter #D97757 ring stays visible on charcoal.
 *  - muted foregrounds sit at ≥5.1:1 on their own background in both modes.
 */
export const DEFAULT_LIGHT_COLORS: ColorSet = {
  background: '#FAF9F5',
  foreground: '#141413',
  card: '#FFFFFF',
  cardForeground: '#141413',
  muted: '#F0EEE6',
  mutedForeground: '#5E5D59',
  border: '#E6E3DA',
  primary: '#B65433',
  secondary: '#3D3D3A',
  accent: '#4D6E58',
  ring: '#C96442',
};

export const DEFAULT_DARK_COLORS: ColorSet = {
  background: '#1F1E1D',
  foreground: '#F5F4EE',
  card: '#2A2927',
  cardForeground: '#F5F4EE',
  muted: '#30302E',
  mutedForeground: '#A6A39A',
  border: '#3A3936',
  primary: '#C15F3C',
  secondary: '#C9C6BC',
  accent: '#8DB59A',
  ring: '#D97757',
};

export const DEFAULT_THEME_TOKENS: ThemeTokens = {
  light: DEFAULT_LIGHT_COLORS,
  dark: DEFAULT_DARK_COLORS,
  radius: 12,
  glass: { blur: 16, opacity: 80 },
  fonts: { sans: 'inter', display: 'source-serif' },
};

export const DEFAULT_THEME_NAME = 'Ivory & Clay';
