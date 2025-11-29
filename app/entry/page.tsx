"use client"

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertTriangle, Camera, Check, ImageIcon, Loader2, Sparkles } from "lucide-react"

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

type ViewState = "idle" | "processing" | "result" | "success"

interface AnalysisInfo {
  plateNumber: string | null
  confidence: number | null
  color: string | null
}

const EMPTY_ANALYSIS: AnalysisInfo = { plateNumber: null, confidence: null, color: null }

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
  const cameraInputRef = useRef<HTMLInputElement>(null) // 用于直接触发系统相机
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
    // 重置文件输入，允许重新选择
    if (cameraInputRef.current) cameraInputRef.current.value = ""
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  // 处理系统相机拍照（iOS/Android）
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
    // 重置 input，允许重复选择同一文件
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
    setPhotoPreview(imageDataUrl)
    setPlateNumber("")
    setAnalysisInfo(EMPTY_ANALYSIS)
    setAnalysisError(null)
    setViewState("processing")

    try {
      const response = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageDataUrl }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error ?? "识别失败，请手动输入")
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
      const errorMessage = err instanceof Error ? err.message : "识别失败，请手动输入"
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
    // 支持多国车牌格式的重复检测
    // 先尝试精确匹配（保留原始格式，包括大小写、连字符、空格等）
    const { data: exactMatch } = await supabase
      .from("tickets")
      .select("*")
      .eq("plate_number", plate) // 精确匹配
      .eq("status", "active")
      .eq("parking_lot_id", "default")
      .order("entry_time", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (exactMatch) return exactMatch as Ticket | null

    // 如果没有精确匹配，尝试不区分大小写的匹配（处理大小写变体）
    const { data: caseInsensitiveMatch } = await supabase
      .from("tickets")
      .select("*")
      .ilike("plate_number", plate.replace(/[%_]/g, "\\$&")) // 转义特殊字符，精确匹配但大小写不敏感
      .eq("status", "active")
      .eq("parking_lot_id", "default")
      .order("entry_time", { ascending: false })
      .limit(1)
      .maybeSingle()

    return caseInsensitiveMatch as Ticket | null
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
    // 支持多国车牌格式，不强制转大写，只去除首尾空格
    const finalPlate = plateNumber.trim()
    if (!finalPlate) {
      setFormError("请输入车牌号")
      return
    }

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
          vehicle_color: analysisInfo.color, // 车辆颜色（从 OCR 识别）
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
      setFormError(err instanceof Error ? err.message : "创建入场记录失败")
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
      <header className="sticky top-0 z-10 border-b bg-card/50 backdrop-blur-md">
        <div className="mx-auto max-w-md px-4 py-3">
          <h1 className="text-lg font-semibold text-foreground">入场登记</h1>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-6 space-y-4">
        {/* 只在初始状态（idle）且没有照片时显示采集卡片 */}
        {viewState === "idle" && !photoPreview && (
          <Card>
            <CardHeader>
              <CardTitle>采集车辆照片</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border bg-card p-3">
                  <div>
                    <p className="text-xs font-medium">拍照</p>
                    <p className="text-[10px] text-muted-foreground">直接调用摄像头</p>
                  </div>
                  <div className="mt-3">
                    <div
                      className="flex flex-col items-center justify-center rounded-lg border border-dashed border-muted-foreground/60 bg-muted/40 px-2 py-6 text-center hover:bg-muted/70 cursor-pointer transition-colors"
                      onClick={() => cameraInputRef.current?.click()}
                    >
                      <Camera className="h-8 w-8 text-primary mb-1.5" />
                      <p className="text-xs font-medium">点击拍照</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {isIOS ? "系统相机" : "浏览器摄像头"}
                      </p>
                    </div>
                    {/* 隐藏的相机 input - 直接触发系统相机 */}
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={handleNativeCamera}
                    />
                  </div>
                </div>

                <div className="rounded-xl border bg-card p-3">
                  <div>
                    <p className="text-xs font-medium">上传图片</p>
                    <p className="text-[10px] text-muted-foreground">选择相册或历史图片</p>
                  </div>
                  <div className="mt-3">
                    <div
                      className="flex flex-col items-center justify-center rounded-lg border border-dashed border-muted-foreground/60 bg-muted/40 px-2 py-6 text-center hover:bg-muted/70 cursor-pointer transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <ImageIcon className="h-8 w-8 text-primary mb-1.5" />
                      <p className="text-xs font-medium">点击上传图片</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">支持 JPG / PNG</p>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleUploadImage}
                    />
                  </div>
                </div>
              </div>

              <Button variant="ghost" size="sm" className="w-full" onClick={handleManualEntry}>
                无法拍照？直接手动登记
              </Button>
            </CardContent>
          </Card>
        )}

        {showResultCard && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                识别结果
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {photoPreview ? (
                <div className="relative aspect-video overflow-hidden rounded-xl border bg-muted">
                  <img src={photoPreview} alt="车辆照片" className="h-full w-full object-cover" />
                  {viewState === "processing" && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 text-sm">
                      <Loader2 className="h-5 w-5 animate-spin mb-2" />
                      正在识别车牌...
                    </div>
                  )}
                </div>
              ) : (
                <div className="aspect-video rounded-xl border border-dashed flex items-center justify-center text-sm text-muted-foreground">
                  暂无照片，直接手动输入车牌
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">车牌号码</label>
                <Input
                  ref={plateInputRef}
                  value={plateNumber}
                  onChange={(e) => {
                    // 支持多国车牌格式，不强制转大写，保留原始格式（包括连字符、空格等）
                    setPlateNumber(e.target.value)
                  }}
                  placeholder="请输入或扫描车牌号（支持全球各国格式）"
                  className="text-lg font-mono tracking-wide"
                  disabled={viewState === "processing"}
                />
                {analysisInfo.confidence !== null && (
                  <p className="text-xs text-muted-foreground">
                    AI 置信度：{Math.round((analysisInfo.confidence ?? 0) * 100)}%
                  </p>
                )}
                {analysisError && <p className="text-xs text-destructive">{analysisError}</p>}
              </div>

              {formError && <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{formError}</div>}

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={handleRetake} disabled={viewState === "processing"}>
                  重新开始
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => handleConfirmEntry(false)}
                  disabled={viewState === "processing" || isLoading || !plateNumber.trim()}
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
            </CardContent>
          </Card>
        )}

        {viewState === "success" && createdTicket && (
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
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" asChild>
                  <Link href="/">返回首页</Link>
                </Button>
                <Button className="flex-1" onClick={handleNewEntry}>
                  继续入场
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
              检测到重复入场
            </DialogTitle>
            <DialogDescription>
              车牌 <span className="font-mono font-bold">{plateNumber}</span> 已有未出场记录
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
