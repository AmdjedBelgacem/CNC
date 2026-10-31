import { createContext, useContext } from 'react';
import type { CatalogStatProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index';
import { isPlaceholderValue } from './use-catalog-stats';

/**
 * Live values keyed by child node id.
 *
 * The builder's live preview and the public server render both know the real
 * counters, but the stored stat child still holds the seeded placeholder. The
 * catalog hero supplies this map around the real slot children so the children
 * stay selectable/editable in the canvas while still showing the live number.
 */
export const CatalogStatValueOverrides = createContext<Map<string, string> | null>(null);

/** One label/value cell in the catalog hero's stats strip. */
export function CatalogStatBlock({ props }: BlockComponentProps<CatalogStatProps>) {
  const { id, label, value, className } = props;
  const overrides = useContext(CatalogStatValueOverrides);
  const liveValue = id ? overrides?.get(id) : undefined;
  const displayValue = liveValue && isPlaceholderValue(value) ? liveValue : value;
  return (
    <div className={cn('bg-card px-5 py-4', className)} style={layoutStyle(props)}>
      <dt className="text-xs font-medium text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1.5 font-display text-2xl font-medium tracking-[-0.02em] text-foreground tabular-nums">
        {displayValue}
      </dd>
    </div>
  );
}
