'use client';
import * as React from 'react';
import { m, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ease } from '@/lib/motion';

export function Progress({
  value = 0,
  max = 100,
  className,
  barClassName,
  label,
}: {
  value?: number;
  max?: number;
  className?: string;
  barClassName?: string;
  label?: string;
}) {
  const reduce = useReducedMotion();
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-muted', className)}
    >
      <m.div
        className={cn('h-full rounded-full bg-primary', barClassName)}
        // Animated rather than a `transition-[width]`: a CSS width transition
        // restarts from 0 every time the bar remounts (route change, list
        // refetch, tab switch), so the same 40% would visibly re-count up.
        // framer-motion seeds the keyframe from the currently painted width, so
        // an unchanged value stays still.
        initial={reduce ? false : { width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={reduce ? { duration: 0 } : { duration: 0.7, ease: ease.emerge }}
      />
    </div>
  );
}

/** Circular progress used on course/learning cards. */
export function ProgressRing({
  value = 0,
  size = 44,
  strokeWidth = 4,
  className,
  children,
}: {
  value?: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  children?: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const pct = Math.min(100, Math.max(0, value));
  const r = (size - strokeWidth) / 2;
  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-muted"
        />
        {/* `pathLength` normalises the dash maths to 1, so the arc is driven by
            a plain 0–1 value instead of recomputing the circumference on every
            size change. */}
        <m.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          pathLength={1}
          initial={reduce ? false : { strokeDasharray: 1, strokeDashoffset: 1 }}
          animate={{ strokeDasharray: 1, strokeDashoffset: 1 - pct / 100 }}
          transition={reduce ? { duration: 0 } : { duration: 0.9, ease: ease.emerge }}
          className="stroke-primary"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-2xs font-semibold tabular-nums text-foreground">
        {children ?? `${Math.round(pct)}%`}
      </span>
    </div>
  );
}
