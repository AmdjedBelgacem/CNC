'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useBuilderUI } from './builder-ui-store';

/**
 * The language the builder canvas renders in — independent of the admin interface language.
 *
 * The canvas used to inherit the admin's own locale. An admin working in Arabic saw the
 * English layout laid out right-to-left with Arabic live sections around it, and an admin
 * working in English never saw what Arabic visitors get. Neither matched the public page. The
 * canvas now has its own language: English shows the English layout left-to-right, Arabic
 * shows exactly what an Arabic visitor receives (the merged Arabic layout, right-to-left, live
 * data and labels in Arabic).
 */
export type CanvasLocale = 'en' | 'ar';

type Messages = Record<string, unknown>;

interface CanvasLocaleValue {
  locale: CanvasLocale;
  dir: 'ltr' | 'rtl';
  /** The message catalogue for `locale`, or null while it loads. */
  messages: Messages | null;
}

const CanvasLocaleContext = createContext<CanvasLocaleValue>({ locale: 'en', dir: 'ltr', messages: null });

const cache = new Map<CanvasLocale, Messages>();

async function loadMessages(locale: CanvasLocale): Promise<Messages> {
  const hit = cache.get(locale);
  if (hit) return hit;
  const messages = (
    locale === 'ar' ? await import('../../../messages/ar.json') : await import('../../../messages/en.json')
  ).default as Messages;
  cache.set(locale, messages);
  return messages;
}

export function CanvasLocaleProvider({ children }: { children: ReactNode }) {
  const locale = useBuilderUI((state) => state.canvasLocale);
  const [messages, setMessages] = useState<Messages | null>(cache.get(locale) ?? null);
  useEffect(() => {
    let active = true;
    void loadMessages(locale).then((loaded) => {
      if (active) setMessages(loaded);
    });
    return () => {
      active = false;
    };
  }, [locale]);
  return (
    <CanvasLocaleContext.Provider
      value={{ locale, dir: locale === 'ar' ? 'rtl' : 'ltr', messages: messages && cache.get(locale) === messages ? messages : null }}
    >
      {children}
    </CanvasLocaleContext.Provider>
  );
}

export function useCanvasLocale() {
  return useContext(CanvasLocaleContext);
}
