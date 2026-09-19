const VERSION = 'titans-v2';
const PAGES_CACHE = `pages-${VERSION}`;
const STATIC_CACHE = `static-${VERSION}`;
const IMAGES_CACHE = `images-${VERSION}`;

const PRECACHE = ['/offline'];

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
          Promise.all(keys.filter((k) => !keep.has(k) && k.startsWith('titans-') || k.startsWith('pages-') || k.startsWith('static-') || k.startsWith('images-')).map((k) => caches.delete(k))),
        ),
      // Legacy v1 sweep
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

  // Hashed Next.js static assets: cache-first (immutable)
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/_next/image')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
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
