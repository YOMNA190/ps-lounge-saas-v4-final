import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { getCardInventory, sellCard, restockCards, getCardSalesReport, addCardType } from '@/lib/cards'
import { CardInventorySummary, CardSaleReport, CardPaymentMethod, PAYMENT_METHODS, CARD_PROVIDERS } from '@/types'
import { supabase } from '@/lib/supabase'
import { Wifi, Plus, ShoppingBag, BarChart3, RefreshCw, X, AlertTriangle, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'

// ── Provider colors ──────────────────────────────────────────
const PROVIDER_STYLE: Record<string, { color: string; bg: string; border: string; emoji: string }> = {
  'WE':        { color: 'var(--ps-blue-light)', bg: 'rgba(0,87,255,.1)',    border: 'rgba(0,87,255,.2)',    emoji: '🔵' },
  'فودافون':   { color: 'var(--ps-red)',         bg: 'rgba(255,61,90,.08)',  border: 'rgba(255,61,90,.18)',  emoji: '🔴' },
  'اتصالات':  { color: 'var(--ps-green)',        bg: 'rgba(0,229,160,.08)', border: 'rgba(0,229,160,.18)', emoji: '🟢' },
  'أورانج':   { color: 'var(--ps-gold)',         bg: 'rgba(255,200,67,.08)',border: 'rgba(255,200,67,.18)',emoji: '🟠' },
}
const getStyle = (provider: string) => PROVIDER_STYLE[provider] || { color: 'var(--ps-muted)', bg: 'rgba(82,82,122,.1)', border: 'rgba(82,82,122,.2)', emoji: '📶' }

// ── Sell Card Modal ──────────────────────────────────────────
function SellModal({ card, onClose, onSold }: {
  card: CardInventorySummary
  onClose: () => void
  onSold: () => void
}) {
  const [payMethod, setPayMethod] = useState<CardPaymentMethod>('vodafone_cash')
  const [payRef, setPayRef]         = useState('')
  const [custSearch, setCustSearch] = useState('')
  const [custResults, setCustResults] = useState<{ id: string; name: string; phone: string | null }[]>([])
  const [selectedCust, setSelectedCust] = useState<{ id: string; name: string } | null>(null)
  const [loading, setLoading]       = useState(false)
  const style = getStyle(card.provider)

  useEffect(() => {
    if (custSearch.length < 2) { setCustResults([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('customers').select('id, name, phone')
        .or(`name.ilike.%${custSearch}%,phone.ilike.%${custSearch}%`).limit(5)
      setCustResults(data || [])
    }, 280)
    return () => clearTimeout(t)
  }, [custSearch])

  const handleSell = async () => {
    if ((payMethod === 'vodafone_cash' || payMethod === 'instapay') && !payRef.trim()) {
      toast.error('أدخل رقم العملية'); return
    }
    setLoading(true)
    const { error } = await sellCard({
      typeId:        card.id,
      customerId:    selectedCust?.id,
      paymentMethod: payMethod,
      paymentRef:    payRef.trim() || undefined,
    })
    if (error) {
      toast.error(error.message.includes('لا توجد') ? 'لا توجد كروت متاحة من هذا النوع!' : 'فشل البيع')
    } else {
      toast.success(`✓ تم بيع كارت ${card.name} — ${card.sell_price} جنيه`)
      onSold()
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={onClose}/>
      <div className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl overflow-hidden animate-slide-up"
        style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)', maxHeight: '90dvh' }}>

        {/* Handle mobile */}
        <div className="flex justify-center pt-3 sm:hidden">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--ps-border-hi)' }}/>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--ps-border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
              style={{ background: style.bg, border: `1px solid ${style.border}` }}>
              {style.emoji}
            </div>
            <div>
              <p className="font-bold text-ps-text">{card.name}</p>
              <p className="text-xs text-ps-muted">{card.sell_price} جنيه · {card.available_count} كارت متاح</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5 hidden sm:flex"><X size={17}/></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(90dvh - 160px)' }}>

          {/* طريقة الدفع */}
          <div>
            <label className="label">طريقة الدفع</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(PAYMENT_METHODS) as CardPaymentMethod[]).map(m => (
                <button key={m} onClick={() => setPayMethod(m)}
                  className="py-3 px-2 rounded-xl text-center text-xs font-semibold transition-all duration-200"
                  style={payMethod === m ? {
                    background: 'rgba(0,87,255,.12)', border: '1px solid rgba(0,87,255,.35)',
                    color: 'var(--ps-blue-light)',
                  } : {
                    background: 'var(--ps-surface)', border: '1px solid var(--ps-border)',
                    color: 'var(--ps-muted)',
                  }}>
                  <span className="block text-base mb-1">{PAYMENT_METHODS[m].split(' ')[0]}</span>
                  {PAYMENT_METHODS[m].split(' ').slice(1).join(' ')}
                </button>
              ))}
            </div>
          </div>

          {/* رقم العملية */}
          {(payMethod === 'vodafone_cash' || payMethod === 'instapay') && (
            <div>
              <label className="label">
                رقم العملية {payMethod === 'vodafone_cash' ? '(فودافون كاش)' : '(إنستاباي)'} *
              </label>
              <input
                className="input font-mono" dir="ltr"
                placeholder={payMethod === 'vodafone_cash' ? '10-digit transaction ID' : 'InstaPay ref number'}
                value={payRef} onChange={e => setPayRef(e.target.value)}
              />
              <p className="text-xs text-ps-muted mt-1">
                {payMethod === 'vodafone_cash'
                  ? 'رقم المرجع اللي بيجي في رسالة التأكيد'
                  : 'رقم المرجع من تطبيق إنستاباي'}
              </p>
            </div>
          )}

          {/* العميل (اختياري) */}
          <div>
            <label className="label">العميل (اختياري)</label>
            <div className="relative">
              <input className="input text-sm" placeholder="ابحث بالاسم أو الموبايل..."
                value={selectedCust ? selectedCust.name : custSearch}
                onChange={e => { setCustSearch(e.target.value); setSelectedCust(null) }}
              />
              {custResults.length > 0 && !selectedCust && (
                <div className="absolute top-full mt-1 w-full rounded-xl overflow-hidden z-10 shadow-2xl"
                  style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
                  {custResults.map(c => (
                    <button key={c.id}
                      onClick={() => { setSelectedCust(c); setCustResults([]); setCustSearch('') }}
                      className="w-full text-right px-4 py-2.5 text-sm flex justify-between transition-colors"
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--ps-surface)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                      <span className="text-ps-text">{c.name}</span>
                      <span className="text-ps-muted text-xs font-mono">{c.phone}</span>
                    </button>
                  ))}
                </div>
              )}
              {selectedCust && (
                <div className="mt-2 flex items-center justify-between px-3 py-2.5 rounded-xl"
                  style={{ background: 'rgba(0,229,160,.06)', border: '1px solid rgba(0,229,160,.2)' }}>
                  <span className="text-sm font-medium" style={{ color: 'var(--ps-green)' }}>{selectedCust.name}</span>
                  <button onClick={() => setSelectedCust(null)} className="text-ps-muted hover:text-ps-red"><X size={14}/></button>
                </div>
              )}
            </div>
          </div>

          {/* ملخص */}
          <div className="rounded-xl p-4" style={{ background: 'var(--ps-surface)', border: '1px solid var(--ps-border)' }}>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-ps-muted">سعر البيع</span>
              <span className="font-mono font-bold" style={{ color: 'var(--ps-gold)' }}>{card.sell_price} جنيه</span>
            </div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-ps-muted">هامش الربح</span>
              <span className="font-mono" style={{ color: 'var(--ps-green)' }}>+{card.margin} جنيه</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-ps-muted">طريقة الدفع</span>
              <span className="text-ps-text">{PAYMENT_METHODS[payMethod]}</span>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t flex gap-3" style={{ borderColor: 'var(--ps-border)', background: 'rgba(0,0,0,.2)' }}>
          <button onClick={onClose} className="btn-ghost flex-1">إلغاء</button>
          <button onClick={handleSell} disabled={loading} className="btn-primary flex-1 py-3 text-base">
            {loading ? <span className="spinner" style={{ width: 18, height: 18 }}/> : `📶 بيع الكارت — ${card.sell_price} جنيه`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Restock Modal ────────────────────────────────────────────
function RestockModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { isAdmin } = useAuth()
  const [cards, setCards] = useState<CardInventorySummary[]>([])
  const [tab, setTab] = useState<'restock' | 'add'>('restock')

  // Restock form
  const [selType, setSelType]   = useState<number | null>(null)
  const [qty, setQty]           = useState(10)
  const [serials, setSerials]   = useState('')
  const [withSerial, setWithSerial] = useState(false)
  const [loading, setLoading]   = useState(false)

  // Add type form
  const [newType, setNewType] = useState({
    name: '', provider: 'WE', data_amount: '', validity_days: 30,
    cost_price: 0, sell_price: 0, low_stock_alert: 3
  })

  useEffect(() => {
    getCardInventory().then(setCards)
  }, [])

  const handleRestock = async () => {
    if (!selType) { toast.error('اختر نوع الكارت'); return }
    setLoading(true)
    const serialArr = withSerial
      ? serials.split('\n').map(s => s.trim()).filter(Boolean)
      : undefined
    const { error } = await restockCards(selType, qty, serialArr)
    if (error) toast.error('فشل الإضافة')
    else { toast.success(`✓ تم إضافة ${serialArr?.length || qty} كارت`); onDone() }
    setLoading(false)
  }

  const handleAddType = async () => {
    if (!newType.name || !newType.data_amount) { toast.error('أكمل البيانات'); return }
    setLoading(true)
    const { error } = await addCardType(newType)
    if (error) toast.error('فشل الإضافة')
    else { toast.success('✓ تم إضافة نوع الكارت'); onDone() }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={onClose}/>
      <div className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl overflow-hidden animate-slide-up"
        style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)', maxHeight: '90dvh' }}>

        <div className="flex justify-center pt-3 sm:hidden">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--ps-border-hi)' }}/>
        </div>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--ps-border)' }}>
          <p className="font-bold text-ps-text">إضافة كروت</p>
          <button onClick={onClose} className="btn-ghost p-1.5 hidden sm:flex"><X size={17}/></button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mx-5 mt-4 p-1 rounded-xl" style={{ background: 'var(--ps-surface)', border: '1px solid var(--ps-border)' }}>
          {[['restock','📦 إضافة مخزون'],['add','➕ نوع جديد']].map(([k,l]) => (
            <button key={k} onClick={() => setTab(k as 'restock'|'add')}
              className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
              style={tab === k ? { background: 'var(--ps-card)', color: 'var(--ps-text)', border: '1px solid var(--ps-border)' }
                : { color: 'var(--ps-muted)' }}>
              {l}
            </button>
          ))}
        </div>

        <div className="p-5 overflow-y-auto space-y-4" style={{ maxHeight: 'calc(90dvh - 200px)' }}>
          {tab === 'restock' ? (
            <>
              <div>
                <label className="label">نوع الكارت</label>
                <select className="input text-sm" value={selType || ''} onChange={e => setSelType(Number(e.target.value))}>
                  <option value="">-- اختر --</option>
                  {cards.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.provider} — {c.name} ({c.available_count} متاح)
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <div onClick={() => setWithSerial(!withSerial)}
                    className="w-10 h-6 rounded-full relative transition-colors"
                    style={{ background: withSerial ? 'var(--ps-blue)' : 'var(--ps-border)' }}>
                    <div className="absolute top-1 w-4 h-4 bg-white rounded-full transition-all"
                      style={{ left: withSerial ? '22px' : '2px' }}/>
                  </div>
                  <span className="text-sm text-ps-muted">إضافة أرقام سيريال</span>
                </label>
              </div>

              {!withSerial ? (
                <div>
                  <label className="label">الكمية</label>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setQty(q => Math.max(1,q-1))} className="btn-ghost w-10 h-10 border" style={{ borderColor: 'var(--ps-border)' }}>−</button>
                    <input type="number" className="input text-center font-mono font-bold text-xl flex-1" value={qty} onChange={e => setQty(Math.max(1,Number(e.target.value)))} min={1}/>
                    <button onClick={() => setQty(q => q+1)} className="btn-ghost w-10 h-10 border" style={{ borderColor: 'var(--ps-border)' }}>+</button>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="label">أرقام السيريال (كل رقم في سطر)</label>
                  <textarea className="input font-mono text-sm" rows={6} dir="ltr"
                    placeholder={"123456789\n987654321\n..."}
                    value={serials} onChange={e => setSerials(e.target.value)}
                    style={{ resize: 'vertical' }}/>
                  <p className="text-xs text-ps-muted mt-1">
                    {serials.split('\n').filter(s => s.trim()).length} كارت
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">المزود</label>
                  <select className="input text-sm" value={newType.provider} onChange={e => setNewType(t => ({...t, provider: e.target.value}))}>
                    {CARD_PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">الباقة</label>
                  <input className="input text-sm" placeholder="10 جيجا" value={newType.data_amount} onChange={e => setNewType(t => ({...t, data_amount: e.target.value}))}/>
                </div>
              </div>
              <div>
                <label className="label">الاسم الكامل</label>
                <input className="input text-sm" placeholder="WE 10 جيجا شهري" value={newType.name} onChange={e => setNewType(t => ({...t, name: e.target.value}))}/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">سعر الشراء</label>
                  <input type="number" className="input font-mono" value={newType.cost_price} onChange={e => setNewType(t => ({...t, cost_price: Number(e.target.value)}))}/>
                </div>
                <div>
                  <label className="label">سعر البيع</label>
                  <input type="number" className="input font-mono" value={newType.sell_price} onChange={e => setNewType(t => ({...t, sell_price: Number(e.target.value)}))}/>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">الصلاحية (يوم)</label>
                  <input type="number" className="input font-mono" value={newType.validity_days} onChange={e => setNewType(t => ({...t, validity_days: Number(e.target.value)}))}/>
                </div>
                <div>
                  <label className="label">تنبيه عند</label>
                  <input type="number" className="input font-mono" value={newType.low_stock_alert} onChange={e => setNewType(t => ({...t, low_stock_alert: Number(e.target.value)}))}/>
                </div>
              </div>
              {newType.sell_price > 0 && newType.cost_price > 0 && (
                <div className="rounded-xl p-3 flex justify-between" style={{ background: 'rgba(0,229,160,.06)', border: '1px solid rgba(0,229,160,.15)' }}>
                  <span className="text-sm text-ps-muted">هامش الربح</span>
                  <span className="font-mono font-bold" style={{ color: 'var(--ps-green)' }}>+{newType.sell_price - newType.cost_price} جنيه ({Math.round(((newType.sell_price-newType.cost_price)/newType.sell_price)*100)}%)</span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t flex gap-3" style={{ borderColor: 'var(--ps-border)', background: 'rgba(0,0,0,.2)' }}>
          <button onClick={onClose} className="btn-ghost flex-1">إلغاء</button>
          <button onClick={tab==='restock'?handleRestock:handleAddType} disabled={loading} className="btn-primary flex-1">
            {loading ? <span className="spinner" style={{ width:16,height:16 }}/> : tab==='restock'?'✓ إضافة الكروت':'✓ إضافة النوع'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── MAIN PAGE ────────────────────────────────────────────────
export default function CardsPage() {
  const { isAdmin } = useAuth()
  const [inventory, setInventory]   = useState<CardInventorySummary[]>([])
  const [report, setReport]         = useState<CardSaleReport[]>([])
  const [loading, setLoading]       = useState(true)
  const [tab, setTab]               = useState<'inventory'|'report'>('inventory')
  const [sellModal, setSellModal]   = useState<CardInventorySummary | null>(null)
  const [restockModal, setRestockModal] = useState(false)
  const [reportDays, setReportDays] = useState(7)

  const load = useCallback(async () => {
    setLoading(true)
    const [inv, rep] = await Promise.all([
      getCardInventory(),
      getCardSalesReport(reportDays),
    ])
    setInventory(inv)
    setReport(rep)
    setLoading(false)
  }, [reportDays])

  useEffect(() => { load() }, [load])

  const lowStockCount = inventory.filter(c => c.is_low_stock).length
  const totalAvailable = inventory.reduce((s, c) => s + c.available_count, 0)
  const todayReport = report.filter(r => r.sale_date === new Date().toISOString().split('T')[0])
  const todayRevenue = todayReport.reduce((s, r) => s + r.total_revenue, 0)
  const todayProfit  = todayReport.reduce((s, r) => s + r.total_profit, 0)

  // Group report by date
  const reportByDate = report.reduce<Record<string, CardSaleReport[]>>((acc, r) => {
    if (!acc[r.sale_date]) acc[r.sale_date] = []
    acc[r.sale_date].push(r)
    return acc
  }, {})

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ps-text">كروت الإنترنت</h1>
          <p className="text-ps-muted text-sm mt-0.5">
            {totalAvailable} كارت متاح
            {lowStockCount > 0 && <span className="text-ps-red mr-2">· {lowStockCount} نوع منخفض ⚠️</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-ghost p-2.5" style={{ border: '1px solid var(--ps-border)' }}>
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''}/>
          </button>
          {isAdmin && (
            <button onClick={() => setRestockModal(true)} className="btn-primary gap-2 text-sm">
              <Plus size={15}/>إضافة كروت
            </button>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { l:'متاح',        v:totalAvailable,           c:'var(--ps-green)',      g:'#00e5a0', i:<Wifi size={16}/> },
          { l:'إيرادات اليوم', v:`${todayRevenue} جنيه`, c:'var(--ps-gold)',       g:'#ffc843', i:<ShoppingBag size={16}/> },
          { l:'ربح اليوم',   v:`${todayProfit} جنيه`,   c:'var(--ps-blue-light)', g:'#0057ff', i:<TrendingUp size={16}/> },
        ].map((s,i) => (
          <div key={i} className="stat-card" style={{ border: `1px solid ${s.g}20` }}>
            <div className="flex items-start justify-between mb-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: `${s.g}15`, border: `1px solid ${s.g}20`, color: s.c }}>
                {s.i}
              </div>
              <span className="text-ps-muted text-xs font-mono opacity-60">{s.l}</span>
            </div>
            <p className="font-mono font-bold text-lg leading-none" style={{ color: s.c }}>{s.v}</p>
            <div className="absolute bottom-0 inset-x-0 h-px" style={{ background: `linear-gradient(90deg,transparent,${s.g}40,transparent)` }}/>
          </div>
        ))}
      </div>

      {/* Low stock alert */}
      {lowStockCount > 0 && (
        <div className="rounded-2xl p-4" style={{ background: 'rgba(255,61,90,.06)', border: '1px solid rgba(255,61,90,.2)' }}>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} style={{ color: 'var(--ps-red)' }}/>
            <p className="font-semibold text-sm" style={{ color: 'var(--ps-red)' }}>كروت منخفضة المخزون</p>
          </div>
          <div className="space-y-2">
            {inventory.filter(c => c.is_low_stock).map(c => (
              <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: 'rgba(0,0,0,.3)' }}>
                <span className="text-lg">{getStyle(c.provider).emoji}</span>
                <div className="flex-1">
                  <p className="font-semibold text-sm text-ps-text">{c.name}</p>
                  <p className="text-xs" style={{ color: 'var(--ps-red)' }}>
                    متبقي <span className="font-mono font-bold">{c.available_count}</span> كارت فقط
                  </p>
                </div>
                {isAdmin && (
                  <button onClick={() => setRestockModal(true)} className="btn-outline text-xs px-3 py-1.5">
                    إضافة
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--ps-surface)', border: '1px solid var(--ps-border)' }}>
        {[['inventory','📦 المخزون'],['report','📊 التقارير']].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k as 'inventory'|'report')}
            className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
            style={tab === k ? { background: 'var(--ps-card)', color: 'var(--ps-text)', border: '1px solid var(--ps-border)', boxShadow: '0 2px 8px rgba(0,0,0,.3)' }
              : { color: 'var(--ps-muted)' }}>
            {l}
          </button>
        ))}
      </div>

      {/* ── INVENTORY TAB ── */}
      {tab === 'inventory' && (
        <div className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-12"><span className="spinner" style={{ width: 28, height: 28 }}/></div>
          ) : inventory.length === 0 ? (
            <div className="rounded-2xl py-16 flex flex-col items-center text-ps-muted" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
              <Wifi size={40} style={{ opacity: .2, marginBottom: 10 }}/>
              <p>لا توجد كروت بعد</p>
            </div>
          ) : (
            // Group by provider
            Object.entries(
              inventory.reduce<Record<string, CardInventorySummary[]>>((acc, c) => {
                if (!acc[c.provider]) acc[c.provider] = []
                acc[c.provider].push(c)
                return acc
              }, {})
            ).map(([provider, cards]) => (
              <div key={provider}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className="text-lg">{getStyle(provider).emoji}</span>
                  <h3 className="font-semibold text-sm text-ps-text">{provider}</h3>
                  <span className="text-xs text-ps-muted">{cards.reduce((s,c) => s+c.available_count, 0)} متاح</span>
                </div>
                <div className="space-y-2">
                  {cards.map(card => {
                    const style = getStyle(card.provider)
                    return (
                      <div key={card.id} className="rounded-2xl overflow-hidden"
                        style={{ background: 'var(--ps-card)', border: `1px solid ${card.is_low_stock ? 'rgba(255,61,90,.2)' : 'var(--ps-border)'}` }}>
                        <div className="flex items-center gap-4 px-4 py-4">
                          {/* Icon */}
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                            style={{ background: style.bg, border: `1px solid ${style.border}` }}>
                            {style.emoji}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-ps-text">{card.name}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="text-xs text-ps-muted">{card.data_amount} · {card.validity_days} يوم</span>
                              <span className="text-xs font-mono font-bold" style={{ color: 'var(--ps-gold)' }}>{card.sell_price} جنيه</span>
                              <span className="text-xs font-mono" style={{ color: 'var(--ps-green)' }}>+{card.margin} ربح</span>
                            </div>
                          </div>

                          {/* Stock count */}
                          <div className="text-center flex-shrink-0 ml-2">
                            <p className="font-mono font-bold text-2xl leading-none"
                              style={{ color: card.is_low_stock ? 'var(--ps-red)' : card.available_count > 5 ? 'var(--ps-green)' : 'var(--ps-gold)' }}>
                              {card.available_count}
                            </p>
                            <p className="text-xs text-ps-muted">متاح</p>
                            {card.is_low_stock && <span className="text-xs" style={{ color: 'var(--ps-red)' }}>⚠️</span>}
                          </div>

                          {/* Sell button */}
                          <button
                            onClick={() => card.available_count > 0 && setSellModal(card)}
                            disabled={card.available_count === 0}
                            className="btn-primary text-sm px-4 py-2 flex-shrink-0"
                            style={{ opacity: card.available_count === 0 ? .4 : 1 }}>
                            {card.available_count === 0 ? 'نفد' : 'بيع'}
                          </button>
                        </div>

                        {/* Stock bar */}
                        <div className="px-4 pb-3">
                          <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--ps-surface)' }}>
                            <div className="h-full rounded-full transition-all duration-700"
                              style={{
                                width: `${Math.min((card.available_count / Math.max(card.available_count + card.sold_count, 1)) * 100, 100)}%`,
                                background: card.is_low_stock ? 'var(--ps-red)' : style.color,
                              }}/>
                          </div>
                          <div className="flex justify-between mt-1 text-xs text-ps-muted">
                            <span>{card.sold_count} مباع</span>
                            <span>تنبيه عند {card.low_stock_alert}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── REPORT TAB ── */}
      {tab === 'report' && (
        <div className="space-y-4">
          {/* Period selector */}
          <div className="flex gap-2 justify-end">
            {[7, 14, 30].map(d => (
              <button key={d} onClick={() => setReportDays(d)}
                className="px-4 py-2 rounded-xl text-sm font-mono font-semibold transition-all"
                style={reportDays === d ? {
                  background: 'rgba(0,87,255,.12)', border: '1px solid rgba(0,87,255,.3)', color: 'var(--ps-blue-light)',
                } : {
                  background: 'var(--ps-surface)', border: '1px solid var(--ps-border)', color: 'var(--ps-muted)',
                }}>
                {d}Y
              </button>
            ))}
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { l:'إجمالي المبيعات', v:report.reduce((s,r)=>s+r.total_revenue,0), c:'var(--ps-gold)'       },
              { l:'إجمالي الربح',    v:report.reduce((s,r)=>s+r.total_profit,0),  c:'var(--ps-green)'      },
              { l:'كروت مباعة',      v:report.reduce((s,r)=>s+r.qty_sold,0),       c:'var(--ps-blue-light)' },
              { l:'هامش الربح %',   v:`${report.length?Math.round((report.reduce((s,r)=>s+r.total_profit,0)/Math.max(report.reduce((s,r)=>s+r.total_revenue,0),1))*100):0}%`, c:'var(--ps-purple)' },
            ].map((s,i) => (
              <div key={i} className="stat-card">
                <p className="text-xs text-ps-muted mb-1">{s.l}</p>
                <p className="font-mono font-bold text-xl" style={{ color: s.c }}>{s.v}</p>
                <div className="absolute bottom-0 inset-x-0 h-px" style={{ background: `linear-gradient(90deg,transparent,${s.c}40,transparent)` }}/>
              </div>
            ))}
          </div>

          {/* Daily breakdown */}
          {Object.keys(reportByDate).length === 0 ? (
            <div className="rounded-2xl py-12 flex flex-col items-center text-ps-muted" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
              <BarChart3 size={36} style={{ opacity: .2, marginBottom: 10 }}/>
              <p>لا توجد مبيعات في هذه الفترة</p>
            </div>
          ) : (
            Object.entries(reportByDate).map(([date, rows]) => {
              const dayRev    = rows.reduce((s,r) => s+r.total_revenue, 0)
              const dayProfit = rows.reduce((s,r) => s+r.total_profit, 0)
              const dayQty    = rows.reduce((s,r) => s+r.qty_sold, 0)
              return (
                <div key={date} className="rounded-2xl overflow-hidden" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
                  <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'var(--ps-border)' }}>
                    <p className="font-semibold text-sm text-ps-text">{date}</p>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="font-mono" style={{ color: 'var(--ps-green)' }}>+{dayProfit} ربح</span>
                      <span className="font-mono font-bold" style={{ color: 'var(--ps-gold)' }}>{dayRev} جنيه</span>
                      <span className="text-ps-muted">{dayQty} كارت</span>
                    </div>
                  </div>
                  <div className="divide-y" style={{ borderColor: 'var(--ps-border)' }}>
                    {rows.map((r, i) => (
                      <div key={i} className="flex items-center gap-3 px-5 py-3"
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--ps-surface)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                        <span className="text-lg">{getStyle(r.provider).emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-ps-text truncate">{r.card_name}</p>
                          <div className="flex items-center gap-2 text-xs text-ps-muted">
                            <span>{PAYMENT_METHODS[r.payment_method]}</span>
                            <span>·</span>
                            <span className="font-mono" style={{ color: 'var(--ps-green)' }}>+{r.total_profit} ربح</span>
                          </div>
                        </div>
                        <div className="text-left flex-shrink-0">
                          <p className="font-mono font-bold text-sm" style={{ color: 'var(--ps-gold)' }}>{r.total_revenue} جنيه</p>
                          <p className="text-xs text-ps-muted">{r.qty_sold} كارت</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Modals */}
      {sellModal && (
        <SellModal card={sellModal} onClose={() => setSellModal(null)} onSold={() => { setSellModal(null); load() }}/>
      )}
      {restockModal && (
        <RestockModal onClose={() => setRestockModal(false)} onDone={() => { setRestockModal(false); load() }}/>
      )}
    </div>
  )
}
