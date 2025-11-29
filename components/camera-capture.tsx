"use client"

import type React from "react"

import { useRef, useState, useCallback, useEffect } from "react"
import { Camera, SwitchCamera, ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

interface CameraCaptureProps {
  onCapture: (imageDataUrl: string) => void
  useNativeCamera?: boolean // 新增：是否使用原生相机
}

export function CameraCapture({ onCapture, useNativeCamera = false }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const nativeCameraInputRef = useRef<HTMLInputElement>(null) // 新增：原生相机 input
  const [isStreaming, setIsStreaming] = useState(false)
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment")
  const [error, setError] = useState<string | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [isIOS, setIsIOS] = useState(false)

  // 检测是否为 iOS
  useEffect(() => {
    setIsIOS(/iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase()))
  }, [])

  const startCamera = useCallback(async () => {
    try {
      setError(null)

      // Stop existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setIsStreaming(true)
      }
    } catch (err: any) {
      console.error("Camera error:", err)
      let errorMessage = "无法访问摄像头"
      
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDismissedError") {
        errorMessage = "摄像头权限被拒绝，请在浏览器设置中允许摄像头访问，或使用相册上传图片"
      } else if (err?.name === "NotFoundError" || err?.name === "DevicesNotFoundError") {
        errorMessage = "未找到摄像头设备，请使用相册上传图片"
      } else if (err?.name === "NotReadableError" || err?.name === "TrackStartError") {
        errorMessage = "摄像头被其他应用占用，请关闭其他应用后重试，或使用相册上传"
      } else if (err?.name === "OverconstrainedError") {
        errorMessage = "摄像头不支持所需设置，请使用相册上传图片"
      } else if (err?.message) {
        errorMessage = `摄像头错误：${err.message}，请使用相册上传图片`
      } else {
        errorMessage = "无法访问摄像头，请检查权限设置或使用相册上传"
      }
      
      setError(errorMessage)
      setIsStreaming(false)
    }
  }, [facingMode])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsStreaming(false)
  }, [])

  // 如果使用原生相机，就不启动 WebRTC 流
  useEffect(() => {
    if (!useNativeCamera && !isIOS) {
      startCamera()
      return () => stopCamera()
    }
  }, [startCamera, stopCamera, useNativeCamera, isIOS])

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")

    if (!ctx) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Compress image: max width 1024px, quality 0.6
    const MAX_WIDTH = 1024
    let width = video.videoWidth
    let height = video.videoHeight

    if (width > MAX_WIDTH) {
      height = Math.round((height * MAX_WIDTH) / width)
      width = MAX_WIDTH
    }

    canvas.width = width
    canvas.height = height
    ctx.drawImage(video, 0, 0, width, height)

    const imageDataUrl = canvas.toDataURL("image/jpeg", 0.6)
    stopCamera()
    onCapture(imageDataUrl)
  }

  const handleSwitchCamera = () => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"))
  }

  // 处理原生相机拍照（iOS/Android）
  const handleNativeCamera = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const result = event.target?.result as string
      if (result) {
        // Compress image
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement("canvas")
          const ctx = canvas.getContext("2d")
          if (!ctx) return

          const MAX_WIDTH = 1024
          let width = img.width
          let height = img.height

          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width)
            width = MAX_WIDTH
          }

          canvas.width = width
          canvas.height = height
          ctx.drawImage(img, 0, 0, width, height)

          const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.6)
          onCapture(compressedDataUrl)
        }
        img.src = result
      }
    }
    reader.readAsDataURL(file)
    
    // 重置 input，允许重复选择同一文件
    if (e.target) {
      e.target.value = ''
    }
  }

  // 处理相册上传
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const result = event.target?.result as string
      if (result) {
        // Compress uploaded image
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement("canvas")
          const ctx = canvas.getContext("2d")
          if (!ctx) return

          const MAX_WIDTH = 1024
          let width = img.width
          let height = img.height

          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width)
            width = MAX_WIDTH
          }

          canvas.width = width
          canvas.height = height
          ctx.drawImage(img, 0, 0, width, height)

          const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.6)
          stopCamera()
          onCapture(compressedDataUrl)
        }
        img.src = result
      }
    }
    reader.readAsDataURL(file)
  }

  // 如果使用原生相机（iOS 推荐），直接显示按钮
  if (useNativeCamera || isIOS) {
    return (
      <div className="space-y-4">
        <div className="relative aspect-video overflow-hidden rounded-lg bg-muted border-2 border-dashed border-muted-foreground/50 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <Camera className="mx-auto h-12 w-12 mb-2" />
            <p className="text-sm">点击下方按钮使用系统相机</p>
            {isIOS && (
              <p className="text-xs mt-1 text-muted-foreground/70">
                拍照后可使用键盘"扫描文本"识别车牌
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          {/* 原生相机按钮 - iOS/Android 会直接打开系统相机 App */}
          <Button 
            className="flex-1 bg-green-600 hover:bg-green-700" 
            onClick={() => nativeCameraInputRef.current?.click()}
          >
            <Camera className="mr-2 h-5 w-5" />
            {isIOS ? "使用相机拍照" : "拍照"}
          </Button>

          {/* 相册选择 */}
          <Button variant="outline" size="icon" onClick={() => fileInputRef.current?.click()}>
            <ImageIcon className="h-5 w-5" />
          </Button>
        </div>

        {/* 原生相机 input - capture="environment" 表示后置摄像头 */}
        <input 
          ref={nativeCameraInputRef} 
          type="file" 
          accept="image/*" 
          capture="environment"
          className="hidden" 
          onChange={handleNativeCamera} 
        />
        
        {/* 相册选择 input */}
        <input 
          ref={fileInputRef} 
          type="file" 
          accept="image/*" 
          className="hidden" 
          onChange={handleFileUpload} 
        />
      </div>
    )
  }

  // 否则使用 WebRTC 浏览器内相机（桌面端或 Android 非原生模式）
  return (
    <div className="space-y-4">
      <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
        <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
        <canvas ref={canvasRef} className="hidden" />

        {!isStreaming && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <div className="text-center text-muted-foreground">
              <Camera className="mx-auto h-12 w-12 mb-2 animate-pulse" />
              <p>正在启动摄像头...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <div className="text-center text-muted-foreground p-4">
              <Camera className="mx-auto h-12 w-12 mb-2 opacity-50" />
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Button variant="outline" size="icon" onClick={handleSwitchCamera} disabled={!isStreaming}>
          <SwitchCamera className="h-5 w-5" />
        </Button>

        <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={handleCapture} disabled={!isStreaming}>
          <Camera className="mr-2 h-5 w-5" />
          拍照
        </Button>

        <Button variant="outline" size="icon" onClick={() => fileInputRef.current?.click()}>
          <ImageIcon className="h-5 w-5" />
        </Button>

        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
      </div>
    </div>
  )
}
