import { supabase } from '@/lib/supabase'
import { CardInventorySummary, CardSaleReport, CardPaymentMethod } from '@/types'

// ─────────────────────────────────────────────────────────────
// GET INVENTORY SUMMARY
// ─────────────────────────────────────────────────────────────
export async function getCardInventory(): Promise<CardInventorySummary[]> {
  const { data, error } = await supabase
    .from('card_inventory_summary')
    .select('*')
    .order('provider')
    .order('data_amount')
  if (error) throw error
  return (data || []) as CardInventorySummary[]
}

// ─────────────────────────────────────────────────────────────
// SELL CARD — calls server-side function (atomic, FIFO)
// ─────────────────────────────────────────────────────────────
export async function sellCard(params: {
  typeId:        number
  customerId?:   string
  paymentMethod: CardPaymentMethod
  paymentRef?:   string
  salePrice?:    number
  notes?:        string
}) {
  const { data, error } = await supabase.rpc('sell_card', {
    p_type_id:        params.typeId,
    p_customer_id:    params.customerId    ?? null,
    p_payment_method: params.paymentMethod,
    p_payment_ref:    params.paymentRef    ?? null,
    p_sale_price:     params.salePrice     ?? null,
    p_notes:          params.notes         ?? null,
  })
  return { data, error }
}

// ─────────────────────────────────────────────────────────────
// RESTOCK — add cards (with or without serials)
// ─────────────────────────────────────────────────────────────
export async function restockCards(
  typeId: number,
  quantity: number,
  serials?: string[]
) {
  const { data, error } = await supabase.rpc('restock_cards', {
    p_type_id:  typeId,
    p_quantity: quantity,
    p_serials:  serials?.length ? serials : null,
  })
  return { data, error }
}

// ─────────────────────────────────────────────────────────────
// SALES REPORT
// ─────────────────────────────────────────────────────────────
export async function getCardSalesReport(days = 30): Promise<CardSaleReport[]> {
  const since = new Date()
  since.setDate(since.getDate() - days)

  const { data, error } = await supabase
    .from('card_sales_report')
    .select('*')
    .gte('sale_date', since.toISOString().split('T')[0])
  if (error) throw error
  return (data || []) as CardSaleReport[]
}

// ─────────────────────────────────────────────────────────────
// ADD CARD TYPE (admin)
// ─────────────────────────────────────────────────────────────
export async function addCardType(params: {
  name:            string
  provider:        string
  data_amount:     string
  validity_days:   number
  cost_price:      number
  sell_price:      number
  low_stock_alert: number
}) {
  const { data, error } = await supabase
    .from('card_types')
    .insert(params)
    .select()
    .single()
  return { data, error }
}

// ─────────────────────────────────────────────────────────────
// GET TODAY's CARD SALES (for shift summary)
// ─────────────────────────────────────────────────────────────
export async function getTodayCardsSales() {
  const today = new Date(); today.setHours(0,0,0,0)
  const { data } = await supabase
    .from('cards')
    .select('sale_price, payment_method, card_type:card_types(name, provider)')
    .eq('status', 'sold')
    .gte('sold_at', today.toISOString())
  return data || []
}
