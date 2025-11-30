// Service Worker for PWA
const CACHE_VERSION = 'v3'
const STATIC_CACHE = `motorcycle-parking-static-${CACHE_VERSION}`
const RUNTIME_CACHE = `motorcycle-parking-runtime-${CACHE_VERSION}`

// 需要缓存的静态资源（不再缓存 HTML 路由，避免旧版本一直命中）
const STATIC_ASSETS = [
  '/icon-light-32x32.png',
  '/icon-dark-32x32.png',
  '/apple-icon.png',
  '/icon.svg',
  '/manifest.json',
  '/favicon.ico',
]

// 安装 Service Worker
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...')
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
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
              cacheName !== STATIC_CACHE &&
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

  const acceptHeader = request.headers.get('accept') || ''

  // HTML 页面使用网络优先策略，确保发布后用户拉到最新版本
  if (acceptHeader.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone()
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, responseClone))
          return response
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request)
          if (cachedResponse) {
            return cachedResponse
          }
          return caches.match('/') // 兜底到首页
        })
    )
    return
  }

  // API 请求使用网络优先策略
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseClone = response.clone()
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseClone)
            })
          }
          return response
        })
        .catch(() => {
          return caches.match(request)
        })
    )
    return
  }

  // 其他静态资源使用缓存优先策略（首次未命中时缓存）
  const targetCache = STATIC_ASSETS.includes(url.pathname) ? STATIC_CACHE : RUNTIME_CACHE

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse
      }

      return fetch(request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response
          }

          const responseToCache = response.clone()
          caches.open(targetCache).then((cache) => {
            cache.put(request, responseToCache)
          })

          return response
        })
        .catch(() => undefined)
    })
  )
})

// 监听消息（用于手动更新缓存）
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
