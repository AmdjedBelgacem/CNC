/**
 * The service worker has been removed.
 *
 * This file no longer serves anything. It exists for one purpose: to dismantle the worker
 * that every current visitor already has installed, then unregister itself.
 *
 * It was deleted because every strategy it used to cache pages produced blank pages, in
 * sequence and each after a fix that appeared to work:
 *
 *   - `respondWith` was handed `undefined` when the network failed and the cache missed,
 *     giving "Failed to convert value to 'Response'";
 *   - when the cached HTML *was* served, its scripts were often not cached alongside it,
 *     because a first visit runs before the worker takes control — React never hydrated and
 *     the page rendered Next's "the app failed to start" boundary;
 *   - `/offline` failed identically, being itself a Next.js page whose chunks are not
 *     precached;
 *   - removing navigation interception still left the catch-all branch rethrowing on a
 *     network-and-cache miss, surfacing as `ERR_CACHE_MISS` and "Failed to fetch";
 *   - and cached responses were one deploy behind regardless, since the worker only
 *     re-validated itself when `sw.js` changed and deploys rarely changed it.
 *
 * The site is server-rendered with no offline requirement, so the worker bought a stale-cache
 * hazard and little else. Caching content-hashed assets is a performance nicety that belongs
 * in the CDN or the HTTP cache, both of which the platform already provides and neither of
 * which can turn a page load into an error page.
 *
 * `install` and `activate` both tear everything down and unregister, and `skipWaiting` plus
 * `clients.claim` are set so this takes effect on the next load rather than waiting for every
 * old tab to close.
 */

const DISMANTLE = async () => {
  try {
    // Every cache this worker or any predecessor created, whatever it was named.
    if (self.caches) {
      const keys = await self.caches.keys();
      await Promise.all(keys.map((key) => self.caches.delete(key)));
    }
  } catch {
    /* nothing to clear */
  }
  try {
    await self.registration.unregister();
  } catch {
    /* already gone */
  }
  try {
    await self.clients.claim();
  } catch {
    /* non-fatal */
  }
};

self.addEventListener('install', (event) => {
  event.waitUntil(DISMANTLE().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(DISMANTLE());
});

// Handle the legacy update-toast message so nothing throws if the old UI is still cached.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});