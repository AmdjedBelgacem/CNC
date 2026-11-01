'use client';
import type { ReactNode } from 'react';
import { buildCategoryHref } from '@/lib/store-category';

/**
 * Department tile that drives the catalog filter. The departments island is
 * server-rendered, so the click behaviour lives in this client leaf.
 */
export function DepartmentLink({
  name,
  index,
  count,
  children,
}: {
  name: string;
  index: number;
  count: string;
  children?: ReactNode;
}) {
  // The href is a real, shareable link to the filtered store. The click
  // handler is still needed because the catalog island lives further down the
  // page: without it the visitor would land at the top of the store with the
  // filter applied but the grid off-screen.
  const href = `${buildCategoryHref('/products', '', name)}#inventory`;

  return (
    <a
      href={href}
      data-department={name}
      onClick={() => {
        window.dispatchEvent(new CustomEvent('catalog:category', { detail: name }));
      }}
      className="card-hover group flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-card px-5 py-4 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex min-w-0 items-center gap-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-xs font-medium tabular-nums text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
          {String(index).padStart(2, '0')}
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-[17px] font-medium tracking-[-0.01em] text-foreground transition-colors group-hover:text-primary">
            {name}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{count}</p>
        </div>
      </div>
      {children}
    </a>
  );
}
