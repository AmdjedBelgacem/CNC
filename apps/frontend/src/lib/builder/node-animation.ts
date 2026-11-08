import type { Transition, Variants } from 'framer-motion';
import {
  NODE_ANIMATION_EASES,
  NODE_ANIMATION_HOVERS,
  NODE_ANIMATION_LOOPS,
  NODE_ANIMATION_PRESSES,
  NODE_ANIMATION_RANGES,
  NODE_ANIMATION_TYPES,
  type NodeAnimationEase,
  type NodeAnimationHover,
  type NodeAnimationLoop,
  type NodeAnimationPress,
  type NodeAnimationRangeKey,
  type NodeAnimationType,
} from '@titan/shared';
import { ease as easeTokens, spring as springTokens } from '@/lib/motion';

/**
 * Pure animation logic for builder nodes: flat `anim*` props in, Framer Motion values out.
 *
 * The public site, the canvas preview and the inspector's stage and timeline all read from here,
 * so what the admin tunes is what the visitor gets. Nothing in this file touches React or the DOM.
 */

type Direction = 'ltr' | 'rtl';
type Bezier = readonly [number, number, number, number];

interface EntrancePreset {
  /** Axis the element travels along. `x` is logical: it mirrors in RTL. */
  axis?: 'x' | 'y';
  /** Which side it starts on: y+ is below, x- is the inline start. */
  sign?: 1 | -1;
  distance?: number;
  scale?: number;
  rotate?: number;
  blur?: number;
  flip?: boolean;
  wipe?: 'up' | 'start';
}

const ENTRANCE_PRESETS: Record<Exclude<NodeAnimationType, 'none'>, EntrancePreset> = {
  fade: {},
  fadeUp: { axis: 'y', sign: 1, distance: 14 },
  fadeDown: { axis: 'y', sign: -1, distance: 14 },
  scaleIn: { scale: 0.96 },
  fadeScale: { scale: 0.96 },
  slideStart: { axis: 'x', sign: -1, distance: 14 },
  slideEnd: { axis: 'x', sign: 1, distance: 14 },
  blurIn: { blur: 8 },
  blurUp: { axis: 'y', sign: 1, distance: 14, blur: 10 },
  zoomIn: { scale: 0.8 },
  zoomOut: { scale: 1.12 },
  rotateIn: { axis: 'y', sign: 1, distance: 14, rotate: -6 },
  flipUp: { axis: 'y', sign: 1, distance: 14, flip: true },
  wipeUp: { wipe: 'up' },
  wipeStart: { wipe: 'start' },
};

/** Tween curves. Anything not listed here is a spring. */
const TWEEN_CURVES: Partial<Record<NodeAnimationEase, Bezier | 'linear'>> = {
  smooth: easeTokens.emerge,
  easeOut: [0.16, 1, 0.3, 1],
  easeInOut: [0.65, 0, 0.35, 1],
  linear: 'linear',
  overshoot: [0.34, 1.56, 0.64, 1],
};

const SPRING_PRESETS: Partial<
  Record<NodeAnimationEase, { stiffness: number; damping: number; mass: number }>
> = {
  soft: { stiffness: springTokens.soft.stiffness, damping: springTokens.soft.damping, mass: springTokens.soft.mass },
  snappy: { stiffness: springTokens.snappy.stiffness, damping: springTokens.snappy.damping, mass: springTokens.snappy.mass },
  bouncy: { stiffness: 300, damping: 14, mass: 1 },
};

export function isSpringEase(ease: unknown): boolean {
  return typeof ease === 'string' && ease in SPRING_PRESETS;
}

export interface NodeEntrance {
  type: Exclude<NodeAnimationType, 'none'>;
  axis?: 'x' | 'y';
  sign: 1 | -1;
  distance: number;
  scale: number;
  rotate: number;
  blur: number;
  fromOpacity: number;
  flip: boolean;
  wipe?: 'up' | 'start';
  delay: number;
  duration: number;
  ease: NodeAnimationEase;
  spring: { stiffness: number; damping: number; mass: number } | null;
}

