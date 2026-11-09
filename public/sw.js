// サービスワーカー：通信できるときは最新版を取り、できないときは保存しておいたものを使う（オフラインで遊べる）
const CACHE = 'rimina-v7';
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    // 18夜目：ページそのもの（index.html）は、ブラウザの控えを使わずに毎回取りに行く（古い版が残らないように）
    fetch(req, req.mode === 'navigate' ? { cache: 'no-cache' } : undefined).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then((r) => r || caches.match(new URL('./', self.registration.scope).href)))
  );
});
