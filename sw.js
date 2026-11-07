/* 氢计划 Service Worker：只缓存 app shell，让断网时也能打开。
   上传到 https 网址后，手机浏览器访问时会自动启用离线缓存。 */

const CACHE_NAME = 'aeroplan-v41';

const ASSETS = [
  './index.html',
  './styles.css?v=41',
  './i18n.js?v=41',
  './regions.js?v=41',
  './weather.js?v=41',
  './app.js?v=41',
  './fonts/zcool-xiaowei-subset.woff2',
  './fonts/cormorant-garamond-subset.woff2',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon-180.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      // 单个资源失败不应让整个离线缓存安装失败
      .then(cache => cache.addAll(ASSETS).catch(() =>
        Promise.all(ASSETS.map(url => cache.add(url).catch(() => null))
      )))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // 打开页面：先走网络，失败时用缓存的首页（断网也能进）
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 静态资源：缓存优先，缓存没有再去网络
  event.respondWith(
    caches.match(request).then(hit => {
      if (hit) return hit;
      return fetch(request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
