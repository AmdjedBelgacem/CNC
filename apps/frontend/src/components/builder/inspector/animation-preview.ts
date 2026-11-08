'use client';

import { create } from 'zustand';
import { animate, motionValue, type AnimationPlaybackControls, type MotionValue } from 'framer-motion';
import {
  cascadeDelay,
  entranceLength,
  entranceStates,
  entranceTransition,
  resolveNodeAnimation,
  type NodeEntrance,
} from '@/lib/builder/node-animation';

/**
 * Plays an element's entrance on the real block in the canvas, from the inspector.
 *
 * It animates the DOM node Puck already rendered, with Framer's motion values. Earlier
 * this mounted a wrapper around the block, and that remount reset the block's state, while pausing
 * unmounted the wrapper and snapped the block straight to its final state. Working on the existing
 * node means no React render is involved, so the canvas stays bare, and the returned controls give
 * a true pause, a scrubbable timeline and playback speed.
 */

export interface PreviewTarget {
  el: HTMLElement;
  entrance: NodeEntrance;
  extraDelay: number;
}

export type PreviewStatus = 'idle' | 'playing' | 'paused';

interface PreviewState {
  nodeId: string | null;
  status: PreviewStatus;
  /** Current position, in seconds. */
  time: number;
  /** Full length of the run, in seconds, delays included. */
  total: number;
  speed: number;
  loop: boolean;
}

const INLINE_PROPS = ['opacity', 'transform', 'filter', 'clip-path', 'transform-origin', 'will-change'];
const LOOP_REST_MS = 450;

let targets: PreviewTarget[] = [];
let controls: AnimationPlaybackControls[] = [];
let direction: 'ltr' | 'rtl' = 'ltr';
/** Bumped on every run, so frames and timers from an older run stop themselves. */
let generation = 0;
let frame = 0;
let restTimer: ReturnType<typeof setTimeout> | null = null;

const totalOf = (list: PreviewTarget[]) =>
  list.reduce((longest, t) => Math.max(longest, t.entrance.delay + t.extraDelay + entranceLength(t.entrance)), 0);

/** Framer's own order, so a transform composes exactly as it does on the public site. */
const TRANSFORM_ORDER: ReadonlyArray<readonly [string, (value: number) => string]> = [
  ['x', (value) => `translateX(${value}px)`],
  ['y', (value) => `translateY(${value}px)`],
  ['scale', (value) => `scale(${value})`],
  ['rotate', (value) => `rotate(${value}deg)`],
  ['rotateX', (value) => `rotateX(${value}deg)`],
];
const PAINT_KEYS = ['opacity', 'filter', 'clipPath'];

/**
 * Starts one target's animation.
 *
 * Framer runs the timing, through a motion value per property, and this writes the styles. Passing
 * the node to `animate` directly does nothing: Framer checks `instanceof Element`, and a node from
 * the canvas iframe belongs to another realm, so it is treated as a plain object and never painted.
 */
function startTarget(target: PreviewTarget, speed: number, reduce: boolean): AnimationPlaybackControls[] {
  const { el, entrance, extraDelay } = target;
  const { hidden, visible } = entranceStates(entrance, direction);
  const transition = entranceTransition(entrance, { extraDelay, reduce }) as Record<string, unknown>;
  const motionTransition = Object.fromEntries(
    Object.entries(transition).filter(([key]) => !PAINT_KEYS.includes(key)),
  );
  const perspective = hidden.transformPerspective;
  const values: Record<string, MotionValue<number | string>> = {};

  const paint = () => {
    const current = (key: string) => values[key]?.get();
    const parts = perspective ? [`perspective(${perspective}px)`] : [];
    for (const [key, format] of TRANSFORM_ORDER) {
      const value = current(key);
      if (typeof value === 'number') parts.push(format(value));
    }
    el.style.transform = parts.join(' ');
    el.style.opacity = String(current('opacity') ?? 1);
    if (values.filter) el.style.filter = String(current('filter'));
    if (values.clipPath) el.style.clipPath = String(current('clipPath'));
  };

  const keys = Object.keys(visible).filter((key) => {
    if (key === 'transformPerspective') return false;
    // Reduced motion drops travel, as `<MotionConfig>` does on the public site.
    return !(reduce && !PAINT_KEYS.includes(key));
  });
  for (const key of keys) {
    const from = hidden[key] as number | string;
    values[key] = motionValue(from);
    values[key].on('change', paint);
  }
  // Paint the start state now, so a delayed entrance waits hidden rather than visible.
  paint();

  return keys.map((key) => {
    const options = (PAINT_KEYS.includes(key) ? transition[key] : motionTransition) as object;
    const run = animate(
      values[key] as MotionValue<number>,
      [hidden[key], visible[key]] as number[],
      options,
    );
    run.speed = speed;
    return run;
  });
}

