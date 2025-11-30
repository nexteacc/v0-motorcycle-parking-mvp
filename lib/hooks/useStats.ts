import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"

interface Stats {
  currentParking: number
  todayEntry: number
  todayExit: number
}

export function useStats() {
  const [stats, setStats] = useState<Stats>({
    currentParking: 0,
    todayEntry: 0,
    todayExit: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setError(null)
        const supabase = createClient()
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const todayStart = today.toISOString()

        const [currentResult, entryResult, exitResult] = await Promise.all([
          supabase
            .from("tickets")
            .select("id", { count: "exact", head: true })
            .eq("parking_lot_id", "default")
            .eq("status", "active"),
          supabase
            .from("tickets")
            .select("id", { count: "exact", head: true })
            .eq("parking_lot_id", "default")
            .gte("entry_time", todayStart),
          supabase
            .from("tickets")
            .select("id", { count: "exact", head: true })
            .eq("parking_lot_id", "default")
            .eq("status", "exited")
            .gte("exit_time", todayStart),
        ])

        setStats({
          currentParking: currentResult.count || 0,
          todayEntry: entryResult.count || 0,
          todayExit: exitResult.count || 0,
        })
      } catch (err) {
        console.error("Fetch stats error:", err)
        setError(err instanceof Error ? err.message : "Failed to fetch stats")
      } finally {
        setIsLoading(false)
      }
    }

    fetchStats()
    
    const interval = setInterval(fetchStats, 30000)
    
    return () => clearInterval(interval)
  }, [])

  return { stats, isLoading, error }
}
