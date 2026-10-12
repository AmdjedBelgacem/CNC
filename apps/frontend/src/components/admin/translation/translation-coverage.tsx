'use client';

import { useTranslations } from 'next-intl';
import type { TranslationCoverage } from '@titan/shared';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * How much of one entity is translated.
 *
 * Coverage is deliberately visible before translating rather than after: an editor who cannot see
 * that a course is 4/7 translated will happily publish an Arabic page with three English fields
 * still showing through.
 */
export function TranslationCoverageBadge({
  coverage,
  className,
}: {
  coverage: TranslationCoverage;
  className?: string;
}) {
  const t = useTranslations('admin.translate');
  if (coverage.total === 0) {
    return (
      <Badge variant="soft-muted" className={className}>
        {t('coverage.empty')}
      </Badge>
    );
  }
  const done = coverage.total > 0 && coverage.translated === coverage.total;
  return (
    <Badge variant={done ? 'success' : 'warning'} className={className}>
      {t('coverage.badge', { translated: coverage.translated, total: coverage.total })}
    </Badge>
  );
}

/**
 * A bar plus the specific fields still missing.
 *
 * The missing labels are the actionable part: "Title, Description" tells the editor what the AI
 * pass will touch and what it will leave alone.
 */
export function TranslationCoveragePanel({
  coverage,
  className,
}: {
  coverage: TranslationCoverage;
  className?: string;
}) {
  const t = useTranslations('admin.translate');
  if (coverage.total === 0) return null;
  const percent = Math.round((coverage.translated / coverage.total) * 100);
  const complete = coverage.translated === coverage.total;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">{t('coverage.label')}</span>
        <TranslationCoverageBadge coverage={coverage} />
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t('coverage.label')}
      >
        <div
          className={cn('h-full rounded-full transition-all', complete ? 'bg-success' : 'bg-warning')}
          style={{ width: `${percent}%` }}
        />
      </div>
      {coverage.missing.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {t('coverage.missing', { fields: coverage.missing.join(', ') })}
        </p>
      )}
    </div>
  );
}
