'use client';

import * as React from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { useRouter } from 'next/navigation';
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
  title = 'Something went wrong',
  className,
}: ErrorViewProps) {
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
      className={cn('flex min-h-[60vh] items-center justify-center px-4 py-16', className)}
    >
      <m.div
        // `key` re-runs the entrance on every retry, so the recovery reads as
        // "trying again" rather than a frozen panel.
        key={attempt}
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1, transition: spring.gentle }}
        className="w-full max-w-md text-center"
      >
        <m.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1, transition: { ...spring.snappy, delay: 0.06 } }}
          className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl border border-destructive/25 bg-destructive/10"
        >
          <AlertTriangle className="size-6 text-destructive" />
        </m.div>

        <h1 className="font-display text-headline-md font-semibold tracking-[-0.02em] text-foreground">
          {title}
        </h1>

        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
          This part of the page failed to load. Retrying usually fixes it — if it keeps failing, the
          data may be temporarily unavailable.
        </p>

        <AnimatePresence initial={false}>
          {isSpecificMessage(error.message) && (
            <m.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0, transition: transition.leave }}
              className="mt-4 overflow-hidden"
            >
              <span className="inline-block max-w-full break-words rounded-md bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
                {error.message}
              </span>
            </m.p>
          )}
        </AnimatePresence>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={handleRetry} disabled={reloading}>
            {reloading ? (
              <span
                aria-hidden
                className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
              />
            ) : (
              <RefreshCw className="size-4" />
            )}
            {reloading ? 'Retrying' : 'Try again'}
          </Button>

          {showHome && (
            <Button variant="outline" asChild>
              <a href="/">
                <Home className="size-4" />
                Go home
              </a>
            </Button>
          )}
        </div>

        {error.digest && (
          <p className="mt-6 font-mono text-2xs text-muted-foreground/70">
            Reference: {error.digest}
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
  title = 'Page not found',
  description = "The page you're looking for doesn't exist, was moved, or has been retired.",
  className,
}: {
  title?: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex min-h-[60vh] items-center justify-center px-4 py-16', className)}>
      <m.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0, transition: transition.enter }}
        className="w-full max-w-md text-center"
      >
        <p
          className="font-display text-[4rem] font-bold leading-none tracking-tighter text-muted/60"
          aria-hidden
        >
          404
        </p>
        <h1 className="mt-2 font-display text-headline-md font-semibold tracking-[-0.02em] text-foreground">
          {title}
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button asChild>
            <a href="/">
              <Home className="size-4" />
              Go home
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href="/search">
              <RotateCcw className="size-4" />
              Search the site
            </a>
          </Button>
        </div>
      </m.div>
    </div>
  );
}