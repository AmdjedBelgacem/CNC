'use client';
import type { ReactNode } from 'react';
import { Reveal } from '@/components/ui/motion';

/**
 * Scroll-triggered reveal.
 *
 * Kept as an alias of `<Reveal>` because the two had drifted apart: this one
 * used a bespoke IntersectionObserver plus a `duration-700` CSS transition over
 * `translate-y-8`, while `Reveal` uses the house curve at 450ms over 14px. Two
 * reveal behaviours on one page is exactly the inconsistency that makes a product
 * feel unfinished, so both now resolve to a single implementation.
 *
 * Prefer `<Reveal>` in new code — it takes `from`, `repeat` and an `as` prop.
 */
export function ScrollReveal({
  children,
  className = '',
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  /** Seconds. Previously milliseconds — divided here so old callers still work. */
  delay?: number;
}) {
  return (
    <Reveal className={className} delay={delay > 10 ? delay / 1000 : delay}>
      {children}
    </Reveal>
  );
}