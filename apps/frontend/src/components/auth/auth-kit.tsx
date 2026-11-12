'use client';

/**
 * Shared building blocks for the `/(auth)` screens — Ivory & Clay.
 *
 * Every auth screen is the same shape: a quiet eyebrow, a serif greeting, a
 * muted subtitle, a short form, and (often) a terminal state that replaces the
 * form. Keeping those pieces here means login/register/reset/2FA/verify all
 * move and read identically instead of drifting screen by screen.
 */

import * as React from 'react';
import { AnimatePresence, m } from 'framer-motion';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { Input, type InputProps } from '@/components/ui/input';
import { Button, type ButtonProps } from '@/components/ui/button';
import { distance, ease, transition } from '@/lib/motion';
import { cn } from '@/lib/utils';

/* ── Heading ─────────────────────────────────────────────────────────────── */

export function AuthHeading({
  eyebrow,
  title,
  subtitle,
  align = 'start',
  icon,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  align?: 'start' | 'center';
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-8', align === 'center' && 'text-center', className)}>
      {icon && <div className={cn('mb-5', align === 'center' && 'flex justify-center')}>{icon}</div>}
      {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
      <h1 className="text-balance font-display text-[30px] font-medium leading-[1.12] tracking-[-0.022em] text-foreground sm:text-[34px]">
        {title}
      </h1>
      {subtitle && (
        <div className="mt-2.5 text-[15px] leading-relaxed text-muted-foreground">{subtitle}</div>
      )}
    </div>
  );
}

/* ── Fields ──────────────────────────────────────────────────────────────── */

export function AuthField({
  id,
  label,
  aside,
  children,
  className,
  labelClassName,
}: {
  id: string;
  label: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  labelClassName?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className={cn('text-sm font-medium text-foreground', labelClassName)}>
          {label}
        </label>
        {aside}
      </div>
      {children}
    </div>
  );
}

export const AuthInput = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <Input ref={ref} className={cn('h-11 rounded-lg px-3.5 text-[15px] sm:text-sm', className)} {...props} />
  ),
);
AuthInput.displayName = 'AuthInput';

export function AuthSubmit({ className, ...props }: ButtonProps) {
  return <Button size="lg" className={cn('h-11 w-full text-[15px] sm:text-sm', className)} {...props} />;
}

/* ── Inline alert (animated in / out) ────────────────────────────────────── */

