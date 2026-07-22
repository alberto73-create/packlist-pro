// sw.js - Service Worker per Packlist Pro
// Release checklist: mantenere questa versione allineata con APP_VERSION in js/modules/db.js,
// con la versione visibile/query string in index.html e con version/start_url in manifest.json.
// Cambiare CACHE_NAME a ogni release forza i browser a scaricare asset freschi.
const CACHE_NAME = 'packlist-v1.10.26';
const ASSETS = [
    '/',
    '/index.html',
    '/offline.html',
    '/js/app.js?v=1.10.26',
    '/vendor/pdf/packlist-pdf-adapter.js?v=1.10.26',
    '/vendor/pdf/packlist-autotable-adapter.js?v=1.10.26',
    '/js/modules/controller.js',
    '/js/modules/db.js',
    '/js/modules/db-data.js',
    '/js/modules/admin.js',
    '/js/modules/anonymous-logs.js',
    '/js/modules/communications.js',
    '/js/modules/pwa.js',
    '/js/modules/ui.js',
    '/js/modules/utils.js',
    '/css/style.css?v=1.10.26',
    '/manifest.json',
    '/icons/icon-backpack.svg',
    '/icons/icon-192.png',
    '/icons/icon-512.png'
];
const PRECACHE_URLS = new Set(ASSETS);

function cacheKeyFor(requestUrl) {
    const key = `${requestUrl.pathname}${requestUrl.search}`;
    if (PRECACHE_URLS.has(key)) return key;
    if (requestUrl.pathname === '/') return '/';
    return null;
}

function shouldBypassCache(requestUrl) {
    return requestUrl.pathname.startsWith('/api/');
}

self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('message', event => {
    if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)));
        // Il cambio controller fa ricaricare ogni client una sola volta tramite pwa.js.
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    const requestUrl = new URL(event.request.url);
    if (requestUrl.origin !== self.location.origin || shouldBypassCache(requestUrl)) return;

    const precacheKey = cacheKeyFor(requestUrl);
    if (!precacheKey && event.request.mode !== 'navigate') return;

    event.respondWith(
        fetch(event.request)
            .then(response => {
                if (response.ok && precacheKey) {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(precacheKey, copy));
                }
                return response;
            })
            .catch(async () => {
                if (precacheKey) {
                    const cached = await caches.match(precacheKey);
                    if (cached) return cached;
                }
                if (event.request.mode === 'navigate') return (await caches.match('/index.html')) || caches.match('/offline.html');
                return Response.error();
            })
    );
});
