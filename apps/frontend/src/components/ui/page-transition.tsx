'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, m } from 'framer-motion';
import { ease, transition } from '@/lib/motion';
import { cn } from '@/lib/utils';

/**
 * Module-level so it survives the unmount that happens between navigations.
 * A template remounts on every route change, so component state would reset
 * before we could compare against the previous URL.
 */
let previousPathname: string | null = null;

/** Rough "depth" of a path, used to infer forward vs. back navigation. */
function depthOf(pathname: string): number {
  return pathname.split('/').filter(Boolean).length;
}

/**
 * Route-change transition, mounted via a `template.tsx`.
 *
 * ── Why a template and not a layout ──
 * Next.js re-renders a `layout` when its children change but *keeps the layout
 * mounted*, so an exit animation in a layout never fires — it's the same
 * component instance. A `template` gets a fresh instance per navigation, which
 * is what lets `AnimatePresence` see the old tree leave and the new one arrive.
 *
 * ── Why this only crossfades ──
 * A full-page slide looks impressive once and becomes nauseating by the third
 * navigation, because every route you visit becomes a moving target. A short
 * crossfade with a 10px lift reads as "new context" while keeping the user's eye
 * and scroll position anchored. Apple's own apps do exactly this.
 */
export function PageTransition({
  children,
  className,
  /** Seconds for the outgoing page. Kept well under the enter time. */
  exitSeconds = 0.16,
}: {
  children: React.ReactNode;
  className?: string;
  exitSeconds?: number;
}) {
  const pathname = usePathname();

  // Resolved during render (not in an effect) so the first painted frame already
  // has the right direction — an effect would flash the default direction first.
  const direction = React.useMemo(() => {
    if (previousPathname === null) return 1; // first paint of the session
    const forward = depthOf(pathname) >= depthOf(previousPathname);
    return forward ? 1 : -1;
  }, [pathname]);

  React.useEffect(() => {
    previousPathname = pathname;
  }, [pathname]);

  // NOTE: there is deliberately no `useReducedMotion()` branch here.
  //
  // `useReducedMotion()` returns `false` on the server (there is no media query
  // to read) and the real value on the client, so branching on it during render
  // makes the server and client emit different markup. With a differing
  // `className` that is a hydration mismatch on every navigation — and it
  // reproduces only under `prefers-reduced-motion`, so it survives casual
  // testing and then fires in production for exactly the users who asked for
  // less motion.
  //
  // `<MotionConfig reducedMotion="user">` in the root layout already does this
  // job correctly: it drops transform animations while keeping opacity fades, so
  // content still arrives gracefully, and it does so without changing a single
  // byte of markup.
  return (
    <AnimatePresence mode="wait" initial={false}>
      <m.div
        // Keyed on direction so back/forward produce distinct trees and
        // AnimatePresence actually has something to cross-fade.
        key={`${direction}:${pathname}`}
        className={cn('min-h-0', className)}
        initial={{ opacity: 0, y: 10 * direction }}
        animate={{ opacity: 1, y: 0, transition: transition.enter }}
        exit={{ opacity: 0, transition: { duration: exitSeconds, ease: ease.exit } }}
      >
        {children}
      </m.div>
    </AnimatePresence>
  );
}