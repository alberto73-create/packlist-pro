// sw.js - Service Worker v27
const CACHE_NAME = 'packlist-v27';
const ASSETS = [
    '/',
    '/index.html',
    '/js/app.js?v=1.1.0',
    '/js/modules/controller.js',
    '/js/modules/db.js',
    '/js/modules/pwa.js',
    '/js/modules/ui.js',
    '/js/modules/utils.js',
    '/css/style.css?v=1.1.0',
    '/manifest.json'
];

self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)));
        await self.clients.claim();

        // Forza anche le pagine ancora aperte con il vecchio JS/CSS a caricare la nuova build.
        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        await Promise.all(clients.map(client => client.navigate(client.url)));
    })());
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    const requestUrl = new URL(event.request.url);
    if (requestUrl.origin !== self.location.origin) return;

    event.respondWith(
        fetch(event.request)
            .then(response => {
                if (response.ok) {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
                }
                return response;
            })
            .catch(async () => {
                const cached = await caches.match(event.request);
                if (cached) return cached;
                if (event.request.mode === 'navigate') return caches.match('/index.html');
                return Response.error();
            })
    );
});
