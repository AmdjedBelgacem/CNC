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
      className="group flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-5 py-4 shadow-xs transition-colors hover:border-primary/40"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="font-mono text-xs font-semibold text-border-strong tabular-nums">
          {String(index).padStart(2, '0')}
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-base font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary">
            {name}
          </p>
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            {count}
          </p>
        </div>
      </div>
      {children}
    </a>
  );
}
