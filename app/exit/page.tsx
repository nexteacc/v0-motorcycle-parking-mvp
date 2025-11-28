"use client"

import type React from "react"

import { useState } from "react"
import { QrCode, Search, Check, Undo2, Loader2, Clock, ImageIcon } from "lucide-react"
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
import { QRScanner } from "@/components/qr-scanner"
import { createClient } from "@/lib/supabase/client"
import type { Ticket } from "@/lib/types"

type Mode = "select" | "qr-scan" | "upload-scan" | "search" | "confirm" | "success"

export default function ExitPage() {
  const [mode, setMode] = useState<Mode>("select")
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Ticket[]>([])
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exitedTicket, setExitedTicket] = useState<Ticket | null>(null)
  const [showUndoDialog, setShowUndoDialog] = useState(false)
  const [canUndo, setCanUndo] = useState(false)

  const deviceId = typeof window !== "undefined" ? localStorage.getItem("device_id") || "unknown" : "unknown"

  const handleQRScan = async (data: string) => {
    try {
      const parsed = JSON.parse(data)
      if (parsed.id) {
        await findTicketById(parsed.id)
      }
    } catch {
      setError("无效的二维码")
    }
  }

  const findTicketById = async (id: number) => {
    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data, error: fetchError } = await supabase.from("tickets").select("*").eq("id", id).single()

      if (fetchError) throw fetchError

      if (!data) {
        setError("未找到该停车记录")
        return
      }

      setSelectedTicket(data as Ticket)
      setMode("confirm")
    } catch (err) {
      setError(err instanceof Error ? err.message : "查询失败")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    setIsSearching(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data, error: searchError } = await supabase
        .from("tickets")
        .select("*")
        .eq("parking_lot_id", "default")
        .eq("status", "active")
        .ilike("plate_number", `%${searchQuery.toUpperCase()}%`)
        .order("entry_time", { ascending: false })
        .limit(10)

      if (searchError) throw searchError

      setSearchResults((data as Ticket[]) || [])

      if (!data || data.length === 0) {
        setError("未找到匹配的在场车辆")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "搜索失败")
    } finally {
      setIsSearching(false)
    }
  }

  const handleSelectTicket = (ticket: Ticket) => {
    setSelectedTicket(ticket)
    setMode("confirm")
  }

  const handleConfirmExit = async () => {
    if (!selectedTicket) return

    setIsLoading(true)
    setError(null)

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "出场登记失败")
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
    setError(null)

    try {
      // Verify can still undo
      const stillCanUndo = await checkCanUndo(exitedTicket.id)
      if (!stillCanUndo) {
        setError("无法撤销：该车牌已有新的入场记录")
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "撤销失败")
    } finally {
      setIsLoading(false)
    }
  }

  const handleNewExit = () => {
    setSelectedTicket(null)
    setExitedTicket(null)
    setSearchQuery("")
    setSearchResults([])
    setError(null)
    setMode("select")
  }

  const handleQRImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const result = event.target?.result as string
      if (result) {
        // Use jsQR to decode from image
        const img = new Image()
        img.onload = async () => {
          const canvas = document.createElement("canvas")
          canvas.width = img.width
          canvas.height = img.height
          const ctx = canvas.getContext("2d")
          if (ctx) {
            ctx.drawImage(img, 0, 0)
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
            // Use jsQR library (should be imported at top)
            const code = (window as any).jsQR(imageData.data, imageData.width, imageData.height)
            if (code) {
              handleQRScan(code.data)
            } else {
              setError("无法识别二维码，请确保图片清晰")
            }
          }
        }
        img.src = result
      }
    }
    reader.readAsDataURL(file)
  }

  const formatDuration = (entryTime: string, exitTime?: string | null) => {
    const start = new Date(entryTime)
    const end = exitTime ? new Date(exitTime) : new Date()
    const diff = end.getTime() - start.getTime()

    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    if (hours > 0) {
      return `${hours}小时${minutes}分钟`
    }
    return `${minutes}分钟`
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="border-b bg-card/50 backdrop-blur-md sticky top-0 z-10">
        <div className="mx-auto max-w-md px-4 py-3">
          <h1 className="text-lg font-semibold text-foreground">出场登记</h1>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-6">
        {mode === "select" && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>选择出场方式</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  className="w-full h-16 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
                  onClick={() => setMode("qr-scan")}
                >
                  <QrCode className="mr-3 h-5 w-5" />
                  <span className="text-base">扫描二维码</span>
                </Button>
                <Button
                  className="w-full h-16 bg-gradient-to-r from-primary/80 to-accent/80 hover:from-primary/70 hover:to-accent/70"
                  onClick={() => setMode("upload-scan")}
                >
                  <ImageIcon className="mr-3 h-5 w-5" />
                  <span className="text-base">上传二维码图片</span>
                </Button>
                <Button variant="outline" className="w-full h-16 bg-transparent" onClick={() => setMode("search")}>
                  <Search className="mr-3 h-5 w-5" />
                  <span className="text-base">搜索车牌</span>
                </Button>
              </CardContent>
            </Card>
          </div>
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
                  扫描二维码
                </Button>
                <Button
                  variant={mode === "upload-scan" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setMode("upload-scan")}
                >
                  <ImageIcon className="mr-2 h-4 w-4" />
                  上传图片
                </Button>
              </div>
            )}

            {mode === "qr-scan" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <QrCode className="h-5 w-5" />
                    扫描停车票二维码
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <QRScanner onScan={handleQRScan} />
                  {isLoading && (
                    <div className="mt-4 flex items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>正在查询...</span>
                    </div>
                  )}
                  <Button variant="outline" className="w-full mt-4 bg-transparent" onClick={() => setMode("select")}>
                    返回选择
                  </Button>
                </CardContent>
              </Card>
            )}

            {mode === "upload-scan" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="h-5 w-5" />
                    上传二维码图片
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
                        handleQRImageUpload(event)
                      }
                      input.click()
                    }}
                  >
                    <div className="text-center">
                      <ImageIcon className="mx-auto h-12 w-12 mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">点击上传二维码图片</p>
                    </div>
                  </div>
                  {isLoading && (
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>正在识别...</span>
                    </div>
                  )}
                  {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}
                  <Button
                    variant="outline"
                    className="w-full bg-transparent"
                    onClick={() => {
                      setError(null)
                      setMode("select")
                    }}
                  >
                    返回选择
                  </Button>
                </CardContent>
              </Card>
            )}

            {mode === "search" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="h-5 w-5" />
                    搜索车牌号
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
                      placeholder="输入车牌号"
                      className="font-mono"
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    />
                    <Button onClick={handleSearch} disabled={isSearching}>
                      {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </div>

                  {searchResults.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">找到 {searchResults.length} 条记录</p>
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
                            入场: {new Date(ticket.entry_time).toLocaleString("zh-CN")}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {error && mode !== "upload-scan" && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
            )}
          </div>
        )}

        {mode === "confirm" && selectedTicket && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>确认出场信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedTicket.photo_url && (
                  <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
                    <img
                      src={selectedTicket.photo_url || "/placeholder.svg"}
                      alt="车辆照片"
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}

                <div className="rounded-lg bg-muted/50 p-4 space-y-3">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">车牌号码</p>
                    <p className="text-2xl font-mono font-bold">{selectedTicket.plate_number}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">入场时间</p>
                      <p className="font-medium">{new Date(selectedTicket.entry_time).toLocaleString("zh-CN")}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">停车时长</p>
                      <p className="font-medium flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {formatDuration(selectedTicket.entry_time)}
                      </p>
                    </div>
                  </div>

                  {selectedTicket.status !== "active" && (
                    <div className="rounded bg-orange-100 p-2 text-center text-sm text-orange-700">
                      状态: {selectedTicket.status === "exited" ? "已出场" : selectedTicket.status}
                    </div>
                  )}
                </div>

                {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 bg-transparent" onClick={handleNewExit}>
                取消
              </Button>
              <Button
                className="flex-1 bg-primary hover:bg-primary/90"
                onClick={handleConfirmExit}
                disabled={isLoading || selectedTicket.status !== "active"}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    处理中...
                  </>
                ) : (
                  "确认出场"
                )}
              </Button>
            </div>
          </div>
        )}

        {mode === "success" && exitedTicket && (
          <div className="space-y-4">
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="text-center">
                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Check className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-primary">出场登记成功</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-white p-4 space-y-3">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">车牌号码</p>
                    <p className="text-2xl font-mono font-bold">{exitedTicket.plate_number}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">入场时间</p>
                      <p className="font-medium">{new Date(exitedTicket.entry_time).toLocaleString("zh-CN")}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">出场时间</p>
                      <p className="font-medium">
                        {exitedTicket.exit_time ? new Date(exitedTicket.exit_time).toLocaleString("zh-CN") : "-"}
                      </p>
                    </div>
                  </div>

                  <div className="text-center pt-2 border-t">
                    <p className="text-sm text-muted-foreground">总停车时长</p>
                    <p className="text-lg font-semibold">
                      {formatDuration(exitedTicket.entry_time, exitedTicket.exit_time)}
                    </p>
                  </div>
                </div>

                {canUndo && (
                  <Button variant="outline" className="w-full bg-transparent" onClick={() => setShowUndoDialog(true)}>
                    <Undo2 className="mr-2 h-4 w-4" />
                    撤销出场
                  </Button>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 bg-transparent" onClick={() => setMode("select")}>
                继续出场
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* Undo Confirmation Dialog */}
      <Dialog open={showUndoDialog} onOpenChange={setShowUndoDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认撤销出场</DialogTitle>
            <DialogDescription>
              撤销后，车牌 <span className="font-mono font-bold">{exitedTicket?.plate_number}</span> 将恢复为在场状态。
              <br />
              此操作会被记录到系统日志中。
            </DialogDescription>
          </DialogHeader>
          {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setShowUndoDialog(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleUndo} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  处理中...
                </>
              ) : (
                "确认撤销"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
