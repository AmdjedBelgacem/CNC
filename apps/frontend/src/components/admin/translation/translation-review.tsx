'use client';

import { useTranslations } from 'next-intl';
import { ArrowRight, Languages, Sparkles } from 'lucide-react';
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
import { cn } from '@/lib/utils';

/**
 * Side-by-side English and Arabic for every translatable field.
 *
 * Machine output is only trustworthy if it can be checked against its source, so each field is a
 * paired row rather than a list of translations: the editor reads across, not down. The status rail
 * on the left makes a long list scannable without reading any of it, and the missing state offers
 * the fix inline rather than reporting a dead end.
 */
export interface TranslationReviewItem {
  label: string;
  source: string;
  translation: string;
  /** English exists but Arabic does not — the only state worth drawing attention to. */
  missing: boolean;
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
    // A field with no English has nothing to translate and would otherwise show as a permanent
    // "missing" that cannot be acted on.
    if (!english) continue;
    const arabic = readPath(target, field.path).trim();
    items.push({ label: field.label, source: english, translation: arabic, missing: !arabic });
  }
  return items;
}

function StatusRail({ missing }: { missing: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'absolute inset-y-3 start-0 w-[3px] rounded-full',
        missing ? 'bg-warning' : 'bg-success',
      )}
    />
  );
}

export function TranslationReviewDialog({
  open,
  onOpenChange,
  items,
  entityLabel,
  onTranslateField,
  busyField,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: TranslationReviewItem[];
  entityLabel?: string;
  /** Translates one field on its own, for an editor fixing a single bad line. */
  onTranslateField?: (label: string) => void;
  busyField?: string | null;
}) {
  const t = useTranslations('admin.translate');
  const missing = items.filter((item) => item.missing).length;
  const done = items.length - missing;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-0">
        <DialogHeader className="border-b border-border px-4 py-4 pe-12 sm:px-6 sm:py-5 sm:pe-14">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2 font-display text-lg">
                <Languages className="size-4 shrink-0 text-primary" aria-hidden />
                <span className="truncate">{t('review.title', { entity: entityLabel ?? '' })}</span>
              </DialogTitle>
              <DialogDescription className="mt-1">{t('review.description')}</DialogDescription>
            </div>
            {/* A precise count rather than a bar: it is the only number that matters here. */}
            <div className="shrink-0 text-end">
              <div className="font-mono text-xl font-medium tabular-nums leading-none">
                <span className={missing ? 'text-warning' : 'text-success'}>{done}</span>
                <span className="text-muted-foreground">/{items.length}</span>
              </div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {missing ? t('review.missingCount', { count: missing }) : t('coverage.complete')}
              </div>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="space-y-2">
          {items.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('review.nothing')}</p>
          )}
          {items.map((item, index) => (
            <article
              key={`${item.label}-${index}`}
              className="relative grid gap-x-7 gap-y-3 rounded-lg border border-border bg-card ps-4 pe-4 py-3.5 transition-colors hover:border-border-strong sm:grid-cols-2"
            >
              <StatusRail missing={item.missing} />

              <div className="min-w-0 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    {item.label}
                  </span>
                  <span className="rounded-sm bg-muted px-1.5 py-px font-mono text-[10px] tracking-wider text-muted-foreground">
                    EN
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-foreground" dir="ltr">
                  {item.source}
                </p>
              </div>

              <div className="min-w-0 space-y-1.5 sm:border-s sm:border-border/70 sm:ps-7">
                <div className="flex items-center gap-2 sm:justify-end">
                  <ArrowRight
                    className="size-3 shrink-0 rotate-180 rtl:rotate-0 text-border-strong sm:hidden"
                    aria-hidden
                  />
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    {t('review.arabic')}
                  </span>
                  {item.missing ? (
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-warning">
                      {t('review.missing')}
                    </span>
                  ) : (
                    <span className="rounded-sm bg-accent/10 px-1.5 py-px font-mono text-[10px] tracking-wider text-accent">
                      AR
                    </span>
                  )}
                </div>
                {item.missing ? (
                  // Not a dash: a dash reads as a rendering fault, and it offers no way forward.
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-sm italic text-muted-foreground">{t('review.notYet')}</p>
                    {onTranslateField && (
                      <button
                        type="button"
                        disabled={busyField === item.label}
                        onClick={() => onTranslateField(item.label)}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-sm text-xs font-medium text-primary',
                          'underline decoration-primary/30 underline-offset-4 transition-colors',
                          'hover:decoration-primary focus-visible:outline-none',
                          'focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60',
                        )}
                      >
                        <Sparkles className="size-3" aria-hidden />
                        {busyField === item.label ? t('working') : t('review.translateOne')}
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed text-foreground" dir="rtl">
                    {item.translation}
                  </p>
                )}
              </div>
            </article>
          ))}
        </DialogBody>

        <DialogFooter className="flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3">
          <p className="text-xs text-muted-foreground sm:mr-auto">{t('review.hint')}</p>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            {t('review.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
