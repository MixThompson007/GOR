// ============================================================
// GOR v3.1 — Service Worker
// Improved: No API caching
// ============================================================

const CACHE_NAME = 'gor-v3.1'
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/main.js',
  '/manifest.json'
]

// Install event — cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.error('SW: Cache addAll error', err)
      })
    })
  )
  self.skipWaiting()
})

// Activate event — clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    })
  )
  self.clients.claim()
})

// Fetch event — serve from cache, fallback to network
// IMPORTANT: Do NOT cache Supabase API calls
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)
  
  // Skip Supabase API and Cloudinary requests — always go to network
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('cloudinary.com') ||
    url.pathname.includes('/rest/v1/') ||
    url.pathname.includes('/auth/v1/') ||
    url.pathname.includes('/storage/v1/')
  ) {
    return // Let browser handle it normally (no caching)
  }
  
  // Skip chrome-extension and other non-http requests
  if (!event.request.url.startsWith('http')) {
    return
  }
  
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      // Return cached response if exists
      if (cachedResponse) {
        return cachedResponse
      }
      
      // Fetch from network
      return fetch(event.request).then(response => {
        // Don't cache non-successful responses or non-GET requests
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response
        }
        
        // Cache static files only
        const responseClone = response.clone()
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone).catch(() => {})
        })
        
        return response
      }).catch(() => {
        // Offline fallback — you can return a custom offline page here
        // For now, just let it fail
        return new Response('Offline — ไม่สามารถเชื่อมต่อได้', {
          status: 503,
          statusText: 'Service Unavailable'
        })
      })
    })
  )
})