export function AuthAlert({
  show,
  tone = 'error',
  children,
  id,
}: {
  show: boolean;
  tone?: 'error' | 'success' | 'info';
  children?: React.ReactNode;
  id?: string;
}) {
  const toneClass =
    tone === 'error'
      ? 'border-destructive/25 bg-destructive/[0.06] text-destructive'
      : tone === 'success'
        ? 'border-success/25 bg-success/[0.07] text-success'
        : 'border-info/25 bg-info/[0.07] text-info';
  const Icon = tone === 'success' ? CheckCircle2 : AlertCircle;
  return (
    <AnimatePresence initial={false}>
      {show && (
        <m.div
          key="alert"
          id={id}
          role={tone === 'error' ? 'alert' : 'status'}
          initial={{ opacity: 0, height: 0, y: -distance.xs }}
          animate={{ opacity: 1, height: 'auto', y: 0, transition: transition.enter }}
          exit={{ opacity: 0, height: 0, transition: transition.leave }}
          className="overflow-hidden"
        >
          <m.div
            initial={{ x: 0 }}
            animate={tone === 'error' ? { x: [0, -5, 4, -2, 0] } : { x: 0 }}
            transition={{ duration: 0.36, ease: ease.standard }}
            className={cn(
              'flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm leading-snug',
              toneClass,
            )}
          >
            <Icon className="mt-px size-4 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1">{children}</div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}

/* ── Status badge (springy terminal-state glyph) ─────────────────────────── */

export function AuthStatusIcon({
  tone = 'success',
  children,
}: {
  tone?: 'success' | 'primary' | 'error';
  children: React.ReactNode;
}) {
  const ring =
    tone === 'success'
      ? 'bg-success/10 text-success ring-success/20'
      : tone === 'error'
        ? 'bg-destructive/10 text-destructive ring-destructive/20'
        : 'bg-primary/10 text-primary ring-primary/20';
  return (
    <m.div
      initial={{ scale: 0.6, opacity: 0, rotate: -8 }}
      animate={{ scale: 1, opacity: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 18, mass: 0.8 }}
      className={cn('relative mx-auto flex size-14 items-center justify-center rounded-full ring-1', ring)}
    >
      {tone !== 'error' && (
        <m.span
          aria-hidden
          className={cn('absolute inset-0 rounded-full ring-1', ring)}
          initial={{ scale: 1, opacity: 0.6 }}
          animate={{ scale: 1.7, opacity: 0 }}
          transition={{ duration: 1.1, ease: ease.emerge, delay: 0.1 }}
        />
      )}
      {children}
    </m.div>
  );
}

/** Animated check stroke — draws itself after the badge lands. */
export function DrawnCheck({ className }: { className?: string }) {
  return (
    <svg className={cn('size-7', className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <m.path
        d="M5 13l4 4L19 7"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.45, ease: ease.emerge, delay: 0.18 }}
      />
    </svg>
  );
}

/** Centered terminal state (success / sent / error) that replaces a form. */
export function AuthStatus({
  icon,
  title,
  children,
  className,
}: {
  icon: React.ReactNode;
  title: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex h-full flex-col items-center justify-center text-center', className)}>
      {icon}
      <m.div
        initial={{ opacity: 0, y: distance.sm }}
        animate={{ opacity: 1, y: 0, transition: { ...transition.enter, delay: 0.08 } }}
        className="mt-6 w-full"
      >
        <h1 className="text-balance font-display text-[28px] font-medium leading-[1.15] tracking-[-0.02em] text-foreground">
          {title}
        </h1>
        {children}
      </m.div>
    </div>
  );
}

/* ── Divider & small links ───────────────────────────────────────────────── */

export function AuthDivider({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative my-7 flex items-center gap-3" role="separator">
      <span className="h-px flex-1 bg-border/80" aria-hidden />
      <span className="text-xs font-medium text-muted-foreground">{children}</span>
      <span className="h-px flex-1 bg-border/80" aria-hidden />
    </div>
  );
}

export const authLinkClass =
  'font-medium text-primary underline-offset-4 transition-colors duration-150 hover:text-primary/80 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm';

export function AuthNote({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'w-full rounded-xl border border-border/70 bg-muted/50 px-4 py-3 text-[13px] leading-relaxed text-muted-foreground',
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ── Google ──────────────────────────────────────────────────────────────── */

export function GoogleButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      onClick={onClick}
      className="h-11 w-full gap-3 text-[15px] font-medium sm:text-sm"
    >
      <svg className="size-4" viewBox="0 0 24 24" aria-hidden>
        <path
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
          fill="#4285F4"
        />
        <path
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          fill="#34A853"
        />
        <path
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          fill="#FBBC05"
        />
        <path
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          fill="#EA4335"
        />
      </svg>
      Google
    </Button>
  );
}

/* ── Step container (form ↔ terminal state) ──────────────────────────────── */

/**
 * Swaps between steps of a flow (form → sent, code → recovery). Uses a short
 * vertical travel + fade so the card feels like it's turning a page rather
 * than sliding a carousel.
 */
export function AuthSteps({ step, children }: { step: React.Key; children: React.ReactNode }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <m.div
        key={step}
        initial={{ opacity: 0, y: distance.md, filter: 'blur(2px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)', transition: transition.enter }}
        exit={{ opacity: 0, y: -distance.sm, filter: 'blur(2px)', transition: transition.leave }}
        className="flex h-full flex-col justify-center"
      >
        {children}
      </m.div>
    </AnimatePresence>
  );
}

/* ── Sign in / create account switch ─────────────────────────────────────── */

/**
 * The two-segment switch at the top of the sign-in and create-account screens. They are separate
 * routes, so these are links (with `aria-current`), not tabs that hide panels.
 */
export function AuthModeSwitch({
  active,
  signInLabel,
  createLabel,
  query,
}: {
  active: 'signin' | 'create';
  signInLabel: string;
  createLabel: string;
  /** Carried across so a returnUrl survives switching modes. */
  query?: string;
}) {
  const item = (mode: 'signin' | 'create', href: string, label: string) => (
    <Link
      href={query ? `${href}?${query}` : href}
      aria-current={active === mode ? 'page' : undefined}
      className={cn(
        'flex min-h-10 items-center justify-center rounded-[10px] text-sm transition-colors',
        active === mode
          ? 'bg-foreground/10 font-semibold text-foreground shadow-xs'
          : 'font-medium text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label={`${signInLabel} / ${createLabel}`} className="mb-7 grid grid-cols-2 rounded-[14px] border border-border/70 bg-card p-1">
      {item('signin', '/login', signInLabel)}
      {item('create', '/register', createLabel)}
    </nav>
  );
}

/* ── Password with reveal ────────────────────────────────────────────────── */

export const AuthPasswordInput = React.forwardRef<
  HTMLInputElement,
  InputProps & { showLabel: string; hideLabel: string }
>(({ className, showLabel, hideLabel, ...props }, ref) => {
  const [visible, setVisible] = React.useState(false);
  return (
    <div className="relative">
      <AuthInput ref={ref} {...props} type={visible ? 'text' : 'password'} className={cn('pe-12', className)} />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? hideLabel : showLabel}
        aria-pressed={visible}
        className="absolute end-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
    </div>
  );
});
AuthPasswordInput.displayName = 'AuthPasswordInput';
