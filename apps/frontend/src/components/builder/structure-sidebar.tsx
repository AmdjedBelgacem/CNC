'use client';
import { Layers } from 'lucide-react';
import { StructureTree } from './structure-tree'; /** * Docked left sidebar — the structure/layers tree. Toggleable from the * toolbar; replaces Puck's expensive layer outline. */
export function StructureSidebar() {
  return (
    <aside className="flex min-h-0 w-64 shrink-0 flex-col self-stretch border-r border-border bg-card max-lg:absolute max-lg:inset-y-0 max-lg:left-0 max-lg:z-40 max-lg:w-[85vw] max-lg:max-w-72 max-lg:animate-drawer-in-left max-lg:shadow-sm max-lg:shadow-black/20">
      {' '}
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
        {' '}
        <Layers className="h-3.5 w-3.5 text-muted-foreground" />{' '}
        <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          Layers
        </span>{' '}
      </div>{' '}
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-1.5">
        {' '}
        <StructureTree />{' '}
      </div>{' '}
      <div className="shrink-0 border-t border-border px-3 py-2">
        {' '}
        <p className="text-[10px] leading-relaxed text-muted-foreground/70">
          {' '}
          Click a row to select it on the canvas. Click the chevron to expand or collapse a
          branch.{' '}
        </p>{' '}
      </div>{' '}
    </aside>
  );
}
