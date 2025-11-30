"use client"

import type React from "react"

import { useRef, useState, useCallback, useEffect } from "react"
import { Camera, SwitchCamera, ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

interface CameraCaptureProps {
  onCapture: (imageDataUrl: string) => void
  useNativeCamera?: boolean
}

export function CameraCapture({ onCapture, useNativeCamera = false }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const nativeCameraInputRef = useRef<HTMLInputElement>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment")
  const [error, setError] = useState<string | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [isIOS, setIsIOS] = useState(false)

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
    } catch (err: unknown) {
      console.error("Camera error:", err)
      let errorMessage = "Unable to access camera"
      
      // Type guard for DOMException/Error with name property
      const isErrorWithName = (error: unknown): error is { name?: string; message?: string } => {
        return typeof error === 'object' && error !== null
      }
      
      if (isErrorWithName(err)) {
        if (err.name === "NotAllowedError" || err.name === "PermissionDismissedError") {
          errorMessage = "Camera permission denied, please allow access or use gallery"
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
          errorMessage = "Camera not found, please use gallery"
        } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
          errorMessage = "Camera in use, close other apps or use gallery"
        } else if (err.name === "OverconstrainedError") {
          errorMessage = "Camera settings not supported, please use gallery"
        } else if (err.message) {
          errorMessage = `Camera error: ${err.message}, please use gallery`
        } else {
          errorMessage = "Unable to access camera, check permissions or use gallery"
        }
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

    // Compress image: max width 800px, quality 0.6
    const MAX_WIDTH = 800
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

            const MAX_WIDTH = 800
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
    
    if (e.target) {
      e.target.value = ''
    }
  }

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

          const MAX_WIDTH = 800
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

  if (useNativeCamera || isIOS) {
    return (
      <div className="space-y-4">
        <div className="relative aspect-video overflow-hidden rounded-lg bg-muted border-2 border-dashed border-muted-foreground/50 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <Camera className="mx-auto h-12 w-12 mb-2" />
            <p className="text-sm">System Camera</p>
            {isIOS && (
              <p className="text-xs mt-1 text-muted-foreground/70">
                Use "Scan Text" after capture
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <Button 
            className="flex-1 bg-green-600 hover:bg-green-700" 
            onClick={() => nativeCameraInputRef.current?.click()}
          >
            <Camera className="mr-2 h-5 w-5" />
            {isIOS ? "Camera" : "Capture"}
          </Button>

          <Button variant="outline" size="icon" onClick={() => fileInputRef.current?.click()}>
            <ImageIcon className="h-5 w-5" />
          </Button>
        </div>

        <input 
          ref={nativeCameraInputRef} 
          type="file" 
          accept="image/*" 
          capture="environment"
          className="hidden" 
          onChange={handleNativeCamera} 
        />
        
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

  return (
    <div className="space-y-4">
      <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
        <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
        <canvas ref={canvasRef} className="hidden" />

        {!isStreaming && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <div className="text-center text-muted-foreground">
              <Camera className="mx-auto h-12 w-12 mb-2 animate-pulse" />
              <p>Starting...</p>
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
          Capture
        </Button>

        <Button variant="outline" size="icon" onClick={() => fileInputRef.current?.click()}>
          <ImageIcon className="h-5 w-5" />
        </Button>

        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
      </div>
    </div>
  )
}
