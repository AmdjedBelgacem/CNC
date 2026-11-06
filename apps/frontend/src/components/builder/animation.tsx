'use client';

import * as React from 'react';
import { create } from 'zustand';
import { m, MotionConfig, useAnimationControls, useReducedMotion } from 'framer-motion';
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

const fadeDown: Variants = {
  hidden: { opacity: 0, y: -distance.md },
  visible: { opacity: 1, y: 0 },
};

const blurIn: Variants = {
  hidden: { opacity: 0, filter: 'blur(8px)' },
  visible: { opacity: 1, filter: 'blur(0px)' },
};

const VARIANTS_BY_TYPE: Record<string, Variants> = {
  fade: fadeIn,
  fadeUp,
  fadeDown,
  scaleIn,
  fadeScale: scaleIn,
  ...SLIDE_VARIANTS,
  blurIn,
};

export interface NodeAnimationParams {
  delay?: number;
  duration?: number;
  easeKind?: string;
  stiffness?: number;
  damping?: number;
}

/** Motion feel → the transition used for the entrance. Springs ignore the
 *  duration (stiffness/damping own the timing); the tween uses it directly. */
function transitionFor(params: NodeAnimationParams): Record<string, unknown> {
  const { duration = 0.45, easeKind = 'smooth', stiffness, damping } = params;
  if (easeKind === 'soft') {
    return { type: 'spring' as const, stiffness: stiffness ?? 210, damping: damping ?? 30, mass: 1 };
  }
  if (easeKind === 'snappy') {
    return { type: 'spring' as const, stiffness: stiffness ?? 520, damping: damping ?? 34, mass: 0.7 };
  }
  return { duration, ease: [0.32, 0.72, 0, 1] };
}

export const NODE_ANIMATION_OPTIONS: ReadonlyArray<{ label: string; value: string }> = [
  { label: 'None', value: 'none' },
  { label: 'Fade', value: 'fade' },
  { label: 'Fade up', value: 'fadeUp' },
  { label: 'Fade down', value: 'fadeDown' },
  { label: 'Scale in', value: 'scaleIn' },
  { label: 'Fade + scale', value: 'fadeScale' },
  { label: 'Slide from start', value: 'slideStart' },
  { label: 'Slide from end', value: 'slideEnd' },
  { label: 'Blur in', value: 'blurIn' },
];

export function isNodeAnimationType(value: unknown): value is string {
  return typeof value === 'string' && value !== 'none' && value in VARIANTS_BY_TYPE;
}

export function nodeAnimationVariants(
  type: unknown,
  params: NodeAnimationParams = {},
): Variants | null {
  const { delay = 0 } = params;
  if (!isNodeAnimationType(type)) return null;
  const base = VARIANTS_BY_TYPE[type] as Variants;
  const visible = base.visible as Record<string, unknown>;
  return {
    ...base,
    visible: {
      ...visible,
      transition: {
        ...(visible.transition as object),
        ...transitionFor(params),
        ...(delay ? { delay } : {}),
      },
    },
  };
}

/* ── Playback transport store (builder inspector → canvas) ───────────────── */

export type AnimPlaybackMode = 'play' | 'pause';

interface AnimPlaybackState {
  nodeId: string | null;
  token: number;
  mode: AnimPlaybackMode;
}

/**
 * Carries the inspector's Play/Pause/Replay clicks to the canvas node.
 * `token` bumps on every Play/Replay so the runner remounts from hidden;
 * `pause` freezes the running animation at its current frame.
 */
export const useAnimPlayback = create<
  AnimPlaybackState & {
    play: (nodeId: string) => void;
    replay: (nodeId: string) => void;
    pause: () => void;
    clear: () => void;
  }
>((set) => ({
  nodeId: null,
  token: 0,
  mode: 'play',
  play: (nodeId) =>
    set((s) => ({ nodeId, mode: 'play' as const, token: s.nodeId === nodeId ? s.token + 1 : 1 })),
  replay: (nodeId) =>
    set((s) => ({ nodeId, mode: 'play' as const, token: s.token + 1 })),
  pause: () => set((s) => (s.nodeId ? { mode: 'pause' as const } : s)),
  clear: () => set({ nodeId: null, mode: 'play' as const }),
}))

/* ── Playback runner — canvas-only, forced playback ───────────────────────── */

export interface PlaybackRunnerProps {
  variants: Variants;
  mode: AnimPlaybackMode;
  token: number;
  children: React.ReactNode;
}

/**
 * Runs the entrance on demand. Play/Replay parks the node at hidden and
 * animates to visible (the variant's own transition applies, delay included);
 * Pause freezes the animation at its current frame via controls.stop().
 *
 * The nested MotionConfig overrides the editor's reducedMotion="always" guard
 * for this subtree only — Play is a deliberate preview request — while
 * `user` still drops transforms for reduced-motion visitors.
 */
export function PlaybackRunner({ variants, mode, token, children }: PlaybackRunnerProps) {
  const controls = useAnimationControls();
  const reduce = useReducedMotion();

  React.useEffect(() => {
    if (mode === 'pause') {
      controls.stop();
      return;
    }
    // set → start in the same tick: framer animates from the hidden state to
    // visible using the variant's own transition. (A rAF-deferred start was
    // tried here and cancelled by re-render cleanups before it ever fired,
    // leaving the node stuck at hidden.)
    controls.set('hidden');
    void controls.start('visible');
  }, [controls, mode, token]);

  return (
    <MotionConfig reducedMotion={reduce ? 'user' : 'never'}>
      <m.div animate={controls} initial={false} variants={variants}>
        {children}
      </m.div>
    </MotionConfig>
  );
}

export interface NodeAnimationProps {
  /** `props.animType` on the node. Anything unknown/none renders bare. */
  type?: unknown;
  /** `props.animDelay` — seconds before the entrance starts. */
  delay?: unknown;
  /** `props.animDuration` — seconds the entrance runs (tween feel). */
  duration?: unknown;
  /** `props.animEase` — motion feel: smooth tween, soft or snappy spring. */
  easeKind?: unknown;
  /** `props.animStiffness` — spring override. */
  stiffness?: unknown;
  /** `props.animDamping` — spring override. */
  damping?: unknown;
  /** False in the builder edit canvas → children render with no wrapper. */
  active?: boolean;
  children: React.ReactNode;
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function NodeAnimation({
  type,
  delay,
  duration,
  easeKind,
  stiffness,
  damping,
  active = true,
  children,
}: NodeAnimationProps) {
  if (!active) return <>{children}</>;
  const variants = nodeAnimationVariants(type, {
    delay: num(delay) ?? 0,
    duration: num(duration),
    easeKind: typeof easeKind === 'string' ? easeKind : undefined,
    stiffness: num(stiffness),
    damping: num(damping),
  });
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
