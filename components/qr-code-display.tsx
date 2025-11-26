"use client"

import { useEffect, useRef } from "react"
import QRCode from "qrcode"
import type { Ticket } from "@/lib/types"

interface QRCodeDisplayProps {
  ticket: Ticket
  size?: number
}

export function QRCodeDisplay({ ticket, size = 200 }: QRCodeDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    // Generate QR code data: ticket ID + plate + parking lot ID + entry time
    const qrData = JSON.stringify({
      id: ticket.id,
      plate: ticket.plate_number,
      lot: ticket.parking_lot_id,
      entry: ticket.entry_time,
    })

    QRCode.toCanvas(canvasRef.current, qrData, {
      width: size,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    })
  }, [ticket, size])

  return (
    <div className="flex justify-center">
      <div className="rounded-lg bg-white p-4 shadow-sm">
        <canvas ref={canvasRef} />
      </div>
    </div>
  )
}
