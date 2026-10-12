'use client';

import { useTranslations } from 'next-intl';
import { readPath, type TranslatableField } from '@titan/shared';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Side-by-side English and Arabic for every translatable field.
 *
 * Machine output is only trustworthy if it can be checked against the source, so this pairs each
 * field rather than showing Arabic alone — a fluent-looking translation of the wrong field is the
 * failure mode an editor cannot catch from the Arabic text by itself.
 */
export interface TranslationReviewItem {
  label: string;
  source: string;
  translation: string;
}

export function buildReviewItems(
  source: unknown,
  translated: unknown,
  fields: TranslatableField[],
): TranslationReviewItem[] {
  const target = (translated ?? {}) as Record<string, unknown>;
  const items: TranslationReviewItem[] = [];
  for (const field of fields) {
    const english = readPath(source, field.path).trim();
    if (!english) continue;
    items.push({
      label: field.label,
      source: english,
      translation: readPath(target, field.path).trim(),
    });
  }
  return items;
}

export function TranslationReviewDialog({
  open,
  onOpenChange,
  items,
  entityLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: TranslationReviewItem[];
  entityLabel?: string;
}) {
  const t = useTranslations('admin.translate');
  const missing = items.filter((item) => !item.translation).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t('review.title', { entity: entityLabel ?? '' })}</DialogTitle>
          <DialogDescription>{t('review.description')}</DialogDescription>
        </DialogHeader>
        <DialogBody className="max-h-[60vh] overflow-y-auto">
          <div className="space-y-3">
            {items.length === 0 && <p className="text-sm text-muted-foreground">{t('review.nothing')}</p>}
            {items.map((item) => (
              <div key={item.label} className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {item.label}
                    </span>
                    <Badge variant="soft-muted">EN</Badge>
                  </div>
                  <p className="whitespace-pre-wrap text-sm" dir="ltr">
                    {item.source}
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t('review.arabic')}
                    </span>
                    {item.translation ? (
                      <Badge variant="success">AR</Badge>
                    ) : (
                      <Badge variant="warning">{t('review.missing')}</Badge>
                    )}
                  </div>
                  <p
                    className={cn(
                      'whitespace-pre-wrap text-sm',
                      !item.translation && 'italic text-muted-foreground',
                    )}
                    dir="rtl"
                  >
                    {item.translation || '—'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </DialogBody>
        <DialogFooter>
          {missing > 0 && (
            <p className="mr-auto self-center text-xs text-warning">{t('review.missingCount', { count: missing })}</p>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('review.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
