// Карточки — offline cache. Bump VERSION with every release (matches version.json).
const VERSION = 20;
const CACHE = 'kartochki-v' + VERSION;
const SHELL = ['./', 'index.html', 'style.css?v=20', 'app.js?v=20', 'seed.js?v=20', 'version.json', 'manifest.webmanifest',
  'icon-180.png', 'icon-192.png', 'icon-512.png', 'vendor/telegram-web-app.js?v=20', 'vendor/bwip-js-4.11.4.min.js',
  'assets/ny/background.svg?v=20', 'assets/ny/header-snowflake.svg?v=20',
  'assets/ny/garland-bright.svg?v=20', 'assets/ny/garland-dim.svg?v=20', 'assets/ny/garland-wire.svg?v=20',
  'assets/ny/snowflake-1.svg?v=20', 'assets/ny/snowflake-2.svg?v=20', 'assets/ny/snowflake-3.svg?v=20', 'assets/ny/snowflake-4.svg?v=20',
  'assets/ny/flake-dot.svg?v=20', 'assets/ny/snow-cap-a.svg?v=20', 'assets/ny/snow-cap-b.svg?v=20', 'assets/ny/snow-cap-c.svg?v=20', 'assets/ny/snow-cap-d.svg?v=20',
  'assets/ny/snow-cap-a-tall.svg?v=20', 'assets/ny/snow-cap-b-tall.svg?v=20', 'assets/ny/snow-cap-c-tall.svg?v=20', 'assets/ny/snow-cap-d-tall.svg?v=20',
  'assets/ny/sparkle-white.svg?v=20', 'assets/ny/sparkle-gold.svg?v=20'];
const LAZY = ['vendor/zxing-wasm-2.2.4-full.js', 'vendor/zxing_full.wasm']; // scanner: cached in background, not required to install

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(async c => {
    await c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })));
    c.addAll(LAZY.map(u => new Request(u, { cache: 'reload' }))).catch(() => {});
  }).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('kartochki-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
const fresh = (req, ms) => new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('slow')), ms);
  fetch(req, { cache: 'no-store' }).then(r => { clearTimeout(t); r.ok ? res(r) : rej(new Error(r.status)); }, e => { clearTimeout(t); rej(e); });
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  const path = url.pathname;
  if (path.endsWith('/version.json')) { // always ask the network; offline -> cached copy
    e.respondWith(fetch(req, { cache: 'no-store' }).catch(() => caches.match('version.json', { ignoreSearch: true }).then(r => r || new Response('{"v":0}', { headers: { 'content-type': 'application/json' } }))));
    return;
  }
  if (req.mode === 'navigate' || path.endsWith('/') || path.endsWith('/index.html')) { // page: network first (short timeout), then cache
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      try { const r = await fresh(new Request(url.origin + url.pathname), 3500); c.put('index.html', r.clone()); return r; }
      catch (_) { return (await c.match('index.html')) || (await c.match('./')) || (await caches.match('index.html', { ignoreSearch: true })) || (await caches.match(req, { ignoreSearch: true })) || Response.error(); }
    })());
    return;
  }
  // versioned assets: cache first, refreshed in the background
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(req) || await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; });
    if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
    return net.catch(() => Response.error());
  })());
});
