"use client"

import { useState, useRef, useEffect, useCallback, type ReactNode } from "react"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

interface SwipeableCardProps {
  children: ReactNode
  onDelete: () => void | Promise<void>
  onTap?: () => void
  disabled?: boolean
  deleteLabel?: string
}

export function SwipeableCard({
  children,
  onDelete,
  onTap,
  disabled = false,
  deleteLabel = "Delete",
}: SwipeableCardProps) {
  const [translateX, setTranslateX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const startXRef = useRef<number>(0)
  const startYRef = useRef<number>(0)
  const currentXRef = useRef<number>(0)
  const isHorizontalSwipeRef = useRef<boolean | null>(null)
  const hasTappedRef = useRef(false)

  const DELETE_BUTTON_WIDTH = 72
  const SWIPE_THRESHOLD = 10
  const VELOCITY_THRESHOLD = 0.3
  const startTimeRef = useRef<number>(0)

  const handleReset = useCallback(() => {
    setTranslateX(0)
  }, [])

  useEffect(() => {
    const card = cardRef.current
    if (!card) return

    const handleTouchStart = (e: TouchEvent) => {
      if (disabled || isDeleting) return
      
      const touch = e.touches[0]
      if (!touch) return
      
      startXRef.current = touch.clientX
      startYRef.current = touch.clientY
      currentXRef.current = touch.clientX
      startTimeRef.current = Date.now()
      isHorizontalSwipeRef.current = null
      hasTappedRef.current = false
      setIsDragging(true)
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (disabled || isDeleting || !isDragging) return
      
      const touch = e.touches[0]
      if (!touch) return
      
      const deltaX = touch.clientX - startXRef.current
      const deltaY = touch.clientY - startYRef.current
      
      if (isHorizontalSwipeRef.current === null) {
        const absX = Math.abs(deltaX)
        const absY = Math.abs(deltaY)
        
        if (absX > SWIPE_THRESHOLD || absY > SWIPE_THRESHOLD) {
          isHorizontalSwipeRef.current = absX > absY * 1.5
        }
      }
      
      if (isHorizontalSwipeRef.current === false) {
        return
      }
      
      if (isHorizontalSwipeRef.current === true) {
        e.preventDefault()
      }
      
      currentXRef.current = touch.clientX
      
      let newTranslateX = deltaX
      
      if (translateX < 0) {
        newTranslateX = translateX + deltaX
      }
      
      newTranslateX = Math.max(-DELETE_BUTTON_WIDTH, Math.min(0, newTranslateX))
      
      if (deltaX > 0 && translateX >= 0) {
        newTranslateX = deltaX * 0.2
        newTranslateX = Math.min(20, newTranslateX)
      }
      
      setTranslateX(newTranslateX)
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (disabled || isDeleting) return
      
      setIsDragging(false)
      
      const deltaX = currentXRef.current - startXRef.current
      const deltaTime = Date.now() - startTimeRef.current
      const velocity = Math.abs(deltaX) / deltaTime
      
      if (Math.abs(deltaX) < SWIPE_THRESHOLD && isHorizontalSwipeRef.current === null) {
        if (translateX < 0) {
          handleReset()
        } else if (onTap) {
          hasTappedRef.current = true
          onTap()
        }
        return
      }
      
      if (isHorizontalSwipeRef.current === false) {
        return
      }
      
      const shouldOpen = 
        (velocity > VELOCITY_THRESHOLD && deltaX < 0) ||
        (translateX < -DELETE_BUTTON_WIDTH / 2)
      
      const shouldClose = 
        (velocity > VELOCITY_THRESHOLD && deltaX > 0) ||
        (translateX >= -DELETE_BUTTON_WIDTH / 2)
      
      if (shouldOpen && !shouldClose) {
        setTranslateX(-DELETE_BUTTON_WIDTH)
      } else {
        handleReset()
      }
    }

    card.addEventListener("touchstart", handleTouchStart, { passive: true })
    card.addEventListener("touchmove", handleTouchMove, { passive: false })
    card.addEventListener("touchend", handleTouchEnd, { passive: true })

    return () => {
      card.removeEventListener("touchstart", handleTouchStart)
      card.removeEventListener("touchmove", handleTouchMove)
      card.removeEventListener("touchend", handleTouchEnd)
    }
  }, [disabled, isDeleting, isDragging, translateX, onTap, handleReset])

  const handleDelete = async () => {
    if (isDeleting) return
    setIsDeleting(true)
    try {
      await onDelete()
      setTranslateX(0)
    } catch (error) {
      console.error("Delete failed:", error)
      setTranslateX(0)
    } finally {
      setIsDeleting(false)
    }
  }

  const deleteButtonOpacity = Math.min(1, Math.abs(translateX) / (DELETE_BUTTON_WIDTH * 0.5))

  return (
    <div className="relative overflow-hidden rounded-lg">
      <div
        className="absolute inset-y-0 right-0 flex items-center justify-center bg-destructive"
        style={{ 
          width: `${DELETE_BUTTON_WIDTH}px`,
          opacity: deleteButtonOpacity,
        }}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDelete}
          disabled={isDeleting}
          className="h-10 w-10 text-white hover:bg-destructive/80 hover:text-white"
          title={deleteLabel}
        >
          <Trash2 className={`h-5 w-5 ${isDeleting ? 'animate-pulse' : ''}`} />
        </Button>
      </div>

      <div
        ref={cardRef}
        className="relative z-10 bg-background"
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          willChange: 'transform',
        }}
        onClick={(e) => {
          if (translateX < 0) {
            e.preventDefault()
            e.stopPropagation()
            handleReset()
          }
        }}
      >
        <Card 
          className="border shadow-sm"
          style={{
            touchAction: 'pan-y',
            WebkitUserSelect: 'none',
            userSelect: 'none',
          }}
        >
          <CardContent className="py-3">
            {children}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
