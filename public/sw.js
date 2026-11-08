// Offline support. Every request goes to the network first, so edits show up as
// before; if the network is missing or slow, the last saved copy is used instead.
// On install, the page and every litany are saved, so all of them work offline.
const CACHE = 'litany-reader-v2';
const SHELL = [
  './',
  'index.html',
  'app.js',
  'wake-lock.js',
  'lib/breath.js',
  'lib/colour.js',
  'lib/favs.js',
  'lib/heartbeat.js',
  'lib/memorise.js',
  'lib/prefs.js',
  'lib/text.js',
  'style.css',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png',
  'apple-touch-icon.png',
];
const TIMEOUT = 2500; // ms to wait for the network before using the saved copy

// Saves the index and every litany it lists.
async function saveLitanies(cache) {
  const res = await fetch('api/index.json', { cache: 'no-store' });
  if (!res.ok) return;
  await cache.put('api/index.json', res.clone());
  const items = await res.json();
  await Promise.all(items.map((it) => cache.add(`api/litany/${encodeURIComponent(it.id)}.json`).catch(() => {})));
}

self.addEventListener('install', (e) => {
  e.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(SHELL);
      await saveLitanies(cache).catch(() => {});
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
      await self.clients.claim();
    })(),
  );
});

// The page asks for this after loading the index, so new litanies are saved too.
self.addEventListener('message', (e) => {
  if (e.data === 'save-litanies')
    e.waitUntil(
      caches
        .open(CACHE)
        .then(saveLitanies)
        .catch(() => {}),
    );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.endsWith('/__shutdown')) return;
  e.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const net = fetch(e.request, { cache: 'no-store' }).then((res) => {
        if (res.ok) cache.put(e.request, res.clone());
        return res;
      });
      net.catch(() => {}); // a late failure after the saved copy was used is not an error
      const timeout = new Promise((resolve) => setTimeout(resolve, TIMEOUT));
      try {
        // Network wins if it answers in time; otherwise fall back to the saved copy.
        const res = await Promise.race([net, timeout]);
        if (res) return res;
        const saved = await cache.match(e.request, { ignoreSearch: true });
        return saved || (await net);
      } catch {
        const saved = await cache.match(e.request, { ignoreSearch: true });
        if (saved) return saved;
        throw new Error('offline');
      }
    })(),
  );
});
