"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Search, Filter, Clock, Car, RefreshCw, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { TicketStatus } from "@/lib/types"
import { useTickets } from "@/lib/hooks/useTickets"
import { formatDuration, getStatusBadgeConfig, formatDateTime } from "@/lib/utils"

type FilterStatus = "all" | TicketStatus

export default function VehiclesPage() {
  const {
    tickets,
    isLoading,
    isRefreshing,
    error,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    fetchTickets,
    refresh,
  } = useTickets({
    defaultStatusFilter: "active",
    limit: 100,
  })

  // 搜索防抖已在 useTickets hook 内部实现，无需额外处理

  const getStatusBadge = (status: TicketStatus) => {
    const { label, className } = getStatusBadgeConfig(status)
    return (
      <Badge variant="secondary" className={className}>
        {label}
      </Badge>
    )
  }

  const activeCount = tickets.filter((t) => t.status === "active").length

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-30 border-b border-border/50 bg-background/95 backdrop-blur-md">
        <div className="mx-auto max-w-md px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-foreground">车辆列表</h1>
            <Button variant="ghost" size="icon" onClick={refresh} disabled={isRefreshing}>
              <RefreshCw className={`h-5 w-5 ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-4">
        {/* Stats */}
        <Card className="mb-4 bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-200/50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Car className="h-5 w-5 text-green-600" />
                <span className="text-sm text-muted-foreground">当前在场车辆</span>
              </div>
              <span className="text-2xl font-bold text-green-600">{activeCount}</span>
            </div>
          </CardContent>
        </Card>

        {/* Search and Filter */}
        <div className="mb-4 space-y-3">
          <div className="flex gap-2">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
              placeholder="搜索车牌号（实时搜索）"
              className="font-mono text-sm"
            />
            <Button onClick={refresh} disabled={isLoading || isRefreshing} size="sm" variant="outline">
              {isRefreshing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          {error && (
            <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as FilterStatus)}>
              <SelectTrigger className="w-full text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="active">在场</SelectItem>
                <SelectItem value="exited">已出场</SelectItem>
                <SelectItem value="abnormal">异常</SelectItem>
                <SelectItem value="error">错误</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-12">
            <Car className="mx-auto h-12 w-12 text-muted-foreground/50 mb-2" />
            <p className="text-muted-foreground text-sm">暂无车辆记录</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tickets.map((ticket) => (
              <Link key={ticket.id} href={`/vehicles/${ticket.id}`} className="block">
                <Card className="transition-all hover:shadow-md hover:border-primary/50 active:scale-95">
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {ticket.photo_url ? (
                          <div className="h-12 w-12 overflow-hidden rounded bg-muted">
                            <img
                              src={ticket.photo_url || "/placeholder.svg"}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded bg-muted">
                            <Car className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <p className="font-mono font-bold text-sm">{ticket.plate_number}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(ticket.entry_time)}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {getStatusBadge(ticket.status)}
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatDuration(ticket.entry_time, ticket.exit_time)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
