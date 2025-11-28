import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { BottomNav } from "@/components/bottom-nav"
import { ThemeToggle } from "@/components/theme-toggle"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "摩托车停车管理系统 - 智能停车解决方案",
  description: "支持车牌识别、二维码扫码、实时追踪的现代化摩托车停车管理平台",
  generator: "v0.app",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <header className="sticky top-0 z-40 border-b border-border/50 bg-background/95 backdrop-blur-md">
          <div className="mx-auto max-w-md px-4 py-2 flex items-center justify-end">
            <ThemeToggle />
          </div>
        </header>
        {children}
        <BottomNav />
        <Analytics />
      </body>
    </html>
  )
}
