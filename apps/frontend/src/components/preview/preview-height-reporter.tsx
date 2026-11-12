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
    const send = () => {
      const height = measureIslandHeight(root);
      // The builder canvas is itself an iframe (Puck renders the block tree
      // through a portal), so `parent` is the canvas document — not the React
      // realm that owns the message listener. Send to the top window, where
      // the listener actually lives.
      (window.top ?? window.parent)?.postMessage(
        { type: 'builder-island-height', height },
        window.location.origin,
      );
    };
    let fallback = 0;
    const post = () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(fallback);
      const once = () => {
        cancelAnimationFrame(frame);
        window.clearTimeout(fallback);
        send();
      };
      // Next frame, so the measurement sees the settled layout; the timer covers a tab or pane in
      // the background, where frames never fire and every island stayed at its fallback height.
      frame = requestAnimationFrame(once);
      fallback = window.setTimeout(once, 100);
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
    // The builder asks again whenever it starts listening: a report sent before its listener was
    // attached is lost, and a stable island never resizes to send another.
    const onRequest = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if ((event.data as { type?: string } | null)?.type === 'builder-island-measure') post();
    };
    window.addEventListener('message', onRequest);
    const timeout = window.setTimeout(post, 1200);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(fallback);
      observer.disconnect();
      window.removeEventListener('load', post);
      window.removeEventListener('resize', post);
      window.removeEventListener('message', onRequest);
      window.clearTimeout(timeout);
    };
  }, []);

  return null;
}
