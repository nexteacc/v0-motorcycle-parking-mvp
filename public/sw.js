// Service Worker for PWA
const CACHE_NAME = 'motorcycle-parking-v2' // 更新版本号以强制刷新缓存
const RUNTIME_CACHE = 'motorcycle-parking-runtime-v2'

// 需要缓存的静态资源
const STATIC_ASSETS = [
  '/',
  '/entry',
  '/exit',
  '/history',
  '/vehicles',
  '/icon-light-32x32.png',
  '/icon-dark-32x32.png',
  '/apple-icon.png',
  '/icon.svg',
  '/manifest.json',
]

// 安装 Service Worker
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...')
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching static assets')
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[Service Worker] Failed to cache some assets:', err)
      })
    })
  )
  // 立即激活新的 Service Worker
  self.skipWaiting()
})

// 激活 Service Worker
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...')
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            // 删除旧版本的缓存
            return (
              cacheName.startsWith('motorcycle-parking-') &&
              cacheName !== CACHE_NAME &&
              cacheName !== RUNTIME_CACHE
            )
          })
          .map((cacheName) => {
            console.log('[Service Worker] Deleting old cache:', cacheName)
            return caches.delete(cacheName)
          })
      )
    })
  )
  // 立即控制所有客户端
  return self.clients.claim()
})

// 拦截网络请求
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // 跳过非 GET 请求和跨域请求
  if (request.method !== 'GET' || url.origin !== location.origin) {
    return
  }

  // API 请求使用网络优先策略
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // 如果网络请求成功，缓存响应
          if (response.ok) {
            const responseClone = response.clone()
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseClone)
            })
          }
          return response
        })
        .catch(() => {
          // 网络失败时，尝试从缓存获取
          return caches.match(request)
        })
    )
    return
  }

  // 静态资源使用缓存优先策略
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse
      }

      // 缓存未命中，从网络获取
      return fetch(request)
        .then((response) => {
          // 只缓存成功的响应
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response
          }

          const responseToCache = response.clone()
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, responseToCache)
          })

          return response
        })
        .catch(() => {
          // 网络失败且缓存也没有，返回离线页面（如果有）
          if (request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/')
          }
        })
    })
  )
})

// 监听消息（用于手动更新缓存）
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
