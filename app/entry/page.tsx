"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Camera, Edit2, Check, X, AlertTriangle, Loader2 } from "lucide-react"
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
import { QRCodeDisplay } from "@/components/qr-code-display"
import { CameraCapture } from "@/components/camera-capture"
import { createClient } from "@/lib/supabase/client"
import type { Ticket } from "@/lib/types"

type Step = "capture" | "confirm" | "success"

export default function EntryPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>("capture")
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [plateNumber, setPlateNumber] = useState("")
  const [isEditing, setIsEditing] = useState(false)
  const [editedPlate, setEditedPlate] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isOcrLoading, setIsOcrLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdTicket, setCreatedTicket] = useState<Ticket | null>(null)

  // Duplicate plate handling
  const [duplicateTicket, setDuplicateTicket] = useState<Ticket | null>(null)
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false)

  const deviceId = typeof window !== "undefined" ? localStorage.getItem("device_id") || generateDeviceId() : "unknown"

  function generateDeviceId() {
    const id = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    if (typeof window !== "undefined") {
      localStorage.setItem("device_id", id)
    }
    return id
  }

  const handlePhotoCapture = async (imageDataUrl: string) => {
    setPhotoUrl(imageDataUrl)
    setIsOcrLoading(true)
    setError(null)

    try {
      // Call OCR API
      const response = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageDataUrl }),
      })

      const data = await response.json()

      if (data.plateNumber) {
        setPlateNumber(data.plateNumber)
        setEditedPlate(data.plateNumber)
      } else {
        // OCR failed, allow manual entry
        setPlateNumber("")
        setEditedPlate("")
        setIsEditing(true)
      }

      setStep("confirm")
    } catch {
      setError("OCR识别失败，请手动输入车牌号")
      setPlateNumber("")
      setEditedPlate("")
      setIsEditing(true)
      setStep("confirm")
    } finally {
      setIsOcrLoading(false)
    }
  }

  const checkDuplicatePlate = async (plate: string): Promise<Ticket | null> => {
    const supabase = createClient()
    const { data } = await supabase
      .from("tickets")
      .select("*")
      .eq("plate_number", plate)
      .eq("status", "active")
      .eq("parking_lot_id", "default")
      .order("entry_time", { ascending: false })
      .limit(1)
      .single()

    return data as Ticket | null
  }

  const handleConfirmEntry = async (forceCreate = false) => {
    const finalPlate = isEditing ? editedPlate : plateNumber

    if (!finalPlate.trim()) {
      setError("请输入车牌号")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Check for duplicate unless forcing create
      if (!forceCreate) {
        const existing = await checkDuplicatePlate(finalPlate)
        if (existing) {
          setDuplicateTicket(existing)
          setShowDuplicateDialog(true)
          setIsLoading(false)
          return
        }
      }

      // Create ticket
      const supabase = createClient()

      // Upload photo to Supabase Storage if available
      let uploadedPhotoUrl = photoUrl
      if (photoUrl && photoUrl.startsWith("data:")) {
        const photoBlob = await fetch(photoUrl).then((r) => r.blob())
        const fileName = `entry_${Date.now()}_${finalPlate.replace(/[^a-zA-Z0-9]/g, "_")}.jpg`

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("parking-photos")
          .upload(fileName, photoBlob, { contentType: "image/jpeg" })

        if (!uploadError && uploadData) {
          const { data: urlData } = supabase.storage.from("parking-photos").getPublicUrl(fileName)
          uploadedPhotoUrl = urlData.publicUrl
        }
      }

      const { data, error: insertError } = await supabase
        .from("tickets")
        .insert({
          plate_number: finalPlate.toUpperCase(),
          photo_url: uploadedPhotoUrl,
          status: forceCreate ? "abnormal" : "active",
          device_id: deviceId,
          parking_lot_id: "default",
          plate_modified: isEditing && plateNumber !== editedPlate,
          original_plate_number: isEditing && plateNumber !== editedPlate ? plateNumber : null,
        })
        .select()
        .single()

      if (insertError) throw insertError

      // If we marked old ticket as abnormal
      if (forceCreate && duplicateTicket) {
        await supabase.from("tickets").update({ status: "abnormal" }).eq("id", duplicateTicket.id)

        // Log the operation
        await supabase.from("operation_logs").insert({
          ticket_id: duplicateTicket.id,
          operation_type: "mark_abnormal_duplicate",
          old_value: { status: "active" },
          new_value: { status: "abnormal" },
          device_id: deviceId,
        })
      }

      setCreatedTicket(data as Ticket)
      setShowDuplicateDialog(false)
      setStep("success")
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建入场记录失败")
    } finally {
      setIsLoading(false)
    }
  }

  const handleViewDuplicate = () => {
    if (duplicateTicket) {
      router.push(`/vehicles/${duplicateTicket.id}`)
    }
  }

  const handleForceEntry = () => {
    handleConfirmEntry(true)
  }

  const handleEditPlate = () => {
    setIsEditing(true)
    setEditedPlate(plateNumber)
  }

  const handleSaveEdit = () => {
    setPlateNumber(editedPlate)
    setIsEditing(false)
  }

  const handleCancelEdit = () => {
    setEditedPlate(plateNumber)
    setIsEditing(false)
  }

  const handleRetake = () => {
    setPhotoUrl(null)
    setPlateNumber("")
    setEditedPlate("")
    setIsEditing(false)
    setError(null)
    setStep("capture")
  }

  const handleNewEntry = () => {
    setPhotoUrl(null)
    setPlateNumber("")
    setEditedPlate("")
    setIsEditing(false)
    setError(null)
    setCreatedTicket(null)
    setStep("capture")
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-lg font-semibold text-foreground">入场登记</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-lg">
        {step === "capture" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                拍摄车牌
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CameraCapture onCapture={handlePhotoCapture} />
              {isOcrLoading && (
                <div className="mt-4 flex items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>正在识别车牌...</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {step === "confirm" && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>确认车牌信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {photoUrl && (
                  <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
                    <img src={photoUrl || "/placeholder.svg"} alt="车辆照片" className="h-full w-full object-cover" />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">车牌号码</label>
                  {isEditing ? (
                    <div className="flex gap-2">
                      <Input
                        value={editedPlate}
                        onChange={(e) => setEditedPlate(e.target.value.toUpperCase())}
                        placeholder="请输入车牌号"
                        className="text-lg font-mono"
                      />
                      <Button size="icon" variant="ghost" onClick={handleSaveEdit}>
                        <Check className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={handleCancelEdit}>
                        <X className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 rounded-lg border bg-muted/50 px-4 py-3 text-xl font-mono font-bold">
                        {plateNumber || "未识别"}
                      </div>
                      <Button size="icon" variant="outline" onClick={handleEditPlate}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>

                {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 bg-transparent" onClick={handleRetake}>
                重新拍照
              </Button>
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={() => handleConfirmEntry(false)}
                disabled={isLoading || (!plateNumber && !editedPlate)}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    处理中...
                  </>
                ) : (
                  "确认入场"
                )}
              </Button>
            </div>
          </div>
        )}

        {step === "success" && createdTicket && (
          <div className="space-y-4">
            <Card className="border-green-200 bg-green-50">
              <CardHeader className="text-center">
                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                  <Check className="h-6 w-6 text-green-600" />
                </div>
                <CardTitle className="text-green-700">入场登记成功</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <QRCodeDisplay ticket={createdTicket} />

                <div className="rounded-lg bg-white p-4 text-center">
                  <p className="text-sm text-muted-foreground">车牌号码</p>
                  <p className="text-2xl font-mono font-bold">{createdTicket.plate_number}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    入场时间: {new Date(createdTicket.entry_time).toLocaleString("zh-CN")}
                  </p>
                </div>

                <p className="text-center text-sm text-muted-foreground">请将二维码展示给车主，用于出场扫码</p>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 bg-transparent" asChild>
                <Link href="/">返回首页</Link>
              </Button>
              <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={handleNewEntry}>
                继续入场
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* Duplicate Plate Dialog */}
      <Dialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-5 w-5" />
              检测到重复入场
            </DialogTitle>
            <DialogDescription>
              车牌 <span className="font-mono font-bold">{isEditing ? editedPlate : plateNumber}</span> 已有未出场记录
              {duplicateTicket && (
                <span className="block mt-1">
                  入场时间: {new Date(duplicateTicket.entry_time).toLocaleString("zh-CN")}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button variant="outline" onClick={handleViewDuplicate}>
              查看记录
            </Button>
            <Button variant="destructive" onClick={handleForceEntry} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  处理中...
                </>
              ) : (
                "标记异常并重新入场"
              )}
            </Button>
            <Button variant="ghost" onClick={() => setShowDuplicateDialog(false)}>
              取消
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
