"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Search, Filter, Clock, RefreshCw, Loader2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { SwipeableCard } from "@/components/swipeable-card"
import type { TicketStatus, Ticket } from "@/lib/types"
import { useTickets } from "@/lib/hooks/useTickets"
import { formatDuration, getStatusBadgeConfig, formatDateTime } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { useErrorHandler } from "@/lib/hooks/useErrorHandler"

type FilterStatus = "all" | TicketStatus

export default function VehiclesPage() {
  const router = useRouter()
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set())
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [ticketToDelete, setTicketToDelete] = useState<Ticket | null>(null)
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
  const { error: actionError, handleError, clearError } = useErrorHandler("Delete failed")

  const getStatusBadge = (status: TicketStatus) => {
    const { label, className } = getStatusBadgeConfig(status)
    return (
      <Badge variant="secondary" className={className}>
        {label}
      </Badge>
    )
  }

  const activeCount = tickets.filter((t) => t.status === "active").length

  const handleDeleteClick = (ticket: Ticket) => {
    setTicketToDelete(ticket)
    setShowDeleteDialog(true)
  }

  const handleConfirmDelete = async () => {
    if (!ticketToDelete) return

    const ticketId = ticketToDelete.id
    if (deletingIds.has(ticketId)) return

    setDeletingIds((prev) => new Set(prev).add(ticketId))
    setShowDeleteDialog(false)
    
    try {
      clearError()
      const supabase = createClient()
      const { error: deleteError } = await supabase.from("tickets").delete().eq("id", ticketId)

      if (deleteError) throw deleteError

      await refresh()
      setTicketToDelete(null)
    } catch (err) {
      handleError(err, "Delete failed, please try again")
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev)
        next.delete(ticketId)
        return next
      })
    }
  }

  const handleCancelDelete = () => {
    setShowDeleteDialog(false)
    setTicketToDelete(null)
  }

  const handleCardTap = (ticketId: number) => {
    router.push(`/vehicles/${ticketId}`)
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <main className="mx-auto max-w-md px-4 py-4 space-y-4">
        <div className="flex justify-end">
          <Button variant="ghost" size="icon" onClick={refresh} disabled={isRefreshing}>
            <RefreshCw className={`h-5 w-5 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <Card className="mb-4 bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-200/50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded bg-green-100">
                  <Image src="/logo.png" alt="Vehicle icon" width={20} height={20} className="object-contain" />
                </span>
                <span className="text-sm text-muted-foreground">Current</span>
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
              onChange={(e) => {
                setSearchQuery(e.target.value)
              }}
              placeholder="Search plate"
              className="font-mono text-sm"
            />
            <Button onClick={refresh} disabled={isLoading || isRefreshing} size="sm" variant="outline">
              {isRefreshing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          {[error, actionError].filter(Boolean).map((message, index) => (
            <div key={index} className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {message}
            </div>
          ))}

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as FilterStatus)}>
              <SelectTrigger className="w-full text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="exited">Exited</SelectItem>
                <SelectItem value="abnormal">Abnormal</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-12">
            <div className="mx-auto h-12 w-12 mb-2">
              <Image src="/logo.png" alt="No vehicles" width={48} height={48} className="object-contain opacity-60" />
            </div>
            <p className="text-muted-foreground text-sm">No records</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tickets.map((ticket) => (
              <SwipeableCard
                key={ticket.id}
                onDelete={() => handleDeleteClick(ticket)}
                onTap={() => handleCardTap(ticket.id)}
                disabled={deletingIds.has(ticket.id)}
                deleteLabel={deletingIds.has(ticket.id) ? "Deleting..." : "Delete"}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {ticket.photo_url ? (
                      <div className="h-12 w-12 overflow-hidden rounded bg-muted">
                        <img
                          src={ticket.photo_url || "/placeholder.svg"}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded bg-muted">
                        <Image src="/logo.png" alt="Vehicle" width={24} height={24} className="object-contain opacity-70" />
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
              </SwipeableCard>
            ))}
          </div>
        )}
      </main>

      <Dialog 
        open={showDeleteDialog} 
        onOpenChange={(open) => {
          if (!open) {
            handleCancelDelete()
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirm Delete
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this parking record?
              {ticketToDelete && (
                <>
                  <br />
                  <br />
                  <span className="font-mono font-bold text-foreground">
                    {ticketToDelete.plate_number}
                  </span>
                  <br />
                  <span className="text-xs text-muted-foreground">
                    Entry: {formatDateTime(ticketToDelete.entry_time)}
                  </span>
                  {ticketToDelete.exit_time && (
                    <span className="text-xs text-muted-foreground block">
                      Exit: {formatDateTime(ticketToDelete.exit_time)}
                    </span>
                  )}
                  <br />
                  <span className="text-xs text-destructive font-medium">
                    This action cannot be undone.
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={handleCancelDelete} className="flex-1">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={!ticketToDelete || deletingIds.has(ticketToDelete.id)}
              className="flex-1"
            >
              {ticketToDelete && deletingIds.has(ticketToDelete.id) ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
