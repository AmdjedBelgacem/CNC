'use client';

import * as React from 'react';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * IMAGE LOAD-IN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Every image in the product is a plain `<img>` (77 of them, and no
 * `next/image`), so rather than touching each call site this watches the
 * document once and fades images in as they finish decoding.
 *
 * Without it, a card grid paints as a row of empty boxes and then everything
 * snaps into place at once — the single most common way a page looks "not
 * finished" even when it is. With it, images settle individually and the page
 * resolves rather than flashing.
 *
 * ── Why the hidden state is gated behind `@media (scripting: enabled)` ──
 *
 * The CSS starts eligible images at `opacity: 0` and reveals them via a
 * `data-media` attribute this component sets. If scripting is unavailable,
 * nothing would ever set that attribute and the images would stay invisible
 * forever. Gating the rule on `scripting: enabled` means:
 *
 *   - scripting on    → hidden, then faded in
 *   - scripting off   → normal images, immediately
 *   - `scripting` unsupported by the browser → the rule is dropped entirely, so
 *     images just appear. A missing fade is invisible to the user; missing
 *     images are not.
 */

type MediaState = 'pending' | 'loaded' | 'error';

/** Marks an image as managed without hiding it, so the transition is seamless. */
function settle(img: HTMLImageElement, state: MediaState) {
  img.dataset.media = state;
  img.classList.add('media-ready');
}

export function MediaLoadProvider({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    // `load` does not bubble, so this has to be a capturing listener on the
    // document to see events from every image.
    const onLoad = (event: Event) => {
      const t = event.target;
      if (t instanceof HTMLImageElement) settle(t, 'loaded');
    };

    const onError = (event: Event) => {
      const t = event.target;
      if (t instanceof HTMLImageElement) {
        // Never leave a failed image invisible — a broken-image glyph is more
        // useful than an empty box, and `object-cover` areas would stay blank.
        settle(t, 'error');
      }
    };

    /**
     * Decide what to do with one image.
     *
     * Three cases, and the middle one is the subtle one:
     *
     *  - No `src` at all → leave it alone. An `<img>` with no src reports
     *    `complete === true` and `naturalWidth === 0`, which looks identical to
     *    a broken image. Treating it as one marked it `error`, which resolves to
     *    fully visible — so the image skipped the fade entirely and then
     *    appeared without any transition the moment its `src` was assigned a
     *    tick later. That is the normal shape of
     *    `<img src={url} />` where `url` arrives after the first render, so it
     *    was not a rare edge case: it silently disabled the effect for every
     *    image whose source resolves asynchronously.
     *  - Has a src and still loading → `pending`, so it fades in on load.
     *  - Has a src and finished → `loaded` / `error`, both of which are visible.
     *
     * Already-complete images with a src are also left untouched during the
     * initial sweep, for the hydration reason documented below.
     */
    const manage = (img: HTMLImageElement) => {
      if (img.dataset.media) return;
      if (!img.getAttribute('src')) return;
      if (!img.complete) {
        img.dataset.media = 'pending';
        return;
      }
      // Only reached post-hydration (see the deferral note), so writing here is
      // safe. Harmless for images that are already visible anyway.
      settle(img, img.naturalWidth > 0 ? 'loaded' : 'error');
    };

    const sweep = (root: ParentNode) => {
      root.querySelectorAll?.('img:not([data-media])').forEach((img) => {
        if (img instanceof HTMLImageElement) manage(img);
      });
    };

    // ── Why the initial sweep is deferred ──────────────────────────────
    // `settle()` writes `data-media` onto elements React owns. If that happens
    // while React is still hydrating, React compares the DOM against its own
    // (attribute-less) virtual DOM, sees an attribute it never rendered, and
    // reports a hydration mismatch that it will not patch up.
    //
    // This is not hypothetical: a `loading="eager"` hero image is usually
    // already complete by the time the page hydrates, so an eager sweep
    // stamped `data-media` onto it and every page load logged
    // "A tree hydrated but some attributes of the server rendered HTML didn't
    // match" on the one image above the fold.
    //
    // Two things together avoid it:
    //   1. Already-complete images get NO attribute written. They're visible by
    //      default, so there is nothing to reveal and nothing to mutate — which
    //      removes the eager-image case entirely.
    //   2. Everything else is swept after a double `requestAnimationFrame`, by
    //      which point React has finished the hydration commit. Two frames
    //      rather than one: the first rAF can be queued from inside the
    //      hydration commit itself, so the second is guaranteed to be after it.
    const cleanup: { mo?: MutationObserver } = {};
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        sweep(document);

        // Client-side navigation mounts new images after hydration, so those
        // never fire the events above. One observer on the body catches them,
        // and by then React isn't hydrating — the additions are ours to annotate.
        const mo = new MutationObserver((records) => {
          for (const record of records) {
            // `<img src={url} />` where `url` arrives after the first render:
            // the element is already in the DOM with no src, so the addedNodes
            // pass skips it. Watching the attribute catches the moment the
            // source appears and marks it pending, which is what lets it fade.
            // (All three URLs in this codebase's data flow arrive this way.)
            if (record.type === 'attributes' && record.target instanceof HTMLImageElement) {
              manage(record.target);
              continue;
            }
            record.addedNodes.forEach((node) => {
              if (node instanceof HTMLImageElement) {
                manage(node);
              } else if (node instanceof Element && node.querySelector('img')) {
                sweep(node);
              }
            });
          }
        });
        mo.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['src'],
        });
        cleanup.mo = mo;
      });
    });

    // Meanwhile, listen from the start so nothing that loads during hydration is
    // missed — the listeners don't mutate anything on their own, they only
    // respond to events React isn't involved in.
    document.addEventListener('load', onLoad, true);
    document.addEventListener('error', onError, true);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      cleanup.mo?.disconnect();
      document.removeEventListener('load', onLoad, true);
      document.removeEventListener('error', onError, true);
    };
  }, []);

  return <>{children}</>;
}
