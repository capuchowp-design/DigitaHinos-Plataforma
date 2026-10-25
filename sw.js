// ── DigitaHinos Plataforma | Service Worker ────────────────────────────────────────
const CACHE_NAME = 'digitahinos-plataforma-v5';

// Assets to pre-cache for offline use
const PRECACHE_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
    './sw-register.js',
    'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Space+Mono:wght@400;700&display=swap'
];

// ── Install: pre-cache shell assets ────────────────────────────────────────
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) =>
            // Tolerante: um arquivo que falhe não derruba a instalação do SW
            Promise.all(PRECACHE_ASSETS.map((url) => cache.add(url).catch(() => null)))
        )
    );
    // Activate immediately without waiting for old tabs to close
    self.skipWaiting();
});

// ── Activate: clean up old caches ──────────────────────────────────────────
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

// ── Fetch: cache-first for local assets, network-first for external ─────────
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // External links (apps DigitaHinos no GitHub Pages) → always network, no caching
    const externalHosts = [
        'youtube.com',
        'capuchowp-design.github.io'
    ];
    if (externalHosts.some((h) => url.hostname.includes(h))) {
        return; // Let browser handle normally
    }

    // Google Fonts → stale-while-revalidate
    if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
        event.respondWith(
            caches.open(CACHE_NAME).then(async (cache) => {
                const cached = await cache.match(request);
                const networkFetch = fetch(request).then((response) => {
                    cache.put(request, response.clone());
                    return response;
                });
                return cached || networkFetch;
            })
        );
        return;
    }

    // Local assets → cache-first
    event.respondWith(
        caches.match(request).then((cached) => {
            return cached || fetch(request).then((response) => {
                // Cache successful GET responses
                if (request.method === 'GET' && response.status === 200) {
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
                }
                return response;
            });
        }).catch(() => {
            // Offline fallback: serve index.html for navigation requests
            if (request.mode === 'navigate') {
                return caches.match('./index.html');
            }
        })
    );
});
