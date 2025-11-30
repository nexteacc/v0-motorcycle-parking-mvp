"use client"

import { useState, useEffect } from "react"
import { X, Sparkles, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function ProductIntroToast() {
  const [showToast, setShowToast] = useState(false)
  const [showDialog, setShowDialog] = useState(false)

  useEffect(() => {
    // 初始化 CSS 变量
    document.documentElement.style.setProperty('--toast-height', '0px')
    
    // 检查是否已经关闭过
    const dismissed = localStorage.getItem("product-intro-dismissed")
    if (!dismissed) {
      setShowToast(true)
    }
  }, [])

  const handleClose = () => {
    setShowToast(false)
    localStorage.setItem("product-intro-dismissed", "true")
  }

  const handleViewDetails = () => {
    setShowDialog(true)
  }

  useEffect(() => {
    // 设置 CSS 变量来控制 Header 位置
    if (showToast) {
      document.documentElement.style.setProperty('--toast-height', '3.5rem')
    } else {
      document.documentElement.style.setProperty('--toast-height', '0px')
    }
    
    return () => {
      // 组件卸载时清理
      document.documentElement.style.setProperty('--toast-height', '0px')
    }
  }, [showToast])

  if (!showToast) return null

  return (
    <>
      <div 
        className="fixed top-0 left-0 right-0 z-50 bg-yellow-400 dark:bg-yellow-500 border-b border-yellow-500 dark:border-yellow-600 shadow-lg"
        style={{
          paddingTop: `env(safe-area-inset-top, 0px)`,
        }}
      >
        <div className="mx-auto max-w-md px-4 py-3">
          <div className="flex items-center gap-3">
            {/* 左侧：图标 */}
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-600 dark:bg-yellow-700 flex-shrink-0 shadow-sm">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            
            {/* 中间：文案（居中显示） */}
            <div className="flex-1 min-w-0 text-center">
              {/* 桌面端：完整文案 */}
              <p className="hidden md:block text-sm text-yellow-900 dark:text-yellow-950 leading-tight font-semibold">
                Quick vehicle check in, check out with AI
              </p>
              {/* 移动端：简短文案 */}
              <p className="block md:hidden text-sm text-yellow-900 dark:text-yellow-950 leading-tight font-semibold">
                AI-powered parking management
              </p>
            </div>
            
            {/* 右侧：操作按钮 */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* 桌面端：文字按钮 */}
              <Button
                variant="ghost"
                size="sm"
                className="hidden md:flex h-7 px-2.5 text-xs font-medium text-yellow-900 dark:text-yellow-950 hover:text-yellow-950 dark:hover:text-yellow-950 hover:bg-yellow-300 dark:hover:bg-yellow-400"
                onClick={handleViewDetails}
              >
                Details
                <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
              </Button>
              {/* 移动端：只显示箭头图标 */}
              <Button
                variant="ghost"
                size="icon"
                className="flex md:hidden h-7 w-7 text-yellow-900 dark:text-yellow-950 hover:text-yellow-950 dark:hover:text-yellow-950 hover:bg-yellow-300 dark:hover:bg-yellow-400"
                onClick={handleViewDetails}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-yellow-900 dark:text-yellow-950 hover:text-yellow-950 dark:hover:text-yellow-950 hover:bg-yellow-300 dark:hover:bg-yellow-400"
                onClick={handleClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Product Guide</DialogTitle>
            <DialogDescription>
              Learn how to use the Motorcycle Parking Management System
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 text-sm">
            <div>
              <h3 className="font-semibold mb-2">Product Overview</h3>
              <p className="text-muted-foreground">
                A modern parking management platform designed for motorcycles. 
                Features automatic license plate recognition, QR code scanning, 
                and real-time vehicle tracking.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Core Features</h3>
              <ul className="space-y-2 text-muted-foreground list-disc list-inside">
                <li>
                  <strong>Check In:</strong> Take a photo or manually enter license plate. 
                  The system automatically recognizes the plate number.
                </li>
                <li>
                  <strong>Check Out:</strong> Scan QR code, upload image, or search by plate 
                  to complete vehicle exit.
                </li>
                <li>
                  <strong>Vehicles:</strong> View all currently parked vehicles and their details.
                </li>
                <li>
                  <strong>History:</strong> Browse complete parking records and statistics.
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-2">How to Use</h3>
              <div className="space-y-2 text-muted-foreground">
                <p>
                  <strong>1. Check In:</strong> Tap "Check In" → Take photo or upload image → 
                  System recognizes plate → Confirm entry.
                </p>
                <p>
                  <strong>2. Check Out:</strong> Tap "Check Out" → Scan QR code or search plate → 
                  Confirm exit.
                </p>
                <p>
                  <strong>3. View Records:</strong> Use "Vehicles" to see current parking, 
                  or "History" for past records.
                </p>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Notes</h3>
              <ul className="space-y-1 text-muted-foreground list-disc list-inside">
                <li>If duplicate plate detected, you can view existing record or mark as abnormal</li>
                <li>All photos are automatically stored and linked to vehicle records</li>
                <li>QR codes are generated for each entry for quick checkout</li>
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