export interface NodeAnimationConfig {
  entrance: NodeEntrance | null;
  /** True when the entrance waits for load rather than for the element to scroll into view. */
  onLoad: boolean;
  repeat: boolean;
  viewAmount: number;
  stagger: number;
  hover: NodeAnimationHover;
  press: NodeAnimationPress;
  loop: NodeAnimationLoop;
  loopDuration: number;
  loopAmount: number;
}

function ranged(key: NodeAnimationRangeKey, value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const { min, max } = NODE_ANIMATION_RANGES[key];
  return Math.min(max, Math.max(min, value));
}

function oneOf<T extends string>(options: readonly T[], value: unknown, fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

/** Returns null when the node has nothing to animate, so untouched blocks render bare. */
export function resolveNodeAnimation(props: Record<string, unknown>): NodeAnimationConfig | null {
  const config = readNodeAnimation(props);
  const idle = !config.entrance && config.hover === 'none' && config.press === 'none' && config.loop === 'none';
  return idle ? null : config;
}

/** Normalizes raw node props: unknown values fall back, and numbers are clamped to their range. */
export function readNodeAnimation(props: Record<string, unknown>): NodeAnimationConfig {
  const type = oneOf(NODE_ANIMATION_TYPES, props.animType, 'none');
  const hover = oneOf(NODE_ANIMATION_HOVERS, props.animHover, 'none');
  const press = oneOf(NODE_ANIMATION_PRESSES, props.animPress, 'none');
  const loop = oneOf(NODE_ANIMATION_LOOPS, props.animLoop, 'none');

  let entrance: NodeEntrance | null = null;
  if (type !== 'none') {
    const preset = ENTRANCE_PRESETS[type];
    const ease = oneOf(NODE_ANIMATION_EASES, props.animEase, 'smooth');
    const springPreset = SPRING_PRESETS[ease];
    entrance = {
      type,
      axis: preset.axis,
      sign: preset.sign ?? 1,
      distance: ranged('animDistance', props.animDistance, preset.distance ?? 0),
      scale: ranged('animScale', props.animScale, preset.scale ?? 1),
      rotate: ranged('animRotate', props.animRotate, preset.rotate ?? 0),
      blur: ranged('animBlur', props.animBlur, preset.blur ?? 0),
      fromOpacity: ranged('animFromOpacity', props.animFromOpacity, 0),
      flip: preset.flip === true,
      wipe: preset.wipe,
      delay: ranged('animDelay', props.animDelay, 0),
      duration: ranged('animDuration', props.animDuration, 0.45),
      ease,
      spring: springPreset
        ? {
            stiffness: ranged('animStiffness', props.animStiffness, springPreset.stiffness),
            damping: ranged('animDamping', props.animDamping, springPreset.damping),
            mass: ranged('animMass', props.animMass, springPreset.mass),
          }
        : null,
    };
  }

  return {
    entrance,
    onLoad: props.animTrigger === 'load',
    repeat: props.animRepeat === true,
    viewAmount: ranged('animViewAmount', props.animViewAmount, 0.15),
    stagger: ranged('animStagger', props.animStagger, 0),
    hover,
    press,
    loop,
    loopDuration: ranged('animLoopDuration', props.animLoopDuration, 3),
    loopAmount: ranged('animLoopAmount', props.animLoopAmount, 1),
  };
}

/* ── Curves ──────────────────────────────────────────────────────────────── */

/** Position of a spring released from rest at 0 toward 1, `t` seconds in. */
export function springPosition(
  { stiffness, damping, mass }: { stiffness: number; damping: number; mass: number },
  t: number,
): number {
  const w0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    const decay = Math.exp(-zeta * w0 * t);
    return 1 - decay * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
  }
  if (zeta === 1) return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
  const root = w0 * Math.sqrt(zeta * zeta - 1);
  const r1 = -zeta * w0 + root;
  const r2 = -zeta * w0 - root;
  return 1 + (r2 * Math.exp(r1 * t) - r1 * Math.exp(r2 * t)) / (r1 - r2);
}

