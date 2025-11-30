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

      if (debouncedSearchQuery.trim()) {
        query = query.ilike("plate_number", `%${debouncedSearchQuery}%`)
      }

      const { data, error: queryError } = await query

      if (queryError) {
        throw queryError
      }

      setTickets((data as Ticket[]) || [])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Query failed"
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

  useEffect(() => {
    setIsLoading(true)
    fetchTickets().finally(() => setIsLoading(false))
  }, [statusFilter, debouncedSearchQuery])

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
