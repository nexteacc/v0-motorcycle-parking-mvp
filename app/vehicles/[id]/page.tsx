"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Edit2, Clock, Calendar, Smartphone, Check, X, Loader2, AlertTriangle, LogOut, Car } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { QRCodeDisplay } from "@/components/qr-code-display"
import { createClient } from "@/lib/supabase/client"
import type { Ticket, TicketStatus } from "@/lib/types"
import { useErrorHandler } from "@/lib/hooks/useErrorHandler"

export default function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { error, handleError, clearError } = useErrorHandler("Operation failed")

  // Edit plate state
  const [isEditingPlate, setIsEditingPlate] = useState(false)
  const [editedPlate, setEditedPlate] = useState("")
  const [isSavingPlate, setIsSavingPlate] = useState(false)

  // Exit dialog
  const [showExitDialog, setShowExitDialog] = useState(false)
  const [isExiting, setIsExiting] = useState(false)

  const deviceId = typeof window !== "undefined" ? localStorage.getItem("device_id") || "unknown" : "unknown"

  useEffect(() => {
    const fetchTicket = async () => {
      const supabase = createClient()
      const { data, error: fetchError } = await supabase
        .from("tickets")
        .select("*")
        .eq("id", resolvedParams.id)
        .single()

      if (fetchError) {
        handleError(new Error("Record not found"))
      } else {
        clearError()
        setTicket(data as Ticket)
        setEditedPlate(data.plate_number)
      }
      setIsLoading(false)
    }

    fetchTicket()
  }, [resolvedParams.id])

  const handleEditPlate = () => {
    if (ticket?.plate_modified) {
      handleError(new Error("Plate can only be modified once"))
      return
    }
    setIsEditingPlate(true)
    setEditedPlate(ticket?.plate_number || "")
  }

  const handleSavePlate = async () => {
    if (!ticket || !editedPlate.trim()) return

    setIsSavingPlate(true)
    clearError()

    try {
      const supabase = createClient()

      const { error: updateError } = await supabase
        .from("tickets")
        .update({
          plate_number: editedPlate.toUpperCase(),
          plate_modified: true,
          original_plate_number: ticket.plate_number,
        })
        .eq("id", ticket.id)

      if (updateError) throw updateError

      // Log the operation
      await supabase.from("operation_logs").insert({
        ticket_id: ticket.id,
        operation_type: "modify_plate",
        old_value: { plate_number: ticket.plate_number },
        new_value: { plate_number: editedPlate.toUpperCase() },
        device_id: deviceId,
      })

      setTicket({
        ...ticket,
        plate_number: editedPlate.toUpperCase(),
        plate_modified: true,
        original_plate_number: ticket.plate_number,
      })
      setIsEditingPlate(false)
    } catch (err) {
      handleError(err, "Update failed")
    } finally {
      setIsSavingPlate(false)
    }
  }

  const handleCancelEdit = () => {
    setEditedPlate(ticket?.plate_number || "")
    setIsEditingPlate(false)
  }

  const handleConfirmExit = async () => {
    if (!ticket) return

    setIsExiting(true)
    clearError()

    try {
      const supabase = createClient()

      const { data, error: updateError } = await supabase
        .from("tickets")
        .update({
          status: "exited",
          exit_time: new Date().toISOString(),
        })
        .eq("id", ticket.id)
        .select()
        .single()

      if (updateError) throw updateError

      await supabase.from("operation_logs").insert({
        ticket_id: ticket.id,
        operation_type: "exit",
        old_value: { status: "active" },
        new_value: { status: "exited", exit_time: new Date().toISOString() },
        device_id: deviceId,
      })

      setTicket(data as Ticket)
      setShowExitDialog(false)
    } catch (err) {
      handleError(err, "Check out failed")
    } finally {
      setIsExiting(false)
    }
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
      active: { label: "Active", className: "bg-green-100 text-green-700" },
      exited: { label: "Exited", className: "bg-gray-100 text-gray-700" },
      error: { label: "Error", className: "bg-red-100 text-red-700" },
      abnormal: { label: "Abnormal", className: "bg-orange-100 text-orange-700" },
    }
    const { label, className } = variants[status]
    return (
      <Badge variant="secondary" className={className}>
        {label}
      </Badge>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center gap-3">
              <Link href="/vehicles">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <h1 className="text-lg font-semibold">Details</h1>
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-12 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground/50 mb-2" />
          <p className="text-muted-foreground">{error || "Record not found"}</p>
          <Button className="mt-4" asChild>
            <Link href="/vehicles">Back</Link>
          </Button>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header 
        className="border-b bg-card sticky top-0 z-10"
        style={{
          paddingTop: `calc(0.75rem + env(safe-area-inset-top, 0px))`,
        }}
      >
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/vehicles">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <h1 className="text-lg font-semibold">Details</h1>
            </div>
            {getStatusBadge(ticket.status)}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-lg space-y-4 pb-6">
        {/* Photo - Always show photo section */}
        <Card>
          <CardContent className="p-0">
            <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
              {ticket.photo_url ? (
                <img
                  src={ticket.photo_url}
                  alt="Vehicle photo"
                  className="h-full w-full object-cover"
                  loading="eager"
                  onError={(e) => {
                    // 如果图片加载失败，显示占位符
                    const target = e.target as HTMLImageElement
                    target.style.display = 'none'
                    const container = target.parentElement
                    if (container) {
                      const placeholder = document.createElement('div')
                      placeholder.className = 'flex items-center justify-center h-full text-muted-foreground'
                      placeholder.innerHTML = `
                        <div class="text-center">
                          <svg class="h-12 w-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <p class="text-sm">Photo unavailable</p>
                        </div>
                      `
                      container.appendChild(placeholder)
                    }
                  }}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <Car className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No photo</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Plate Number */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Plate</CardTitle>
          </CardHeader>
          <CardContent>
            {isEditingPlate ? (
              <div className="flex gap-2">
                <Input
                  value={editedPlate}
                  onChange={(e) => setEditedPlate(e.target.value.toUpperCase())}
                  className="text-lg font-mono"
                />
                <Button size="icon" variant="ghost" onClick={handleSavePlate} disabled={isSavingPlate}>
                  {isSavingPlate ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 text-green-600" />
                  )}
                </Button>
                <Button size="icon" variant="ghost" onClick={handleCancelEdit}>
                  <X className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-2xl font-mono font-bold">{ticket.plate_number}</span>
                {ticket.status === "active" && !ticket.plate_modified && (
                  <Button size="icon" variant="outline" onClick={handleEditPlate}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
            {ticket.plate_modified && ticket.original_plate_number && (
              <p className="mt-2 text-xs text-muted-foreground">Original: {ticket.original_plate_number}</p>
            )}
          </CardContent>
        </Card>

        {/* Time Info */}
        <Card>
          <CardContent className="py-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span className="text-sm">Entry</span>
              </div>
              <span className="font-medium">{new Date(ticket.entry_time).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: true
              })}</span>
            </div>

            {ticket.exit_time && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span className="text-sm">Exit</span>
                </div>
                <span className="font-medium">{new Date(ticket.exit_time).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true
                })}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span className="text-sm">Time</span>
              </div>
              <span className="font-semibold text-lg">{formatDuration(ticket.entry_time, ticket.exit_time)}</span>
            </div>
          </CardContent>
        </Card>

        {/* QR Code for active tickets */}
        {ticket.status === "active" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-center text-sm font-medium text-muted-foreground">QR Code</CardTitle>
            </CardHeader>
            <CardContent>
              <QRCodeDisplay ticket={ticket} />
            </CardContent>
          </Card>
        )}

        {/* Device Info */}
        {ticket.device_id && (
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Smartphone className="h-3 w-3" />
            <span>Device: {ticket.device_id.slice(0, 20)}...</span>
          </div>
        )}

        {/* Error Message */}
        {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}

        {/* Action Button */}
        {ticket.status === "active" && (
          <Button className="w-full bg-orange-600 hover:bg-orange-700" onClick={() => setShowExitDialog(true)}>
            <LogOut className="mr-2 h-4 w-4" />
            Confirm Exit
          </Button>
        )}
      </main>

      {/* Exit Confirmation Dialog */}
      <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Exit</DialogTitle>
            <DialogDescription>
              Exit plate <span className="font-mono font-bold">{ticket.plate_number}</span>?
              <br />
              {formatDuration(ticket.entry_time)}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setShowExitDialog(false)}>
              Cancel
            </Button>
            <Button className="bg-orange-600 hover:bg-orange-700" onClick={handleConfirmExit} disabled={isExiting}>
              {isExiting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Confirm Exit"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
