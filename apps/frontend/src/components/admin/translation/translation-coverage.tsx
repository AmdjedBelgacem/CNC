'use client';

import { useTranslations } from 'next-intl';
import type { TranslationCoverage } from '@titan/shared';
import { cn } from '@/lib/utils';

/**
 * How much of one entity is translated.
 *
 * Drawn as discrete segments rather than a progress bar on purpose: a smooth bar can only say
 * "somewhere between here and there", while one segment per field says *which* field is still
 * missing, at the position it occupies in the entity. An editor scanning six of these at once can
 * see "the description" without reading any text.
 *
 * A field counts as translated only when the English source has content AND the Arabic side does,
 * so the indicator never claims full coverage while a field is empty in both languages.
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
      <span
        className={cn(
          'inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground',
          className,
        )}
      >
        {t('coverage.empty')}
      </span>
    );
  }
  const complete = coverage.translated === coverage.total;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em]',
        complete ? 'text-success' : 'text-warning',
        className,
      )}
    >
      <CoverageSegments coverage={coverage} />
      <span className="tabular-nums">
        {coverage.translated}/{coverage.total}
      </span>
    </span>
  );
}

function CoverageSegments({
  coverage,
  className,
}: {
  coverage: TranslationCoverage;
  className?: string;
}) {
  // Beyond this many fields the segments stop being individually readable and would just be a
  // bar with extra steps, so it collapses back to a continuous fill.
  const MAX_SEGMENTS = 12;
  if (coverage.total > MAX_SEGMENTS) {
    const percent = (coverage.translated / coverage.total) * 100;
    return (
      <span
        className={cn('block h-1.5 w-16 overflow-hidden rounded-full bg-muted', className)}
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span
          className={cn(
            'block h-full rounded-full',
            coverage.translated === coverage.total ? 'bg-success' : 'bg-warning',
          )}
          style={{ width: `${percent}%` }}
        />
      </span>
    );
  }
  return (
    <span className={cn('inline-flex items-center gap-[3px]', className)} aria-hidden>
      {Array.from({ length: coverage.total }, (_, index) => (
        <span
          key={index}
          className={cn(
            'block h-1.5 w-2 rounded-[2px]',
            index < coverage.translated ? 'bg-success' : 'bg-warning/70',
          )}
        />
      ))}
    </span>
  );
}

/**
 * The inline coverage readout that sits next to the translate action.
 *
 * Deliberately quiet: it is a status line, not a call to action, so it stays in the muted part of
 * the palette and lets the button carry the emphasis.
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
  const complete = coverage.translated === coverage.total;

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          {t('coverage.label')}
        </span>
        <TranslationCoverageBadge coverage={coverage} />
      </div>
      {coverage.missing.length > 0 && (
        <p className="min-w-0 break-words text-xs leading-relaxed text-muted-foreground">
          {t('coverage.missing', { fields: coverage.missing.join(' · ') })}
        </p>
      )}
      {complete && (
        <p className="text-xs text-success">{t('coverage.complete')}</p>
      )}
    </div>
  );
}
