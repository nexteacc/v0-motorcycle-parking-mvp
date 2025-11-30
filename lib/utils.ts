import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { Badge } from '@/components/ui/badge'
import type { TicketStatus } from '@/lib/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

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

export function getStatusBadgeConfig(status: TicketStatus): { label: string; className: string } {
  const variants: Record<TicketStatus, { label: string; className: string }> = {
    active: { label: "Active", className: "bg-green-100 text-green-700 hover:bg-green-100" },
    exited: { label: "Exited", className: "bg-gray-100 text-gray-700 hover:bg-gray-100" },
    error: { label: "Error", className: "bg-red-100 text-red-700 hover:bg-red-100" },
    abnormal: { label: "Abnormal", className: "bg-orange-100 text-orange-700 hover:bg-orange-100" },
  }
  return variants[status]
}

export function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  })
}
