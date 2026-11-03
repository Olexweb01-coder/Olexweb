// Olexweb Meet's service worker. It only makes the app installable and shows a friendly page when there's no connection.
// It stores nothing private: never meetings, API answers, recordings or video. Pages always come fresh from the network.
const CACHE = 'olexweb-meet-v1', OFFLINE = '/meet/offline.html'
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll([OFFLINE, '/meet/icon-192.png'])).then(() => self.skipWaiting())) })
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())) })
self.addEventListener('fetch', (e) => {
  const r = e.request
  if (r.method !== 'GET' || r.mode !== 'navigate' || new URL(r.url).origin !== self.location.origin) return   // everything else goes straight to the network
  e.respondWith(fetch(r).catch(() => caches.match(OFFLINE)))
})
