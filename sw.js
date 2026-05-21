// sw.js - Service Worker v18
const CACHE_NAME = 'packlist-v18';
const ASSETS = [
    '/',
    '/index.html',
    '/js/app.js',
    '/css/style.css'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Cache aperta');
            return cache.addAll(ASSETS);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const url = event.request.url;

    // FIX: Ignora richieste chrome-extension e manifest.json per evitare errori
    if (url.startsWith('chrome-extension://')) return;
    if (url.includes('manifest.json')) return;
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;

            return fetch(event.request).then((networkResponse) => {
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    return networkResponse;
                }

                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });

                return networkResponse;
            }).catch(() => {
                if (event.request.headers.get('accept').includes('text/html')) {
                    return caches.match('/index.html');
                }
            });
        })
    );
});