function startControls(speed: number) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  controls = targets.flatMap((target) => startTarget(target, speed, reduce));
}

/** Lands every value at rest, then hands the node back with no inline styles left on it. */
function releaseNodes() {
  const released = targets;
  controls.forEach((run) => run.complete());
  controls = [];
  requestAnimationFrame(() => {
    if (controls.length) return;
    released.forEach(({ el }) => INLINE_PROPS.forEach((prop) => el.style.removeProperty(prop)));
  });
}

export const useAnimationPreview = create<
  PreviewState & {
    play: (nodeId: string, nextTargets: PreviewTarget[], dir: 'ltr' | 'rtl') => void;
    pause: () => void;
    resume: () => void;
    seek: (time: number) => void;
    setSpeed: (speed: number) => void;
    setLoop: (loop: boolean) => void;
    stop: () => void;
  }
>((set, get) => {
  const clearPending = () => {
    cancelAnimationFrame(frame);
    if (restTimer) clearTimeout(restTimer);
    restTimer = null;
  };

  /** Counts playback on its own clock, so progress survives pausing and speed changes. */
  const runClock = () => {
    const run = generation;
    let last = performance.now();
    const tick = (now: number) => {
      if (run !== generation) return;
      const state = get();
      if (state.status !== 'playing') return;
      const time = state.time + ((now - last) / 1000) * state.speed;
      last = now;
      if (time >= state.total) {
        finish();
        return;
      }
      set({ time });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  };

  const finish = () => {
    const run = generation;
    releaseNodes();
    set((state) => ({ status: 'idle', time: state.total }));
    if (!get().loop) return;
    restTimer = setTimeout(() => {
      if (run !== generation || !get().loop || !targets.length) return;
      begin();
    }, LOOP_REST_MS);
  };

  const begin = () => {
    generation += 1;
    clearPending();
    controls.forEach((run) => run.cancel());
    startControls(get().speed);
    set({ status: 'playing', time: 0, total: totalOf(targets) });
    runClock();
  };

  return {
    nodeId: null,
    status: 'idle',
    time: 0,
    total: 0,
    speed: 1,
    loop: false,
    play: (nodeId, nextTargets, dir) => {
      if (!nextTargets.length) return;
      releaseNodes();
      targets = nextTargets;
      direction = dir;
      set({ nodeId });
      begin();
    },
    pause: () => {
      if (get().status !== 'playing') return;
      generation += 1;
      clearPending();
      controls.forEach((run) => run.pause());
      set({ status: 'paused' });
    },
    resume: () => {
      if (get().status !== 'paused' || !controls.length) return;
      generation += 1;
      controls.forEach((run) => run.play());
      set({ status: 'playing' });
      runClock();
    },
    seek: (time) => {
      if (!targets.length) return;
      generation += 1;
      clearPending();
      // A finished run has released the node, so scrubbing starts a fresh one, held in place.
      if (!controls.length) startControls(get().speed);
      controls.forEach((run) => {
        run.pause();
        run.time = time;
      });
      set({ status: 'paused', time, total: totalOf(targets) });
    },
    setSpeed: (speed) => {
      controls.forEach((run) => {
        run.speed = speed;
      });
      set({ speed });
    },
    setLoop: (loop) => set({ loop }),
    stop: () => {
      generation += 1;
      clearPending();
      releaseNodes();
      targets = [];
      set({ nodeId: null, status: 'idle', time: 0, total: 0 });
    },
  };
});

/**
 * The elements a Play should move: the node itself, or its direct children when it cascades.
 * Returns an empty list when the block renders nothing that can be animated.
 */
export function collectPreviewTargets(
  nodeId: string,
  propsOf: (id: string) => Record<string, unknown> | undefined,
  hasSlots: boolean,
): PreviewTarget[] {
  const frameEl = document.querySelector<HTMLIFrameElement>('iframe#preview-frame');
  const root = frameEl?.contentDocument ?? document;
  const selector = (id: string) => `[data-puck-component="${CSS.escape(id)}"]`;
  const el = root.querySelector<HTMLElement>(selector(nodeId));
  const config = resolveNodeAnimation(propsOf(nodeId) ?? {});
  const entrance = config?.entrance;
  if (!el || !config || !entrance) return [];

  if (hasSlots && config.stagger > 0) {
    const children = Array.from(el.querySelectorAll<HTMLElement>('[data-puck-component]')).filter(
      (child) => child.parentElement?.closest('[data-puck-component]') === el,
    );
    if (children.length) {
      return children.map((child, index) => {
        const id = child.getAttribute('data-puck-component') ?? '';
        const childEntrance = resolveNodeAnimation(propsOf(id) ?? {})?.entrance ?? entrance;
        return { el: child, entrance: childEntrance, extraDelay: cascadeDelay(index, config.stagger) };
      });
    }
  }
  return [{ el, entrance, extraDelay: 0 }];
}
