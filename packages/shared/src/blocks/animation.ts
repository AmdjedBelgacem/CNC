import { z } from 'zod';

/**
 * Per-element animation model, stored as flat `anim*` props on every builder node.
 *
 * Every prop is optional. `none` is the default, so existing layouts and untouched elements
 * never move, and layouts saved with the original six props keep working unchanged.
 *
 * The "start state" props (`animDistance`, `animScale`, `animRotate`, `animBlur`) and the spring
 * props have no defaults on purpose: unset means "use the value of the chosen preset", so
 * switching preset never leaves a stale number behind.
 */
export const NODE_ANIMATION_TYPES = [
  'none',
  'fade',
  'fadeUp',
  'fadeDown',
  'scaleIn',
  'slideStart',
  'slideEnd',
  /** Same motion as `scaleIn`. Valid for saved layouts, but no longer offered in the picker. */
  'fadeScale',
  'blurIn',
  'blurUp',
  'zoomIn',
  'zoomOut',
  'rotateIn',
  'flipUp',
  'wipeUp',
  'wipeStart',
] as const;
export type NodeAnimationType = (typeof NODE_ANIMATION_TYPES)[number];

/** Motion feel: tween curves first, then spring presets. */
export const NODE_ANIMATION_EASES = [
  'smooth',
  'easeOut',
  'easeInOut',
  'linear',
  'overshoot',
  'soft',
  'snappy',
  'bouncy',
] as const;
export type NodeAnimationEase = (typeof NODE_ANIMATION_EASES)[number];

export const NODE_ANIMATION_TRIGGERS = ['view', 'load'] as const;
export type NodeAnimationTrigger = (typeof NODE_ANIMATION_TRIGGERS)[number];

export const NODE_ANIMATION_HOVERS = ['none', 'lift', 'grow', 'shrink', 'tilt'] as const;
export type NodeAnimationHover = (typeof NODE_ANIMATION_HOVERS)[number];

export const NODE_ANIMATION_PRESSES = ['none', 'press', 'deep'] as const;
export type NodeAnimationPress = (typeof NODE_ANIMATION_PRESSES)[number];

export const NODE_ANIMATION_LOOPS = ['none', 'float', 'pulse', 'sway', 'breathe', 'spin'] as const;
export type NodeAnimationLoop = (typeof NODE_ANIMATION_LOOPS)[number];

/** Limits shared by the schema, the runtime clamp and the inspector sliders. */
export const NODE_ANIMATION_RANGES = {
  animDelay: { min: 0, max: 2, step: 0.05 },
  animDuration: { min: 0.05, max: 3, step: 0.05 },
  animDistance: { min: 0, max: 200, step: 2 },
  animScale: { min: 0.5, max: 1.5, step: 0.01 },
  animRotate: { min: -45, max: 45, step: 1 },
  animBlur: { min: 0, max: 30, step: 1 },
  animFromOpacity: { min: 0, max: 1, step: 0.05 },
  animStiffness: { min: 30, max: 800, step: 10 },
  animDamping: { min: 5, max: 100, step: 1 },
  animMass: { min: 0.2, max: 3, step: 0.1 },
  animViewAmount: { min: 0, max: 0.75, step: 0.05 },
  animStagger: { min: 0, max: 0.5, step: 0.01 },
  animLoopDuration: { min: 0.5, max: 12, step: 0.1 },
  animLoopAmount: { min: 0.25, max: 3, step: 0.05 },
} as const;
export type NodeAnimationRangeKey = keyof typeof NODE_ANIMATION_RANGES;

export const NODE_ANIMATION_DEFAULTS: Record<string, unknown> = {
  animType: 'none',
  animDelay: 0,
  animDuration: 0.45,
  animEase: 'smooth',
  animFromOpacity: 0,
  animTrigger: 'view',
  animRepeat: false,
  animViewAmount: 0.15,
  animStagger: 0,
  animHover: 'none',
  animPress: 'none',
  animLoop: 'none',
  animLoopDuration: 3,
  animLoopAmount: 1,
};

const ranged = (key: NodeAnimationRangeKey) =>
  z.number().min(NODE_ANIMATION_RANGES[key].min).max(NODE_ANIMATION_RANGES[key].max).optional();

/**
 * Zod shape shared by every block schema, so animation props survive the JSON inspector's apply
 * (which validates against the block schema) and any server-side layout validation.
 */
export const NODE_ANIMATION_SCHEMA_SHAPE = {
  animType: z.enum(NODE_ANIMATION_TYPES).optional(),
  animDelay: ranged('animDelay'),
  animDuration: ranged('animDuration'),
  animEase: z.enum(NODE_ANIMATION_EASES).optional(),
  animDistance: ranged('animDistance'),
  animScale: ranged('animScale'),
  animRotate: ranged('animRotate'),
  animBlur: ranged('animBlur'),
  animFromOpacity: ranged('animFromOpacity'),
  animStiffness: ranged('animStiffness'),
  animDamping: ranged('animDamping'),
  animMass: ranged('animMass'),
  animTrigger: z.enum(NODE_ANIMATION_TRIGGERS).optional(),
  animRepeat: z.boolean().optional(),
  animViewAmount: ranged('animViewAmount'),
  animStagger: ranged('animStagger'),
  animHover: z.enum(NODE_ANIMATION_HOVERS).optional(),
  animPress: z.enum(NODE_ANIMATION_PRESSES).optional(),
  animLoop: z.enum(NODE_ANIMATION_LOOPS).optional(),
  animLoopDuration: ranged('animLoopDuration'),
  animLoopAmount: ranged('animLoopAmount'),
};

/** Every prop the animation system owns: what copy, paste and reset operate on. */
export const NODE_ANIMATION_PROP_KEYS = Object.keys(NODE_ANIMATION_SCHEMA_SHAPE) as ReadonlyArray<
  keyof typeof NODE_ANIMATION_SCHEMA_SHAPE
>;
