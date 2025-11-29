"use client"

import { useEffect } from "react"

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator
    ) {
      let registration: ServiceWorkerRegistration | null = null

      // 注册 Service Worker
      navigator.serviceWorker
        .register("/sw.js", {
          scope: "/",
          updateViaCache: "none", // 禁用 Service Worker 脚本的缓存
        })
        .then((reg) => {
          registration = reg
          console.log("[PWA] Service Worker registered:", reg.scope)

          // 立即检查更新
          reg.update()

          // 监听更新发现
          reg.addEventListener("updatefound", () => {
            const newWorker = reg.installing
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (
                  newWorker.state === "installed" &&
                  navigator.serviceWorker.controller
                ) {
                  // 新版本已安装，自动激活并刷新
                  console.log("[PWA] New version available, activating...")
                  newWorker.postMessage({ type: "SKIP_WAITING" })
                }
              })
            }
          })
        })
        .catch((error) => {
          console.error("[PWA] Service Worker registration failed:", error)
        })

      // 监听 Service Worker 控制权变化（自动刷新）
      let refreshing = false
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!refreshing) {
          refreshing = true
          console.log("[PWA] New Service Worker activated, reloading...")
          window.location.reload()
        }
      })

      // 定期检查更新（每次页面可见时检查）
      const checkForUpdates = () => {
        if (registration) {
          registration.update()
        }
      }

      // 页面可见时检查更新
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
          checkForUpdates()
        }
      })

      // 页面聚焦时检查更新
      window.addEventListener("focus", checkForUpdates)

      // 定期检查更新（每 60 秒）
      const updateInterval = setInterval(checkForUpdates, 60000)

      return () => {
        clearInterval(updateInterval)
        document.removeEventListener("visibilitychange", checkForUpdates)
        window.removeEventListener("focus", checkForUpdates)
      }
    }
  }, [])

  return null
}
