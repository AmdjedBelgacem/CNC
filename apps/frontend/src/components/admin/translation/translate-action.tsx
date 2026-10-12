'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Languages, Loader2, RefreshCw, Sparkles } from 'lucide-react';
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
 * "throw this away and start again" — so those are separate menu items rather than one button with
 * a confirm dialog behind it.
 */
export interface TranslateActionProps extends Omit<ButtonProps, 'onClick' | 'children'> {
  coverage?: TranslationCoverage | null;
  busy?: boolean;
  onTranslate: (scope: TranslateScope) => void;
  /** Reveals the review dialog affordance once there is Arabic copy to review. */
  onReview?: () => void;
  /** Disables the "translate everything" item when nothing is missing. */
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

  const nothingToDo = coverage != null && coverage.translated === coverage.total;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {coverage && <TranslationCoverageBadge coverage={coverage} />}
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant={variant} size={size} disabled={busy} {...rest}>
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Languages className="size-3.5" aria-hidden />
            )}
            {busy ? t('working') : t('button')}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>{t('menu.title')}</DropdownMenuLabel>
          <DropdownMenuItem
            onSelect={() => {
              setOpen(false);
              onTranslate('missing');
            }}
            disabled={busy || nothingToDo}
          >
            <Sparkles className="size-3.5" aria-hidden />
            <span className="flex-1">{t('menu.missing')}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              setOpen(false);
              onTranslate('all');
            }}
            disabled={busy || disableAll}
            className="text-destructive focus:text-destructive"
          >
            <RefreshCw className="size-3.5" aria-hidden />
            <span className="flex-1">{t('menu.all')}</span>
          </DropdownMenuItem>
          {onReview && coverage && coverage.translated > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => {
                  setOpen(false);
                  onReview();
                }}
              >
                <span className="flex-1">{t('menu.review')}</span>
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <p className="px-2 py-1.5 text-xs text-muted-foreground">{t('menu.hint')}</p>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