/** Seconds until a spring stays within 1% of its target. */
export function springSettleTime(spring: { stiffness: number; damping: number; mass: number }): number {
  const step = 1 / 120;
  const limit = 10;
  let settled = 0;
  for (let t = 0; t <= limit; t += step) {
    if (Math.abs(1 - springPosition(spring, t)) > 0.01) settled = t + step;
  }
  return Math.min(limit, settled);
}

function bezierAt([x1, y1, x2, y2]: Bezier, x: number): number {
  const sample = (a: number, b: number, t: number) =>
    3 * a * t * (1 - t) ** 2 + 3 * b * t ** 2 * (1 - t) + t ** 3;
  let low = 0;
  let high = 1;
  let t = x;
  for (let i = 0; i < 24; i += 1) {
    const current = sample(x1, x2, t);
    if (Math.abs(current - x) < 1e-4) break;
    if (current < x) low = t;
    else high = t;
    t = (low + high) / 2;
  }
  return sample(y1, y2, t);
}

/** Running time of an entrance, excluding its delay. */
export function entranceLength(entrance: NodeEntrance): number {
  return entrance.spring ? springSettleTime(entrance.spring) : entrance.duration;
}

/** Evenly spaced progress samples across the entrance, for the inspector's curve graph. */
export function entranceCurve(entrance: NodeEntrance, samples = 48): number[] {
  const length = entranceLength(entrance);
  const curve = TWEEN_CURVES[entrance.ease];
  return Array.from({ length: samples + 1 }, (_, index) => {
    const x = index / samples;
    if (entrance.spring) return springPosition(entrance.spring, x * length);
    return curve && curve !== 'linear' ? bezierAt(curve, x) : x;
  });
}

/* ── Framer Motion output ────────────────────────────────────────────────── */

const FADE_CURVE: Bezier = easeTokens.emerge;

/**
 * The transition for an entrance.
 *
 * Transforms take the chosen curve or spring, while opacity, blur and clip always take a plain
 * tween. A bouncy spring or overshoot curve runs past its target, which is correct for a position
 * but would mean a negative blur or an invalid clip. Reduced motion makes blur and clip instant,
 * because `<MotionConfig>` only strips transforms.
 */
export function entranceTransition(
  entrance: NodeEntrance,
  { extraDelay = 0, reduce = false }: { extraDelay?: number; reduce?: boolean } = {},
): Transition {
  const delay = entrance.delay + extraDelay;
  const curve = TWEEN_CURVES[entrance.ease];
  const motion: Transition = entrance.spring
    ? { type: 'spring', ...entrance.spring, delay }
    : { type: 'tween', duration: entrance.duration, ease: curve as unknown as number[], delay };
  const fadeLength = entrance.spring ? Math.min(0.6, springSettleTime(entrance.spring) * 0.6) : entrance.duration;
  const paint = { type: 'tween' as const, duration: fadeLength, ease: FADE_CURVE as unknown as number[], delay };
  const opacity = entrance.ease === 'linear' ? { ...paint, ease: 'linear' as const } : paint;
  const decorative = reduce ? { duration: 0, delay } : opacity;
  return { ...motion, opacity, filter: decorative, clipPath: decorative } as Transition;
}

/** The two end states of an entrance, as plain style values. */
export function entranceStates(
  entrance: NodeEntrance,
  dir: Direction,
): { hidden: Record<string, number | string>; visible: Record<string, number | string> } {
  const mirror = dir === 'rtl' ? -1 : 1;
  const hidden: Record<string, number | string> = { opacity: entrance.fromOpacity };
  const visible: Record<string, number | string> = { opacity: 1 };
  const add = (key: string, from: number | string, to: number | string) => {
    hidden[key] = from;
    visible[key] = to;
  };
  if (entrance.axis === 'y' && entrance.distance) add('y', entrance.sign * entrance.distance, 0);
  if (entrance.axis === 'x' && entrance.distance) add('x', entrance.sign * entrance.distance * mirror, 0);
  if (entrance.scale !== 1) add('scale', entrance.scale, 1);
  if (entrance.rotate) add('rotate', entrance.rotate * mirror, 0);
  if (entrance.flip) {
    add('rotateX', 60, 0);
    add('transformPerspective', 800, 800);
  }
  if (entrance.blur) add('filter', `blur(${entrance.blur}px)`, 'blur(0px)');
  if (entrance.wipe) {
    const start = dir === 'rtl' ? 'inset(0% 0% 0% 100%)' : 'inset(0% 100% 0% 0%)';
    add('clipPath', entrance.wipe === 'up' ? 'inset(100% 0% 0% 0%)' : start, 'inset(0% 0% 0% 0%)');
  }
  return { hidden, visible };
}

