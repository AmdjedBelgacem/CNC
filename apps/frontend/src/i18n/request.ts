import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  coerceLocale,
  localeFromAcceptLanguage,
} from './config';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const headerStore = await headers();

  // Cookie wins over the browser hint: an explicit choice must never be
  // overwritten by Accept-Language on a later request.
  const cookieValue = cookieStore.get(LOCALE_COOKIE)?.value;
  let locale = coerceLocale(cookieValue);
  if (!cookieValue) {
    locale = localeFromAcceptLanguage(headerStore.get('accept-language')) ?? DEFAULT_LOCALE;
  }

  // Dynamic import keeps messages chunked per locale; fall back to English.
  let messages: Record<string, unknown>;
  try {
    messages = (await import(`../../messages/${locale}.json`)).default;
  } catch {
    messages = (await import(`../../messages/${DEFAULT_LOCALE}.json`)).default;
    locale = DEFAULT_LOCALE;
  }

  // The English catalog is kept in memory purely to resolve missing keys. Without
  // it a gap renders as `courses.studio.saveBlocks` at the user, which is worse
  // than reading the English sentence.
  const fallbackMessages =
    locale === DEFAULT_LOCALE
      ? messages
      : ((await import(`../../messages/${DEFAULT_LOCALE}.json`)).default as Record<string, unknown>);

  return {
    locale,
    messages,
    // Missing keys fall back to English source (also helps dev spot gaps)
    onError(error) {
      if (error.code === 'MISSING_MESSAGE') {
        console.warn(`Missing message for locale ${locale}`);
      }
    },
    getMessageFallback({ namespace, key }) {
      // English first, then the raw key: a missing translation must never be
      // more broken than the English original.
      const source = fallbackMessages as Record<string, Record<string, unknown>>;
      const block = namespace ? source[namespace] : source;
      const value = block && typeof block === 'object' ? (block as Record<string, unknown>)[key] : undefined;
      return typeof value === 'string' && value.length > 0 ? value : [namespace, key].filter(Boolean).join('.');
    },
  };
});
