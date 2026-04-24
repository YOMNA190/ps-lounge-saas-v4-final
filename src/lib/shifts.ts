import { supabase } from '@/lib/supabase'

export async function startShift(staffId: string, openingCash: number) {
  const { data: existing } = await supabase
    .from('shifts').select('id').eq('staff_id', staffId).is('ended_at', null).single()
  if (existing) return { data: null, error: new Error('يوجد شيفت نشط بالفعل') }
  const { data, error } = await supabase
    .from('shifts')
    .insert({ staff_id: staffId, opening_cash: openingCash })
    .select('*, staff:profiles(name, role)').single()
  return { data, error }
}

export async function endShift(
  shiftId: string, pin: string,
  closingCash: number, cashTaken: number, cashLeft: number
) {
  const { data, error } = await supabase.rpc('end_shift', {
    p_shift_id: shiftId, p_pin: pin,
    p_closing_cash: closingCash, p_cash_taken: cashTaken, p_cash_left: cashLeft,
  })
  if (error) {
    const msg = error.message || ''
    if (msg.includes('PIN')) return { data: null, error: new Error('❌ PIN غير صحيح') }
    return { data: null, error: new Error(msg) }
  }
  return { data, error: null }
}

export async function getShiftPreview(staffId: string, shiftStartedAt: string) {
  const start = new Date(shiftStartedAt)
  const [sessRes, saleRes] = await Promise.all([
    supabase.from('sessions').select('cost')
      .eq('staff_id', staffId).gte('started_at', start.toISOString()).not('ended_at', 'is', null),
    supabase.from('sales').select('total')
      .eq('staff_id', staffId).gte('created_at', start.toISOString()),
  ])
  const sessionsRevenue = (sessRes.data || []).reduce((s: number, r: { cost: number }) => s + (r.cost || 0), 0)
  const salesRevenue    = (saleRes.data || []).reduce((s: number, r: { total: number }) => s + (r.total || 0), 0)
  return {
    sessionsRevenue: Math.round(sessionsRevenue * 100) / 100,
    salesRevenue:    Math.round(salesRevenue * 100) / 100,
    total:           Math.round((sessionsRevenue + salesRevenue) * 100) / 100,
    sessionsCount:   sessRes.data?.length || 0,
    salesCount:      saleRes.data?.length || 0,
  }
}

export async function getActiveShift(staffId: string) {
  const { data } = await supabase
    .from('shifts').select('*, staff:profiles(name, role)')
    .eq('staff_id', staffId).is('ended_at', null).single()
  return data
}

export async function getAllActiveShifts() {
  const { data } = await supabase
    .from('shifts').select('*, staff:profiles(name, role)').is('ended_at', null).order('started_at')
  return data || []
}

export async function getShiftHistory(limit = 20) {
  const { data } = await supabase
    .from('shifts').select('*, staff:profiles(name, role)')
    .not('ended_at', 'is', null).order('ended_at', { ascending: false }).limit(limit)
  return data || []
}

export async function setStaffPin(staffId: string, pin: string) {
  const { error } = await supabase.rpc('set_staff_pin', { p_staff_id: staffId, p_pin: pin })
  return { error }
}

export async function getUnreadAlerts() {
  const { data } = await supabase
    .from('alerts').select('*').eq('is_read', false)
    .order('created_at', { ascending: false }).limit(20)
  return data || []
}

export async function markAlertRead(alertId: number) {
  await supabase.from('alerts').update({ is_read: true }).eq('id', alertId)
}

// Customer loyalty
export async function getCustomerMonthlySpending(customerId?: string) {
  let q = supabase.from('customer_monthly_spending').select('*').order('total_spend', { ascending: false })
  if (customerId) q = q.eq('id', customerId)
  const { data } = await q
  return data || []
}

export async function claimCustomerReward(customerId: string) {
  const { data, error } = await supabase.rpc('claim_customer_reward', { p_customer_id: customerId })
  return { data, error }
}

export async function getAllStaff() {
  const { data } = await supabase.from('profiles').select('*').order('name')
  return data || []
}
