/* 我的衣橱 · Service Worker
 * 只缓存 App 本身（界面代码与图标），用于离线打开。你的衣物和照片保存在 IndexedDB 中，不经过这里，也不会上传。
 * 发布新版本时修改 VERSION（与 index.html 中的 APP_VERSION 保持一致），旧缓存会被自动清理。
 */
const VERSION = '1.1.0';
const CACHE = 'wardrobe-shell-' + VERSION;
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/favicon-64.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('wardrobe-shell-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function timeout(ms) { return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)); }

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    // 页面：优先联网取最新版本（3.5 秒超时），离线时用缓存
    event.respondWith(
      Promise.race([fetch(req), timeout(3500)])
        .then(res => {
          if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(new URL('./index.html', self.registration.scope).href, copy)); }
          return res;
        })
        .catch(() => caches.match(new URL('./index.html', self.registration.scope).href).then(r => r || caches.match(req)))
    );
    return;
  }

  // 其他静态文件：先用缓存，同时后台更新
  event.respondWith(
    caches.match(req).then(cached => {
      const net = fetch(req).then(res => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      }).catch(() => cached);
      return cached || net;
    })
  );
});
