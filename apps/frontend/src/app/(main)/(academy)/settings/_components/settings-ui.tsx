'use client';

import type { ButtonHTMLAttributes, ElementType, ReactNode } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { Reveal } from '@/components/ui/motion';
import { spring, transition } from '@/lib/motion';
import { cn } from '@/lib/utils';

/* ─────────────────────────────────────────────────────────────────────────────
 * Ivory & Clay building blocks shared by every settings page.
 *
 * Local to the settings route so the pages read the same without reaching into
 * the shared `ui/*` primitives. Everything here is presentational: no data, no
 * handlers beyond what callers pass in.
 * ───────────────────────────────────────────────────────────────────────────── */

/** Page header: serif title, muted lede, optional trailing action. */
export function SettingsHeader({
  icon: Icon,
  title,
  subtitle,
  action,
  className,
}: {
  icon?: ElementType;
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start gap-4', className)}>
      {Icon && (
        <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="size-[18px]" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-balance font-display text-2xl font-medium tracking-[-0.02em] text-foreground sm:text-[1.75rem]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1.5 max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** A titled card. Header sits on paper, body on white — hairline between. */
export function SettingsSection({
  icon: Icon,
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
  tone = 'default',
  delay = 0,
  id,
}: {
  icon?: ElementType;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
  tone?: 'default' | 'danger';
  delay?: number;
  id?: string;
}) {
  return (
    <Reveal
      as="section"
      delay={delay}
      id={id}
      className={cn(
        'overflow-hidden rounded-xl border bg-card shadow-xs',
        tone === 'danger' ? 'border-destructive/25' : 'border-border/70',
        className,
      )}
    >
      <div className="flex items-start gap-3 px-6 pb-4 pt-5">
        {Icon && (
          <span
            className={cn(
              'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg',
              tone === 'danger'
                ? 'bg-destructive/10 text-destructive'
                : 'bg-muted text-muted-foreground',
            )}
          >
            <Icon className="size-4" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-medium leading-snug tracking-[-0.012em] text-foreground">
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children !== undefined && (
        <div className={cn('border-t border-border/60 px-6 py-5', bodyClassName)}>{children}</div>
      )}
    </Reveal>
  );
}

/** Label + hint on the start side, a control (usually a Switch) on the end. */
export function SettingsRow({
  icon: Icon,
  title,
  description,
  control,
  className,
}: {
  icon?: ElementType;
  title: ReactNode;
  description?: ReactNode;
  control: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-muted/30',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" />}
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{title}</p>
          {description && (
            <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

const BANNER_TONES = {
  success: 'border-success/25 bg-success/10 text-success',
  error: 'border-destructive/25 bg-destructive/10 text-destructive',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  info: 'border-info/25 bg-info/10 text-info',
} as const;

/** Inline status line that animates in and out with its condition. */
export function SettingsBanner({
  show,
  tone,
  icon: Icon,
  children,
  role,
  className,
}: {
  show: boolean;
  tone: keyof typeof BANNER_TONES;
  icon?: ElementType;
  children: ReactNode;
  role?: 'alert' | 'status';
  className?: string;
}) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <m.div
          role={role}
          initial={{ opacity: 0, y: -6, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto', transition: transition.enter }}
          exit={{ opacity: 0, y: -4, height: 0, transition: transition.leave }}
          className="overflow-hidden"
        >
          <div
            className={cn(
              'flex gap-2.5 rounded-xl border px-4 py-3 text-sm',
              BANNER_TONES[tone],
              className,
            )}
          >
            {Icon && <Icon className="mt-0.5 size-4 shrink-0" />}
            <div className="min-w-0 flex-1">{children}</div>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
}

/** Floating save bar pinned to the bottom of the viewport while scrolling. */
export function SettingsSaveBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <m.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0, transition: spring.gentle }}
      className={cn(
        'sticky bottom-4 z-20 mt-6 flex items-center justify-end gap-3 rounded-xl border border-border/70 bg-card px-4 py-3 shadow-lg',
        className,
      )}
    >
      {children}
    </m.div>
  );
}

/** Segmented choice tile with a sliding selection ring (shared `layoutId`). */
export function ChoiceTile({
  active,
  onSelect,
  layoutId,
  children,
  className,
  ...rest
}: {
  active: boolean;
  onSelect: () => void;
  layoutId: string;
  children: ReactNode;
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'children' | 'className'>) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={cn(
        'group relative rounded-xl border p-3 text-start transition-[border-color,background-color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        active
          ? 'border-transparent bg-card shadow-sm'
          : 'border-border/70 bg-card hover:border-border-strong hover:shadow-sm',
        className,
      )}
      {...rest}
    >
      {active && (
        <m.span
          layoutId={layoutId}
          transition={spring.smooth}
          aria-hidden
          className="pointer-events-none absolute -inset-px rounded-xl border-2 border-primary"
        />
      )}
      {children}
    </button>
  );
}
