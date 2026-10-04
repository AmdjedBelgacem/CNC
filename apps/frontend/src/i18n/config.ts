/**
 * Locale configuration shared by the middleware, the request config, and any
 * client component that needs to switch language or know text direction.
 */
export const LOCALES = ['en', 'ar'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'NEXT_LOCALE';

/** Locales written right-to-left. Drives `dir` on <html> and logical CSS. */
const RTL_LOCALES: readonly Locale[] = ['ar'];

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  ar: 'العربية',
};

export const LOCALE_NATIVE_LABELS: Record<Locale, string> = {
  en: 'English',
  ar: 'العربية',
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

export function dirFor(locale: Locale): 'ltr' | 'rtl' {
  return RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr';
}

/** Coerce anything (cookie, header, URL param) to a supported locale. */
export function coerceLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** Best-effort locale from an Accept-Language header. */
export function localeFromAcceptLanguage(header: string | null): Locale | null {
  if (!header) return null;
  const primary = header.split(',')[0]?.split(';')[0]?.trim().toLowerCase() ?? '';
  if (!primary) return null;
  if (primary.startsWith('ar')) return 'ar';
  if (primary.startsWith('en')) return 'en';
  return null;
}
