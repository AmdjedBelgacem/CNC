'use client';

import { m } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { distance, fadeIn, fadeUp, inView, scaleIn, transition } from '@/lib/motion';

/**
 * Per-element entrance animation for builder blocks.
 *
 * The admin picks an entrance per element in the builder inspector
 * (`animType` / `animDelay` node props). The same wrapper renders in three
 * places with one behaviour difference:
 *
 *   - public site: `active` — animates in when scrolled into view, once
 *   - builder preview (eye toggle): `active` — same as the public site
 *   - builder edit canvas: NOT rendered bare — the canvas must stay a 1:1,
 *     selectable copy of the final layout, so the edit-mode render path never
 *     mounts this wrapper
 *
 * Reduced motion is enforced globally by `<MotionConfig>` in the root layout:
 * transforms are dropped after mount and only the opacity fade remains.
 */

const SLIDE_VARIANTS: Record<'slideStart' | 'slideEnd', Variants> = {
  slideStart: {
    hidden: { opacity: 0, x: distance.md },
    visible: { opacity: 1, x: 0, transition: transition.reveal },
  },
  slideEnd: {
    hidden: { opacity: 0, x: -distance.md },
    visible: { opacity: 1, x: 0, transition: transition.reveal },
  },
};

const VARIANTS_BY_TYPE: Record<string, Variants> = {
  fade: fadeIn,
  fadeUp,
  scaleIn,
  ...SLIDE_VARIANTS,
};

export const NODE_ANIMATION_OPTIONS: ReadonlyArray<{ label: string; value: string }> = [
  { label: 'None', value: 'none' },
  { label: 'Fade', value: 'fade' },
  { label: 'Fade up', value: 'fadeUp' },
  { label: 'Scale in', value: 'scaleIn' },
  { label: 'Slide from start', value: 'slideStart' },
  { label: 'Slide from end', value: 'slideEnd' },
];

export function isNodeAnimationType(value: unknown): value is string {
  return typeof value === 'string' && value !== 'none' && value in VARIANTS_BY_TYPE;
}

export function nodeAnimationVariants(type: unknown, delay = 0): Variants | null {
  if (!isNodeAnimationType(type)) return null;
  const base = VARIANTS_BY_TYPE[type] as Variants;
  if (!delay) return base;
  const visible = base.visible as Record<string, unknown>;
  return {
    ...base,
    visible: {
      ...visible,
      transition: { ...(visible.transition as object), delay },
    },
  };
}

export interface NodeAnimationProps {
  /** `props.animType` on the node. Anything unknown/none renders bare. */
  type?: unknown;
  /** `props.animDelay` — seconds before the entrance starts. */
  delay?: unknown;
  /** False in the builder edit canvas → children render with no wrapper. */
  active?: boolean;
  children: React.ReactNode;
}

export function NodeAnimation({ type, delay = 0, active = true, children }: NodeAnimationProps) {
  if (!active) return <>{children}</>;
  const variants = nodeAnimationVariants(type, typeof delay === 'number' ? delay : 0);
  if (!variants) return <>{children}</>;
  return (
    <m.div
      variants={variants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: inView.once, amount: inView.amount }}
    >
      {children}
    </m.div>
  );
}
