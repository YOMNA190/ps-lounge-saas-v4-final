import { supabase } from '@/lib/supabase'
import { Product, SaleItem } from '@/types'

export async function getProducts(categoryId?: number) {
  let q = supabase
    .from('products')
    .select('*, category:inventory_categories(*)')
    .eq('is_active', true)
    .order('category_id')
    .order('name')
  if (categoryId) q = q.eq('category_id', categoryId)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function getLowStockProducts(): Promise<Product[]> {
  // Simple client-side filter — Supabase doesn't support column-vs-column comparisons
  const { data } = await supabase
    .from('products')
    .select('*, category:inventory_categories(*)')
    .eq('is_active', true)
  return ((data || []) as Product[]).filter(p => p.stock_qty <= p.min_stock_qty)
}

export async function getAllLowStock(): Promise<Product[]> {
  const { data } = await supabase
    .from('products')
    .select('*, category:inventory_categories(*)')
    .eq('is_active', true)
  const all = (data || []) as Product[]
  return all.filter(p => p.stock_qty <= p.min_stock_qty)
}

export async function restockProduct(productId: number, qty: number, notes?: string, staffId?: string) {
  const { data, error } = await supabase.rpc('restock_product', {
    p_product_id: productId,
    p_qty:        qty,
    p_notes:      notes || null,
    p_staff_id:   staffId || null,
  })
  return { data, error }
}

export async function createProduct(product: Partial<Product>) {
  const { data, error } = await supabase.from('products').insert(product).select().single()
  return { data, error }
}

export async function updateProduct(id: number, updates: Partial<Product>) {
  const { data, error } = await supabase.from('products').update(updates).eq('id', id).select().single()
  return { data, error }
}

// ─────────────────────────────────────────────────────────────
// POS — Create a sale
// ─────────────────────────────────────────────────────────────
export async function createSale(
  items: SaleItem[],
  staffId: string,
  sessionId?: string,
  customerId?: string
) {
  // 1. Create sale header
  const { data: sale, error: saleErr } = await supabase
    .from('sales')
    .insert({
      session_id:  sessionId  || null,
      customer_id: customerId || null,
      staff_id:    staffId,
    })
    .select()
    .single()

  if (saleErr || !sale) return { data: null, error: saleErr }

  // 2. Insert items (triggers handle stock reduction + total update)
  const saleItems = items.map(item => ({
    sale_id:    sale.id,
    product_id: item.product_id,
    qty:        item.qty,
    unit_price: item.unit_price,
    unit_cost:  item.unit_cost,
  }))

  const { error: itemsErr } = await supabase.from('sale_items').insert(saleItems)
  if (itemsErr) return { data: null, error: itemsErr }

  // 3. Fetch final sale with total
  const { data: finalSale } = await supabase
    .from('sales')
    .select('*, items:sale_items(*, product:products(name,unit))')
    .eq('id', sale.id)
    .single()

  return { data: finalSale, error: null }
}

export async function getTodaySales() {
  const today = new Date(); today.setHours(0,0,0,0)
  const { data, error } = await supabase
    .from('sales')
    .select('*, items:sale_items(*, product:products(name)), customer:customers(name)')
    .gte('created_at', today.toISOString())
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}
