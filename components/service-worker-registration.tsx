"use client"

import { useEffect } from "react"

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator
    ) {
      let registration: ServiceWorkerRegistration | null = null

      navigator.serviceWorker
        .register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        })
        .then((reg) => {
          registration = reg
          console.log("[PWA] Service Worker registered:", reg.scope)

          reg.update()

          reg.addEventListener("updatefound", () => {
            const newWorker = reg.installing
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (
                  newWorker.state === "installed" &&
                  navigator.serviceWorker.controller
                ) {
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

      let refreshing = false
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!refreshing) {
          refreshing = true
          console.log("[PWA] New Service Worker activated, reloading...")
          window.location.reload()
        }
      })

      const checkForUpdates = () => {
        if (registration) {
          registration.update()
        }
      }

      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
          checkForUpdates()
        }
      })

      window.addEventListener("focus", checkForUpdates)

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
