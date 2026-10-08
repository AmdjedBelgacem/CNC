/**
 * Cache names are scoped to the Next.js build ID, which the Dockerfile substitutes for the
 * placeholder below after `next build`.
 *
 * This matters more than it looks. Next content-hashes every chunk under `/_next/static`, so
 * the HTML for a build can only load its scripts from that same build. Caching pages under a
 * hand-written version string meant a deploy never changed this file, so the worker never
 * re-activated, so the old caches were never cleared: `sw.js` was byte-identical across
 * dozens of deploys. A visitor who had `/products` cached kept the previous build's HTML,
 * which pointed at chunks the new image no longer ships. The moment the network hiccuped,
 * navigation fell back to that HTML, its scripts 404'd, and React never hydrated — a blank
 * page that looked like an application bug and reproduced only on real browsers, never on a
 * fresh profile with an empty cache.
 *
 * Scoping to the build ID makes the file change whenever the app does, which re-triggers
 * `activate` and deletes the previous build's caches.
 */
const BUILD = '__BUILD_ID__';
const PAGES_CACHE = `pages-${BUILD}`;
const STATIC_CACHE = `static-${BUILD}`;
const IMAGES_CACHE = `images-${BUILD}`;

/** Prefixes this worker owns. Anything else in Cache Storage belongs to another feature. */
const OWNED_PREFIXES = ['pages-', 'static-', 'images-'];

const PRECACHE = ['/offline'];

const isOurs = (key) => OWNED_PREFIXES.some((prefix) => key.startsWith(prefix));

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PAGES_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  const keep = new Set([PAGES_CACHE, STATIC_CACHE, IMAGES_CACHE]);
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) =>
          Promise.all(keys.filter((key) => isOurs(key) && !keep.has(key)).map((key) => caches.delete(key))),
        ),
      caches.delete('titans-v1'),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

// Cap image cache at ~60 entries (LRU-ish: delete oldest 20 when over)
async function trimImagesCache() {
  const cache = await caches.open(IMAGES_CACHE);
  const keys = await cache.keys();
  if (keys.length > 60) {
    await Promise.all(keys.slice(0, 20).map((r) => cache.delete(r)));
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API, auth, admin mutations, or websockets
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin/') || url.pathname.startsWith('/auth/')) return;

  // Navigations: network-first, then cache, then offline fallback
  const isNavigation =
    req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  if (isNavigation) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Cache a clone of successful same-origin navigations
          if (res.ok) {
            const copy = res.clone();
            caches.open(PAGES_CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(async () => (await caches.match(req)) || caches.match('/offline')),
    );
    return;
  }

  /**
   * Hashed Next.js static assets: cache-first.
   *
   * Safe only because the cache is build-scoped. A miss is fetched and cached, and a 404 is
   * returned as-is rather than left to wedge the page — with build-scoped caches an entry
   * can never outlive the asset it points at.
   */
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/_next/image')) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  // Images/fonts: stale-while-revalidate
  if (req.destination === 'image' || req.destination === 'font') {
    event.respondWith(
      caches.match(req).then((hit) => {
        const network = fetch(req)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(IMAGES_CACHE).then((c) => c.put(req, copy).then(trimImagesCache));
            }
            return res;
          })
          .catch(() => hit);
        return hit || network;
      }),
    );
    return;
  }

  // Everything else same-origin GET: try network, fall back to cache
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(PAGES_CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req)),
  );
});