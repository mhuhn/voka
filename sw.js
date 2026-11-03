// Service Worker: hält die App offline verfügbar und sorgt dafür, dass Updates ankommen.
// - Die App-Seite wird immer zuerst vom Server geholt (am Browser-Cache vorbei);
//   nur ohne Internet (oder bei sehr langsamer Verbindung) kommt die gespeicherte Kopie.
// - Icons und Manifest kommen aus dem Cache und werden im Hintergrund aufgefrischt.
const CACHE = 'vokabelkarten-v6';
const ASSETS = ['./index.html', './manifest.json', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];
const SLOW_MS = 3000;

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // cache:'reload' umgeht den HTTP-Cache, damit wirklich frische Dateien gespeichert werden
    await Promise.all(ASSETS.map(async u => {
      const res = await fetch(new Request(u, { cache: 'reload' }));
      if (!res.ok) throw new Error(u + ' ' + res.status);
      await cache.put(u, res);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const isPage = (req) => {
  if (req.mode === 'navigate') return true;
  const p = new URL(req.url).pathname;
  return p.endsWith('/') || p.endsWith('/index.html');
};

// Holt die Seite mit eindeutiger Adresse und ohne Cache: so liefert weder der Browser-Cache
// noch ein Zwischenspeicher von GitHub eine veraltete Version.
const freshUrl = () => new URL('index.html', self.registration.scope).href + '?_=' + Date.now();

async function pageResponse(req, e) {
  const cache = await caches.open(CACHE);
  const fresh = fetch(freshUrl(), { cache: 'no-store' }).then(res => {
    if (!res.ok) return null;
    cache.put('./index.html', res.clone());
    return res;
  }).catch(() => null);
  e.waitUntil(fresh);
  // Beim Start nur kurz auf den Server warten; die Seite prüft danach selbst noch einmal auf Updates.
  const res = req.mode === 'navigate'
    ? await Promise.race([fresh, new Promise(r => setTimeout(() => r(null), SLOW_MS))])
    : await fresh;
  if (res) return res;
  const cached = await cache.match('./index.html');
  if (cached) return cached;
  return (await fresh) || new Response('Offline', { status: 503 });
}

async function assetResponse(req, e) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req, { ignoreSearch: true });
  const fetching = fetch(new Request(req.url, { cache: 'no-cache' })).then(res => {
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  }).catch(() => null);
  if (cached) { e.waitUntil(fetching); return cached; }
  return (await fetching) || new Response('Offline', { status: 503 });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(isPage(req) ? pageResponse(req, e) : assetResponse(req, e));
});
