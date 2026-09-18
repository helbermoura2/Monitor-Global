/* Service Worker — Monitor Global
   Shell = cache para abertura offline.
   APIs de dados = network-first (tempo quase real).
   NÃO promete alerta ao vivo sem rede. */
const CACHE = 'monitor-global-pro-v583';

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Cloudflare Pages: HTML deve ser index.html na raiz
    const shell = ['./', './index.html', './manifest.webmanifest'];
    await Promise.all(shell.map((u) => cache.add(u).catch(() => null)));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Dados ao vivo: nunca preferir cache velho
  const isDataApi = /open-meteo|usgs\.gov|emsc-csem|gdacs|rainviewer|weather\.gov|allorigins|workers\.dev|arcgisonline|google\.com\/vt|apiprevmet3\.inmet|brasilapi\.com\.br|orhanaydogdu|deprem-api|afad\.gov|cptec\.inpe|nhc\.noaa|eonet\.gsfc|seismicportal|geofon\.gfz|ingv\.it|isc\.ac\.uk|jma\.go\.jp|cgesp\.org|cemaden|redemet\.decea|moho\.iag\.usp/i.test(url.href);

  if (isDataApi) {
    event.respondWith(
      fetch(req)
        .then((res) => res)
        .catch(() => caches.match(req))
    );
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(req);
    try {
      const res = await fetch(req);
      if (res && res.ok) {
        const cache = await caches.open(CACHE);
        cache.put(req, res.clone()).catch(() => {});
      }
      return res;
    } catch (err) {
      if (cached) return cached;
      if (req.mode === 'navigate') {
        const shell =
          (await caches.match('./index.html')) ||
          (await caches.match('./')) ||
          (await caches.match('/index.html')) ||
          (await caches.match('/'));
        if (shell) return shell;
      }
      throw err;
    }
  })());
});
