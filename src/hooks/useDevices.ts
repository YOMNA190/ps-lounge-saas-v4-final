import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { subscribeToSessions } from '@/lib/sessions'
import { Device, Session } from '@/types'

/**
 * Detect if a session is at risk of being reaped as a ghost session.
 * Ghost sessions are auto-closed after 12 hours of inactivity.
 * We warn users at 6 hours to encourage manual closure.
 *
 * @param startTime - ISO timestamp of session start
 * @returns true if session has been active > 6 hours
 */
export function isGhostRisk(startTime: string): boolean {
  const hoursElapsed = (Date.now() - new Date(startTime).getTime()) / 3_600_000
  return hoursElapsed > 6 // warn after 6 hours, auto-close at 12
}

export function useDevices(branchId?: string) {
  const [devices, setDevices]   = useState<Device[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      // Build query with optional branch_id filter
      let devQuery = supabase.from('devices').select('*').order('id')
      if (branchId) {
        devQuery = devQuery.eq('branch_id', branchId)
      }

      let sessQuery = supabase.from('sessions')
        .select('*, customer:customers(*)')
        .is('ended_at', null)
      if (branchId) {
        sessQuery = sessQuery.eq('branch_id', branchId)
      }

      const [devRes, sessRes] = await Promise.all([devQuery, sessQuery])

      if (devRes.error) throw devRes.error
      if (sessRes.error) throw sessRes.error

      const sessionMap = new Map<number, Session>()
      ;(sessRes.data || []).forEach(s => sessionMap.set(s.device_id, s))

      const enriched = (devRes.data || []).map(d => ({
        ...d,
        active_session: sessionMap.get(d.id) || null,
      }))

      setDevices(enriched)
      setSessions(sessRes.data || [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'خطأ في تحميل البيانات')
    } finally {
      setLoading(false)
    }
  }, [branchId])

  useEffect(() => {
    fetchAll()

    // 🔴 REALTIME — updates across all connected browsers instantly
    // CRITICAL: Filter by branch_id to prevent cross-tenant data leakage
    const channel = subscribeToSessions(fetchAll, branchId)
    return () => { supabase.removeChannel(channel) }
  }, [fetchAll, branchId])

  return { devices, sessions, loading, error, refetch: fetchAll, isGhostRisk }
}
