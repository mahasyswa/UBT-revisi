// This service worker unregisters itself and clears all caches// Unregister all service workers// Force clear all caches and unregister

// Used to remove old service worker from Vercel deployment

self.addEventListener('install', function(e) {self.addEventListener('install', (event) => {

self.addEventListener('install', (event) => {

  console.log('SW: Uninstalling old service worker...');  self.skipWaiting();  console.log('Service Worker: Force uninstalling...');

  self.skipWaiting();

      });});  self.skipWaiting();



self.addEventListener('activate', (event) => {});

  console.log('SW: Clearing all caches and unregistering...');

  event.waitUntil(self.addEventListener('activate', function(e) {

    caches.keys()

      .then((cacheNames) => {  self.registration.unregister()self.addEventListener('activate', (event) => {

        return Promise.all(

          cacheNames.map((cacheName) => {    .then(function() {  console.log('Service Worker: Force clearing all caches...');

            console.log('SW: Deleting cache:', cacheName);

            return caches.delete(cacheName);      return self.clients.matchAll();  event.waitUntil(

          })

        );    })    caches.keys().then((cacheNames) => {

      })

      .then(() => {    .then(function(clients) {      return Promise.all(

        console.log('SW: Unregistering service worker...');

        return self.registration.unregister();      clients.forEach(client => client.navigate(client.url))        cacheNames.map((cacheName) => caches.delete(cacheName))

      })

      .then(() => {    });      );

        console.log('SW: Reloading all clients...');

        return self.clients.matchAll();});    }).then(() => {

      })

      .then((clients) => {      return self.registration.unregister();

        clients.forEach(client => {    }).then(() => {

          console.log('SW: Navigating client:', client.url);      return self.clients.matchAll();

          client.navigate(client.url);    }).then((clients) => {

        });      clients.forEach(client => client.navigate(client.url));

      })    })

      .catch((error) => {  );

        console.error('SW: Error during cleanup:', error);});

      })

  );const CACHE_NAME = 'barcode-protocol-v1.0.2';

});const STATIC_CACHE = 'static-' + CACHE_NAME;

const DYNAMIC_CACHE = 'dynamic-' + CACHE_NAME;

// Files to cache for offline functionality
const STATIC_FILES = [
  '/',
  '/scanner',
  '/styles.css',
  '/scanner.css',
  '/manifest.json'
  // Removed CDN links from pre-cache to avoid install failures
];

// API endpoints to cache
const API_ENDPOINTS = [
  '/api/',
  '/scan/',
  '/barcode/'
];

// Install event - cache static files
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('Service Worker: Caching static files');
        return cache.addAll(STATIC_FILES);
      })
      .catch((error) => {
        console.error('Service Worker: Error caching static files', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('Service Worker: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      self.clients.claim()
    ])
  );
});

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Handle same-origin requests
  if (url.origin === location.origin) {
    event.respondWith(handleSameOriginRequest(request));
  } else {
    // Handle external resources (CDN, etc.)
    event.respondWith(handleExternalRequest(request));
  }
});

// Handle same-origin requests with cache-first strategy
function handleSameOriginRequest(request) {
  // For API requests, use network-first strategy
  if (isApiRequest(request.url)) {
    return networkFirstStrategy(request);
  }
  
  // For static resources, use cache-first strategy
  return cacheFirstStrategy(request);
}

// Handle external requests (CDN resources)
function handleExternalRequest(request) {
  // Use network-first for CDN to avoid install-time cache issues
  return networkFirstStrategy(request);
}

// Check if request is for API endpoint
function isApiRequest(url) {
  return API_ENDPOINTS.some(endpoint => url.includes(endpoint));
}

// Cache-first strategy: check cache first, fallback to network
function cacheFirstStrategy(request) {
  return caches.match(request)
    .then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      
      return fetch(request)
        .then((networkResponse) => {
          // Clone response before caching
          const responseClone = networkResponse.clone();
          
          // Cache successful responses
          if (networkResponse.status === 200) {
            caches.open(DYNAMIC_CACHE)
              .then((cache) => {
                cache.put(request, responseClone);
              });
          }
          
          return networkResponse;
        })
        .catch(() => {
          // Return offline page for navigation requests
          if (request.destination === 'document') {
            return caches.match('/');
          }
          
          // Return empty response for other requests
          return new Response('', { status: 404 });
        });
    });
}

// Network-first strategy: try network first, fallback to cache
function networkFirstStrategy(request) {
  return fetch(request)
    .then((networkResponse) => {
      // Clone response before caching
      const responseClone = networkResponse.clone();
      
      // Cache successful responses
      if (networkResponse.status === 200) {
        caches.open(DYNAMIC_CACHE)
          .then((cache) => {
            cache.put(request, responseClone);
          });
      }
      
      return networkResponse;
    })
    .catch(() => {
      // Fallback to cache if network fails
      return caches.match(request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          // Return error response if not in cache
          return new Response(
            JSON.stringify({ error: 'Network unavailable', offline: true }),
            {
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'application/json' }
            }
          );
        });
    });
}

// Handle background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync triggered', event.tag);
  
  if (event.tag === 'background-sync-status-update') {
    event.waitUntil(syncStatusUpdates());
  }
});

// Sync offline status updates when connection restored
function syncStatusUpdates() {
  return caches.open(DYNAMIC_CACHE)
    .then((cache) => {
      return cache.keys();
    })
    .then((requests) => {
      const syncPromises = requests
        .filter((request) => request.url.includes('/api/confirm-usage/'))
        .map((request) => {
          return fetch(request)
            .then((response) => {
              if (response.status === 200) {
                // Remove from cache after successful sync
                return caches.open(DYNAMIC_CACHE)
                  .then((cache) => cache.delete(request));
              }
            })
            .catch((error) => {
              console.error('Service Worker: Sync failed for', request.url, error);
            });
        });
      
      return Promise.all(syncPromises);
    });
}

// Handle push notifications
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push notification received');
  
  const options = {
    body: event.data ? event.data.text() : 'New barcode protocol update',
    icon: '/icons/icon-96x96.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'View Dashboard',
        icon: '/icons/icon-72x72.png'
      },
      {
        action: 'close',
        title: 'Close notification',
        icon: '/icons/icon-72x72.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('Barcode Protocol System', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked');
  
  event.notification.close();
  
  if (event.action === 'explore') {
    // Open the app
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Handle messages from main thread
self.addEventListener('message', (event) => {
  console.log('Service Worker: Message received', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});