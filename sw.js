/* オフラインでも開けるようにする（ジムで電波が弱いとき用）。
   まずネットから最新を取りに行き、3秒で取れなければ保存しておいた版を使う */
const CACHE = 'kinmon-20261026060250';
const FILES = ['./', 'index.html', 'app.css', 'app.js', 'mon.js', 'manifest.webmanifest', 'icon-180.png', 'icon-512.png'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  const net = fetch(e.request).then((r) => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return r;
  });
  const slow = new Promise((res) => setTimeout(res, 3000)).then(() => caches.match(e.request, { ignoreSearch: true }));
  e.respondWith(Promise.race([net, slow.then((c) => c || net)]).catch(() => caches.match(e.request, { ignoreSearch: true })));
});

/* リマインド通知：通知サーバーから届いたら表示し、押されたらアプリを開く */
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || '筋モン', {
    body: d.body || '筋トレの時間だぞ', icon: 'icon-180.png', badge: 'icon-180.png', tag: 'kinmon-remind', data: { url: d.url || './' },
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    const c = cs.find((x) => 'focus' in x);
    return c ? c.focus() : self.clients.openWindow(e.notification.data?.url || './');
  }));
});
