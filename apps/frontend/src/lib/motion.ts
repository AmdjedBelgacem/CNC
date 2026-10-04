import type { Transition, Variants } from 'framer-motion';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * MOTION TOKENS
 * ─────────────────────────────────────────────────────────────────────────────
 * One source of truth for timing so the whole product breathes at the same rate.
 *
 * The guiding rules, borrowed from how Apple's own UI moves:
 *
 *  1. Distance is small. Content should travel 4–16px, never further. Anything
 *     larger reads as "sliding", not "arriving".
 *  2. Entrances decelerate hard. `emerge` (the default) front-loads velocity and
 *     eases out long, which is what makes an object feel physical rather than
 *     scripted.
 *  3. Exits are ~40% faster than entrances. Nobody wants to wait for something
 *     that is leaving.
 *  4. Anything the finger touches gets a spring. Springs carry velocity, so a
 *     card flicked while scrolling keeps moving instead of restarting.
 *  5. Opacity never dips below the value the element lands on. No fade-out-then-in.
 */

/* ── Durations (seconds) ─────────────────────────────────────────────────── */

export const duration = {
  /** Instant feedback: press states, ripples, small toggles. */
  instant: 0.12,
  /** Standard enter/leave for a single element. */
  fast: 0.2,
  /** Default for most transitions. */
  base: 0.32,
  /** Large surfaces: modals, sheets, page-level crossfades. */
  slow: 0.45,
  /** Deliberate, attention-drawing motion. Rare — use sparingly. */
  deliberate: 0.7,
} as const;

/* ── Easings ─────────────────────────────────────────────────────────────── */

export const ease = {
  /** Symmetric ease. Only for continuous values (progress, rotation). */
  standard: [0.4, 0, 0.2, 1],
  /**
   * The house curve. Front-loaded deceleration — matches the `cubic-bezier`
   * already used by the CSS `fade-in-up` / `scale-in` keyframes.
   */
  emerge: [0.32, 0.72, 0, 1],
  /** Slight overshoot-free settle for exits. */
  exit: [0.4, 0, 1, 1],
  /** Gentle ease-in, for things leaving the screen upward. */
  accelerate: [0.4, 0, 1, 1],
} as const;

/* ── Springs ─────────────────────────────────────────────────────────────── */

/**
 * Tuned by feel, not by defaults:
 *   - `damping / 2 * stiffness` lands near critical damping, so these settle
 *     rather than bounce — bounces read as toy-like.
 *   - `mass` below 1 makes small elements (icons, chips) feel snappy at the same
 *     stiffness that keeps big surfaces from wobbling.
 */
export const spring = {
  /** Press-in on buttons, chips, small toggles. */
  snappy: { type: 'spring', stiffness: 520, damping: 34, mass: 0.7 },
  /** Default for interactive feedback: hover lift, drawer, popover. */
  smooth: { type: 'spring', stiffness: 380, damping: 32, mass: 0.9 },
  /** Large surfaces: sheets, page transitions. Carries momentum deliberately. */
  gentle: { type: 'spring', stiffness: 260, damping: 30, mass: 1.1 },
  /** Layout-shifting reflows (grids reordering, expanding panels). */
  layout: { type: 'spring', stiffness: 300, damping: 34, mass: 1 },
} as const;

/* ── Named transitions ───────────────────────────────────────────────────── */

export const transition = {
  /** Default enter. */
  enter: { duration: duration.base, ease: ease.emerge },
  /** Default exit — faster, no bounce. */
  leave: { duration: duration.fast, ease: ease.exit },
  /** Opacity-only crossfade (never moves layout). */
  crossfade: { duration: duration.fast, ease: ease.standard },
  /** Spring for anything clickable. */
  interactive: spring.smooth,
  /** Reveal on scroll. Slightly slower so it finishes before the eye arrives. */
  reveal: { duration: duration.slow, ease: ease.emerge },
} as const satisfies Record<string, Transition>;

/* ── Distances ───────────────────────────────────────────────────────────── */

export const distance = {
  xs: 4,
  sm: 8,
  md: 14,
  lg: 24,
  xl: 40,
} as const;

/* ── Variants ────────────────────────────────────────────────────────────── */

/** The default reveal: fades up a short distance. Use for page + section content. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: distance.md },
  visible: { opacity: 1, y: 0, transition: transition.enter },
  exit: { opacity: 0, y: -distance.xs, transition: transition.leave },
};

/** Scale-and-fade. For things that feel like they *appear* rather than move. */
export const fadeScale: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: { ...transition.enter, type: 'spring' as const, stiffness: 420, damping: 34, mass: 0.8 } },
  exit: { opacity: 0, scale: 0.98, transition: transition.leave },
};

/** Pure crossfade. For swapping content in place (tabs, route views). */
export const fade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: transition.crossfade },
  exit: { opacity: 0, transition: transition.leave },
};

/**
 * Container that reveals its children one after another.
 *
 * The stagger is expressed as a delay function rather than `staggerChildren`
 * so the delay is *absolute*: the Nth child starts `n × stagger` after the
 * container animates in, regardless of how long any earlier child takes. With
 * `staggerChildren`, one slow child pushes every later one out.
 *
 * Capped by `maxDelay` so a 200-row list doesn't take six seconds to appear —
 * past ~10 items the cascade stops adding information and just adds latency.
 */
export function stagger(options: { delay?: number; stagger?: number } = {}): Variants {
  const { delay = 0, stagger: gap = 0.045 } = options;
  return {
    hidden: {},
    visible: { transition: { staggerChildren: gap, delayChildren: delay } },
    exit: {},
  };
}

/**
 * Absolute-delay stagger. Pair with `<StaggerItem>`.
 * See note in `stagger()` for why we don't use `staggerChildren`.
 */
export function staggerItem(index: number, options: { delay?: number; stagger?: number; maxDelay?: number } = {}) {
  const { delay = 0, stagger: gap = 0.045, maxDelay = 0.45 } = options;
  const offset = Math.min(index * gap, maxDelay);
  return {
    hidden: { opacity: 0, y: distance.sm },
    visible: {
      opacity: 1,
      y: 0,
      transition: { ...transition.enter, delay: delay + offset },
    },
    exit: { opacity: 0, transition: transition.leave },
  } satisfies Variants;
}

/* ── Viewport config ─────────────────────────────────────────────────────── */

/**
 * Shared `whileInView` config. `margin` fires slightly before the element is
 * fully on screen, so the reveal is already finished by the time the user
 * actually looks at it.
 */
export const inView = {
  once: true,
  amount: 0.15,
  margin: '0px 0px -10% 0px',
} as const;

/* ── Direction-aware helper ──────────────────────────────────────────────── */
