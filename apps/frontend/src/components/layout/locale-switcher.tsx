'use client';
import { useTransition } from 'react';
import { Languages } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { LOCALES, LOCALE_COOKIE, LOCALE_NATIVE_LABELS, type Locale } from '@/i18n/config';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * Switches between English and Arabic.
 *
 * The locale is resolved from a cookie by the middleware and `i18n/request.ts`,
 * so the cookie is written here and the page reloaded — a client-side state
 * change alone would leave the server-rendered strings and `dir` out of sync.
 */
export function LocaleSwitcher() {
  const locale = useLocale();
  const t = useTranslations('common');
  const [, startTransition] = useTransition();

  const setLocale = (next: Locale) => {
    if (next === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax`;
    startTransition(() => {
      window.location.reload();
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('language')}>
          <Languages />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LOCALES.map((code) => (
          <DropdownMenuItem
            key={code}
            onSelect={() => setLocale(code)}
            className={code === locale ? 'font-semibold text-primary' : undefined}
          >
            <span aria-hidden>{code === 'ar' ? '🇸🇦' : '🇬🇧'}</span>
            {LOCALE_NATIVE_LABELS[code]}
            {code === locale && <span className="ms-auto text-xs">✓</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
