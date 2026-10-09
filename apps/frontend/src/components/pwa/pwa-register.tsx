'use client';

import { useEffect } from 'react';

/**
 * The service worker is gone, so nothing is registered any more.
 *
 * This component no longer registers `/sw.js`. It only clears out anything an earlier
 * version left behind — a registration, and every cache — because visitors who loaded the
 * site before the removal would otherwise keep an installed worker until each tab closed.
 *
 * `/sw.js` itself is now a stub that unregisters and clears caches on install, so the browser
 * picks it up on its own. This is the belt to that braces: it runs on the first page view
 * either way, and covers browsers that had the worker registered by something other than
 * this component.
 *
 * Nothing is registered afterwards. A caching service worker on a server-rendered site has
 * now failed in four different ways, each time producing blank pages that could not be
 * reproduced from a clean profile; the platform HTTP cache covers the part that was actually
 * worth having.
 */
export function PWARegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) && !('caches' in window)) return;

    const purge = async () => {
      try {
        if ('caches' in window) {
          const keys = await window.caches.keys();
          await Promise.all(keys.map((key) => window.caches.delete(key)));
        }
      } catch {
        /* nothing to clear */
      }
      try {
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((registration) => registration.unregister()));
        }
      } catch {
        /* already gone */
      }
    };

    void purge();
  }, []);
  return null;
}
