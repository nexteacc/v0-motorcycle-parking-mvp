"use client"

import Link from "next/link"
import { LogIn, LogOut, List, Clock, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useStats } from "@/lib/hooks/useStats"

export default function HomePage() {
  const { stats, isLoading: statsLoading } = useStats()

  const quickActions = [
    { href: "/entry", icon: LogIn, title: "Check In", description: "Photo entry" },
    { href: "/exit", icon: LogOut, title: "Check Out", description: "Scan or search" },
    { href: "/vehicles", icon: List, title: "Vehicles", description: "Records" },
    { href: "/history", icon: Clock, title: "History", description: "History" },
  ]

  return (
    <div className="min-h-screen bg-background pb-24">
      <main className="mx-auto max-w-md px-4 py-6">
        {/* Hero Section */}
        <div className="mb-8 text-center">
          <h2 className="mb-2 text-2xl font-bold">Welcome</h2>
          <p className="text-sm text-muted-foreground">Select a function</p>
        </div>

        {/* Quick Actions Grid */}
        <div className="grid gap-3 grid-cols-2 mb-8">
          {quickActions.map(({ href, icon: Icon, title, description }) => (
            <Link key={href} href={href}>
              <Card className="h-full cursor-pointer transition-all hover:border-primary/50 hover:shadow-md active:scale-95">
                <CardContent className="p-4 flex flex-col items-center text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 mb-2">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-sm">{title}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{description}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Stats Section */}
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="text-sm">Today</CardTitle>
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
      </main>
    </div>
  )
}
