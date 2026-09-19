import { z } from 'zod';
import { FONT_KEYS } from '../types/theme';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const hexColor = z.string().regex(HEX_COLOR, 'Must be a 6-digit hex color (e.g. #7c3aed)');

export const colorSetSchema = z.object({
  background: hexColor,
  foreground: hexColor,
  card: hexColor,
  cardForeground: hexColor,
  muted: hexColor,
  mutedForeground: hexColor,
  border: hexColor,
  primary: hexColor,
  secondary: hexColor,
  accent: hexColor,
  ring: hexColor,
});

export const themeTokensSchema = z.object({
  light: colorSetSchema,
  dark: colorSetSchema,
  radius: z.number().int().min(0).max(32),
  glass: z.object({
    blur: z.number().int().min(0).max(30),
    opacity: z.number().int().min(0).max(100),
  }),
  fonts: z.object({
    sans: z.enum(FONT_KEYS),
    display: z.enum(FONT_KEYS),
  }),
});

export type ThemeTokensInput = z.infer<typeof themeTokensSchema>;
