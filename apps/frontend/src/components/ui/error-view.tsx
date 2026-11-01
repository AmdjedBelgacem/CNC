'use client';

import * as React from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Home, RefreshCw, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { spring, transition } from '@/lib/motion';
import { cn } from '@/lib/utils';

/**
 * Error presentation shared by `error.tsx` boundaries.
 *
 * ── Why the digest is shown, but the message isn't ──
 * Next.js deliberately redacts server error text from the client bundle in
 * production: `error.message` on a server-thrown error is `"An error occurred in
 * the Server Components render..."` with the real cause replaced by a digest
 * that only exists in the server log. Rendering `error.message` therefore shows
 * the user a useless generic string while hiding the one thing that can help
 * them — the digest, which correlates with the log entry. So: digest in
 * monospace, message only when it's actually specific (client-side throws).
 *
 * ── Why recovery is the primary action ──
 * A route-level error boundary in this app almost always means a fetch to the
 * backend failed or timed out. Reloading is the action with the highest chance
 * of success, so it gets the primary button.
 */

// No component here branches on `useReducedMotion()`: `initial` values are
// written as inline styles during SSR, and the server cannot know the user's
// preference, so a reduced-motion client would render different markup and
// React would report a hydration mismatch. `<MotionConfig>` drops the transform
// animations after mount instead.

export interface ErrorViewProps {
  error: Error & { digest?: string };
  /** Re-renders the failed subtree. */
  reset: () => void;
  /** Absent when rendered from `global-error.tsx`, where the root layout is gone. */
  showHome?: boolean;
  title?: string;
  className?: string;
}

/** A message is only worth showing when it's more specific than Next's default. */
function isSpecificMessage(message: string): boolean {
  return (
    message.length > 0 &&
    message.length < 300 &&
    !/^An error occurred in the Server Components render/i.test(message) &&
    !/^An error occurred in the Client Components render/i.test(message) &&
    !/digest/i.test(message)
  );
}

export function ErrorView({
  error,
  reset,
  showHome = true,
  title,
  className,
}: ErrorViewProps) {
  const t = useTranslations('ui.errorView');
  const heading = title ?? t('defaultTitle');
  const router = useRouter();
  const [reloading, setReloading] = React.useState(false);
  const [attempt, setAttempt] = React.useState(0);

  // A retry that fails again resets the button so the user isn't locked into a
  // state where clicking does nothing visible.
  const handleRetry = React.useCallback(() => {
    setReloading(true);
    setAttempt((n) => n + 1);
    // Give the spinner a frame to paint before the potentially-blocking work.
    requestAnimationFrame(() => {
      reset();
      router.refresh();
    });
    setTimeout(() => setReloading(false), 1200);
  }, [reset, router]);

  return (
    <div
      role="alert"
      className={cn('relative flex min-h-[60vh] items-center justify-center px-4 py-20', className)}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 blueprint-grid opacity-60 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_65%)]"
      />
      <m.div
        // `key` re-runs the entrance on every retry, so the recovery reads as
        // "trying again" rather than a frozen panel.
        key={attempt}
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1, transition: spring.gentle }}
        className="relative w-full max-w-md text-center"
      >
        <m.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1, transition: { ...spring.snappy, delay: 0.06 } }}
          className="mx-auto mb-6 flex size-14 items-center justify-center rounded-full bg-destructive/[0.08] ring-1 ring-inset ring-destructive/20 shadow-[0_0_0_8px_rgb(var(--c-destructive)/0.04)]"
        >
          <AlertTriangle className="size-6 text-destructive" />
        </m.div>

        <h1 className="text-balance font-display text-3xl font-medium tracking-[-0.022em] text-foreground sm:text-4xl">
          {heading}
        </h1>

        <p className="mx-auto mt-4 max-w-sm text-pretty text-[15px] leading-relaxed text-muted-foreground">
          {t('description')}
        </p>

        <AnimatePresence initial={false}>
          {isSpecificMessage(error.message) && (
            <m.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0, transition: transition.leave }}
              className="mt-4 overflow-hidden"
            >
              <span className="inline-block max-w-full break-words rounded-lg border border-border/70 bg-muted/60 px-3 py-2 font-mono text-xs text-muted-foreground">
                {error.message}
              </span>
            </m.p>
          )}
        </AnimatePresence>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={handleRetry} disabled={reloading}>
            {reloading ? (
              <span
                aria-hidden
                className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
              />
            ) : (
              <RefreshCw className="size-4" />
            )}
            {reloading ? t('retrying') : t('tryAgain')}
          </Button>

          {showHome && (
            <Button variant="outline" asChild>
              <a href="/">
                <Home className="size-4" />
                {t('goHome')}
              </a>
            </Button>
          )}
        </div>

        {error.digest && (
          <p className="mt-8 text-xs text-muted-foreground/80">
            {t('reference')}:{' '}
            <span className="rounded-md bg-muted/70 px-1.5 py-0.5 font-mono text-2xs">{error.digest}</span>
          </p>
        )}
      </m.div>
    </div>
  );
}

/**
 * Not-found view.
 *
 * Distinct from the error view: a 404 is a dead end for this route but not a
 * fault, so the tone and the primary action differ — the primary action is
 * finding another way to the content, not retrying.
 */
export function NotFoundView({
  title,
  description,
  className,
}: {
  title?: string;
  description?: string;
  className?: string;
}) {
  const t = useTranslations('ui.errorView');
  return (
    <div className={cn('relative flex min-h-[60vh] items-center justify-center px-4 py-20', className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 ambient-wash opacity-70 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_70%)]"
      />
      <m.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0, transition: transition.enter }}
        className="relative w-full max-w-md text-center"
      >
        <m.p
          initial={{ opacity: 0, y: 8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1, transition: { ...spring.gentle, delay: 0.04 } }}
          className="font-display text-[6.5rem] font-normal italic leading-none tracking-[-0.04em] text-primary/25 sm:text-[8rem]"
          aria-hidden
        >
          404
        </m.p>
        <h1 className="mt-4 text-balance font-display text-3xl font-medium tracking-[-0.022em] text-foreground sm:text-4xl">
          {title ?? t('notFoundTitle')}
        </h1>
        <p className="mx-auto mt-4 max-w-sm text-pretty text-[15px] leading-relaxed text-muted-foreground">
          {description ?? t('notFoundDescription')}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild>
            <a href="/">
              <Home className="size-4" />
              {t('goHome')}
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href="/search">
              <RotateCcw className="size-4" />
              {t('searchSite')}
            </a>
          </Button>
        </div>
      </m.div>
    </div>
  );
}