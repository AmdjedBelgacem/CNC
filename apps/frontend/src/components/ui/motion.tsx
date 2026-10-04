'use client';

import * as React from 'react';
import {
  AnimatePresence,
  m,
  useReducedMotion,
  useScroll,
  useSpring,
  type HTMLMotionProps,
  type Variants,
} from 'framer-motion';
import {
  distance,
  duration,
  ease,
  fadeScale,
  inView,
  spring,
  stagger,
  staggerItem,
  transition,
} from '@/lib/motion';
import { cn } from '@/lib/utils';

/**
 * Props shared by every wrapper here.
 *
 * `style` is excluded deliberately: MotionStyle allows MotionValues, which a
 * plain `<div>` fallback (the reduced-motion branch of most components) cannot
 * accept. None of these wrappers need a caller-supplied style — they manage
 * transform themselves. Components that do want a style prop should extend
 * `React.ComponentProps<'div'>` directly and cast at the motion boundary.
 */
type MotionDivProps = Omit<HTMLMotionProps<'div'>, 'style' | 'children'> & {
  children: React.ReactNode;
};

/* ═══════════════════════════════════════════════════════════════════════════
 * Reveal — content that animates in when it enters the viewport
 * ═══════════════════════════════════════════════════════════════════════════ */

export type RevealDirection = 'up' | 'down' | 'start' | 'end' | 'none';

export interface RevealProps extends MotionDivProps {
  /** Which edge the content travels from. `none` = pure crossfade. */
  from?: RevealDirection;
  /** Seconds to wait before starting. */
  delay?: number;
  /** Animate again every time it scrolls back into view. Off by default. */
  repeat?: boolean;
  /** Render as a different element. */
  as?: 'div' | 'section' | 'article' | 'li' | 'span' | 'header' | 'footer' | 'main' | 'ul';
}

const DIRECTION_OFFSET: Record<Exclude<RevealDirection, 'none'>, Record<string, number>> = {
  up: { y: distance.md },
  down: { y: -distance.md },
  start: { x: distance.md },
  end: { x: -distance.md },
};

/**
 * Fades + slides content into place the first time it scrolls into view.
 *
 * `useReducedMotion` collapses `from` to an opacity-only fade rather than
 * dropping the animation entirely, so content still arrives gracefully instead
 * of popping in at full opacity with no transition at all.
 */
