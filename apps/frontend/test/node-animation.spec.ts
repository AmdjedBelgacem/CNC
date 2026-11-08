import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  NODE_ANIMATION_EASES,
  NODE_ANIMATION_RANGES,
  NODE_ANIMATION_SCHEMA_SHAPE,
  NODE_ANIMATION_TYPES,
  getBlockDefinition,
} from '@titan/shared';
import {
  CASCADE_MAX_DELAY,
  cascadeDelay,
  entranceCurve,
  entranceStates,
  entranceTransition,
  entranceVariants,
  loopMotion,
  readNodeAnimation,
  resolveNodeAnimation,
  springPosition,
  springSettleTime,
  type NodeEntrance,
} from '../src/lib/builder/node-animation';

const entranceOf = (props: Record<string, unknown>): NodeEntrance => {
  const entrance = readNodeAnimation(props).entrance;
  if (!entrance) throw new Error('expected an entrance');
  return entrance;
};
const source = (path: string) => readFileSync(resolve(__dirname, '../src', path), 'utf8');

describe('reading node props', () => {
  it('leaves untouched nodes with nothing to animate, so they render bare', () => {
    expect(resolveNodeAnimation({})).toBeNull();
    expect(resolveNodeAnimation({ animType: 'none', animDelay: 1, animEase: 'soft' })).toBeNull();
  });

  it('keeps layouts saved with the original props working', () => {
    const entrance = entranceOf({ animType: 'fadeUp', animDelay: 0.2, animDuration: 0.6, animEase: 'smooth' });
    expect(entrance).toMatchObject({ axis: 'y', distance: 14, delay: 0.2, duration: 0.6, spring: null });
  });

  it('falls back on unknown values and clamps out-of-range numbers', () => {
    expect(resolveNodeAnimation({ animType: 'explode' })).toBeNull();
    const entrance = entranceOf({ animType: 'fade', animEase: 'nope', animDelay: 99, animDuration: 'x' });
    expect(entrance.ease).toBe('smooth');
    expect(entrance.delay).toBe(NODE_ANIMATION_RANGES.animDelay.max);
    expect(entrance.duration).toBe(0.45);
  });

  it('uses the preset value until an override is set', () => {
    expect(entranceOf({ animType: 'zoomIn' }).scale).toBe(0.8);
    expect(entranceOf({ animType: 'zoomIn', animScale: 0.6 }).scale).toBe(0.6);
    expect(entranceOf({ animType: 'fadeUp', animEase: 'soft' }).spring?.stiffness).toBe(210);
    expect(entranceOf({ animType: 'fadeUp', animEase: 'soft', animStiffness: 400 }).spring?.stiffness).toBe(400);
  });

  it('has a working preset for every type and ease the schema accepts', () => {
    for (const type of NODE_ANIMATION_TYPES) {
      if (type === 'none') continue;
      for (const ease of NODE_ANIMATION_EASES) {
        const entrance = entranceOf({ animType: type, animEase: ease });
        const { hidden, visible } = entranceStates(entrance, 'ltr');
        expect(hidden.opacity).toBe(0);
        expect(visible.opacity).toBe(1);
        expect(Object.keys(hidden).sort()).toEqual(Object.keys(visible).sort());
      }
    }
  });
});

describe('direction', () => {
  it('starts "slide from start" at the inline start, in both directions', () => {
    const entrance = entranceOf({ animType: 'slideStart' });
    expect(entranceStates(entrance, 'ltr').hidden.x).toBeLessThan(0);
    expect(entranceStates(entrance, 'rtl').hidden.x).toBeGreaterThan(0);
  });

  it('starts "slide from end" at the inline end, in both directions', () => {
    const entrance = entranceOf({ animType: 'slideEnd' });
    expect(entranceStates(entrance, 'ltr').hidden.x).toBeGreaterThan(0);
    expect(entranceStates(entrance, 'rtl').hidden.x).toBeLessThan(0);
  });

  it('wipes from the inline start in both directions', () => {
    const entrance = entranceOf({ animType: 'wipeStart' });
    expect(entranceStates(entrance, 'ltr').hidden.clipPath).toBe('inset(0% 100% 0% 0%)');
    expect(entranceStates(entrance, 'rtl').hidden.clipPath).toBe('inset(0% 0% 0% 100%)');
  });
});

