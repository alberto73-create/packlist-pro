// ============================================================
//  Packlist Pro — Service Worker v1.00.14
//  Strategy: Cache-First for assets, Network-First for API
// ============================================================

const CACHE_NAME = 'packlist-v1.00.14';
const STATIC_CACHE = 'packlist-static-v1.00.14';
const DYNAMIC_CACHE = 'packlist-dynamic-v1.00.14';

// Assets to pre-cache on install
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  // CDN assets (jsPDF)
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js',
];

// ── INSTALL ──────────────────────────────────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Install v1.00.14');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[SW] Pre-caching static assets');
        // Use addAll but don't fail if CDN is unavailable
        return Promise.allSettled(
          PRECACHE_URLS.map(url =>
            cache.add(url).catch(err => console.warn(`[SW] Failed to cache: ${url}`, err))
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ─────────────────────────────────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activate v1.00.14');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ── FETCH ────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and non-http(s) requests
  if (!request.url.startsWith('http')) return;

  // Cache-First for static assets (same origin + CDN)
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Network-First for HTML (always fresh)
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Stale-While-Revalidate for everything else
  event.respondWith(staleWhileRevalidate(request));
});

// ── STRATEGIES ───────────────────────────────────────────────

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline - resource not cached', { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || offlineFallback();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);

  return cached || fetchPromise || offlineFallback();
}

// ── HELPERS ──────────────────────────────────────────────────

function isStaticAsset(url) {
  const staticExtensions = ['.js', '.css', '.woff2', '.woff', '.ttf', '.png', '.jpg', '.svg', '.ico'];
  const isStatic = staticExtensions.some(ext => url.pathname.endsWith(ext));
  const isCDN = url.hostname.includes('cdnjs.cloudflare.com') || url.hostname.includes('fonts.googleapis.com');
  return isStatic || isCDN;
}

function offlineFallback() {
  return new Response(
    `<!DOCTYPE html>
    <html lang="it">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Packlist Pro — Offline</title>
      <style>
        body { background: #0b0f1a; color: #e8edf5; font-family: sans-serif;
               display: flex; align-items: center; justify-content: center;
               min-height: 100vh; margin: 0; text-align: center; padding: 20px; }
        .icon { font-size: 3rem; margin-bottom: 16px; }
        h1 { font-size: 1.4rem; margin-bottom: 8px; }
        p { color: #4a5a72; font-size: 0.9rem; }
        button { margin-top: 20px; background: #5a67f2; color: white; border: none;
                 padding: 12px 24px; border-radius: 12px; cursor: pointer; font-size: 0.9rem; }
      </style>
    </head>
    <body>
      <div>
        <div class="icon">🎒</div>
        <h1>Sei offline</h1>
        <p>Packlist Pro funziona offline una volta caricata.<br>Ricarica la pagina con connessione attiva la prima volta.</p>
        <button onclick="location.reload()">↩ Riprova</button>
      </div>
    </body>
    </html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

// ── MESSAGE HANDLER ──────────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data?.action === 'skipWaiting') {
    console.log('[SW] Forcing update via skipWaiting');
    self.skipWaiting();
  }

  if (event.data?.action === 'clearCache') {
    caches.keys().then(names => Promise.all(names.map(n => caches.delete(n))))
      .then(() => event.source.postMessage({ action: 'cacheCleared' }));
  }

  if (event.data?.action === 'getCacheSize') {
    getCacheSize().then(size => event.source.postMessage({ action: 'cacheSize', size }));
  }
});

async function getCacheSize() {
  let totalBytes = 0;
  const cacheNames = await caches.keys();
  for (const name of cacheNames) {
    const cache = await caches.open(name);
    const requests = await cache.keys();
    for (const req of requests) {
      const res = await cache.match(req);
      if (res) {
        const blob = await res.clone().blob();
        totalBytes += blob.size;
      }
    }
  }
  return totalBytes;
}

// ── PUSH NOTIFICATIONS (placeholder) ─────────────────────────
self.addEventListener('push', event => {
  const data = event.data?.json() ?? { title: 'Packlist Pro', body: 'Hai item da preparare!' };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: './icons/icon-192.png',
      badge: './icons/icon-72.png',
      tag: 'packlist-notification',
      renotify: true,
      data: { url: data.url || './' }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      if (clientList.length > 0) return clientList[0].focus();
      return clients.openWindow(event.notification.data?.url || './');
    })
  );
});
