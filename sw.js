// キャッシュ名はバージョン文字列を含める。中身(プリキャッシュ対象)を更新したらこの文字列を上げること。
const CACHE_NAME = 'md-viewer-v9';
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

// ここで skipWaiting() は呼ばない。呼ぶと、開いている画面(古いindex.html)を表示したまま
// SWだけが新しくなる「ちぐはぐな状態」になり、更新が届いたことをユーザーに伝える機会も無くなる。
// 新しいSWは waiting のまま待機させ、ページ側が更新トーストを出す。
// ユーザーが「再読み込み」を押した時だけ SKIP_WAITING メッセージで交代する。
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

// 待機中のSWを即座に有効化する。ページ側の更新トーストの「再読み込み」からのみ送られる。
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
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
