// キャッシュ名はバージョン文字列を含める。中身(プリキャッシュ対象)を更新したらこの文字列を上げること。
const CACHE_NAME = 'md-viewer-v7';
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './vendor/marked.min.js',
  './vendor/purify.min.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/favicon-32.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

// 同一オリジンのGETのみキャッシュ対象にする。Google APIやGISスクリプト等の外部リクエストは
// そのまま素通しする(Drive連携はもともとオフラインでは使えない機能のため)。
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req).then((res) => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
