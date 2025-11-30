import type React from "react"
import type { Metadata, Viewport } from "next"
import Link from "next/link"
import Image from "next/image"
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
  title: "Motorcycle Parking Management System - Smart Parking Solution",
  description: "Modern motorcycle parking management platform with license plate recognition, QR code scanning, and real-time tracking",
  generator: "v0.app",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Parking",
  },
  icons: {
    icon: [
      {
        url: "/favicon.ico",
        sizes: "any",
      },
      {
        url: "/icon-light-32x32.png",
        sizes: "32x32",
        type: "image/png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        sizes: "32x32",
        type: "image/png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        url: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
    apple: [
      {
        url: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
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
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <header 
          className="sticky top-0 z-40 border-b border-border/50 bg-background/95 backdrop-blur-md"
          style={{
            paddingTop: `calc(0.5rem + env(safe-area-inset-top, 0px))`,
          }}
        >
          <div className="mx-auto max-w-md px-4 py-2 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg overflow-hidden">
                <Image src="/logo.png" alt="Parking Logo" width={36} height={36} className="object-contain" priority />
              </div>
              <div className="leading-tight">
                <p className="text-sm font-semibold text-foreground">Parking</p>
                <p className="text-[10px] text-muted-foreground">Platform</p>
              </div>
            </Link>
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
