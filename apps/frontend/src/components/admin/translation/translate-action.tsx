'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Languages, Loader2, RefreshCw, Sparkles, Eye } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { TranslationCoverage } from '@titan/shared';
import { cn } from '@/lib/utils';
import { TranslationCoverageBadge } from './translation-coverage';
import type { TranslateScope } from './use-translate-draft';

/**
 * The translation action, with its two scopes made explicit.
 *
 * A single button cannot express the decision an editor actually faces — "fill the gaps" versus
 * "throw this away and start again" — so those are separate menu items rather than one button
 * behind a confirm dialog.
 *
 * The button itself is quiet by default. Translation is an assistive action here, not the reason
 * the editor opened the page, so it does not compete with the form fields it sits above.
 */
export interface TranslateActionProps extends Omit<ButtonProps, 'onClick' | 'children'> {
  coverage?: TranslationCoverage | null;
  busy?: boolean;
  onTranslate: (scope: TranslateScope) => void;
  /** Opens the English/Arabic comparison. */
  onReview?: () => void;
  /** Hides "re-translate everything" when there is nothing to re-translate. */
  disableAll?: boolean;
}

export function TranslateAction({
  coverage,
  busy,
  onTranslate,
  onReview,
  disableAll,
  variant = 'outline',
  size = 'sm',
  className,
  ...rest
}: TranslateActionProps) {
  const t = useTranslations('admin.translate');
  const [open, setOpen] = useState(false);

  const nothingToDo = coverage != null && coverage.total > 0 && coverage.translated === coverage.total;
  const hasCoverage = coverage != null && coverage.total > 0;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {hasCoverage && (
        // The count sits inside the trigger's own label rather than beside the button, so the
        // control reads as one object instead of a button next to a button-shaped badge.
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant={variant} size={size} disabled={busy} {...rest}>
              {busy ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <Languages className="size-3.5" aria-hidden />
              )}
              {busy ? t('working') : t('button')}
              {hasCoverage && (
                <span className="ms-1.5 border-s border-border-strong ps-1.5 font-mono text-[11px] tabular-nums text-muted-foreground">
                  {coverage.translated}/{coverage.total}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel className="flex items-center justify-between gap-3 font-normal">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {t('menu.title')}
              </span>
              <TranslationCoverageBadge coverage={coverage} />
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                setOpen(false);
                onTranslate('missing');
              }}
              disabled={busy || nothingToDo}
              className="gap-2.5 py-2.5"
            >
              <Sparkles className="size-3.5 shrink-0 text-primary" aria-hidden />
              <span className="flex-1">{t('menu.missing')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                setOpen(false);
                onTranslate('all');
              }}
              disabled={busy || disableAll}
              className="gap-2.5 py-2.5 text-destructive focus:text-destructive"
            >
              <RefreshCw className="size-3.5 shrink-0" aria-hidden />
              <span className="flex-1">{t('menu.all')}</span>
            </DropdownMenuItem>
            {onReview && coverage!.translated > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => {
                    setOpen(false);
                    onReview();
                  }}
                  className="gap-2.5 py-2.5"
                >
                  <Eye className="size-3.5 shrink-0" aria-hidden />
                  <span className="flex-1">{t('menu.review')}</span>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {!hasCoverage && (
        <Button
          type="button"
          variant={variant}
          size={size}
          disabled={busy}
          onClick={() => onTranslate('missing')}
          {...rest}
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <Languages className="size-3.5" aria-hidden />
          )}
          {busy ? t('working') : t('button')}
        </Button>
      )}
    </div>
  );
}
