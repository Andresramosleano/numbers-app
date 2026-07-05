// Numbers Oracle — Service Worker v1.27
const CACHE_NAME = 'numbers-oracle-v1.27';

// Archivos esenciales a cachear para modo offline básico
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Instalación: cachear recursos esenciales
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activación: limpiar cachés antiguas
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: Network-first (siempre datos frescos), fallback a cache
self.addEventListener('fetch', event => {
  // Solo interceptar peticiones GET al mismo dominio
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // No interceptar peticiones a Supabase ni a APIs externas
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('jsdelivr.net')
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Guardar copia en cache si la respuesta es válida
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Sin red: servir desde cache
        return caches.match(event.request).then(cached => {
          return cached || caches.match('/index.html');
        });
      })
  );
});