export function Reveal({
  children,
  from = 'up',
  delay = 0,
  repeat = false,
  className,
  as = 'div',
  ...rest
}: RevealProps) {
  const Tag = m[as] as typeof m.div;

  // Deliberately NOT branching these variants on `useReducedMotion()`.
  // Framer Motion renders `initial`'s variant out as an inline style during SSR,
  // and the server cannot know the preference — so it writes
  // `opacity:0; transform:translateY(14px)` while a reduced-motion client
  // renders `opacity:0`, which React reports as a hydration mismatch. On every
  // page containing a Reveal, but only for reduced-motion users.
  // `<MotionConfig>` in the root layout drops the transform after mount instead,
  // where it can't desynchronise the markup.
  const offset = from === 'none' ? {} : DIRECTION_OFFSET[from];
  const variants: Variants = {
    hidden: { opacity: 0, ...offset },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: { ...transition.reveal, delay },
    },
  };

  return (
    <Tag
      // `motion-reveal` is a marker only — no styles attached in the default
      // case. It exists so globals.css can force these elements visible when
      // scripting is disabled; see the note on `.motion-reveal` there.
      className={cn('motion-reveal', className)}
      variants={variants}
      initial="hidden"
      whileInView="visible"
      viewport={repeat ? { amount: inView.amount } : { once: inView.once, amount: inView.amount, margin: inView.margin }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Stagger / StaggerItem — lists and grids that cascade in
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface StaggerProps extends MotionDivProps {
  /** Seconds between successive items. */
  gap?: number;
  /** Seconds before the cascade begins. */
  delay?: number;
  /** Cap on the accumulated delay — keeps long lists from crawling. */
  maxDelay?: number;
  /** Animate on scroll into view rather than on mount. */
  inViewOnly?: boolean;
  as?: 'div' | 'ul' | 'ol' | 'section';
}

interface StaggerConfig {
  gap: number;
  delay: number;
  maxDelay: number;
}

/**
 * Published by `<Stagger>` so `<StaggerItem>` can inherit the cascade settings.
 *
 * This exists because the per-item delay is *absolute* (see `staggerItem`), not
 * relative to the previous sibling — which is what stops one slow item from
 * pushing the rest of the cascade out. An absolute delay can't be expressed with
 * `staggerChildren` on the parent, so the parent has no timing to own; it only
 * owns the numbers, and the items each compute their own offset from `index`.
 *
 * Without this, every item in a 40-card grid would need the same `gap` and
 * `maxDelay` props spelled out — one config to change in two places is one
 * config to forget.
 */
const StaggerContext = React.createContext<StaggerConfig | null>(null);

/**
 * Parent for a cascading list. Pair with `<StaggerItem>`.
 *
 * `maxDelay` caps the accumulated offset: past ~10 items the cascade stops
 * adding information and just adds latency, so a 200-row list doesn't take six
 * seconds to finish appearing.
 */
export function Stagger({
  children,
  gap = 0.045,
  delay = 0,
  maxDelay = 0.45,
  inViewOnly = false,
  className,
  as = 'div',
  ...rest
}: StaggerProps) {
  const Tag = m[as] as typeof m.div;
  const viewport = inViewOnly
    ? { once: inView.once, amount: inView.amount, margin: inView.margin }
    : undefined;

  const config = React.useMemo(() => ({ gap, delay, maxDelay }), [gap, delay, maxDelay]);

  return (
    <StaggerContext.Provider value={config}>
      <Tag
        className={className}
        variants={stagger({ delay, stagger: gap })}
        initial="hidden"
        {...(inViewOnly ? { whileInView: 'visible', viewport } : { animate: 'visible' })}
        {...rest}
      >
        {children}
      </Tag>
    </StaggerContext.Provider>
  );
}

export interface StaggerItemProps extends MotionDivProps {
  /** Position in the cascade. */
  index?: number;
  /** Override the parent's cascade settings. */
  gap?: number;
  delay?: number;
  maxDelay?: number;
  /** Scale in instead of sliding up. */
  scale?: boolean;
  as?: 'div' | 'li' | 'article' | 'section' | 'span';
}

/**
 * One item inside a `<Stagger>`.
 *
 * Inherits `gap` / `delay` / `maxDelay` from the nearest parent, so the usual
 * call is just `<StaggerItem index={i}>`.
 *
 * Items carry their own `initial`/`animate` rather than inheriting the parent's
 * variant labels, because their delays are absolute. The parent still declares
 * the labels so that a *nested* `Stagger` composes correctly.
 */
export function StaggerItem({
  children,
  index = 0,
  gap,
  delay,
  maxDelay,
  scale = false,
  className,
  as = 'div',
  ...rest
}: StaggerItemProps) {
  const Tag = m[as] as typeof m.div;
  const inherited = React.useContext(StaggerContext);
  const config = {
    gap: gap ?? inherited?.gap ?? 0.045,
    delay: delay ?? inherited?.delay ?? 0,
    maxDelay: maxDelay ?? inherited?.maxDelay ?? 0.45,
  };
  const variants = scale ? fadeScale : staggerItem(index, config);

  return (
    <Tag
      className={cn('motion-reveal', className)}
      variants={variants}
      initial="hidden"
      animate="visible"
      exit="exit"
      {...rest}
    >
      {children}
    </Tag>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Hover / Press — tactile feedback for anything clickable
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface HoverLiftProps extends MotionDivProps {
  /** Pixels to rise on hover. */
  lift?: number;
  /** Slight grow toward the pointer. Cards use a fraction of this. */
  scale?: number;
  /** Match the elevation shadow on hover via this class hook. */
  as?: 'div' | 'article' | 'li' | 'section' | 'a' | 'button' | 'span';
}
export interface PressScaleProps extends MotionDivProps {
  /** How far it shrinks on press. */
  amount?: number;
  as?: 'div' | 'button' | 'a' | 'span';
}

/**
 * Press-in only — no hover lift. For elements that sit on a moving surface
 * (carousel slides, swipeable rows) where lifting reads as a glitch.
 */
export function PressScale({
  children,
  amount = 0.96,
  className,
  as = 'button',
  ...rest
}: PressScaleProps) {
  const Tag = m[as] as typeof m.div;
  return (
    <Tag
      className={className}
      whileTap={{ scale: amount }}
      transition={spring.snappy}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/**
 * `useReducedMotion()`, but safe to branch *render output* on.
 *
 * The built-in hook returns `false` during SSR and the first client render —
 * there is no media query on the server — and flips to the real value on the
 * next tick. So `if (reduced) return null` renders nothing on the server and
 * something on the client: a hydration mismatch that reproduces *only* for
 * users who have asked for reduced motion, which is precisely the population
 * least likely to be covered by normal QA.
 *
 * This version starts `false` and settles after mount, so server and first
 * client render always agree.
 *
 * Use this when the value decides *what markup exists*. For animating
 * properties — `initial`, `animate`, `exit` — prefer `useReducedMotion()`
 * directly: framer-motion never writes those to the DOM, so there's no mismatch
 * to avoid, and skipping the first-frame animation is the desired behaviour.
 */
export function useHasReducedMotion(): boolean {
  const reduced = useReducedMotion();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  return mounted && reduced === true;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Presence helpers — mount/unmount animation
 * ═══════════════════════════════════════════════════════════════════════════ */

export { AnimatePresence };
/* ═══════════════════════════════════════════════════════════════════════════
 * Crossfade — swap content in place (tabs, route views, step flows)
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface CrossfadeProps extends MotionDivProps {
  /** Changing this value triggers the transition. */
  value: React.Key;
  /** Direction-aware slide instead of a crossfade. */
  axis?: 'x' | 'y' | 'none';
  distance?: number;
}
/* ═══════════════════════════════════════════════════════════════════════════
 * AnimatedNumber — values that count up rather than snapping
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface AnimatedNumberProps {
  value: number;
  /** Render function for the final, formatted output. */
  format?: (value: number) => string;
  durationSeconds?: number;
  className?: string;
  /** Re-run the animation each time the value changes. Off by default. */
  animateOnChange?: boolean;
}
/* ═══════════════════════════════════════════════════════════════════════════
 * ProgressBar — width driven by motion, not by CSS transitions
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface MotionProgressProps {
  /** 0–100. */
  value: number;
  className?: string;
  trackClassName?: string;
  /** Seconds to travel. */
  durationSeconds?: number;
  /** Pause the shimmer sweep while the bar is in flight. */
  striped?: boolean;
}
/* ═══════════════════════════════════════════════════════════════════════════
 * Parallax — depth on scroll, driven by the compositor
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface ParallaxProps extends MotionDivProps {
  /** Pixels travelled across the full scroll range. Negative scrolls up. */
  offset?: number;
}
/* ═══════════════════════════════════════════════════════════════════════════
 * Scroll progress bar
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface ScrollProgressProps {
  className?: string;
  /** Thickness in px. */
  height?: number;
  /** `horizontal` is the default reading-progress bar; `vertical` suits a side rail. */
  orientation?: 'horizontal' | 'vertical';
}

/**
 * Reading-progress indicator. Driven by the shared scroll timeline, so it's
 * always in sync with the compositor's scroll position rather than trailing it.
 */
export function ScrollProgress({
  className,
  height = 2,
  orientation = 'horizontal',
}: ScrollProgressProps) {
  // A decorative scroll indicator is exactly the kind of continuous motion
  // reduced-motion users are asking not to see, so it is suppressed entirely —
  // via `useHasReducedMotion` so the server and client agree on whether the
  // element exists.
  const reduce = useHasReducedMotion();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 220, damping: 34, mass: 0.4 });

  if (reduce) return null;

  return (
    <m.div
      aria-hidden
      className={cn(
        'fixed z-50 bg-primary',
        orientation === 'horizontal'
          ? 'inset-x-0 top-0 origin-left'
          : 'inset-y-0 end-0 origin-top',
        className,
      )}
      style={{
        ...(orientation === 'horizontal'
          ? { height, scaleX }
          : { width: height, scaleY: scaleX }),
      }}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Layout helpers
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Opts an element into layout animation.
 *
 * Use when content *reorders* — filtered grids, sortable lists. Framer measures
 * siblings before and after the change and tweens them, which `transition-all`
 * cannot do correctly.
 */
export function LayoutBox({
  children,
  className,
  ...rest
}: MotionDivProps) {
  return (
    <m.div layout="position" className={className} transition={spring.layout} {...rest}>
      {children}
    </m.div>
  );
}
/* ── Re-exports so there's exactly one motion import path ────────────────── */

export { m, duration, ease, spring, transition, distance, stagger, staggerItem, inView };
export type { Variants, HTMLMotionProps };