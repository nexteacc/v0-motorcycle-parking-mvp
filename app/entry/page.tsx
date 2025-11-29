"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Camera, Edit2, Check, X, AlertTriangle, Loader2, ImageIcon } from "lucide-react"
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

type Step = "select" | "camera" | "upload" | "confirm" | "success"

export default function EntryPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>("select")
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [plateNumber, setPlateNumber] = useState("")
  const [isEditing, setIsEditing] = useState(false)
  const [editedPlate, setEditedPlate] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isOcrLoading, setIsOcrLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdTicket, setCreatedTicket] = useState<Ticket | null>(null)
  const [imageSource, setImageSource] = useState<"camera" | "upload" | null>(null)

  // Duplicate plate handling
  const [duplicateTicket, setDuplicateTicket] = useState<Ticket | null>(null)
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false)

  const [isIOS, setIsIOS] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const isIOSDevice = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase())
    setIsIOS(isIOSDevice)
    
    // iOS 用户直接进入快速模式（跳过选择步骤）
    if (isIOSDevice && step === "select") {
      setStep("confirm")
      setIsEditing(true)
    }
  }, [])

  // iOS 用户进入确认页面时自动聚焦（仅当没有车牌号时）
  useEffect(() => {
    if (isIOS && step === "confirm" && inputRef.current && !plateNumber && !editedPlate) {
      // 延迟聚焦，确保 DOM 已渲染
      const timer = setTimeout(() => {
        inputRef.current?.focus()
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [isIOS, step, plateNumber, editedPlate])

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
    
    // iOS 用户：如果已经手动输入了车牌，拍照只是补充照片，不触发 OCR
    if (isIOS && plateNumber && plateNumber.trim() !== "") {
      setStep("confirm")
      // iOS 用户拍照后不自动聚焦输入框，因为车牌已经填好了
      return
    }

    // 非 iOS 用户或首次拍照：调用 OCR
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
      // 非 iOS 用户 OCR 后，如果是首次输入，自动聚焦输入框方便编辑
      if (!isIOS && !data.plateNumber) {
        setTimeout(() => {
          inputRef.current?.focus()
        }, 200)
      }
    } catch {
      setError("OCR识别失败，请手动输入车牌号")
      setPlateNumber("")
      setEditedPlate("")
      setIsEditing(true)
      setStep("confirm")
      if (!isIOS) {
        setTimeout(() => {
          inputRef.current?.focus()
        }, 200)
      }
    } finally {
      setIsOcrLoading(false)
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      const result = event.target?.result as string
      if (result) {
        await handlePhotoCapture(result)
      }
    }
    reader.readAsDataURL(file)
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
    setStep("select")
    setImageSource(null)
  }

  const handleManualInput = () => {
    setStep("confirm")
    setPlateNumber("")
    setEditedPlate("")
    setIsEditing(true)
    // If coming from manual input, we might not have a photo yet
    // setPhotoUrl(null) is already default but being explicit helps understanding
    
    // Focus input after render
    setTimeout(() => {
      inputRef.current?.focus()
    }, 100)
  }

  const handleAddPhoto = () => {
    // Save current input before going to camera
    // In this simple flow, we just go to camera/upload step
    // Ideally we'd pass state, but for now let's just use the standard flow
    // which will eventually come back to confirm
    setStep("select") 
  }

  const handleNewEntry = () => {
    setPhotoUrl(null)
    setPlateNumber("")
    setEditedPlate("")
    setIsEditing(false)
    setError(null)
    setCreatedTicket(null)
    setStep("select")
    setImageSource(null)
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 border-b bg-card/50 backdrop-blur-md">
        <div className="mx-auto max-w-md px-4 py-3">
          <h1 className="text-lg font-semibold text-foreground">入场登记</h1>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-6">
        {step === "select" && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>选择图片来源</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  className="w-full h-16 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
                  onClick={() => {
                    setImageSource("camera")
                    setStep("camera")
                  }}
                >
                  <Camera className="mr-3 h-5 w-5" />
                  <span className="text-base">拍照</span>
                </Button>
                <Button
                  className="w-full h-16 bg-gradient-to-r from-primary/80 to-accent/80 hover:from-primary/70 hover:to-accent/70"
                  onClick={() => {
                    setImageSource("upload")
                    setStep("upload")
                  }}
                >
                  <ImageIcon className="mr-3 h-5 w-5" />
                  <span className="text-base">上传图片</span>
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {step === "camera" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                拍摄车牌
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CameraCapture onCapture={handlePhotoCapture} useNativeCamera={isIOS} />
              {isOcrLoading && (
                <div className="mt-4 flex items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>正在识别车牌...</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {step === "upload" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                上传车辆照片
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className="relative aspect-video overflow-hidden rounded-lg border-2 border-dashed border-muted-foreground/50 bg-muted/30 flex items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => {
                  const input = document.createElement("input")
                  input.type = "file"
                  input.accept = "image/*"
                  input.onchange = (e) => {
                    const target = e.target as HTMLInputElement
                    const event = {
                      target: { files: target.files },
                    } as React.ChangeEvent<HTMLInputElement>
                    handleImageUpload(event)
                  }
                  input.click()
                }}
              >
                <div className="text-center">
                  <ImageIcon className="mx-auto h-12 w-12 mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">点击上传或拖拽图片</p>
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} id="upload-input" />
              </div>
              {isOcrLoading && (
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>正在识别车牌...</span>
                </div>
              )}
              <Button
                variant="outline"
                className="w-full bg-transparent"
                onClick={() => {
                  setStep("select")
                  setImageSource(null)
                }}
              >
                返回选择
              </Button>
            </CardContent>
          </Card>
        )}

        {step === "confirm" && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>
                  {isIOS ? "快速登记" : "确认车牌信息"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* iOS 用户：车牌输入优先，照片可选 */}
                {isIOS ? (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">
                        车牌号码
                      </label>
                      <Input
                        ref={inputRef}
                        value={editedPlate || plateNumber}
                        onChange={(e) => {
                          const val = e.target.value.toUpperCase()
                          setEditedPlate(val)
                          setPlateNumber(val)
                          setIsEditing(true)
                        }}
                        placeholder="点击输入框，然后点击键盘上的「扫描文本」"
                        className="text-xl font-mono h-14 font-bold text-center"
                        autoFocus={!plateNumber && !editedPlate}
                      />
                      {!editedPlate && !plateNumber && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
                          <p className="font-semibold mb-1">📱 如何使用「扫描文本」功能：</p>
                          <ol className="list-decimal list-inside space-y-1 ml-1">
                            <li>点击上方输入框（键盘会自动弹出）</li>
                            <li>在键盘上方找到「扫描文本」按钮（系统自动显示）</li>
                            <li>点击「扫描文本」→ 系统相机打开</li>
                            <li>对着车牌拍照 → 车牌号自动识别并填入</li>
                          </ol>
                          <p className="mt-2 text-blue-700">💡 也可以直接手动输入车牌号</p>
                        </div>
                      )}
                    </div>

                    {/* 照片区域 - 可选 */}
                    {photoUrl ? (
                      <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
                        <img src={photoUrl || "/placeholder.svg"} alt="车辆照片" className="h-full w-full object-cover" />
                        <Button 
                          size="sm" 
                          variant="secondary" 
                          className="absolute bottom-2 right-2 opacity-80 hover:opacity-100"
                          onClick={() => {
                            setStep("camera")
                            setImageSource("camera")
                          }}
                        >
                          重拍
                        </Button>
                      </div>
                    ) : (
                      <div 
                        className="aspect-video rounded-lg bg-muted border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/80 transition-colors"
                        onClick={() => {
                          setStep("camera")
                          setImageSource("camera")
                        }}
                      >
                        <Camera className="h-8 w-8 text-muted-foreground mb-2" />
                        <span className="text-sm text-muted-foreground">拍摄车辆照片 (可选)</span>
                      </div>
                    )}
                  </>
                ) : (
                  /* 非 iOS 用户：保持原有流程 */
                  <>
                    {photoUrl ? (
                      <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
                        <img src={photoUrl || "/placeholder.svg"} alt="车辆照片" className="h-full w-full object-cover" />
                        <Button 
                          size="sm" 
                          variant="secondary" 
                          className="absolute bottom-2 right-2 opacity-80 hover:opacity-100"
                          onClick={() => {
                            setStep("camera")
                            setImageSource("camera")
                          }}
                        >
                          重拍
                        </Button>
                      </div>
                    ) : (
                      <div 
                        className="aspect-video rounded-lg bg-muted border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/80 transition-colors"
                        onClick={() => {
                          setStep("camera")
                          setImageSource("camera")
                        }}
                      >
                        <Camera className="h-8 w-8 text-muted-foreground mb-2" />
                        <span className="text-sm text-muted-foreground">点击拍摄车辆照片 (可选)</span>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">车牌号码</label>
                      <div className="flex gap-2">
                        <Input
                          value={isEditing ? editedPlate : plateNumber}
                          onChange={(e) => {
                            const val = e.target.value.toUpperCase()
                            setEditedPlate(val)
                            setPlateNumber(val)
                            setIsEditing(true)
                          }}
                          placeholder="请输入车牌号"
                          className="text-lg font-mono h-12 font-bold"
                        />
                        {!isEditing && (
                          <Button size="icon" variant="outline" onClick={handleEditPlate}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}
              </CardContent>
            </Card>

            <div className="flex gap-3">
              {!isIOS && (
                <Button variant="outline" className="flex-1 bg-transparent" onClick={handleRetake}>
                  {photoUrl ? "重新开始" : "返回"}
                </Button>
              )}
              <Button
                className={isIOS ? "w-full" : "flex-1"}
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
              <Button className="flex-1 bg-primary hover:bg-primary/90" onClick={handleNewEntry}>
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
