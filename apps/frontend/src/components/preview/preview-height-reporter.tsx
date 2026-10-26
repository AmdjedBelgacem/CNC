'use client';

import { useEffect } from 'react';
import { measureIslandHeight } from './measure-island-height';

/**
 * Reports the rendered island height to the builder canvas.
 *
 * The builder embeds each live island in a same-origin iframe so it can render
 * the exact server component the public page uses. The iframe cannot use
 * `height: auto`, so it posts its measured height back and the block resizes to
 * fit. A ResizeObserver covers images, client data, and responsive reflows.
 */
export function PreviewHeightReporter() {
  useEffect(() => {
    const root = document.getElementById('island-preview-root');
    if (!root) return;

    let frame = 0;
    const post = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const height = measureIslandHeight(root);
        // The builder canvas is itself an iframe (Puck renders the block tree
        // through a portal), so `parent` is the canvas document — not the React
        // realm that owns the message listener. Send to the top window, where
        // the listener actually lives.
        (window.top ?? window.parent)?.postMessage(
          { type: 'builder-island-height', height },
          window.location.origin,
        );
      });
    };

    post();
    const observer = new ResizeObserver(post);
    // Observe the island element itself, not only the preview root: the root can
    // be stretched to the iframe viewport, so its border box never changes when
    // an accordion opens or the wire loads more posts.
    observer.observe(root);
    for (const child of Array.from(root.children)) observer.observe(child);
    window.addEventListener('load', post);
    window.addEventListener('resize', post);
    const timeout = window.setTimeout(post, 1200);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('load', post);
      window.removeEventListener('resize', post);
      window.clearTimeout(timeout);
    };
  }, []);

  return null;
}
