'use client';

import * as React from 'react';
import { useLocale } from 'next-intl';
import { m, MotionConfig, useInView, useReducedMotion, useReducedMotionConfig } from 'framer-motion';
import { coerceLocale, dirFor } from '@/i18n/config';
import {
  cascadeDelay,
  entranceVariants,
  hoverTarget,
  loopMotion,
  pressTarget,
  resolveNodeAnimation,
  type NodeAnimationConfig,
  type NodeEntrance,
} from '@/lib/builder/node-animation';

/**
 * Runtime for the per-element animation authored in the builder inspector.
 *
 *   - public site: plays as authored
 *   - builder preview (eye toggle): plays as authored, with `unlockMotion` lifting the canvas's
 *     reducedMotion="always" guard, which would otherwise strip every transform
 *   - builder edit canvas: renders bare, so the canvas stays a 1:1, selectable copy of the final
 *     layout. The inspector's Play button animates the existing DOM node instead of remounting
 *     it (see `inspector/animation-preview.ts`).
 *
 * Reduced motion: `<MotionConfig>` strips transforms, `entranceTransition` makes blur and clip
 * instant, and loops are skipped. Opacity still fades, so content arrives gracefully.
 */

interface CascadeValue {
  entrance: NodeEntrance;
  gap: number;
  /** The parent's own trigger settings, inherited along with its entrance. */
  config: NodeAnimationConfig;
}

const CascadeContext = React.createContext<CascadeValue | null>(null);

/**
 * Reports when an element reaches the viewport.
 *
 * This replaces `whileInView` for two failure modes that leave content invisible for good. A
 * threshold can be impossible to meet on an element much taller than the screen, so a tall element
 * fires as soon as it appears. And if the observer never reports at all, the element is revealed
 * rather than left at opacity 0.
 */
function useEntersView(
  ref: React.RefObject<HTMLElement | null>,
  { enabled, amount, once }: { enabled: boolean; amount: number; once: boolean },
): boolean {
  const [shown, setShown] = React.useState(!enabled);

  React.useEffect(() => {
    const el = ref.current;
    if (!enabled) {
      setShown(true);
      return;
    }
    if (!el || typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    let reported = false;
    const failsafe = setTimeout(() => {
      if (!reported) setShown(true);
    }, 1500);
    const thresholds = Array.from({ length: 21 }, (_, index) => index / 20);
    const observer = new IntersectionObserver(
      (entries) => {
        reported = true;
        const entry = entries[entries.length - 1];
        if (!entry) return;
        const viewportHeight = el.ownerDocument.defaultView?.innerHeight ?? Infinity;
        const tall = entry.boundingClientRect.height > viewportHeight;
        const hit = entry.isIntersecting && (tall || entry.intersectionRatio >= amount);
        if (hit) {
          setShown(true);
          if (once) observer.disconnect();
        } else if (!once && !entry.isIntersecting) {
          setShown(false);
        }
      },
      { threshold: thresholds },
    );
    observer.observe(el);
    return () => {
      clearTimeout(failsafe);
      observer.disconnect();
    };
  }, [ref, enabled, amount, once]);

  return shown;
}

/** Continuous motion on its own layer, so it never fights the entrance or hover transform. */
export function LoopLayer({ config, children }: { config: NodeAnimationConfig; children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const reduce = useReducedMotionConfig();
  // Stops off screen, so a long page is not running animations nobody can see.
  const inView = useInView(ref);
  const motion = loopMotion(config);
  if (!motion || reduce) return <>{children}</>;
  return (
    <m.div
      ref={ref}
      animate={inView ? motion.animate : motion.rest}
      transition={inView ? motion.transition : { duration: 0.3 }}
    >
      {children}
    </m.div>
  );
}

function AnimatedNode({
  config,
  index,
  hasSlots,
  children,
}: {
  config: NodeAnimationConfig | null;
  index: number;
  hasSlots: boolean;
  children: React.ReactNode;
}) {
  const parent = React.useContext(CascadeContext);
  const dir = dirFor(coerceLocale(useLocale()));
  const reduce = useReducedMotionConfig() === true;
  const ref = React.useRef<HTMLDivElement>(null);

  // A cascading container hands its entrance to its children and holds still itself. Animating
  // both would stack the transforms and move each child further than authored.
  const own = config?.entrance ?? null;
  const cascades = Boolean(config && own && hasSlots && config.stagger > 0);
  const entrance = cascades ? null : (own ?? parent?.entrance ?? null);
  const timing = own ? config : (parent?.config ?? config);
  const shown = useEntersView(ref, {
    enabled: entrance !== null && timing?.onLoad !== true,
    amount: timing?.viewAmount ?? 0.15,
    once: timing?.repeat !== true,
  });

  const variants = React.useMemo(
    () =>
      entrance
        ? entranceVariants(entrance, {
            dir,
            reduce,
            extraDelay: parent ? cascadeDelay(index, parent.gap) : 0,
          })
        : undefined,
    [entrance, dir, reduce, parent, index],
  );

  const cascadeValue = React.useMemo<CascadeValue | null>(
    () => (cascades && config && own ? { entrance: own, gap: config.stagger, config } : null),
    [cascades, config, own],
  );

  const whileHover = config ? hoverTarget(config, dir) : undefined;
  const whileTap = config ? pressTarget(config) : undefined;
  const hasLoop = config !== null && config.loop !== 'none';
  const content = hasLoop && config ? <LoopLayer config={config}>{children}</LoopLayer> : children;
  // Always reset the context, so a cascade only ever reaches its direct children.
  const scoped = <CascadeContext.Provider value={cascadeValue}>{content}</CascadeContext.Provider>;

  if (!variants && !whileHover && !whileTap) return scoped;
  return (
    <m.div
      ref={ref}
      // `node-anim` is what lets globals.css force this visible when scripting is off.
      className={variants ? 'node-anim' : undefined}
      variants={variants}
      initial={variants ? 'hidden' : false}
      animate={variants ? (shown ? 'visible' : 'hidden') : undefined}
      whileHover={whileHover}
      whileTap={whileTap}
    >
      {scoped}
    </m.div>
  );
}

export interface NodeAnimationProps {
  /** The node's merged props. The `anim*` keys are read from here. */
  animProps: Record<string, unknown>;
  /** False in the builder edit canvas: children render with no wrapper. */
  active?: boolean;
  /** Position among the node's siblings, used when its parent cascades. */
  index?: number;
  /** Whether this block has slots, and so has children a cascade can reach. */
  hasSlots?: boolean;
  /** Lifts the builder canvas's motion guard for this subtree (eye preview). */
  unlockMotion?: boolean;
  children: React.ReactNode;
}

function UnlockedMotion({ children }: { children: React.ReactNode }) {
  // `useReducedMotion` reads the system setting directly, not the canvas guard above it.
  const prefersReduced = useReducedMotion();
  return <MotionConfig reducedMotion={prefersReduced ? 'user' : 'never'}>{children}</MotionConfig>;
}

export function NodeAnimation({
  animProps,
  active = true,
  index = 0,
  hasSlots = false,
  unlockMotion = false,
  children,
}: NodeAnimationProps) {
  const parent = React.useContext(CascadeContext);
  const config = React.useMemo(() => resolveNodeAnimation(animProps), [animProps]);
  if (!active || (!config && !parent)) return <>{children}</>;
  const node = (
    <AnimatedNode config={config} index={index} hasSlots={hasSlots}>
      {children}
    </AnimatedNode>
  );
  return unlockMotion ? <UnlockedMotion>{node}</UnlockedMotion> : node;
}
