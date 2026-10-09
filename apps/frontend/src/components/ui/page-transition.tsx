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
        /**
         * Opacity is pinned to 1 on every state; only the vertical offset animates.
         *
         * This is the wrapper around the entire page, inside `<main>`, and it started from
         * `opacity: 0`. Framer Motion writes that out as an inline style and clears it only
         * when the `animate` transition actually runs. It does not always: the reported DOM was
         *
         *     <main class="flex-1"><div class="min-h-0" style="opacity: 0; transform: none;">
         *
         * — `transform: none` meaning the `y: 0` end value *had* resolved while `opacity` had
         * not, so the animation applied halfway and left the page invisible. With
         * `AnimatePresence mode="wait"` a page that never finishes its exit also blocks the
         * next one, which is why a refresh was the only way out.
         *
         * A CSS failsafe was tried for the same class of bug on `<Reveal>` and measurably did
         * not hold: the keyframe applied and the element still computed to `opacity: 0`,
         * because the library reasserts its own inline value. A guarantee layered over the
         * animation cannot work, so the page is simply never asked to be invisible.
         *
         * The trade is the crossfade: pages now swap without fading. The lift is kept, so
         * navigation still reads as movement. Invisible is not a state a page wrapper should
         * be able to reach.
         */
        initial={{ opacity: 1, y: 10 * direction }}
        animate={{ opacity: 1, y: 0, transition: transition.enter }}
        exit={{ opacity: 1, y: -10 * direction, transition: { duration: exitSeconds, ease: ease.exit } }}
      >
        {children}
      </m.div>
    </AnimatePresence>
  );
}