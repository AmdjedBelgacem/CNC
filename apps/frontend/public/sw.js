/**
 * The service worker has been removed. This file no longer serves anything.
 *
 * It exists to dismantle the worker every current visitor already has installed, then
 * unregister itself.
 *
 * Deleting the file was tried first, on the theory that a browser which fetches its worker
 * script and gets a 404 unregisters automatically. It does not, reliably enough: Next.js has no
 * route for `/sw.js`, so it answers with its catch-all page — HTTP **200** with
 * `content-type: text/html`. That relies on each engine treating a non-JS MIME type as a
 * registration failure, and they differ. Serving real JavaScript that removes itself does not
 * depend on that heuristic at all.
 *
 * The worker was removed because every caching strategy it used produced blank pages, in
 * sequence, each after a fix that appeared to work:
 *
 *   - `respondWith` was handed `undefined` when the network failed and the cache missed;
 *   - cached HTML arrived without its scripts, so React never hydrated;
 *   - `/offline` failed the same way, being itself a Next.js page whose chunks are not cached;
 *   - and the catch-all branch rethrew on a network-and-cache miss, surfacing as
 *     `ERR_CACHE_MISS` and `TypeError: Failed to fetch`.
 *
 * `install` and `activate` both tear everything down, and `skipWaiting` with `clients.claim`
 * means it applies on the next page load rather than waiting for every open tab to close.
 */

const DISMANTLE = async () => {
  try {
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

// A cached older page may still post this; answer it without re-registering anything.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
