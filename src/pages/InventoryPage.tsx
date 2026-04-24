import { useState, useEffect, useCallback } from 'react'
import { Product, InventoryCategory, SaleItem } from '@/types'
import { getProducts, restockProduct, createSale, getAllLowStock } from '@/lib/inventory'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { Plus, Minus, ShoppingCart, RefreshCw, AlertTriangle, Search, X } from 'lucide-react'
import { toast } from 'sonner'

export default function InventoryPage() {
  const { user, isAdmin } = useAuth()
  const [products, setProducts]       = useState<Product[]>([])
  const [categories, setCategories]   = useState<InventoryCategory[]>([])
  const [lowStock, setLowStock]       = useState<Product[]>([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [selectedCat, setSelectedCat] = useState<number | null>(null)
  const [tab, setTab]                 = useState<'stock' | 'pos' | 'low'>('pos')

  // POS cart
  const [cart, setCart]             = useState<SaleItem[]>([])
  const [checkingOut, setCheckingOut] = useState(false)

  // Restock modal
  const [restockModal, setRestockModal] = useState<Product | null>(null)
  const [restockQty, setRestockQty]     = useState(12)

  const load = useCallback(async () => {
    setLoading(true)
    const [prods, cats, low] = await Promise.all([
      getProducts(),
      supabase.from('inventory_categories').select('*').then(r => r.data || []),
      getAllLowStock(),
    ])
    setProducts(prods as Product[])
    setCategories(cats as InventoryCategory[])
    setLowStock(low)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = products.filter(p => {
    const matchCat = selectedCat ? p.category_id === selectedCat : true
    const matchSearch = search ? p.name.toLowerCase().includes(search.toLowerCase()) : true
    return matchCat && matchSearch
  })

  // POS cart logic
  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.product_id === product.id)
      if (existing) return prev.map(i => i.product_id === product.id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { product_id: product.id, qty: 1, unit_price: product.sell_price, unit_cost: product.cost_price, product }]
    })
  }

  const updateCartQty = (productId: number, delta: number) => {
    setCart(prev => prev
      .map(i => i.product_id === productId ? { ...i, qty: i.qty + delta } : i)
      .filter(i => i.qty > 0)
    )
  }

  const cartTotal = cart.reduce((s, i) => s + i.qty * i.unit_price, 0)
  const cartProfit = cart.reduce((s, i) => s + i.qty * (i.unit_price - i.unit_cost), 0)

  const handleCheckout = async () => {
    if (!cart.length || !user) return
    setCheckingOut(true)
    const { data, error } = await createSale(cart, user.id)
    if (error) toast.error('فشل البيع')
    else {
      toast.success(`✓ تم البيع — ${(data as { total: number })?.total} جنيه`)
      setCart([])
      load()
    }
    setCheckingOut(false)
  }

  const handleRestock = async () => {
    if (!restockModal || !user) return
    const { error } = await restockProduct(restockModal.id, restockQty, undefined, user.id)
    if (error) toast.error('فشل التخزين')
    else { toast.success(`✓ تم إضافة ${restockQty} ${restockModal.unit}`); setRestockModal(null); load() }
  }

  const TABS = [
    { key: 'pos',   label: '🛒 كاشير' },
    { key: 'stock', label: '📦 المخزن' },
    { key: 'low',   label: `⚠️ منخفض (${lowStock.length})` },
  ] as const

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ps-text">المخزن والبضاعة</h1>
          <p className="text-ps-muted text-sm mt-0.5">{products.length} صنف · {lowStock.length} منخفض</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <button onClick={() => {}} className="btn-outline gap-2 text-sm">
              <Plus size={15} />إضافة صنف
            </button>
          )}
          <button onClick={load} className="btn-ghost p-2.5" style={{ border: '1px solid var(--ps-border)' }}>
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--ps-surface)', border: '1px solid var(--ps-border)' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all duration-200"
            style={tab === t.key ? {
              background: 'var(--ps-card)',
              color: 'var(--ps-text)',
              border: '1px solid var(--ps-border)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            } : { color: 'var(--ps-muted)' }}
          >{t.label}</button>
        ))}
      </div>

      {/* ── POS TAB ── */}
      {tab === 'pos' && (
        <div className="grid lg:grid-cols-[1fr_320px] gap-4">
          {/* Product grid */}
          <div className="space-y-3">
            {/* Search + categories */}
            <div className="flex gap-2 flex-wrap">
              <div className="relative flex-1 min-w-48">
                <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--ps-muted)' }} />
                <input className="input pr-9 text-sm" placeholder="ابحث عن صنف..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <div className="flex gap-1.5 flex-wrap">
                <button onClick={() => setSelectedCat(null)}
                  className="px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                  style={!selectedCat ? { background: 'rgba(0,87,255,0.15)', border: '1px solid rgba(0,87,255,0.3)', color: 'var(--ps-blue-light)' }
                    : { background: 'var(--ps-surface)', border: '1px solid var(--ps-border)', color: 'var(--ps-muted)' }}
                >الكل</button>
                {categories.map(c => (
                  <button key={c.id} onClick={() => setSelectedCat(selectedCat === c.id ? null : c.id)}
                    className="px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                    style={selectedCat === c.id ? { background: 'rgba(0,87,255,0.15)', border: '1px solid rgba(0,87,255,0.3)', color: 'var(--ps-blue-light)' }
                      : { background: 'var(--ps-surface)', border: '1px solid var(--ps-border)', color: 'var(--ps-muted)' }}
                  >{c.icon} {c.name}</button>
                ))}
              </div>
            </div>

            {/* Products */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {filtered.map(p => {
                const inCart = cart.find(i => i.product_id === p.id)
                const isLow  = p.stock_qty <= p.min_stock_qty
                return (
                  <button key={p.id} onClick={() => p.stock_qty > 0 && addToCart(p)}
                    disabled={p.stock_qty === 0}
                    className="relative rounded-xl p-3 text-right transition-all duration-200 active:scale-95 disabled:opacity-40"
                    style={{
                      background: inCart ? 'rgba(0,87,255,0.1)' : 'var(--ps-card)',
                      border: inCart ? '1px solid rgba(0,87,255,0.35)' : '1px solid var(--ps-border)',
                    }}
                  >
                    {isLow && p.stock_qty > 0 && (
                      <div className="absolute top-2 left-2 w-2 h-2 rounded-full" style={{ background: 'var(--ps-gold)' }} />
                    )}
                    {inCart && (
                      <div className="absolute top-2 left-2 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ background: 'var(--ps-blue)', color: '#fff' }}
                      >{inCart.qty}</div>
                    )}
                    <p className="font-semibold text-sm text-ps-text leading-tight mb-1">{p.name}</p>
                    <p className="font-mono font-bold text-lg" style={{ color: 'var(--ps-green)' }}>{p.sell_price} جنيه</p>
                    <p className="text-xs text-ps-muted mt-0.5">
                      {p.stock_qty === 0 ? <span style={{ color: 'var(--ps-red)' }}>نفد المخزون</span> : `متبقي: ${p.stock_qty} ${p.unit}`}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Cart */}
          <div className="rounded-2xl overflow-hidden sticky top-4" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)', maxHeight: 'calc(100vh - 120px)' }}>
            <div className="px-4 py-3.5 border-b flex items-center gap-2" style={{ borderColor: 'var(--ps-border)' }}>
              <ShoppingCart size={16} style={{ color: 'var(--ps-blue-light)' }} />
              <h2 className="font-bold text-ps-text">السلة</h2>
              {cart.length > 0 && (
                <button onClick={() => setCart([])} className="mr-auto btn-ghost p-1 text-xs" style={{ color: 'var(--ps-red)' }}>مسح</button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-ps-muted">
                <ShoppingCart size={32} style={{ opacity: 0.2, marginBottom: 8 }} />
                <p className="text-sm">اضغط على صنف لإضافته</p>
              </div>
            ) : (
              <>
                <div className="divide-y overflow-y-auto" style={{ borderColor: 'var(--ps-border)', maxHeight: 320 }}>
                  {cart.map(item => (
                    <div key={item.product_id} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ps-text truncate">{item.product?.name}</p>
                        <p className="text-xs text-ps-muted font-mono">{item.unit_price} جنيه × {item.qty}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => updateCartQty(item.product_id, -1)}
                          className="w-6 h-6 rounded-lg flex items-center justify-center text-ps-muted hover:text-ps-red transition-colors"
                          style={{ background: 'var(--ps-surface)' }}
                        ><Minus size={12} /></button>
                        <span className="font-mono font-bold text-sm w-5 text-center">{item.qty}</span>
                        <button onClick={() => updateCartQty(item.product_id, 1)}
                          className="w-6 h-6 rounded-lg flex items-center justify-center text-ps-muted hover:text-ps-blue-light transition-colors"
                          style={{ background: 'var(--ps-surface)' }}
                        ><Plus size={12} /></button>
                      </div>
                      <span className="font-mono font-bold text-sm w-16 text-left" style={{ color: 'var(--ps-gold)' }}>
                        {(item.qty * item.unit_price).toFixed(0)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="p-4 border-t space-y-2" style={{ borderColor: 'var(--ps-border)', background: 'rgba(0,0,0,0.2)' }}>
                  <div className="flex justify-between text-sm">
                    <span className="text-ps-muted">الإجمالي</span>
                    <span className="font-mono font-bold text-xl" style={{ color: 'var(--ps-gold)' }}>{cartTotal.toFixed(0)} جنيه</span>
                  </div>
                  {isAdmin && (
                    <div className="flex justify-between text-xs">
                      <span className="text-ps-muted">الربح</span>
                      <span className="font-mono" style={{ color: 'var(--ps-green)' }}>+{cartProfit.toFixed(0)} جنيه</span>
                    </div>
                  )}
                  <button onClick={handleCheckout} disabled={checkingOut} className="btn-primary w-full py-3 text-base mt-2">
                    {checkingOut ? <span className="spinner" style={{ width: 18, height: 18 }} /> : `💳 تحصيل ${cartTotal.toFixed(0)} جنيه`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── STOCK TAB ── */}
      {tab === 'stock' && (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] px-4 py-3 border-b text-xs font-semibold text-ps-muted tracking-widest uppercase"
            style={{ borderColor: 'var(--ps-border)' }}
          >
            <span>الصنف</span>
            <span className="text-center px-3">سعر الشراء</span>
            <span className="text-center px-3">سعر البيع</span>
            <span className="text-center px-3">الكمية</span>
            {isAdmin && <span className="text-center px-3">إجراء</span>}
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--ps-border)' }}>
            {filtered.map(p => {
              const isLow = p.stock_qty <= p.min_stock_qty
              return (
                <div key={p.id} className="grid grid-cols-[1fr_auto_auto_auto_auto] px-4 py-3.5 items-center text-sm"
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--ps-surface)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <div>
                    <p className="font-medium text-ps-text">{p.name}</p>
                    <p className="text-xs text-ps-muted">{p.category?.icon} {p.category?.name}</p>
                  </div>
                  <span className="font-mono text-center px-3 text-ps-muted">{p.cost_price}</span>
                  <span className="font-mono text-center px-3" style={{ color: 'var(--ps-green)' }}>{p.sell_price}</span>
                  <div className="text-center px-3">
                    <span className={`font-mono font-bold ${isLow ? '' : ''}`}
                      style={{ color: isLow ? 'var(--ps-red)' : p.stock_qty > p.min_stock_qty * 2 ? 'var(--ps-green)' : 'var(--ps-gold)' }}
                    >{p.stock_qty}</span>
                    <span className="text-xs text-ps-muted ml-1">{p.unit}</span>
                    {isLow && <AlertTriangle size={11} className="inline mr-1" style={{ color: 'var(--ps-red)' }} />}
                  </div>
                  {isAdmin && (
                    <div className="text-center px-3">
                      <button onClick={() => { setRestockModal(p); setRestockQty(12) }}
                        className="btn-outline text-xs px-3 py-1.5"
                      >إضافة</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── LOW STOCK TAB ── */}
      {tab === 'low' && (
        <div className="space-y-2">
          {lowStock.length === 0 ? (
            <div className="rounded-2xl py-16 flex flex-col items-center text-ps-muted"
              style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}
            >
              <p className="text-4xl mb-3">✅</p>
              <p className="font-semibold">كل الأصناف بمخزون كافٍ</p>
            </div>
          ) : lowStock.map(p => (
            <div key={p.id} className="flex items-center gap-4 px-5 py-4 rounded-2xl"
              style={{ background: 'var(--ps-card)', border: '1px solid rgba(255,61,90,0.2)' }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ background: 'rgba(255,61,90,0.08)' }}
              >
                {p.category?.icon || '📦'}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm text-ps-text">{p.name}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--ps-red)' }}>
                  متبقي <span className="font-bold font-mono">{p.stock_qty}</span> {p.unit} — الحد الأدنى {p.min_stock_qty}
                </p>
              </div>
              {isAdmin && (
                <button onClick={() => { setRestockModal(p); setRestockQty(24) }} className="btn-outline text-sm">
                  تخزين
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Restock Modal */}
      {restockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={() => setRestockModal(null)} />
          <div className="relative w-full max-w-sm rounded-2xl animate-scale-in"
            style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)', boxShadow: '0 24px 64px rgba(0,0,0,0.7)' }}
          >
            <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--ps-border)' }}>
              <p className="font-bold text-ps-text">إضافة مخزون</p>
              <button onClick={() => setRestockModal(null)} className="btn-ghost p-1.5"><X size={17} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="p-3 rounded-xl" style={{ background: 'var(--ps-surface)' }}>
                <p className="font-semibold text-ps-text">{restockModal.name}</p>
                <p className="text-sm text-ps-muted mt-0.5">الكمية الحالية: <span className="font-mono font-bold">{restockModal.stock_qty}</span> {restockModal.unit}</p>
              </div>
              <div>
                <label className="label">الكمية المضافة</label>
                <div className="flex items-center gap-3">
                  <button onClick={() => setRestockQty(q => Math.max(1, q - 1))}
                    className="w-11 h-11 rounded-xl flex items-center justify-center btn-ghost border" style={{ borderColor: 'var(--ps-border)' }}
                  ><Minus size={16} /></button>
                  <input type="number" className="input text-center font-mono font-bold text-xl flex-1"
                    value={restockQty} onChange={e => setRestockQty(Math.max(1, parseInt(e.target.value) || 1))} min={1}
                  />
                  <button onClick={() => setRestockQty(q => q + 1)}
                    className="w-11 h-11 rounded-xl flex items-center justify-center btn-ghost border" style={{ borderColor: 'var(--ps-border)' }}
                  ><Plus size={16} /></button>
                </div>
                <p className="text-xs text-ps-muted mt-2 text-center">
                  سيصبح المخزون: <span className="font-mono font-bold" style={{ color: 'var(--ps-green)' }}>{restockModal.stock_qty + restockQty}</span> {restockModal.unit}
                </p>
              </div>
            </div>
            <div className="p-5 border-t flex gap-3" style={{ borderColor: 'var(--ps-border)' }}>
              <button onClick={() => setRestockModal(null)} className="btn-ghost flex-1">إلغاء</button>
              <button onClick={handleRestock} className="btn-primary flex-1">✓ تأكيد الإضافة</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
