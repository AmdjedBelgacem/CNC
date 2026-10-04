/**
 * Error boundary for `/(auth)`.
 *
 * Next.js renders this in place of the segment when it throws, and it owns the
 * recovery UI — a bare "Application error: a client-side exception has occurred"
 * with a browser reload button is what you get without one.
 *
 * Scoped deliberately: this catches the segment below it only, so a failure in
 * one admin panel doesn't tear down the shell, the navigation, or the session.
 */
'use client';

import { ErrorView } from '@/components/ui/error-view';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorView error={error} reset={reset} title="We couldn't sign you in" />;
}
