/**
 * GlowUp service worker.
 *
 * ── What this may cache, and what it may never cache ────────────────────────
 *
 * Every page in this app is `force-dynamic` and user-scoped: Today renders
 * someone's weight, their habits, their mood. Cache Storage is plain, readable,
 * origin-scoped data that survives sign-out and outlives the session — so a
 * service worker that "helpfully" cached HTML would leave one person's health
 * record sitting on disk for whoever picks the device up next.
 *
 * So the rule is narrow and absolute:
 *
 *   CACHED      immutable build output under `/_next/static/`, and the handful
 *               of static assets listed in PRECACHE. All content-hashed or
 *               versioned; none of it is personal.
 *
 *   NEVER       navigations, RSC payloads, `/api/*`, `/auth/*`, `/monitoring`,
 *               anything cross-origin, and anything that is not a GET.
 *
 * The offline benefit is still real: the JS, CSS and fonts are the slow part of
 * a cold start on a bad connection, and they are exactly the part that is safe
 * to keep. What you get offline is an honest "you are offline" page, not a
 * stale copy of yesterday's data presented as today's.
 */

const VERSION = 'v1';
const STATIC_CACHE = `glowup-static-${VERSION}`;
const OFFLINE_URL = '/offline';

/** Small, stable, and safe to serve to anyone. */
const PRECACHE = [OFFLINE_URL, '/icon.svg', '/icon-192.png', '/apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      // Individually, so one 404 during a deploy cannot fail the whole install
      // and leave the worker permanently stuck in "installing".
      await Promise.allSettled(PRECACHE.map((url) => cache.add(url)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => name !== STATIC_CACHE).map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

/**
 * A hard stop in front of everything else.
 *
 * Anything this returns false for is left entirely alone — the request never
 * touches Cache Storage in either direction.
 */
function isCacheable(url, request) {
  if (request.method !== 'GET') return false;
  if (url.origin !== self.location.origin) return false;

  // An RSC payload is page data wearing a static-looking URL.
  if (request.headers.get('RSC')) return false;
  if (url.searchParams.has('_rsc')) return false;

  if (url.pathname.startsWith('/_next/static/')) return true;
  return PRECACHE.includes(url.pathname);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Navigations go to the network, always. On failure, the offline page —
  // never a cached copy of a real screen.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const cached = await caches.match(OFFLINE_URL);
          return (
            cached ??
            new Response('You are offline.', {
              status: 503,
              headers: { 'Content-Type': 'text/plain' },
            })
          );
        }
      })(),
    );
    return;
  }

  if (!isCacheable(url, request)) return;

  // Cache-first. Everything reaching here is content-hashed or versioned, so a
  // hit can never be stale in a way that matters.
  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;

      const response = await fetch(request);
      if (response.ok && response.type === 'basic') {
        const cache = await caches.open(STATIC_CACHE);
        cache.put(request, response.clone());
      }
      return response;
    })(),
  );
});

/**
 * Lets the page drop every cache — used on sign-out.
 *
 * Nothing personal is stored, by construction. This exists so that stays true
 * even if a future change to the rules above gets it wrong.
 */
self.addEventListener('message', (event) => {
  if (event.data?.type === 'CLEAR_CACHES') {
    event.waitUntil(caches.keys().then((names) => Promise.all(names.map((n) => caches.delete(n)))));
  }
});
