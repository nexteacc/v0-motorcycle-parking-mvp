import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"

interface Stats {
  currentParking: number // 当前在场车辆数
  todayEntry: number // 今日入场数
  todayExit: number // 今日出场数
}

/**
 * 获取停车统计数据 Hook
 * @returns 统计数据
 */
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

        // 并行查询三个统计数据
        const [currentResult, entryResult, exitResult] = await Promise.all([
          // 当前在场车辆数
          supabase
            .from("tickets")
            .select("id", { count: "exact", head: true })
            .eq("parking_lot_id", "default")
            .eq("status", "active"),
          // 今日入场数
          supabase
            .from("tickets")
            .select("id", { count: "exact", head: true })
            .eq("parking_lot_id", "default")
            .gte("entry_time", todayStart),
          // 今日出场数
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
        setError(err instanceof Error ? err.message : "获取统计数据失败")
      } finally {
        setIsLoading(false)
      }
    }

    fetchStats()
    
    // 每 30 秒自动刷新统计数据
    const interval = setInterval(fetchStats, 30000)
    
    return () => clearInterval(interval)
  }, [])

  return { stats, isLoading, error }
}
