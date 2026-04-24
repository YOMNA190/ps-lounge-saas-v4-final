import { supabase } from '@/lib/supabase'
import { Session, StartSessionPayload } from '@/types'
import { sanitizeError } from '@/lib/errors'

// ─────────────────────────────────────────────────────────────
// PRICING CALCULATION — Display only, never sent to server
// The authoritative calculation lives in stop_session() function
// ─────────────────────────────────────────────────────────────
export function calculateSessionPrice(
  durationSeconds: number,
  hourlyRate: number
): number {
  // Ensure non-negative inputs
  if (durationSeconds < 0) durationSeconds = 0
  if (hourlyRate < 0) hourlyRate = 0

  // Convert seconds to minutes, rounding UP (ceiling)
  const minutes = Math.max(Math.ceil(durationSeconds / 60), 1) // Minimum 1 minute

  // Calculate price: (minutes / 60) * hourly_rate
  const price = (minutes / 60) * hourlyRate

  // Round to 2 decimal places
  return Math.round(price * 100) / 100
}

// ─────────────────────────────────────────────────────────────
// START SESSION — Server-side with row locking
// Problem: Two staff can start session on same device simultaneously
// → two active sessions, billing chaos
// Solution: PostgreSQL function with row-level locking
// ─────────────────────────────────────────────────────────────
export async function startSession(
  deviceId: number,
  customerId?: string,
  mode: string = 'single',
  hourlyRate?: number,
  gamePlayed?: string
): Promise<Session> {
  try {
    const { data, error } = await supabase.rpc('start_session', {
      p_device_id:   deviceId,
      p_customer_id: customerId    ?? null,
      p_mode:        mode,
      p_hourly_rate: hourlyRate    ?? null,
      p_game_played: gamePlayed    ?? null,
    })

    if (error) {
      const appError = sanitizeError(error)
      throw new Error(appError.message)
    }

    // rpc with RETURNS SETOF returns an array
    const session = Array.isArray(data) ? data[0] : data
    if (!session) throw new Error('فشل إنشاء الجلسة')

    return session as Session
  } catch (err) {
    const appError = sanitizeError(err)
    throw new Error(appError.message)
  }
}

// ─────────────────────────────────────────────────────────────
// STOP SESSION — Server-side only, client sends NOTHING
// except the session ID. Server calculates everything.
// Problem: Client-side stop_session allows manipulation of
// end_time, duration, price → financial fraud vector
// Solution: PostgreSQL function calculates all values server-side
// ─────────────────────────────────────────────────────────────
export async function stopSession(sessionId: string): Promise<Session> {
  try {
    const { data, error } = await supabase.rpc('stop_session', {
      p_session_id: sessionId,
    })

    if (error) {
      const appError = sanitizeError(error)
      throw new Error(appError.message)
    }

    const session = Array.isArray(data) ? data[0] : data
    if (!session) throw new Error('فشل إنهاء الجلسة')

    return session as Session
  } catch (err) {
    const appError = sanitizeError(err)
    throw new Error(appError.message)
  }
}

// ─────────────────────────────────────────────────────────────
// LEGACY WRAPPER — For backward compatibility
// ─────────────────────────────────────────────────────────────
export async function endSession(sessionId: string) {
  try {
    const session = await stopSession(sessionId)
    return { data: session, error: null }
  } catch (err) {
    return { data: null, error: err }
  }
}

// ─────────────────────────────────────────────────────────────
// GET ACTIVE SESSIONS (for device grid)
// ─────────────────────────────────────────────────────────────
export async function getActiveSessions(): Promise<Session[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select(`
      *,
      device:devices(*),
      customer:customers(*)
    `)
    .is('ended_at', null)
    .order('started_at', { ascending: false })

  if (error) throw error
  return data || []
}

// ─────────────────────────────────────────────────────────────
// GET TODAY'S SESSIONS (admin)
// ─────────────────────────────────────────────────────────────
export async function getTodaySessions(): Promise<Session[]> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { data, error } = await supabase
    .from('sessions')
    .select(`
      *,
      device:devices(*),
      customer:customers(*)
    `)
    .gte('started_at', today.toISOString())
    .not('ended_at', 'is', null)
    .order('ended_at', { ascending: false })

  if (error) throw error
  return data || []
}

// ─────────────────────────────────────────────────────────────
// SUBSCRIBE TO REALTIME CHANGES (with branch_id filtering)
// ─────────────────────────────────────────────────────────────
let channelCounter = 0

export function subscribeToSessions(callback: () => void, branchId?: string) {
  const channelName = `sessions_realtime_${++channelCounter}_${Date.now()}`
  const subscription = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'sessions',
        // ADD THIS LINE: Filter by branch_id to prevent cross-tenant leakage
        ...(branchId && { filter: `branch_id=eq.${branchId}` }),
      },
      callback
    )
    .subscribe()

  return subscription
}
