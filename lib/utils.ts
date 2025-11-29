import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { Badge } from '@/components/ui/badge'
import type { TicketStatus } from '@/lib/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 格式化停车时长
 * @param entryTime 入场时间
 * @param exitTime 出场时间（可选）
 * @returns 格式化的时长字符串，如 "2h 30m" 或 "45m"
 */
export function formatDuration(entryTime: string, exitTime?: string | null): string {
  const start = new Date(entryTime)
  const end = exitTime ? new Date(exitTime) : new Date()
  const diff = end.getTime() - start.getTime()

  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

/**
 * 获取状态徽章的配置
 * @param status 车辆状态
 * @returns 状态徽章的标签和样式类名
 */
export function getStatusBadgeConfig(status: TicketStatus): { label: string; className: string } {
  const variants: Record<TicketStatus, { label: string; className: string }> = {
    active: { label: "Active", className: "bg-green-100 text-green-700 hover:bg-green-100" },
    exited: { label: "Exited", className: "bg-gray-100 text-gray-700 hover:bg-gray-100" },
    error: { label: "Error", className: "bg-red-100 text-red-700 hover:bg-red-100" },
    abnormal: { label: "Abnormal", className: "bg-orange-100 text-orange-700 hover:bg-orange-100" },
  }
  return variants[status]
}

/**
 * 格式化日期时间（简化版）
 * @param dateString ISO 日期字符串
 * @returns 格式化的日期字符串，如 "1/15 14:30"
 */
export function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  })
}
