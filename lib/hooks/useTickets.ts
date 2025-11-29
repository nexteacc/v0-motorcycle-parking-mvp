import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Ticket, TicketStatus } from "@/lib/types"
import { useDebounce } from "./useDebounce"

type FilterStatus = "all" | TicketStatus

interface UseTicketsOptions {
  parkingLotId?: string
  defaultStatusFilter?: FilterStatus
  defaultSearchQuery?: string
  limit?: number
  orderBy?: string
  orderDirection?: "asc" | "desc"
}

interface UseTicketsReturn {
  tickets: Ticket[]
  isLoading: boolean
  isRefreshing: boolean
  error: string | null
  searchQuery: string
  setSearchQuery: (query: string) => void
  statusFilter: FilterStatus
  setStatusFilter: (filter: FilterStatus) => void
  fetchTickets: () => Promise<void>
  refresh: () => Promise<void>
}

/**
 * 统一的车辆列表查询 Hook
 * @param options 查询选项
 * @returns 车辆列表数据和操作方法
 */
export function useTickets(options: UseTicketsOptions = {}): UseTicketsReturn {
  const {
    parkingLotId = "default",
    defaultStatusFilter = "all",
    defaultSearchQuery = "",
    limit = 100,
    orderBy = "entry_time",
    orderDirection = "desc",
  } = options

  const [tickets, setTickets] = useState<Ticket[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState(defaultSearchQuery)
  const [statusFilter, setStatusFilter] = useState<FilterStatus>(defaultStatusFilter)

  // 搜索防抖：延迟 300ms
  const debouncedSearchQuery = useDebounce(searchQuery, 300)

  const fetchTickets = useCallback(async () => {
    try {
      setError(null)
      const supabase = createClient()

      let query = supabase
        .from("tickets")
        .select("id, plate_number, entry_time, exit_time, photo_url, vehicle_color, status, device_id, parking_lot_id, plate_modified, original_plate_number, created_at, updated_at")
        .eq("parking_lot_id", parkingLotId)
        .order(orderBy, { ascending: orderDirection === "asc" })
        .limit(limit)

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter)
      }

      // 使用防抖后的搜索关键词（支持多国车牌格式，不强制转大写）
      if (debouncedSearchQuery.trim()) {
        query = query.ilike("plate_number", `%${debouncedSearchQuery}%`) // ilike 不区分大小写
      }

      const { data, error: queryError } = await query

      if (queryError) {
        throw queryError
      }

      setTickets((data as Ticket[]) || [])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "查询车辆列表失败"
      setError(errorMessage)
      console.error("Fetch tickets error:", err)
      setTickets([])
    }
  }, [parkingLotId, statusFilter, debouncedSearchQuery, limit, orderBy, orderDirection])

  const refresh = useCallback(async () => {
    setIsRefreshing(true)
    await fetchTickets()
    setIsRefreshing(false)
  }, [fetchTickets])

  // 初始加载和筛选条件变化时自动查询
  useEffect(() => {
    setIsLoading(true)
    fetchTickets().finally(() => setIsLoading(false))
  }, [statusFilter, debouncedSearchQuery]) // 使用防抖后的搜索关键词

  return {
    tickets,
    isLoading,
    isRefreshing,
    error,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    fetchTickets,
    refresh,
  }
}
