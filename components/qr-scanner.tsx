"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { QrCode, Loader2 } from "lucide-react"

interface QRScannerProps {
  onScan: (data: string) => void
}

export function QRScanner({ onScan }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationRef = useRef<number | null>(null)

  const stopScanning = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setIsScanning(false)
  }, [])

  const startScanning = useCallback(async () => {
    try {
      setError(null)

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setIsScanning(true)

        // Dynamic import of jsQR for QR code scanning
        const jsQR = (await import("jsqr")).default

        const scanFrame = () => {
          if (!videoRef.current || !canvasRef.current) return

          const video = videoRef.current
          const canvas = canvasRef.current
          const ctx = canvas.getContext("2d")

          if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
            animationRef.current = requestAnimationFrame(scanFrame)
            return
          }

          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          ctx.drawImage(video, 0, 0)

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          })

          if (code) {
            stopScanning()
            onScan(code.data)
            return
          }

          animationRef.current = requestAnimationFrame(scanFrame)
        }

        animationRef.current = requestAnimationFrame(scanFrame)
      }
    } catch (err) {
      console.error("Camera error:", err)
      setError("无法访问摄像头，请检查权限设置")
      setIsScanning(false)
    }
  }, [onScan, stopScanning])

  useEffect(() => {
    startScanning()
    return () => stopScanning()
  }, [startScanning, stopScanning])

  return (
    <div className="space-y-4">
      <div className="relative aspect-square overflow-hidden rounded-lg bg-black">
        <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
        <canvas ref={canvasRef} className="hidden" />

        {/* Scanning overlay */}
        {isScanning && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-8 border-2 border-white/50 rounded-lg">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-orange-500 rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-orange-500 rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-orange-500 rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-orange-500 rounded-br-lg" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-0.5 w-3/4 bg-orange-500 animate-pulse" />
            </div>
          </div>
        )}

        {!isScanning && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <div className="text-center text-muted-foreground">
              <Loader2 className="mx-auto h-12 w-12 mb-2 animate-spin" />
              <p>正在启动摄像头...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <div className="text-center text-muted-foreground p-4">
              <QrCode className="mx-auto h-12 w-12 mb-2 opacity-50" />
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}
      </div>

      <p className="text-center text-sm text-muted-foreground">将二维码对准扫描框内</p>
    </div>
  )
}
