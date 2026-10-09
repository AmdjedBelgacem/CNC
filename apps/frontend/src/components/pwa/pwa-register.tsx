'use client';

import { useEffect } from 'react';

/**
 * The service worker is gone, so nothing is registered any more.
 *
 * `public/sw.js` has been deleted. That is the load-bearing part of the removal: a browser
 * that checks its worker script and gets a 404 unregisters the worker on its own, with no
 * cooperation from this bundle. That matters because an installed worker keeps controlling a
 * visitor's pages until every tab is closed, so it has to be dismantled by the browser rather
 * than by the new JavaScript — which cannot run on a page the old worker is already breaking.
 *
 * This component is the second line: it deletes every cache and unregisters every
 * registration, so caches are cleared even where the script check has not happened yet, and it
 * covers a worker registered by something other than this component.
 *
 * Nothing is registered. A caching service worker on a server-rendered site failed four
 * different ways here, each after a fix that appeared to work, every one of them surfacing as
 * a blank page that could not be reproduced from a clean profile.
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
