'use client';

import * as React from 'react';
import { LazyMotion, MotionConfig, domAnimation, useReducedMotion } from 'framer-motion';

/**
 * Global motion configuration, mounted once in the root layout.
 *
 * ── Why reduced motion is applied after mount, not during it ──
 *
 * `reducedMotion="user"` is what we want at runtime: it drops transform
 * animations while keeping opacity fades, so content still arrives gracefully
 * but nothing slides across the screen.
 *
 * It cannot, however, be applied during render. Framer Motion writes an
 * element's `initial` variant out as inline style during SSR, and the server
 * has no way to know the user's preference — so it always writes the transform.
 * On the client, `reducedMotion="user"` omits it, and React reports:
 *
 *   <div style={{opacity: 0, transform: "translateY(14px)"}}>   ← server
 *   <div style={{opacity: 0}}>                                  ← client
 *
 * "A tree hydrated but some attributes of the server rendered HTML didn't
 * match" — on *every* page, but only for users who have reduced motion turned
 * on. That is the worst possible way for this bug to surface: invisible in
 * normal QA, and a console error plus a style flash for exactly the people who
 * asked for the product to move less.
 *
 * So the flag starts at `never` (which is what the server used anyway, and so
 * the first client render matches byte for byte) and flips to `user` on the
 * next tick. By then the entrance animations have finished, and dropping the
 * transforms simply parks elements at their final values — which is the correct
 * reduced-motion outcome anyway.
 *
 * ── Why LazyMotion ──
 *
 * `domAnimation` is loaded lazily instead of being bundled up front, saving
 * ~15kb gzipped on first paint. The trade-off is that components must use `m.*`
 * rather than `motion.*`; `strict` turns a mistake there into a loud warning
 * instead of a silent runtime no-op.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  const prefersReducedMotion = useReducedMotion();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion={mounted && prefersReducedMotion ? 'user' : 'never'}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}