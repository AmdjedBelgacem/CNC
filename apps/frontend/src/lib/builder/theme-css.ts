import { DEFAULT_THEME_TOKENS, FONT_KEYS, resolveFontKey } from '@titan/shared';
import type { ColorSet, FontKey, ThemeTokens } from '@titan/shared';

/** Maps a theme FontKey to the CSS variable name provided by next/font on <html>. */
export const FONT_CSS_VARS: Record<FontKey, string> = {
  inter: 'var(--font-inter)',
  'space-grotesk': 'var(--font-space-grotesk)',
  'jetbrains-mono': 'var(--font-mono)',
};

export function isFontKey(value: unknown): value is FontKey {
  return typeof value === 'string' && (FONT_KEYS as readonly string[]).includes(value);
}

/* ------------------------------------------------------------ colour maths */

/** Parse `#rgb` / `#rrggbb` into an [r,g,b] triple. Falls back to mid-grey. */
export function hexToRgb(hex: string): [number, number, number] {
  let h = (hex || '').trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return [128, 128, 128];
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** "R G B" channel string that Tailwind consumes via rgb(var(--c-x) / <alpha>). */
export function hexToChannels(hex: string): string {
  return hexToRgb(hex).join(' ');
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** WCAG relative luminance — drives automatic foreground contrast. */
function luminance([r, g, b]: [number, number, number]): number {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/**
 * Pick a readable foreground for a background colour. Without this, a user who
 * picks a near-white primary in the theme editor gets white-on-white buttons.
 */
export function contrastForeground(hex: string): string {
  return luminance(hexToRgb(hex)) > 0.45 ? '#070c17' : '#ffffff';
}

/** Lighten (amount > 0) or darken (amount < 0) by mixing toward white/black. */
export function shiftColor(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const t = amount < 0 ? 0 : 255;
  const p = Math.abs(amount);
  return rgbToHex(r + (t - r) * p, g + (t - g) * p, b + (t - b) * p);
}

/* -------------------------------------------------------------- token maps */

/**
 * Expand a `ColorSet` into every channel token Tailwind + globals.css consume.
 * Tokens the set does not describe (popover, surface levels, status colours) are
 * derived so a partially-specified theme still renders a complete, coherent UI.
 */
export function colorSetToTokens(set: ColorSet, mode: 'light' | 'dark'): Record<string, string> {
  const ch = (hex: string) => hexToChannels(hex);
  const darker = mode === 'dark';

  const borderStrong = shiftColor(set.border, darker ? 0.14 : -0.14);
  const surfaceSunken = darker ? shiftColor(set.background, -0.35) : shiftColor(set.muted, -0.06);

  return {
    // Brand
    '--c-primary': ch(set.primary),
    '--c-primary-foreground': ch(contrastForeground(set.primary)),
    '--c-secondary': ch(set.secondary),
    '--c-secondary-foreground': ch(contrastForeground(set.secondary)),
    '--c-accent': ch(set.accent),
    '--c-accent-foreground': ch(contrastForeground(set.accent)),
    // Surfaces
    '--c-background': ch(set.background),
    '--c-foreground': ch(set.foreground),
    '--c-card': ch(set.card),
    '--c-card-foreground': ch(set.cardForeground),
    '--c-popover': ch(set.card),
    '--c-popover-foreground': ch(set.cardForeground),
    '--c-muted': ch(set.muted),
    '--c-muted-foreground': ch(set.mutedForeground),
    '--c-surface-raised': ch(set.card),
    '--c-surface-sunken': ch(surfaceSunken),
    // Overlay is always near-black: it backs modal scrims in both modes.
    '--c-overlay': darker ? '4 7 13' : '15 23 42',
    // Lines
    '--c-border': ch(set.border),
    '--c-border-strong': ch(borderStrong),
    '--c-input': ch(set.border),
    '--c-ring': ch(set.primary),
    // Legacy builder text/surface tokens
    '--c-text-primary': ch(set.foreground),
    '--c-text-secondary': ch(shiftColor(set.foreground, darker ? -0.18 : 0.18)),
    '--c-text-muted': ch(set.mutedForeground),
    '--c-surface-container-lowest': ch(set.card),
    '--c-surface-container-low': ch(set.muted),
    '--c-surface-container-high': ch(borderStrong),
    '--c-secondary-container': ch(shiftColor(set.secondary, 0.78)),
    '--c-secondary-fixed': ch(shiftColor(set.secondary, 0.6)),
    // Glass + decorative
    '--glass-bg': ch(set.card),
    '--glass-border-color': darker ? 'rgba(232,236,245,0.10)' : 'rgba(15,23,42,0.08)',
    '--glow-color': ch(set.background),
    // Hex twins for plain-CSS consumers and native widgets
    '--color-primary': set.primary,
    '--color-secondary': set.secondary,
    '--color-accent': set.accent,
    '--color-background': set.background,
    '--color-foreground': set.foreground,
    '--color-card': set.card,
    '--color-border': set.border,
    '--color-ring': set.primary,
    '--primary': set.primary,
    '--secondary': set.secondary,
    '--accent': set.accent,
    '--background': set.background,
    '--foreground': set.foreground,
    '--card': set.card,
    '--border': set.border,
    '--muted': set.muted,
    '--muted-foreground': set.mutedForeground,
    '--ring': set.primary,
  };
}

/** Plain-alias colour variables (kept for legacy plain-CSS rules). */
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

function fontVars(tokens: ThemeTokens): Record<string, string> {
  const sans = FONT_CSS_VARS[resolveFontKey(tokens.fonts.sans)];
  const display = FONT_CSS_VARS[resolveFontKey(tokens.fonts.display)];
  return {
    '--font-family-sans': `${sans}, ui-sans-serif, system-ui, sans-serif`,
    '--font-family-display': `${display}, var(--font-inter), ui-sans-serif, system-ui, sans-serif`,
  };
}

function shapeVars(tokens: ThemeTokens): Record<string, string> {
  return {
    '--radius': `${tokens.radius}px`,
    // Kept because existing previews and styles reference the older name.
    '--border-radius': `${tokens.radius}px`,
    '--glass-blur': `${tokens.glass.blur}px`,
    '--glass-alpha': String(tokens.glass.opacity / 100),
    '--glass-opacity': String(tokens.glass.opacity),
  };
}

function block(vars: Record<string, string>): string {
  return Object.entries(vars)
    .map(([k, v]) => `${k}:${v};`)
    .join('');
}

/**
 * Full stylesheet for a token set: light tokens on `:root`/`html.light`, dark on
 * `html.dark`, matching the selector structure globals.css already uses.
 */
export function themeTokensToCss(tokens: ThemeTokens): string {
  const shared = { ...shapeVars(tokens), ...fontVars(tokens) };
  return (
    `:root,html.light{${block({ ...colorSetToTokens(tokens.light, 'light'), ...shared })}}` +
    `html.dark{${block({ ...colorSetToTokens(tokens.dark, 'dark'), ...shared })}}`
  );
}

/**
 * Flat `{ '--var': value }` map for a single mode — used by the theme editor's
 * live preview (applied to a wrapper element) and by the client-side applier.
 */
export function themeTokensToInlineVars(
  tokens: ThemeTokens,
  mode: 'light' | 'dark',
): Record<string, string> {
  return {
    ...colorSetToTokens(tokens[mode], mode),
    ...shapeVars(tokens),
    ...fontVars(tokens),
  };
}

export function defaultThemeTokens(): ThemeTokens {
  return DEFAULT_THEME_TOKENS;
}

/** Deep-merge a partial override onto a base token set. */
export function mergeThemeTokens(
  base: ThemeTokens,
  override: Partial<ThemeTokens> | null | undefined,
): ThemeTokens {
  if (!override) return base;
  return {
    light: { ...base.light, ...(override.light ?? {}) },
    dark: { ...base.dark, ...(override.dark ?? {}) },
    radius: override.radius ?? base.radius,
    glass: { ...base.glass, ...(override.glass ?? {}) },
    fonts: { ...base.fonts, ...(override.fonts ?? {}) },
  };
}
