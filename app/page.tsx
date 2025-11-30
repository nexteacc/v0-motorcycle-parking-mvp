"use client"

import Link from "next/link"
import Image from "next/image"
import { Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useStats } from "@/lib/hooks/useStats"

export default function HomePage() {
  const { stats, isLoading: statsLoading } = useStats()
  const today = new Date()
  const dateLabel = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, "0")}.${String(today.getDate()).padStart(2, "0")}`

  const quickActions = [
    { href: "/entry", title: "Check In", icon: "/checkin.png" },
    { href: "/exit", title: "Check Out", icon: "/checkout.png" },
    { href: "/vehicles", title: "Vehicles", icon: "/vehicle.png" },
    { href: "/history", title: "History", icon: "/history.png" },
  ]

  return (
    <div className="min-h-screen bg-background pb-24">
      <main className="mx-auto max-w-md px-4 py-6 space-y-6">
        {/* Stats Section */}
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardHeader className="pb-2 text-center">
            <CardTitle className="text-sm text-muted-foreground tracking-wide">{dateLabel}</CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-primary">{stats.currentParking}</div>
                  <p className="text-xs text-muted-foreground mt-1">Current</p>
                </div>
                <div>
                  <div className="text-2xl font-bold text-primary">{stats.todayEntry}</div>
                  <p className="text-xs text-muted-foreground mt-1">Entries</p>
                </div>
                <div>
                  <div className="text-2xl font-bold text-primary">{stats.todayExit}</div>
                  <p className="text-xs text-muted-foreground mt-1">Exits</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions Grid */}
        <div className="grid gap-3 grid-cols-2">
          {quickActions.map(({ href, icon, title }) => (
            <Link key={href} href={href}>
              <Card className="h-full cursor-pointer transition-all hover:border-primary/50 hover:shadow-md active:scale-95">
                <CardContent className="p-4 flex flex-col items-center text-center">
                  <div className="flex h-12 w-12 items-center justify-center mb-2 overflow-hidden">
                    <Image src={icon} alt={`${title} icon`} width={48} height={48} className="object-contain" priority />
                  </div>
                  <h3 className="font-semibold text-sm">{title}</h3>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

      </main>
    </div>
  )
}
