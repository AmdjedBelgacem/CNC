'use client';
import { forwardRef } from 'react';
import { m } from 'framer-motion';
import { Layers } from 'lucide-react';
import { ease, spring } from '@/lib/motion';
import { StructureTree } from './structure-tree';

/**
 * Docked left sidebar — the structure/layers tree. Toggleable from the
 * toolbar; replaces Puck's expensive layer outline.
 *
 * A floating rounded panel on the sunken stage. It slides in from the inline
 * start on mount and back out on close (the parent wraps it in
 * `AnimatePresence`). Only transform and opacity animate — never width — so the
 * canvas iframe reflows once, not on every frame.
 */
export const StructureSidebar = forwardRef<HTMLElement>(function StructureSidebar(_props, ref) {
  return (
    <m.aside
      ref={ref}
      initial={{ opacity: 0, x: -14 }}
      animate={{ opacity: 1, x: 0, transition: spring.gentle }}
      exit={{ opacity: 0, x: -10, transition: { duration: 0.16, ease: ease.exit } }}
      className="flex min-h-0 w-64 shrink-0 flex-col self-stretch overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm max-lg:absolute max-lg:inset-y-2 max-lg:start-2 max-lg:z-40 max-lg:w-[85vw] max-lg:max-w-72 max-lg:shadow-xl"
    >
      <div className="flex h-11 shrink-0 items-center gap-2 px-3.5">
        <Layers className="size-3.5 text-muted-foreground" />
        <span className="font-display text-sm font-medium tracking-[-0.01em] text-foreground">
          Layers
        </span>
      </div>
      {/* `layoutScroll` keeps the sliding selection pill aligned while this list is scrolled. */}
      <m.div layoutScroll className="scrollbar-thin min-h-0 flex-1 overflow-y-auto border-t border-border/60 p-1.5">
        <StructureTree />
      </m.div>
      <div className="shrink-0 border-t border-border/60 bg-surface-sunken/40 px-3.5 py-2.5">
        <p className="text-2xs leading-relaxed text-muted-foreground/80">
          Click a row to select it on the canvas. Click the chevron to expand or collapse a
          branch.
        </p>
      </div>
    </m.aside>
  );
});
