// sw.js - Service Worker Ottimizzato v17
const CACHE_NAME = 'packlist-v17';
const ASSETS = [
    '/',
    '/index.html',
    '/js/app.js',
    '/css/style.css',
    '/data.json'
];

// Installazione: Cache delle risorse statiche
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Cache aperta');
            return cache.addAll(ASSETS);
        })
    );
    self.skipWaiting();
});

// Attivazione: Pulizia vecchie cache
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

// Fetch: Gestione richieste
self.addEventListener('fetch', (event) => {
    const url = event.request.url;

    // FIX CRITICO: Ignora manifest.json per evitare errori 401 su Vercel
    if (url.includes('manifest.json')) {
        return; 
    }

    // Ignora richieste non-GET
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }

            return fetch(event.request).then((networkResponse) => {
                // Controllo se la risposta è valida prima di cachearla
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    return networkResponse;
                }

                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });

                return networkResponse;
            }).catch(() => {
                // Fallback offline generico
                if (event.request.headers.get('accept').includes('text/html')) {
                    return caches.match('/index.html');
                }
            });
        })
    );
});
