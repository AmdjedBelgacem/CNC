'use client';
import { forwardRef } from 'react';
import { m } from 'framer-motion';
import { ease, spring } from '@/lib/motion';
import { SmartInspector } from './inspector/smart-inspector';

/**
 * Docked right sidebar — the contextual property inspector. Replaces Puck's
 * right sidebar entirely (Puck's own sidebar is disabled for performance).
 *
 * A floating rounded panel that slides in from the inline end; the parent wraps
 * it in `AnimatePresence` so closing plays out. Transform/opacity only.
 */
export const InspectorPanel = forwardRef<HTMLElement>(function InspectorPanel(_props, ref) {
  return (
    <m.aside
      ref={ref}
      initial={{ opacity: 0, x: 14 }}
      animate={{ opacity: 1, x: 0, transition: spring.gentle }}
      exit={{ opacity: 0, x: 10, transition: { duration: 0.16, ease: ease.exit } }}
      className="flex min-h-0 w-80 shrink-0 flex-col self-stretch overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm max-lg:absolute max-lg:inset-y-2 max-lg:end-2 max-lg:z-40 max-lg:w-[85vw] max-lg:max-w-80 max-lg:shadow-xl"
    >
      <SmartInspector />
    </m.aside>
  );
});