describe('transitions', () => {
  it('gives a tween entrance the chosen duration, with no leftover spring type', () => {
    const transition = entranceTransition(entranceOf({ animType: 'scaleIn', animDuration: 1.2 })) as Record<string, unknown>;
    expect(transition.type).toBe('tween');
    expect(transition.duration).toBe(1.2);
  });

  it('never runs opacity, blur or clip on a spring, which would overshoot past valid values', () => {
    const transition = entranceTransition(entranceOf({ animType: 'blurUp', animEase: 'bouncy' })) as Record<string, Record<string, unknown>>;
    expect((transition as unknown as { type: string }).type).toBe('spring');
    for (const key of ['opacity', 'filter', 'clipPath']) expect(transition[key]?.type).toBe('tween');
  });

  it('carries the delay onto the per-property transitions too', () => {
    const transition = entranceTransition(entranceOf({ animType: 'fade', animDelay: 0.5 }), { extraDelay: 0.2 }) as Record<string, Record<string, unknown>>;
    expect(transition.opacity?.delay).toBeCloseTo(0.7);
    expect(transition.filter?.delay).toBeCloseTo(0.7);
  });

  it('makes blur and clip instant under reduced motion, while opacity still fades', () => {
    const transition = entranceTransition(entranceOf({ animType: 'blurIn' }), { reduce: true }) as Record<string, Record<string, unknown>>;
    expect(transition.filter?.duration).toBe(0);
    expect(transition.opacity?.duration).toBeGreaterThan(0);
  });

  it('resets the hidden state instantly, so a repeating entrance never plays backwards', () => {
    const variants = entranceVariants(entranceOf({ animType: 'fadeUp' }), { dir: 'ltr' });
    expect((variants.hidden as { transition: { duration: number } }).transition.duration).toBe(0);
  });

  it('drops a finished filter and clip, which would trap fixed children and cut off shadows', () => {
    const blur = entranceVariants(entranceOf({ animType: 'blurIn' }), { dir: 'ltr' });
    expect((blur.visible as { transitionEnd: object }).transitionEnd).toEqual({ filter: 'none' });
    const wipe = entranceVariants(entranceOf({ animType: 'wipeUp' }), { dir: 'ltr' });
    expect((wipe.visible as { transitionEnd: object }).transitionEnd).toEqual({ clipPath: 'none' });
  });

  it('models springs: a bouncy one overshoots and a critically damped one does not', () => {
    const bouncy = entranceCurve(entranceOf({ animType: 'fade', animEase: 'bouncy' }));
    expect(Math.max(...bouncy)).toBeGreaterThan(1.05);
    const settled = { stiffness: 100, damping: 20, mass: 1 };
    expect(springPosition(settled, 0)).toBeCloseTo(0);
    expect(springPosition(settled, springSettleTime(settled))).toBeCloseTo(1, 1);
  });

  it('caps a cascade, so a long list does not keep its last items waiting', () => {
    expect(cascadeDelay(2, 0.1)).toBeCloseTo(0.2);
    expect(cascadeDelay(500, 0.1)).toBe(CASCADE_MAX_DELAY);
  });

  it('builds every loop, and only then', () => {
    expect(loopMotion(readNodeAnimation({}))).toBeNull();
    for (const loop of ['float', 'pulse', 'sway', 'breathe', 'spin']) {
      expect(loopMotion(readNodeAnimation({ animLoop: loop }))?.transition).toMatchObject({ repeat: Infinity });
    }
  });
});

describe('schema', () => {
  it('rides on every block, so new props survive save and the JSON inspector', () => {
    const shape = (getBlockDefinition('heading')?.schema as unknown as { shape: Record<string, unknown> }).shape;
    for (const key of Object.keys(NODE_ANIMATION_SCHEMA_SHAPE)) expect(shape[key]).toBeDefined();
  });

  it('rejects values outside the shared ranges', () => {
    expect(NODE_ANIMATION_SCHEMA_SHAPE.animDistance.safeParse(200).success).toBe(true);
    expect(NODE_ANIMATION_SCHEMA_SHAPE.animDistance.safeParse(201).success).toBe(false);
    expect(NODE_ANIMATION_SCHEMA_SHAPE.animType.safeParse('wipeUp').success).toBe(true);
    expect(NODE_ANIMATION_SCHEMA_SHAPE.animType.safeParse('explode').success).toBe(false);
  });
});

describe('content can never stay invisible', () => {
  const runtime = source('components/builder/animation.tsx');

  it('reveals when the observer never reports, or does not exist', () => {
    expect(runtime).toMatch(/if \(!reported\) setShown\(true\)/);
    expect(runtime).toMatch(/typeof IntersectionObserver === 'undefined'/);
  });

  it('does not ask a tall element to meet a threshold it cannot reach', () => {
    expect(runtime).toMatch(/const tall = entry\.boundingClientRect\.height > viewportHeight/);
  });

  it('is forced visible when scripting is off', () => {
    expect(runtime).toMatch(/'node-anim'/);
    expect(source('styles/globals.css')).toMatch(/@media \(scripting: none\)[\s\S]*\.node-anim\s*\{/);
  });
});

describe('the mechanism matches what the admin previews', () => {
  it('does not stack the default reveal on a block with its own entrance', () => {
    expect(source('components/builder/block-renderer.tsx')).toMatch(
      /resolveNodeAnimation\(mergeBlockProps\(node\.type, node\.props\)\)\?\.entrance/,
    );
  });

  it('lifts the canvas motion guard for the eye preview, which would strip every transform', () => {
    expect(source('lib/builder/puck-config.tsx')).toMatch(/unlockMotion/);
  });

  it('plays on the existing canvas node, so no render or remount is involved', () => {
    const config = source('lib/builder/puck-config.tsx');
    expect(config).not.toMatch(/PlaybackRunner|useAnimPlayback/);
    expect(source('components/builder/inspector/animation-preview.ts')).toMatch(/data-puck-component/);
  });
});
