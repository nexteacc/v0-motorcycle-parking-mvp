"use client"

import Link from "next/link"
import { Car, LogIn, LogOut, List, Clock, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useStats } from "@/lib/hooks/useStats"

export default function HomePage() {
  const { stats, isLoading: statsLoading } = useStats()

  const quickActions = [
    { href: "/entry", icon: LogIn, title: "入场登记", description: "快速拍照记录" },
    { href: "/exit", icon: LogOut, title: "出场登记", description: "扫码或搜索" },
    { href: "/vehicles", icon: List, title: "车辆列表", description: "所有停车记录" },
    { href: "/history", icon: Clock, title: "历史记录", description: "查看所有历史" },
  ]

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header 
        className="sticky top-0 z-30 border-b border-border/50 bg-background/95 backdrop-blur-md"
        style={{
          paddingTop: `calc(1rem + env(safe-area-inset-top, 0px))`,
        }}
      >
        <div className="mx-auto max-w-md px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
              <Car className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">停车管理</h1>
              <p className="text-xs text-muted-foreground">摩托车停车平台</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-md px-4 py-6">
        {/* Hero Section */}
        <div className="mb-8 text-center">
          <h2 className="mb-2 text-2xl font-bold">欢迎回来</h2>
          <p className="text-sm text-muted-foreground">选择需要的功能开始工作</p>
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
            <CardTitle className="text-sm">今日概览</CardTitle>
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
                  <p className="text-xs text-muted-foreground mt-1">当前停车</p>
                </div>
                <div>
                  <div className="text-2xl font-bold text-primary">{stats.todayEntry}</div>
                  <p className="text-xs text-muted-foreground mt-1">今日入场</p>
                </div>
                <div>
                  <div className="text-2xl font-bold text-primary">{stats.todayExit}</div>
                  <p className="text-xs text-muted-foreground mt-1">今日出场</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
