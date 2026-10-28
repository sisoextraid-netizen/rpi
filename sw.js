/* Service worker RPI.
   - Cangkang aplikasi (HTML, JS, CSS, ikon) dan library CDN: cache, lalu segarkan di latar (stale-while-revalidate).
   - Halaman: network-first, jatuh ke cache saat offline.
   - Data Supabase (API, Auth, Storage, Realtime) TIDAK pernah di-cache, agar data donasi selalu segar dan aman.
   Naikkan VERSION setiap kali berkas di public/ berubah. */
const VERSION = 'rpi-v2';
const SHELL = ['/', '/manifest.json', '/icons/logo.png', '/icons/rpi-192.png'];
const CDN_HOSTS = ['cdn.tailwindcss.com', 'cdnjs.cloudflare.com', 'unpkg.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).catch(() => {}));
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('rpi-') && k !== VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

async function staleWhileRevalidate(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req);
  const net = fetch(req).then((res) => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; }).catch(() => null);
  return hit || (await net) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === location.origin) {
    if (req.mode === 'navigate') {
      event.respondWith((async () => {
        try {
          const res = await fetch(req);
          const cache = await caches.open(VERSION); cache.put('/', res.clone());
          return res;
        } catch (e) {
          return (await caches.match('/')) || Response.error();
        }
      })());
      return;
    }
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  if (CDN_HOSTS.includes(url.hostname)) { event.respondWith(staleWhileRevalidate(req)); return; }
  // selain itu (Supabase dan lainnya): langsung ke jaringan
});
