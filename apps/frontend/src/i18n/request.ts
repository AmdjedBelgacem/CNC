import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';

const SUPPORTED = ['en', 'fr', 'es', 'de'] as const;
type Locale = (typeof SUPPORTED)[number];
const COOKIE_NAME = 'NEXT_LOCALE';
const DEFAULT_LOCALE: Locale = 'en';

function pickFromAcceptLanguage(accept: string | null): Locale | null {
  if (!accept) return null;
  const primary = accept.split(',')[0]?.split(';')[0]?.trim().toLowerCase() ?? '';
  if (primary.startsWith('fr')) return 'fr';
  if (primary.startsWith('es')) return 'es';
  if (primary.startsWith('de')) return 'de';
  if (primary.startsWith('en')) return 'en';
  return null;
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const headerStore = await headers();
  let locale = cookieStore.get(COOKIE_NAME)?.value as Locale | undefined;
  if (!locale || !SUPPORTED.includes(locale)) {
    locale = pickFromAcceptLanguage(headerStore.get('accept-language')) ?? DEFAULT_LOCALE;
  }
  // Dynamic import keeps messages chunked per locale; fallback to en on missing
  let messages: Record<string, unknown>;
  try {
    messages = (await import(`../../messages/${locale}.json`)).default;
  } catch {
    messages = (await import(`../../messages/${DEFAULT_LOCALE}.json`)).default;
    locale = DEFAULT_LOCALE;
  }
  return {
    locale,
    messages,
    // Missing keys fall back to English source (also helps dev spot gaps)
    onError(error) {
      // Only log missing translation, don't crash
      if (error.code === 'MISSING_MESSAGE') {
        console.warn(`Missing message for locale ${locale}`);
      }
    },
    getMessageFallback({ namespace, key }) {
      const path = [namespace, key].filter(Boolean).join('.');
      return path;
    },
  };
});
