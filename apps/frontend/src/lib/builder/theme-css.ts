import { DEFAULT_THEME_TOKENS, FONT_KEYS } from '@titan/shared';
import type {
  ColorSet,
  FontKey,
  ThemeTokens,
} from '@titan/shared'; /** Maps a theme FontKey to the CSS variable name provided by next/font on <html>. */
export const FONT_CSS_VARS: Record<FontKey, string> = {
  outfit: 'var(--font-outfit)',
  inter: 'var(--font-inter)',
  garamond: 'var(--font-garamond)',
  'jetbrains-mono': 'var(--font-mono)',
};
export function isFontKey(value: unknown): value is FontKey {
  return typeof value === 'string' && (FONT_KEYS as readonly string[]).includes(value);
} /** Serializes one color set to a record of CSS custom properties. */
export function colorSetToCssVars(set: ColorSet): Record<string, string> {
  return {
    '--background': set.background,
    '--foreground': set.foreground,
    '--card': set.card,
    '--card-foreground': set.cardForeground,
    '--muted': set.muted,
    '--muted-foreground': set.mutedForeground,
    '--border': set.border,
    '--primary': set.primary,
    '--secondary': set.secondary,
    '--accent': set.accent,
    '--ring': set.ring,
  };
}
function tokensToVarBlock(tokens: ThemeTokens, mode: 'light' | 'dark'): string {
  const vars: Record<string, string> = {
    ...colorSetToCssVars(tokens[mode]),
    '--border-radius': `${tokens.radius}px`,
    '--glass-blur': `${tokens.glass.blur}px`,
    '--glass-opacity': String(tokens.glass.opacity),
    '--font-family-sans': `${FONT_CSS_VARS[tokens.fonts.sans] ?? 'var(--font-outfit)'}, ui-sans-serif, system-ui, sans-serif`,
    '--font-family-display': `${FONT_CSS_VARS[tokens.fonts.display] ?? 'var(--font-garamond)'}, Georgia, 'Times New Roman', serif`,
  };
  return Object.entries(vars)
    .map(([key, value]) => `${key}:${value};`)
    .join('');
} /** * Produces a CSS string that applies a full theme token set via CSS custom * properties. Light tokens land on `:root`/`.light`, dark tokens on `.dark`, * matching the selector structure already used by globals.css. */
export function themeTokensToCss(tokens: ThemeTokens): string {
  return `:root,html.light{${tokensToVarBlock(tokens, 'light')}}html.dark{${tokensToVarBlock(tokens, 'dark')}}`;
} /** * Produces a flat `{ '--var': value }` map for a single mode — used by the * theme editor's live preview panel (applied on a wrapper element). */
export function themeTokensToInlineVars(
  tokens: ThemeTokens,
  mode: 'light' | 'dark',
): Record<string, string> {
  return {
    ...colorSetToCssVars(tokens[mode]),
    '--border-radius': `${tokens.radius}px`,
    '--glass-blur': `${tokens.glass.blur}px`,
    '--glass-opacity': String(tokens.glass.opacity),
    '--font-family-sans': `${FONT_CSS_VARS[tokens.fonts.sans] ?? 'var(--font-outfit)'}, ui-sans-serif, system-ui, sans-serif`,
    '--font-family-display': `${FONT_CSS_VARS[tokens.fonts.display] ?? 'var(--font-garamond)'}, Georgia, 'Times New Roman', serif`,
  };
}
export function defaultThemeTokens(): ThemeTokens {
  return DEFAULT_THEME_TOKENS;
}
