'use client';

import type { ReactNode } from 'react';
import { Repeat } from './region';

/**
 * A grid of cards in the real grid's classes, with the real card's shape.
 *
 * The grid classes are passed in verbatim (copy them from the page) rather than
 * chosen from presets: the column count at each breakpoint is exactly what has
 * to match for the cards not to jump.
 */
export function CardGridSkeleton({
  count,
  className,
  card,
}: {
  count: number;
  /** The real grid's classes, e.g. `grid grid-cols-1 gap-4 lg:grid-cols-2`. */
  className: string;
  /** Renders one placeholder card; receives its index for ragged widths. */
  card: (index: number) => ReactNode;
}) {
  return (
    <div className={className}>
      <Repeat count={count}>{(i) => <div key={i} className="min-w-0">{card(i)}</div>}</Repeat>
    </div>
  );
}
