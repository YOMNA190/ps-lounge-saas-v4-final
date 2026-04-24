import { useState, useEffect } from 'react'
import { getDashboardSummary } from '@/lib/analytics'
import { DashboardSummary } from '@/types'
import { useAuth } from '@/lib/auth-context'

export function useDashboard() {
  const { isAdmin } = useAuth()
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isAdmin) return
    setLoading(true)
    getDashboardSummary()
      .then(setSummary)
      .finally(() => setLoading(false))

    // Refresh every 2 minutes
    const id = setInterval(() => {
      getDashboardSummary().then(setSummary)
    }, 120_000)
    return () => clearInterval(id)
  }, [isAdmin])

  return { summary, loading }
}
