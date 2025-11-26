"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Search, Filter, Clock, Car, RefreshCw, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"
import type { Ticket, TicketStatus } from "@/lib/types"

type FilterStatus = "all" | TicketStatus

export default function VehiclesPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("active")
  const [isRefreshing, setIsRefreshing] = useState(false)

  const fetchTickets = async () => {
    const supabase = createClient()

    let query = supabase
      .from("tickets")
      .select("*")
      .eq("parking_lot_id", "default")
      .order("entry_time", { ascending: false })
      .limit(100)

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter)
    }

    if (searchQuery.trim()) {
      query = query.ilike("plate_number", `%${searchQuery.toUpperCase()}%`)
    }

    const { data, error } = await query

    if (!error && data) {
      setTickets(data as Ticket[])
    }
  }

  useEffect(() => {
    setIsLoading(true)
    fetchTickets().finally(() => setIsLoading(false))
  }, [statusFilter])

  const handleSearch = () => {
    setIsLoading(true)
    fetchTickets().finally(() => setIsLoading(false))
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchTickets()
    setIsRefreshing(false)
  }

  const formatDuration = (entryTime: string, exitTime?: string | null) => {
    const start = new Date(entryTime)
    const end = exitTime ? new Date(exitTime) : new Date()
    const diff = end.getTime() - start.getTime()

    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  const getStatusBadge = (status: TicketStatus) => {
    const variants: Record<TicketStatus, { label: string; className: string }> = {
      active: { label: "在场", className: "bg-green-100 text-green-700 hover:bg-green-100" },
      exited: { label: "已出场", className: "bg-gray-100 text-gray-700 hover:bg-gray-100" },
      error: { label: "错误", className: "bg-red-100 text-red-700 hover:bg-red-100" },
      abnormal: { label: "异常", className: "bg-orange-100 text-orange-700 hover:bg-orange-100" },
    }
    const { label, className } = variants[status]
    return (
      <Badge variant="secondary" className={className}>
        {label}
      </Badge>
    )
  }

  const activeCount = tickets.filter((t) => t.status === "active").length

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <h1 className="text-lg font-semibold text-foreground">车辆列表</h1>
            </div>
            <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={`h-5 w-5 ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-4 max-w-lg">
        {/* Stats */}
        <Card className="mb-4">
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
              placeholder="搜索车牌号"
              className="font-mono"
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={isLoading}>
              <Search className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as FilterStatus)}>
              <SelectTrigger className="w-32">
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
            <p className="text-muted-foreground">暂无车辆记录</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tickets.map((ticket) => (
              <Link key={ticket.id} href={`/vehicles/${ticket.id}`} className="block">
                <Card className="transition-all hover:shadow-md hover:border-primary/50">
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
                          <p className="font-mono font-bold">{ticket.plate_number}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(ticket.entry_time).toLocaleString("zh-CN", {
                              month: "numeric",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
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
