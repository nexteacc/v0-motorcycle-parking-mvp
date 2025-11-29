import type React from "react"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { BottomNav } from "@/components/bottom-nav"
import { ThemeToggle } from "@/components/theme-toggle"
import { PWAInstaller } from "@/components/pwa-installer"
import { ServiceWorkerRegistration } from "@/components/service-worker-registration"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "摩托车停车管理系统 - 智能停车解决方案",
  description: "支持车牌识别、二维码扫码、实时追踪的现代化摩托车停车管理平台",
  generator: "v0.app",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent", // 全屏模式，状态栏透明，内容延伸到状态栏下方
    title: "停车管理",
  },
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <header 
          className="sticky top-0 z-40 border-b border-border/50 bg-background/95 backdrop-blur-md"
          style={{
            paddingTop: `calc(0.5rem + env(safe-area-inset-top, 0px))`,
          }}
        >
          <div className="mx-auto max-w-md px-4 py-2 flex items-center justify-end">
            <ThemeToggle />
          </div>
        </header>
        {children}
        <BottomNav />
        <Analytics />
        <PWAInstaller />
        <ServiceWorkerRegistration />
      </body>
    </html>
  )
}
