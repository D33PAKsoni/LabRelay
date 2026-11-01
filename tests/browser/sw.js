// Test-harness shell caching only. API requests always reach the real test server.
const CACHE = 'labrelay-diagnostic-shell-v1';
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(['/', '/harness.js'])).then(() => self.skipWaiting())); });
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method === 'GET' && url.origin === self.location.origin && ['/', '/harness.js'].includes(url.pathname))
    event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
