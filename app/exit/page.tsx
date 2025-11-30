"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { QrCode, Search, Check, Undo2, Loader2, Clock, ImageIcon, Camera } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { createClient } from "@/lib/supabase/client"
import type { Ticket } from "@/lib/types"
import { useDebounce } from "@/lib/hooks/useDebounce"
import { useErrorHandler } from "@/lib/hooks/useErrorHandler"
import { formatDuration } from "@/lib/utils"
import { ImageDataUrlSchema, QRPayloadSchema } from "@/lib/validations"
import { ZodError } from "zod"

type Mode = "select" | "qr-scan" | "upload-scan" | "search" | "confirm" | "success"

export default function ExitPage() {
  const [mode, setMode] = useState<Mode>("select")
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Ticket[]>([])
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [exitedTicket, setExitedTicket] = useState<Ticket | null>(null)
  const [showUndoDialog, setShowUndoDialog] = useState(false)
  const [canUndo, setCanUndo] = useState(false)

  const deviceId = typeof window !== "undefined" ? localStorage.getItem("device_id") || "unknown" : "unknown"
  
  const { error, handleError, clearError } = useErrorHandler("Failed")
  
  const debouncedSearchQuery = useDebounce(searchQuery, 400)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const qrCameraInputRef = useRef<HTMLInputElement>(null)

  const handleQRScan = async (data: string) => {
    try {
      const parsedJson = JSON.parse(data)
      const payload = QRPayloadSchema.parse(parsedJson)
      await findTicketById(payload.id)
    } catch (err) {
      let message = "Invalid QR code"
      if (err instanceof ZodError) {
        message = err.issues[0]?.message ?? message
      } else if (err instanceof SyntaxError) {
        message = "QR code content is not valid JSON"
      }
      handleError(new Error(message))
    }
  }

  const handleQRCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsLoading(true)
    clearError()

    const reader = new FileReader()
    reader.onload = async (event) => {
      const result = event.target?.result as string
      if (result) {
        await handleQRImageUpload(result)
      }
    }
    reader.onerror = () => {
      handleError(new Error("Failed to read file"))
      setIsLoading(false)
    }
    reader.readAsDataURL(file)

    if (e.target) {
      e.target.value = ""
    }
  }

  const findTicketById = async (id: number) => {
    setIsLoading(true)
    clearError()

    try {
      const supabase = createClient()
      const { data, error: fetchError } = await supabase
        .from("tickets")
        .select("id, plate_number, entry_time, exit_time, photo_url, vehicle_color, status, device_id, parking_lot_id, plate_modified, original_plate_number, created_at, updated_at")
        .eq("id", id)
        .single()

      if (fetchError) throw fetchError

      if (!data) {
        handleError(new Error("Record not found"))
        return
      }

      setSelectedTicket(data as Ticket)
      setMode("confirm")
    } catch (err) {
      handleError(err, "Query failed")
    } finally {
      setIsLoading(false)
    }
  }

  const performSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    clearError()

    try {
      const supabase = createClient()
      const { data, error: searchError } = await supabase
        .from("tickets")
        .select("id, plate_number, entry_time, exit_time, photo_url, vehicle_color, status, device_id, parking_lot_id, plate_modified, original_plate_number, created_at, updated_at")
        .eq("parking_lot_id", "default")
        .eq("status", "active")
        .ilike("plate_number", `%${query}%`)
        .order("entry_time", { ascending: false })
        .limit(10)

      if (searchError) throw searchError

      setSearchResults((data as Ticket[]) || [])

      if (!data || data.length === 0) {
        handleError(new Error("No matches found"))
      }
    } catch (err) {
      handleError(err, "Failed")
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  useEffect(() => {
    if (mode === "search") {
      performSearch(debouncedSearchQuery)
    }
  }, [debouncedSearchQuery, mode])

  const handleSearch = () => {
    performSearch(searchQuery)
  }

  const handleSelectTicket = (ticket: Ticket) => {
    setSelectedTicket(ticket)
    setMode("confirm")
  }

  const handleConfirmExit = async () => {
    if (!selectedTicket) return

    setIsLoading(true)
    clearError()

    try {
      const supabase = createClient()

      const { data, error: updateError } = await supabase
        .from("tickets")
        .update({
          status: "exited",
          exit_time: new Date().toISOString(),
        })
        .eq("id", selectedTicket.id)
        .select()
        .single()

      if (updateError) throw updateError

      // Log the operation
      await supabase.from("operation_logs").insert({
        ticket_id: selectedTicket.id,
        operation_type: "exit",
        old_value: { status: "active" },
        new_value: { status: "exited", exit_time: new Date().toISOString() },
        device_id: deviceId,
      })

      setExitedTicket(data as Ticket)
      setCanUndo(true)
      setMode("success")
      clearError()
    } catch (err) {
      handleError(err, "Exit failed")
    } finally {
      setIsLoading(false)
    }
  }

  const checkCanUndo = async (ticketId: number): Promise<boolean> => {
    const supabase = createClient()

    // Check if there's a new entry with the same plate number after this exit
    const { data: ticket } = await supabase
      .from("tickets")
      .select("plate_number, exit_time")
      .eq("id", ticketId)
      .single()

    if (!ticket || !ticket.exit_time) return false

    const { data: newEntries } = await supabase
      .from("tickets")
      .select("id")
      .eq("plate_number", ticket.plate_number)
      .eq("parking_lot_id", "default")
      .gt("entry_time", ticket.exit_time)
      .limit(1)

    return !newEntries || newEntries.length === 0
  }

  const handleUndo = async () => {
    if (!exitedTicket) return

    setIsLoading(true)
    clearError()

    try {
      // Verify can still undo
      const stillCanUndo = await checkCanUndo(exitedTicket.id)
      if (!stillCanUndo) {
        handleError(new Error("Cannot undo: This license plate has a new entry record"))
        setCanUndo(false)
        setShowUndoDialog(false)
        return
      }

      const supabase = createClient()

      const { error: updateError } = await supabase
        .from("tickets")
        .update({
          status: "active",
          exit_time: null,
        })
        .eq("id", exitedTicket.id)

      if (updateError) throw updateError

      // Log the undo operation
      await supabase.from("operation_logs").insert({
        ticket_id: exitedTicket.id,
        operation_type: "undo_exit",
        old_value: { status: "exited" },
        new_value: { status: "active", exit_time: null },
        device_id: deviceId,
      })

      setShowUndoDialog(false)
      setSelectedTicket(exitedTicket)
      setExitedTicket(null)
      setMode("confirm")
      clearError()
    } catch (err) {
      handleError(err, "Undo failed")
    } finally {
      setIsLoading(false)
    }
  }

  const handleNewExit = () => {
    setSelectedTicket(null)
    setExitedTicket(null)
    setSearchQuery("")
    setSearchResults([])
    clearError()
    setMode("select")
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsLoading(true)
    clearError()

    const reader = new FileReader()
    reader.onload = async (event) => {
      const result = event.target?.result as string
      if (result) {
        await handleQRImageUpload(result)
      }
    }
    reader.onerror = () => {
      handleError(new Error("Failed to read file"))
      setIsLoading(false)
    }
    reader.readAsDataURL(file)

    if (e.target) {
      e.target.value = ""
    }
  }

  const handleQRImageUpload = async (imageDataUrl: string) => {
    try {
      const validation = ImageDataUrlSchema.safeParse(imageDataUrl)
      if (!validation.success) {
        handleError(new Error(validation.error.issues[0]?.message ?? "Invalid image data"))
        setIsLoading(false)
        return
      }

      const normalizedImage = validation.data

      const img = new Image()
      img.onload = async () => {
        const canvas = document.createElement("canvas")
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          handleError(new Error("Failed to create canvas context"))
          setIsLoading(false)
          return
        }

        ctx.drawImage(img, 0, 0)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

        const jsQR = (await import("jsqr")).default
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        })

        if (code) {
          await handleQRScan(code.data)
        } else {
          handleError(new Error("QR code not recognized"))
        }
      }
      img.onerror = () => {
        handleError(new Error("Failed to load image"))
        setIsLoading(false)
      }
      img.src = normalizedImage
    } catch (err) {
      handleError(err, "Failed to scan QR code")
      setIsLoading(false)
    }
  }


  return (
    <div className="min-h-screen bg-background pb-24">
      <main className="mx-auto max-w-md px-4 py-6 space-y-4">
        {mode === "select" && (
          <>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-center gap-2"
              onClick={() => setMode("search")}
            >
              <Search className="h-4 w-4" />
              <span className="text-sm font-medium">Search</span>
            </Button>

            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="p-3">
                  <div
                    className="flex flex-col items-center justify-center rounded-lg border border-dashed border-muted-foreground/60 bg-muted/40 px-2 py-6 text-center hover:bg-muted/70 cursor-pointer transition-colors min-h-[120px]"
                    onClick={() => setMode("qr-scan")}
                  >
                    <QrCode className="h-8 w-8 text-primary mb-1.5" />
                    <p className="text-xs font-medium">Scan QR Code</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 opacity-0">Placeholder</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-3">
                  <div
                    className="flex flex-col items-center justify-center rounded-lg border border-dashed border-muted-foreground/60 bg-muted/40 px-2 py-6 text-center hover:bg-muted/70 cursor-pointer transition-colors min-h-[120px]"
                    onClick={() => setMode("upload-scan")}
                  >
                    <ImageIcon className="h-8 w-8 text-primary mb-1.5" />
                    <p className="text-xs font-medium">Upload</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">JPG / PNG</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {(mode === "qr-scan" || mode === "upload-scan" || mode === "search") && (
          <div className="space-y-4">
            {mode !== "search" && (
              <div className="flex gap-2">
                <Button
                  variant={mode === "qr-scan" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setMode("qr-scan")}
                >
                  <QrCode className="mr-2 h-4 w-4" />
                  Scan QR
                </Button>
                <Button
                  variant={mode === "upload-scan" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setMode("upload-scan")}
                >
                  <ImageIcon className="mr-2 h-4 w-4" />
                  Upload
                </Button>
              </div>
            )}

            {mode === "qr-scan" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <QrCode className="h-5 w-5" />
                    Scan QR
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="relative aspect-video overflow-hidden rounded-lg bg-muted border-2 border-dashed border-muted-foreground/50 flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <QrCode className="mx-auto h-12 w-12 mb-2" />
                      <p className="text-sm">System Camera</p>
                      <p className="text-xs mt-1 text-muted-foreground/70">
                        Take photo to scan QR code
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button 
                      className="flex-1 bg-green-600 hover:bg-green-700" 
                      onClick={() => qrCameraInputRef.current?.click()}
                    >
                      <Camera className="mr-2 h-5 w-5" />
                      Camera
                    </Button>
                    <Button 
                      variant="outline" 
                      size="icon" 
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <ImageIcon className="h-5 w-5" />
                    </Button>
                  </div>

                  <input
                    ref={qrCameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleQRCameraCapture}
                  />

                  {isLoading && (
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Recognizing...</span>
                    </div>
                  )}
                  {error && (
                    <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {error}
                    </div>
                  )}
                  <Button variant="outline" className="w-full" onClick={() => setMode("select")}>
                    Back
                  </Button>
                </CardContent>
              </Card>
            )}

            {mode === "upload-scan" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="h-5 w-5" />
                    Upload QR
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div
                    className="relative aspect-video overflow-hidden rounded-xl border-2 border-dashed border-muted-foreground/60 bg-muted/40 flex items-center justify-center cursor-pointer hover:bg-muted/70 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="text-center">
                      <ImageIcon className="mx-auto h-12 w-12 mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Upload QR</p>
                      <p className="text-xs text-muted-foreground/70 mt-1">Choose from gallery</p>
                    </div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />

                  {isLoading && (
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Recognizing...</span>
                    </div>
                  )}
                  {error && <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      clearError()
                      setMode("select")
                    }}
                  >
                    Back
                  </Button>
                </CardContent>
              </Card>
            )}

            {mode === "search" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="h-5 w-5" />
                    Search
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value)
                        clearError()
                      }}
                      placeholder="Enter plate"
                      className="font-mono"
                    />
                    <Button onClick={handleSearch} disabled={isSearching} variant="outline">
                      {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </div>
                  {error && (
                    <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {error}
                    </div>
                  )}

                  {searchResults.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Found {searchResults.length}</p>
                      {searchResults.map((ticket) => (
                        <button
                          key={ticket.id}
                          className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted"
                          onClick={() => handleSelectTicket(ticket)}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold">{ticket.plate_number}</span>
                            <span className="text-sm text-muted-foreground">{formatDuration(ticket.entry_time)}</span>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {new Date(ticket.entry_time).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                              hour12: true
                            })}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {error && mode !== "upload-scan" && (
              <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
            )}
          </div>
        )}

        {mode === "confirm" && selectedTicket && (
          <Card>
            <CardHeader>
              <CardTitle>Confirm Exit</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedTicket.photo_url && (
                <div className="relative aspect-video overflow-hidden rounded-xl border bg-muted">
                  <img
                    src={selectedTicket.photo_url || "/placeholder.svg"}
                    alt="Vehicle photo"
                    className="h-full w-full object-cover"
                  />
                </div>
              )}

              <div className="rounded-lg bg-muted/50 p-4 space-y-3">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Plate</p>
                  <p className="text-2xl font-mono font-bold">{selectedTicket.plate_number}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Entry</p>
                    <p className="font-medium">{new Date(selectedTicket.entry_time).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true
                    })}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Time</p>
                    <p className="font-medium flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {formatDuration(selectedTicket.entry_time)}
                    </p>
                  </div>
                </div>

                {selectedTicket.status !== "active" && (
                  <div className="rounded bg-orange-100 p-2 text-center text-sm text-orange-700">
                    Status: {selectedTicket.status === "exited" ? "Exited" : selectedTicket.status}
                  </div>
                )}
              </div>

              {error && <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={handleNewExit}>
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleConfirmExit}
                  disabled={isLoading || selectedTicket.status !== "active"}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Confirm Exit"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {mode === "success" && exitedTicket && (
          <Card className="border-green-200 bg-green-50">
            <CardHeader className="text-center">
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <Check className="h-6 w-6 text-green-600" />
              </div>
              <CardTitle className="text-green-700">Success</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-white p-4 text-center">
                <p className="text-sm text-muted-foreground">Plate</p>
                <p className="text-2xl font-mono font-bold">{exitedTicket.plate_number}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Exit: {exitedTicket.exit_time ? new Date(exitedTicket.exit_time).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true
                  }) : "-"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Duration: {formatDuration(exitedTicket.entry_time, exitedTicket.exit_time)}
                </p>
              </div>
              
              {canUndo && (
                <Button variant="outline" className="w-full" onClick={() => setShowUndoDialog(true)}>
                  <Undo2 className="mr-2 h-4 w-4" />
                  Undo Exit
                </Button>
              )}
              
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setMode("select")}>
                  Continue
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      <Dialog open={showUndoDialog} onOpenChange={setShowUndoDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Undo Exit</DialogTitle>
            <DialogDescription>
              Plate <span className="font-mono font-bold">{exitedTicket?.plate_number}</span> will be restored to active.
              <br />
              This will be logged.
            </DialogDescription>
          </DialogHeader>
          {error && <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setShowUndoDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleUndo} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Undo"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
