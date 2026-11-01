const CACHE = 'labrelay-shell-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('message', event => {
  if (event.data?.type !== 'CACHE_SHELL' || !Array.isArray(event.data.urls)) return;
  const urls = event.data.urls.filter(url => {
    try { const parsed = new URL(url, self.location.origin); return parsed.origin === self.location.origin && !parsed.pathname.startsWith('/__preview'); }
    catch { return false; }
  });
  event.waitUntil(caches.open(CACHE).then(async cache => {
    await Promise.allSettled(urls.map(async url => { const response = await fetch(url); if (response.ok) await cache.put(url, response); }));
    event.ports[0]?.postMessage({ cached: true });
  }));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/__preview')) return;
  if (!['document','script','style','font','image'].includes(event.request.destination)) return;
  event.respondWith(fetch(event.request).then(async response => {
    if (response.ok) { const cache = await caches.open(CACHE); await cache.put(event.request, response.clone()); }
    return response;
  }).catch(async () => (await caches.match(event.request, { ignoreVary: true })) || Response.error()));
});
