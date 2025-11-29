"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Clock, Car, RefreshCw, Loader2, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SwipeableCard } from "@/components/swipeable-card"
import type { TicketStatus } from "@/lib/types"
import { useTickets } from "@/lib/hooks/useTickets"
import { formatDuration, getStatusBadgeConfig, formatDateTime } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

type FilterStatus = "all" | TicketStatus

export default function HistoryPage() {
  const router = useRouter()
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set())
  const {
    tickets,
    isLoading,
    isRefreshing,
    error,
    statusFilter,
    setStatusFilter,
    refresh,
  } = useTickets({
    defaultStatusFilter: "all",
    limit: 100,
    orderBy: "entry_time",
    orderDirection: "desc",
  })

  const getStatusBadge = (status: TicketStatus) => {
    const { label, className } = getStatusBadgeConfig(status)
    return (
      <Badge variant="secondary" className={className}>
        {label}
      </Badge>
    )
  }

  const handleDelete = async (ticketId: number) => {
    if (deletingIds.has(ticketId)) return

    setDeletingIds((prev) => new Set(prev).add(ticketId))
    try {
      const supabase = createClient()
      const { error: deleteError } = await supabase.from("tickets").delete().eq("id", ticketId)

      if (deleteError) throw deleteError

      // 刷新列表
      await refresh()
    } catch (err) {
      console.error("删除失败:", err)
      alert("删除失败，请重试")
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev)
        next.delete(ticketId)
        return next
      })
    }
  }

  const handleCardTap = (ticketId: number) => {
    router.push(`/vehicles/${ticketId}`)
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/50 bg-background/95 backdrop-blur-md">
        <div className="mx-auto max-w-md px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-foreground">历史记录</h1>
            <Button variant="ghost" size="icon" onClick={refresh} disabled={isRefreshing}>
              <RefreshCw className={`h-5 w-5 ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-4">
        {/* Status Filter */}
        <div className="mb-4 flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as FilterStatus)}>
            <SelectTrigger className="w-full text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部记录</SelectItem>
              <SelectItem value="exited">已出场</SelectItem>
              <SelectItem value="active">在场</SelectItem>
              <SelectItem value="abnormal">异常</SelectItem>
              <SelectItem value="error">错误</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="mx-auto h-12 w-12 text-muted-foreground/50 mb-2" />
            <p className="text-muted-foreground text-sm">暂无历史记录</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tickets.map((ticket) => (
              <SwipeableCard
                key={ticket.id}
                onDelete={() => handleDelete(ticket.id)}
                onTap={() => handleCardTap(ticket.id)}
                disabled={deletingIds.has(ticket.id)}
                deleteLabel={deletingIds.has(ticket.id) ? "删除中..." : "删除"}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {ticket.photo_url ? (
                      <div className="h-12 w-12 overflow-hidden rounded flex-shrink-0 bg-muted">
                        <img
                          src={ticket.photo_url || "/placeholder.svg"}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded flex-shrink-0 bg-muted">
                        <Car className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-mono font-bold text-sm">{ticket.plate_number}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {formatDateTime(ticket.entry_time)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 ml-2 flex-shrink-0">
                    {getStatusBadge(ticket.status)}
                    {ticket.exit_time && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDuration(ticket.entry_time, ticket.exit_time)}
                      </span>
                    )}
                  </div>
                </div>
              </SwipeableCard>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
