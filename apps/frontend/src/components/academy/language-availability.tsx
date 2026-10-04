import { Languages } from 'lucide-react';
import type { ContentLocale } from '@titan/shared';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function LanguageAvailability({
  availableLocales = ['en'],
  resolvedLocale,
  fallbackFields = [],
  tone = 'default',
}: {
  availableLocales?: ContentLocale[];
  resolvedLocale?: ContentLocale;
  fallbackFields?: string[];
  tone?: 'default' | 'inverse';
}) {
  const locales = availableLocales.length > 0 ? availableLocales : (['en'] as ContentLocale[]);
  return (
    <div className={cn('flex flex-wrap items-center gap-2 text-xs text-muted-foreground', tone === 'inverse' && 'text-background/60')} dir="ltr">
      <Languages className="size-3.5 text-primary" />
      <span>Available:</span>
      {locales.map((locale) => <Badge key={locale} variant={resolvedLocale === locale ? 'soft' : 'soft-muted'}>{locale === 'ar' ? 'العربية' : 'English'}</Badge>)}
      {resolvedLocale && resolvedLocale !== 'en' && <span>Showing {resolvedLocale === 'ar' ? 'Arabic' : 'English'}</span>}
      {fallbackFields.length > 0 && <span className="text-warning">Some fields use English fallback</span>}
    </div>
  );
}
