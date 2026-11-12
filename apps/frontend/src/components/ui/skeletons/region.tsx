'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

/**
 * The accessible wrapper every replica skeleton renders inside.
 *
 * One `role="status"` region per page, marked `aria-busy`, with a single
 * visually hidden label. The bars inside are `aria-hidden` (see `Skeleton`), so
 * a screen reader hears "Loading…" once instead of once per bar.
 *
 * It adds no padding or width of its own: each replica copies the real page's
 * container classes, and a wrapper that padded would shift everything inside.
 */
export function SkeletonRegion({
  label,
  className,
  children,
}: {
  /** Defaults to `common.loading`. */
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  const tc = useTranslations('common');
  const text = label ?? tc('loading');
  return (
    <div role="status" aria-busy="true" aria-live="polite" aria-label={text} className={cn('w-full', className)}>
      <span className="sr-only">{text}</span>
      {children}
    </div>
  );
}

/** Repeat a placeholder `count` times. Saves an `Array.from` in every replica. */
export function Repeat({ count, children }: { count: number; children: (index: number) => ReactNode }) {
  return <>{Array.from({ length: Math.max(0, count) }, (_, i) => children(i))}</>;
}
