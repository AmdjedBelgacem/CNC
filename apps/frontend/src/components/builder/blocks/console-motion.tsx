'use client';
import type { ReactNode } from 'react';
import { m, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * Slow, weightless bob for the floating console badges — the "product visual"
 * should feel alive without demanding attention. Transform-only (never
 * opacity), so nothing waits on JavaScript to become visible, and it stops
 * entirely for reduced-motion users.
 */
export function ConsoleFloat({
  children,
  className,
  delay = 0,
  distance = 6,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  distance?: number;
}) {
  const reduced = useReducedMotion();
  return (
    <m.div
      className={cn('will-change-transform', className)}
      animate={reduced ? undefined : { y: [0, -distance, 0] }}
      transition={{ duration: 6, ease: 'easeInOut', repeat: Infinity, delay }}
    >
      {children}
    </m.div>
  );
}
