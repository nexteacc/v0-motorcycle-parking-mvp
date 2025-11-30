"use client"

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertTriangle, Camera, Check, ImageIcon, Keyboard, Loader2, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
import type { Ticket } from "@/lib/types"
import { ImageDataUrlSchema, PlateNumberSchema } from "@/lib/validations"

type ViewState = "idle" | "processing" | "result" | "success"

interface AnalysisInfo {
  plateNumber: string | null
  confidence: number | null
  color: string | null
}

const EMPTY_ANALYSIS: AnalysisInfo = { plateNumber: null, confidence: null, color: null }

interface PlateCheckCacheEntry {
  result: Ticket | null
  timestamp: number
}

const plateCheckCache = new Map<string, PlateCheckCacheEntry>()
const PLATE_CHECK_TTL = 5 * 60 * 1000
const MAX_CACHE_SIZE = 100

export default function EntryPage() {
  const router = useRouter()
  const [viewState, setViewState] = useState<ViewState>("idle")
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [plateNumber, setPlateNumber] = useState("")
  const [analysisInfo, setAnalysisInfo] = useState<AnalysisInfo>(EMPTY_ANALYSIS)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [createdTicket, setCreatedTicket] = useState<Ticket | null>(null)
  const [duplicateTicket, setDuplicateTicket] = useState<Ticket | null>(null)
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const plateInputRef = useRef<HTMLInputElement>(null)
  const [isIOS, setIsIOS] = useState(false)

  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsIOS(/iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase()))
    }
  }, [])

  useEffect(() => {
    if (viewState === "result" && plateInputRef.current) {
      plateInputRef.current.focus()
    }
  }, [viewState])

  const deviceId = useMemo(() => {
    if (typeof window === "undefined") return "unknown"
    const cached = localStorage.getItem("device_id")
    if (cached) return cached
    const generated = `device_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    localStorage.setItem("device_id", generated)
    return generated
  }, [])

  const resetForm = () => {
    setViewState("idle")
    setPhotoPreview(null)
    setPlateNumber("")
    setAnalysisInfo(EMPTY_ANALYSIS)
    setAnalysisError(null)
    setFormError(null)
    setDuplicateTicket(null)
    setShowDuplicateDialog(false)
    if (cameraInputRef.current) cameraInputRef.current.value = ""
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleNativeCamera = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (e) => {
      const result = e.target?.result as string
      if (result) {
        await runAnalysis(result)
      }
    }
    reader.readAsDataURL(file)
    event.target.value = ""
  }

  const handleUploadImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (e) => {
      const result = e.target?.result as string
      if (result) {
        await runAnalysis(result)
      }
    }
    reader.readAsDataURL(file)
    event.target.value = ""
  }

  const runAnalysis = async (imageDataUrl: string) => {
    const validation = ImageDataUrlSchema.safeParse(imageDataUrl)
    if (!validation.success) {
      setAnalysisError(validation.error.issues[0]?.message ?? "Invalid image data")
      setViewState("result")
      return
    }

    const normalizedImage = validation.data

    setPhotoPreview(normalizedImage)
    setPlateNumber("")
    setAnalysisInfo(EMPTY_ANALYSIS)
    setAnalysisError(null)
    setViewState("processing")

    try {
      const response = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: normalizedImage }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error ?? "Recognition failed")
      }

      setAnalysisInfo({
        plateNumber: data.plateNumber ?? null,
        confidence: data.confidence ?? null,
        color: data.color ?? null,
      })

      if (data.plateNumber) {
        setPlateNumber(data.plateNumber)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Recognition failed"
      console.error("OCR analysis error:", err)
      setAnalysisError(errorMessage)
    } finally {
      setViewState("result")
    }
  }

  const handleManualEntry = () => {
    setPhotoPreview(null)
    setAnalysisInfo(EMPTY_ANALYSIS)
    setAnalysisError(null)
    setPlateNumber("")
    setViewState("result")
  }

  const handleRetake = () => {
    resetForm()
  }

  const checkDuplicatePlate = async (plate: string): Promise<Ticket | null> => {
    const cacheKey = plate.toLowerCase().trim()
    const cached = plateCheckCache.get(cacheKey)
    
    if (cached && Date.now() - cached.timestamp < PLATE_CHECK_TTL) {
      return cached.result
    }

    const { data: exactMatch } = await supabase
      .from("tickets")
      .select("*")
      .eq("plate_number", plate)
      .eq("status", "active")
      .eq("parking_lot_id", "default")
      .order("entry_time", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (exactMatch) {
      plateCheckCache.set(cacheKey, {
        result: exactMatch as Ticket,
        timestamp: Date.now(),
      })
      if (plateCheckCache.size > MAX_CACHE_SIZE) {
        const firstKey = plateCheckCache.keys().next().value
        if (firstKey) plateCheckCache.delete(firstKey)
      }
      return exactMatch as Ticket
    }

    const { data: caseInsensitiveMatch } = await supabase
      .from("tickets")
      .select("*")
      .ilike("plate_number", plate.replace(/[%_]/g, "\\$&"))
      .eq("status", "active")
      .eq("parking_lot_id", "default")
      .order("entry_time", { ascending: false })
      .limit(1)
      .maybeSingle()

    const result = caseInsensitiveMatch as Ticket | null

    plateCheckCache.set(cacheKey, {
      result,
      timestamp: Date.now(),
    })

    if (plateCheckCache.size > MAX_CACHE_SIZE) {
      const firstKey = plateCheckCache.keys().next().value
      if (firstKey) plateCheckCache.delete(firstKey)
    }

    return result
  }

  const uploadPhotoIfNeeded = async (finalPlate: string) => {
    if (!photoPreview || !photoPreview.startsWith("data:")) return photoPreview

    const blob = await fetch(photoPreview).then((res) => res.blob())
    const fileName = `entry_${Date.now()}_${finalPlate.replace(/[^a-zA-Z0-9]/g, "_")}.jpg`
    const { data, error } = await supabase.storage.from("parking-photos").upload(fileName, blob, {
      contentType: "image/jpeg",
    })

    if (error || !data) return null
    const { data: urlData } = supabase.storage.from("parking-photos").getPublicUrl(fileName)
    return urlData.publicUrl
  }

  const handleConfirmEntry = async (forceCreate = false) => {
    const parsedPlate = PlateNumberSchema.safeParse(plateNumber)
    if (!parsedPlate.success) {
      setFormError(parsedPlate.error.issues[0]?.message ?? "Invalid plate number")
      return
    }

    const finalPlate = parsedPlate.data

    setIsLoading(true)
    setFormError(null)

    try {
      if (!forceCreate) {
        const existing = await checkDuplicatePlate(finalPlate)
        if (existing) {
          setDuplicateTicket(existing)
          setShowDuplicateDialog(true)
          setIsLoading(false)
          return
        }
      }

      const uploadedPhotoUrl = await uploadPhotoIfNeeded(finalPlate)

      const { data, error } = await supabase
        .from("tickets")
        .insert({
          plate_number: finalPlate,
          photo_url: uploadedPhotoUrl,
          vehicle_color: analysisInfo.color,
          status: forceCreate ? "abnormal" : "active",
          device_id: deviceId,
          parking_lot_id: "default",
          plate_modified: analysisInfo.plateNumber !== null && analysisInfo.plateNumber !== finalPlate,
          original_plate_number:
            analysisInfo.plateNumber && analysisInfo.plateNumber !== finalPlate ? analysisInfo.plateNumber : null,
        })
        .select()
        .single()

      if (error) throw error

      if (forceCreate && duplicateTicket) {
        await supabase.from("tickets").update({ status: "abnormal" }).eq("id", duplicateTicket.id)
        await supabase.from("operation_logs").insert({
          ticket_id: duplicateTicket.id,
          operation_type: "mark_abnormal_duplicate",
          old_value: { status: "active" },
          new_value: { status: "abnormal" },
          device_id: deviceId,
        })
      }

      setCreatedTicket(data as Ticket)
      setViewState("success")
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create entry record")
    } finally {
      setIsLoading(false)
    }
  }

  const handleForceEntry = () => handleConfirmEntry(true)

  const handleViewDuplicate = () => {
    if (duplicateTicket) {
      router.push(`/vehicles/${duplicateTicket.id}`)
    }
  }

  const handleNewEntry = () => {
    setCreatedTicket(null)
    resetForm()
  }

  const showResultCard = viewState === "processing" || viewState === "result"

  return (
    <div className="min-h-screen bg-background pb-24">
      <main className="mx-auto max-w-md px-4 py-6 space-y-4">
        {viewState === "idle" && !photoPreview && (
          <>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-center gap-2"
              onClick={handleManualEntry}
            >
              <Keyboard className="h-4 w-4" />
              <span className="text-sm font-medium">Manual</span>
            </Button>

            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="p-3">
                  <div
                    className="flex flex-col items-center justify-center rounded-lg border border-dashed border-muted-foreground/60 bg-muted/40 px-2 py-6 text-center hover:bg-muted/70 cursor-pointer transition-colors min-h-[120px]"
                    onClick={() => cameraInputRef.current?.click()}
                  >
                    <Camera className="h-8 w-8 text-primary mb-1.5" />
                    <p className="text-xs font-medium">Camera</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 opacity-0">Placeholder</p>
                  </div>
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleNativeCamera}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-3">
                  <div
                    className="flex flex-col items-center justify-center rounded-lg border border-dashed border-muted-foreground/60 bg-muted/40 px-2 py-6 text-center hover:bg-muted/70 cursor-pointer transition-colors min-h-[120px]"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImageIcon className="h-8 w-8 text-primary mb-1.5" />
                    <p className="text-xs font-medium">Upload</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">JPG / PNG</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleUploadImage}
                  />
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {showResultCard && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Result
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {photoPreview ? (
                <div className="relative aspect-video overflow-hidden rounded-xl border bg-muted">
                  <img src={photoPreview} alt="Vehicle photo" className="h-full w-full object-cover" />
                  {viewState === "processing" && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 text-sm">
                      <Loader2 className="h-5 w-5 animate-spin mb-2" />
                      Scanning...
                    </div>
                  )}
                </div>
              ) : (
                <div className="aspect-video rounded-xl border border-dashed flex items-center justify-center text-sm text-muted-foreground">
                  Manual
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Plate</label>
                <Input
                  ref={plateInputRef}
                  value={plateNumber}
                  onChange={(e) => {
                    setPlateNumber(e.target.value)
                  }}
                  placeholder="Enter license plate"
                  className="text-lg font-mono tracking-wide"
                  disabled={viewState === "processing"}
                />
                {analysisInfo.confidence !== null && (
                  <p className="text-xs text-muted-foreground">
                    Confidence: {Math.round((analysisInfo.confidence ?? 0) * 100)}%
                  </p>
                )}
                {analysisError && <p className="text-xs text-destructive">{analysisError}</p>}
              </div>

              {formError && <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{formError}</div>}

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={handleRetake} disabled={viewState === "processing"}>
                  Start Over
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => handleConfirmEntry(false)}
                  disabled={viewState === "processing" || isLoading || !plateNumber.trim()}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Confirm"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {viewState === "success" && createdTicket && (
          <Card className="border-green-200 bg-green-50">
            <CardHeader className="text-center">
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <Check className="h-6 w-6 text-green-600" />
              </div>
              <CardTitle className="text-green-700">Success</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <QRCodeDisplay ticket={createdTicket} />
              <div className="rounded-lg bg-white p-4 text-center">
                <p className="text-sm text-muted-foreground">Plate</p>
                <p className="text-2xl font-mono font-bold">{createdTicket.plate_number}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Entry: {new Date(createdTicket.entry_time).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true
                  })}
                </p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" asChild>
                  <Link href="/">Home</Link>
                </Button>
                <Button className="flex-1" onClick={handleNewEntry}>
                  Continue
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      <Dialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-5 w-5" />
              Duplicate Entry
            </DialogTitle>
            <DialogDescription>
              Plate <span className="font-mono font-bold">{plateNumber}</span> already active
              {duplicateTicket && (
                <span className="block mt-1">
                  Entry: {new Date(duplicateTicket.entry_time).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true
                  })}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button variant="outline" onClick={handleViewDuplicate}>
              View
            </Button>
            <Button variant="destructive" onClick={handleForceEntry} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Mark Abnormal"
              )}
            </Button>
            <Button variant="ghost" onClick={() => setShowDuplicateDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
