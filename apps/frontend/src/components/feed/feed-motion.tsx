'use client';

/**
 * Small motion primitives shared by the social surfaces (feed, comments,
 * profile, notifications, groups, events). Kept local to this scope rather
 * than in `components/ui` so the shared primitives stay lean.
 */

import * as React from 'react';
import { AnimatePresence, m, useReducedMotion, type HTMLMotionProps } from 'framer-motion';
import { duration, ease, spring } from '@/lib/motion';
import { cn } from '@/lib/utils';

/* ── Sliding active pill / underline ─────────────────────────────────────── */

/**
 * The absolutely positioned highlight behind the active item of a segmented
 * control. Render it *inside* the active button (which must be `relative`) with
 * the same `layoutId` for every item in the group and it glides between them.
 */
export function ActivePill({
  layoutId,
  className,
}: {
  layoutId: string;
  className?: string;
}) {
  return (
    <m.span
      aria-hidden
      layoutId={layoutId}
      transition={spring.smooth}
      className={cn('absolute inset-0 rounded-full bg-card shadow-xs ring-1 ring-border/60', className)}
    />
  );
}

/* ── Springy icon button (votes, reactions) ──────────────────────────────── */

export interface SpringButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  /** When this flips to true the icon gives a short celebratory pop. */
  active?: boolean;
  children: React.ReactNode;
}

/**
 * A button that squashes on press and pops when it becomes active — the
 * "satisfying" feel for votes and reactions. The pop is keyed on `active` so it
 * only plays on the transition into the active state, never on mount.
 */
export const SpringButton = React.forwardRef<HTMLButtonElement, SpringButtonProps>(
  function SpringButton({ active = false, children, disabled, ...rest }, ref) {
    const reduce = useReducedMotion();
    const mounted = React.useRef(false);
    const [popKey, setPopKey] = React.useState(0);

    React.useEffect(() => {
      if (!mounted.current) {
        mounted.current = true;
        return;
      }
      if (active) setPopKey((k) => k + 1);
    }, [active]);

    return (
      <m.button
        ref={ref}
        disabled={disabled}
        whileTap={disabled || reduce ? undefined : { scale: 0.8 }}
        transition={spring.snappy}
        {...rest}
      >
        <m.span
          key={popKey}
          className="inline-flex"
          initial={popKey > 0 && !reduce ? { scale: 0.6 } : false}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 600, damping: 14, mass: 0.6 }}
        >
          {children}
        </m.span>
      </m.button>
    );
  },
);

/* ── Rolling number (score changes) ──────────────────────────────────────── */

/**
 * A number that rolls up or down when it changes, like an odometer digit.
 * Renders the plain value on first paint.
 */
export function RollingNumber({
  value,
  className,
  ...rest
}: { value: number; className?: string } & Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'>) {
  const previous = React.useRef(value);
  const direction = value >= previous.current ? 1 : -1;
  React.useEffect(() => {
    previous.current = value;
  }, [value]);

  return (
    <span className={cn('relative inline-flex overflow-hidden tabular-nums', className)} {...rest}>
      <AnimatePresence mode="popLayout" initial={false}>
        <m.span
          key={value}
          initial={{ y: direction * 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1, transition: spring.snappy }}
          exit={{ y: direction * -10, opacity: 0, transition: { duration: duration.instant, ease: ease.exit } }}
          className="inline-block"
        >
          {value}
        </m.span>
      </AnimatePresence>
    </span>
  );
}

/* ── Height collapse (threads, accordions) ───────────────────────────────── */

/**
 * Expands / collapses its children with a height + fade. Use for comment
 * threads and other inline disclosures.
 */
export function Collapse({
  open,
  children,
  className,
  initial = false,
}: {
  open: boolean;
  children: React.ReactNode;
  className?: string;
  /** Animate on first mount when already open. */
  initial?: boolean;
}) {
  return (
    <AnimatePresence initial={initial}>
      {open && (
        <m.div
          key="collapse"
          initial={{ height: 0, opacity: 0 }}
          animate={{
            height: 'auto',
            opacity: 1,
            transition: { height: spring.layout, opacity: { duration: duration.fast, delay: 0.05 } },
          }}
          exit={{
            height: 0,
            opacity: 0,
            transition: { height: { duration: duration.fast, ease: ease.exit }, opacity: { duration: duration.instant } },
          }}
          className={cn('overflow-hidden', className)}
        >
          {children}
        </m.div>
      )}
    </AnimatePresence>
  );
}

/* ── Fade-in-place for inline messages ───────────────────────────────────── */

export function FadeSlot({
  show,
  children,
  className,
}: {
  show: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <m.div
          key="slot"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0, transition: { duration: duration.fast, ease: ease.emerge } }}
          exit={{ opacity: 0, y: -4, transition: { duration: duration.instant, ease: ease.exit } }}
          className={className}
        >
          {children}
        </m.div>
      )}
    </AnimatePresence>
  );
}
