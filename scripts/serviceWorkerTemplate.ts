export interface ServiceWorkerTemplateOptions {
  readonly version: string;
  readonly precache: readonly string[];
  readonly indexUrl: string;
  readonly baseUrl: string;
}

export function buildServiceWorkerSource(options: ServiceWorkerTemplateOptions): string {
  const cacheName = `brainrot-defense-shell-${options.version}`;
  return `const CACHE_PREFIX = 'brainrot-defense-shell-';
const CACHE_NAME = ${JSON.stringify(cacheName)};
const ACTIVE_CACHE = CACHE_NAME + '-staging';
const INDEX_URL = ${JSON.stringify(options.indexUrl)};
const BASE_URL = ${JSON.stringify(options.baseUrl)};
const PRECACHE = ${JSON.stringify(options.precache, null, 2)};

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(ACTIVE_CACHE);
      try {
        await cache.addAll(PRECACHE);
      } catch (error) {
        await caches.delete(ACTIVE_CACHE);
        throw error;
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== ACTIVE_CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

async function matchCached(request) {
  const cache = await caches.open(ACTIVE_CACHE);
  return cache.match(request, { ignoreSearch: true, ignoreVary: true });
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (response.ok) return response;
        } catch {
          // Fall through to the precached app shell.
        }
        const cache = await caches.open(ACTIVE_CACHE);
        return (
          (await cache.match(request, { ignoreSearch: true, ignoreVary: true })) ||
          (await cache.match(INDEX_URL, { ignoreVary: true })) ||
          (await cache.match(BASE_URL, { ignoreVary: true })) ||
          Response.error()
        );
      })(),
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cached = await matchCached(request);
      if (cached) return cached;
      try {
        return await fetch(request);
      } catch {
        return Response.error();
      }
    })(),
  );
});
`;
}