/**
 * Variants for an entrance.
 *
 * `hidden` resets instantly, so an element that replays each time it enters the viewport never
 * animates backwards while on its way out. `transitionEnd` drops the finished filter and clip,
 * since leaving them on would trap fixed descendants and cut off shadows.
 */
export function entranceVariants(
  entrance: NodeEntrance,
  options: { dir: Direction; extraDelay?: number; reduce?: boolean },
): Variants {
  const { hidden, visible } = entranceStates(entrance, options.dir);
  const transitionEnd: Record<string, string> = {};
  if ('filter' in visible) transitionEnd.filter = 'none';
  if ('clipPath' in visible) transitionEnd.clipPath = 'none';
  return {
    hidden: { ...hidden, transition: { duration: 0 } },
    visible: {
      ...visible,
      transition: entranceTransition(entrance, options),
      ...(Object.keys(transitionEnd).length ? { transitionEnd } : {}),
    },
  } as Variants;
}

/** The longest a cascade may hold back a child: past this, it only adds latency. */
export const CASCADE_MAX_DELAY = 1.2;

export function cascadeDelay(index: number, gap: number): number {
  return Math.min(Math.max(0, index) * gap, CASCADE_MAX_DELAY);
}

const HOVER_TARGETS: Record<Exclude<NodeAnimationHover, 'none'>, Record<string, number>> = {
  lift: { y: -4 },
  grow: { scale: 1.03 },
  shrink: { scale: 0.98 },
  tilt: { rotate: -1 },
};

const PRESS_TARGETS: Record<Exclude<NodeAnimationPress, 'none'>, Record<string, number>> = {
  press: { scale: 0.98 },
  deep: { scale: 0.94 },
};

export function hoverTarget(config: NodeAnimationConfig, dir: Direction) {
  if (config.hover === 'none') return undefined;
  const target = HOVER_TARGETS[config.hover];
  const mirrored = target.rotate !== undefined && dir === 'rtl' ? { rotate: -target.rotate } : target;
  return { ...mirrored, transition: springTokens.smooth };
}

export function pressTarget(config: NodeAnimationConfig) {
  if (config.press === 'none') return undefined;
  return { ...PRESS_TARGETS[config.press], transition: springTokens.snappy };
}

/** Keyframes for a continuous loop, or null when the node has none. */
export function loopMotion(config: NodeAnimationConfig): {
  animate: Record<string, number[]>;
  rest: Record<string, number>;
  transition: Transition;
} | null {
  const { loop, loopAmount: amount, loopDuration: duration } = config;
  if (loop === 'none') return null;
  if (loop === 'spin') {
    return {
      animate: { rotate: [0, 360] },
      rest: { rotate: 0 },
      transition: { duration, repeat: Infinity, ease: 'linear' },
    };
  }
  const keyframes: Record<Exclude<NodeAnimationLoop, 'none' | 'spin'>, Record<string, number[]>> = {
    float: { y: [0, -8 * amount] },
    pulse: { scale: [1, 1 + 0.03 * amount] },
    sway: { rotate: [-2 * amount, 2 * amount] },
    breathe: { opacity: [1, Math.max(0.2, 1 - 0.25 * amount)] },
  };
  const animate = keyframes[loop];
  const rest = Object.fromEntries(
    Object.entries(animate).map(([key]) => [key, key === 'opacity' || key === 'scale' ? 1 : 0]),
  );
  return {
    animate,
    rest,
    // A mirrored loop runs out and back, so one authored cycle is two segments.
    transition: { duration: duration / 2, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' },
  };
}
