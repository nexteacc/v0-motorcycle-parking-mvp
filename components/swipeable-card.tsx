"use client"

import { useState, useRef, useEffect, type ReactNode } from "react"
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
  deleteLabel = "删除",
}: SwipeableCardProps) {
  const [translateX, setTranslateX] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const startXRef = useRef<number>(0)
  const currentXRef = useRef<number>(0)
  const isDraggingRef = useRef(false)
  const hasMovedRef = useRef(false)

  const DELETE_BUTTON_WIDTH = 60 // 删除按钮宽度（仅图标，更紧凑）
  const SWIPE_THRESHOLD = 30 // 滑动阈值，超过这个值才认为是滑动

  useEffect(() => {
    const card = cardRef.current
    if (!card) return

    const handleTouchStart = (e: TouchEvent) => {
      if (disabled) return
      // 阻止事件冒泡，避免触发父元素的点击事件
      e.stopPropagation()
      const touch = e.touches[0]
      if (!touch) return
      
      startXRef.current = touch.clientX
      currentXRef.current = startXRef.current
      isDraggingRef.current = false
      hasMovedRef.current = false
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (disabled) return
      const touch = e.touches[0]
      if (!touch) return
      
      currentXRef.current = touch.clientX
      const deltaX = currentXRef.current - startXRef.current

      // 只允许向左滑动（负值）
      if (deltaX < 0) {
        isDraggingRef.current = true
        hasMovedRef.current = Math.abs(deltaX) > SWIPE_THRESHOLD

        // 限制滑动距离
        const maxTranslate = -DELETE_BUTTON_WIDTH
        const newTranslateX = Math.max(maxTranslate, deltaX)
        setTranslateX(newTranslateX)
        
        // 阻止默认滚动行为
        e.preventDefault()
      } else if (translateX < 0) {
        // 如果已经滑出，允许向右滑动恢复
        const newTranslateX = Math.min(0, translateX + deltaX)
        setTranslateX(newTranslateX)
        hasMovedRef.current = true
        e.preventDefault()
      }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (disabled) return

      const deltaX = currentXRef.current - startXRef.current

      // 如果滑动超过一半，自动展开删除按钮
      if (Math.abs(deltaX) > DELETE_BUTTON_WIDTH / 2 && deltaX < 0) {
        setTranslateX(-DELETE_BUTTON_WIDTH)
      } else if (translateX < -DELETE_BUTTON_WIDTH / 2) {
        // 如果已经展开超过一半，保持展开
        setTranslateX(-DELETE_BUTTON_WIDTH)
      } else {
        // 否则回弹
        setTranslateX(0)
      }

      // 如果只是轻微移动（小于阈值），且没有真正滑动，才触发点击
      if (!hasMovedRef.current && Math.abs(deltaX) < SWIPE_THRESHOLD && onTap) {
        // 延迟执行，确保滑动动画完成
        setTimeout(() => {
          if (!isDraggingRef.current) {
            onTap()
          }
        }, 100)
      }

      isDraggingRef.current = false
    }

    // 使用 { passive: false } 以便可以调用 preventDefault
    card.addEventListener("touchstart", handleTouchStart, { passive: false })
    card.addEventListener("touchmove", handleTouchMove, { passive: false })
    card.addEventListener("touchend", handleTouchEnd, { passive: true })

    return () => {
      card.removeEventListener("touchstart", handleTouchStart)
      card.removeEventListener("touchmove", handleTouchMove)
      card.removeEventListener("touchend", handleTouchEnd)
    }
  }, [disabled, onTap, translateX])

  const handleDelete = async () => {
    if (isDeleting) return
    setIsDeleting(true)
    try {
      await onDelete()
      // 删除成功后重置位置
      setTranslateX(0)
    } catch (error) {
      console.error("Delete failed:", error)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleReset = () => {
    setTranslateX(0)
  }

  return (
    <div className="relative overflow-hidden">
      {/* 删除按钮背景 */}
      <div
        className="absolute right-0 top-0 bottom-0 flex items-center justify-end pr-4 bg-destructive z-10"
        style={{ width: `${DELETE_BUTTON_WIDTH}px` }}
      >
        <Button
          variant="destructive"
          size="icon"
          onClick={handleDelete}
          disabled={isDeleting}
          className="h-8 w-8"
          title={deleteLabel}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* 可滑动的卡片 */}
      <div
        ref={cardRef}
        className="relative transition-transform duration-200 ease-out"
        style={{
          transform: `translateX(${translateX}px)`,
          touchAction: "pan-x pan-y", // 允许水平和垂直滑动
          WebkitTouchCallout: "none", // 禁用 iOS 长按菜单
          WebkitUserSelect: "none", // 禁用文本选择
          userSelect: "none",
        }}
        onClick={(e) => {
          // 如果已经滑出，点击卡片区域时恢复
          if (translateX < 0) {
            e.stopPropagation()
            handleReset()
          }
        }}
      >
        <Card 
          className="transition-all hover:shadow-md hover:border-primary/50"
          style={{
            touchAction: "pan-x pan-y",
            WebkitTouchCallout: "none",
            WebkitUserSelect: "none",
            userSelect: "none",
          }}
        >
          <CardContent 
            className="py-3"
            style={{
              touchAction: "pan-x pan-y",
            }}
          >
            {children}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
