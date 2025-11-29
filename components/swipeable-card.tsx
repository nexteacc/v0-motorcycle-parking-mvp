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
  const isHorizontalSwipeRef = useRef<boolean | null>(null) // 判断是否为水平滑动
  const hasTappedRef = useRef(false)

  const DELETE_BUTTON_WIDTH = 72 // 删除按钮宽度
  const SWIPE_THRESHOLD = 10 // 判定为滑动的最小距离
  const VELOCITY_THRESHOLD = 0.3 // 速度阈值，用于快速滑动判定
  const startTimeRef = useRef<number>(0)

  // 使用 useCallback 优化性能
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
      isHorizontalSwipeRef.current = null // 重置方向判定
      hasTappedRef.current = false
      setIsDragging(true)
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (disabled || isDeleting || !isDragging) return
      
      const touch = e.touches[0]
      if (!touch) return
      
      const deltaX = touch.clientX - startXRef.current
      const deltaY = touch.clientY - startYRef.current
      
      // 首次移动时判断滑动方向
      if (isHorizontalSwipeRef.current === null) {
        const absX = Math.abs(deltaX)
        const absY = Math.abs(deltaY)
        
        // 需要移动超过阈值才判定方向
        if (absX > SWIPE_THRESHOLD || absY > SWIPE_THRESHOLD) {
          // 水平滑动角度小于 30 度认为是水平滑动
          isHorizontalSwipeRef.current = absX > absY * 1.5
        }
      }
      
      // 如果不是水平滑动，不处理
      if (isHorizontalSwipeRef.current === false) {
        return
      }
      
      // 如果是水平滑动，阻止默认行为（防止页面滚动）
      if (isHorizontalSwipeRef.current === true) {
        e.preventDefault()
      }
      
      currentXRef.current = touch.clientX
      
      // 计算新位置
      let newTranslateX = deltaX
      
      // 如果卡片已经展开，从当前位置开始计算
      if (translateX < 0) {
        newTranslateX = translateX + deltaX
      }
      
      // 限制滑动范围：最多滑出删除按钮宽度，最少回到原位
      newTranslateX = Math.max(-DELETE_BUTTON_WIDTH, Math.min(0, newTranslateX))
      
      // 添加阻尼效果：超过边界时减缓滑动
      if (deltaX > 0 && translateX >= 0) {
        // 向右滑动但已在原位，添加阻尼
        newTranslateX = deltaX * 0.2
        newTranslateX = Math.min(20, newTranslateX) // 最多超出 20px
      }
      
      setTranslateX(newTranslateX)
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (disabled || isDeleting) return
      
      setIsDragging(false)
      
      const deltaX = currentXRef.current - startXRef.current
      const deltaTime = Date.now() - startTimeRef.current
      const velocity = Math.abs(deltaX) / deltaTime // px/ms
      
      // 如果几乎没有移动，认为是点击
      if (Math.abs(deltaX) < SWIPE_THRESHOLD && isHorizontalSwipeRef.current === null) {
        // 如果卡片已展开，点击时收起
        if (translateX < 0) {
          handleReset()
        } else if (onTap) {
          // 否则触发点击事件
          hasTappedRef.current = true
          onTap()
        }
        return
      }
      
      // 如果不是水平滑动，重置位置
      if (isHorizontalSwipeRef.current === false) {
        return
      }
      
      // 根据速度和位置决定最终状态
      const shouldOpen = 
        // 快速向左滑动
        (velocity > VELOCITY_THRESHOLD && deltaX < 0) ||
        // 慢速滑动但超过一半
        (translateX < -DELETE_BUTTON_WIDTH / 2)
      
      const shouldClose = 
        // 快速向右滑动
        (velocity > VELOCITY_THRESHOLD && deltaX > 0) ||
        // 慢速滑动但不足一半
        (translateX >= -DELETE_BUTTON_WIDTH / 2)
      
      if (shouldOpen && !shouldClose) {
        setTranslateX(-DELETE_BUTTON_WIDTH)
      } else {
        handleReset()
      }
    }

    // 使用 passive: false 以便可以调用 preventDefault
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
      // 删除失败时收起卡片
      setTranslateX(0)
    } finally {
      setIsDeleting(false)
    }
  }

  // 计算删除按钮的透明度，基于滑动距离
  const deleteButtonOpacity = Math.min(1, Math.abs(translateX) / (DELETE_BUTTON_WIDTH * 0.5))

  return (
    <div className="relative overflow-hidden rounded-lg">
      {/* 删除按钮背景 - z-index 较低，被卡片遮挡 */}
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

      {/* 可滑动的卡片 - z-index 较高，覆盖删除按钮 */}
      <div
        ref={cardRef}
        className="relative z-10 bg-background"
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          willChange: 'transform',
        }}
        onClick={(e) => {
          // 如果已经滑出，点击卡片区域时恢复
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
            touchAction: 'pan-y', // 允许垂直滚动，水平由我们控制
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
