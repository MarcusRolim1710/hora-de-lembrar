const CACHE_NAME = 'hora-de-lembrar-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/lobby.html',
  '/waiting.html',
  '/game.html',
  '/css/style.css',
  '/js/login.js',
  '/js/lobby.js',
  '/js/waiting.js',
  '/js/game.js',
  '/js/animations.js',
  '/manifest.json',
  '/icons/icon.svg',
  '/icons/logo-hora-de-lembrar.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js'
];

// Instalar Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Cache aberto');
        return cache.addAll(urlsToCache);
      })
      .catch((err) => console.warn('⚠️ Erro ao cachear:', err))
  );
  self.skipWaiting();
});

// Ativar Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Estratégia: Network First, fallback para Cache
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Se sucesso, clonar para cache
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Offline: usar cache
        return caches.match(event.request);
      })
  );
});
