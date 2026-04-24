import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useBranch } from '@/lib/branch-context'
import { getDashboardSummary } from '@/lib/analytics'
import { DashboardSummary } from '@/types'
import { TrendingUp, TrendingDown, RefreshCw, ArrowUpRight, ArrowDownRight, Edit2, Check, X, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface Expense { id: number; name: string; amount: number; is_active: boolean; sort_order: number }

export default function ExpensesPage() {
  const { branchId } = useBranch()
  const [expenses, setExpenses]   = useState<Expense[]>([])
  const [summary, setSummary]     = useState<DashboardSummary | null>(null)
  const [loading, setLoading]     = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName]   = useState('')
  const [editAmount, setEditAmount] = useState(0)
  const [saving, setSaving]       = useState(false)
  const [showAdd, setShowAdd]     = useState(false)
  const [newName, setNewName]     = useState('')
  const [newAmount, setNewAmount] = useState(0)

  const load = async () => {
    if (!branchId) return
    setLoading(true)
    const [expRes, sum] = await Promise.all([
      supabase.from('expenses').select('*').eq('branch_id', branchId).eq('is_active', true).order('sort_order'),
      getDashboardSummary(),
    ])
    setExpenses(expRes.data || [])
    setSummary(sum)
    setLoading(false)
  }

  useEffect(() => { load() }, [branchId])

  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const gross    = summary?.gross_revenue ?? 0
  const net      = gross - totalExpenses
  const isProfit = net >= 0
  const profitPct   = gross > 0 ? Math.abs(Math.round((net / gross) * 100)) : 0
  const expensesPct = gross > 0 ? Math.min(Math.round((totalExpenses / gross) * 100), 100) : 0

  const startEdit = (e: Expense) => { setEditingId(e.id); setEditName(e.name); setEditAmount(e.amount) }
  const cancelEdit = () => { setEditingId(null); setEditName(''); setEditAmount(0) }

  const saveEdit = async (id: number) => {
    setSaving(true)
    const { error } = await supabase.rpc('update_expense', { p_expense_id: id, p_amount: editAmount, p_name: editName.trim() || undefined })
    if (error) toast.error('فشل الحفظ')
    else { toast.success('✓ تم الحفظ'); cancelEdit(); load() }
    setSaving(false)
  }

  const deleteExpense = async (id: number) => {
    const { error } = await supabase.from('expenses').update({ is_active: false }).eq('id', id)
    if (error) toast.error('فشل الحذف')
    else { toast.success('تم الحذف'); load() }
  }

  const addExpense = async () => {
    if (!newName.trim() || !branchId) return
    setSaving(true)
    const { error } = await supabase.from('expenses').insert({ branch_id: branchId, name: newName.trim(), amount: newAmount, sort_order: expenses.length + 1 })
    if (error) toast.error('فشل الإضافة')
    else { toast.success('✓ تمت الإضافة'); setNewName(''); setNewAmount(0); setShowAdd(false); load() }
    setSaving(false)
  }

  const PLCard = ({ label, value, color, bg, border, icon, sub }: { label: string; value: number; color: string; bg: string; border: string; icon: React.ReactNode; sub?: string }) => (
    <div className="stat-card" style={{ border: `1px solid ${border}` }}>
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: bg, border: `1px solid ${border}`, color }}>{icon}</div>
        <span className="text-xs text-ps-muted font-mono uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-3xl font-bold font-mono" style={{ color }}>{value.toLocaleString()}</p>
      <p className="text-ps-muted text-sm mt-1">{sub || 'جنيه مصري'}</p>
      <div className="absolute bottom-0 inset-x-0 h-px" style={{ background: `linear-gradient(90deg,transparent,${border.replace('.2','.5')},transparent)` }}/>
    </div>
  )

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ps-text">المصاريف الشهرية</h1>
          <p className="text-ps-muted text-sm mt-0.5">الإجمالي: <span className="font-mono font-bold" style={{ color:'var(--ps-red)' }}>{totalExpenses.toLocaleString()}</span> جنيه</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAdd(!showAdd)} className="btn-outline gap-2 text-sm"><Plus size={15}/>إضافة مصروف</button>
          <button onClick={load} className="btn-ghost p-2.5" style={{ border:'1px solid var(--ps-border)' }}><RefreshCw size={15} className={loading?'animate-spin':''}/></button>
        </div>
      </div>

      {showAdd && (
        <div className="rounded-2xl p-5 animate-slide-up" style={{ background:'var(--ps-card)', border:'1px solid rgba(0,87,255,.2)' }}>
          <p className="font-semibold text-sm text-ps-text mb-4">مصروف جديد</p>
          <div className="flex gap-3 items-end flex-wrap">
            <div className="flex-1 min-w-40">
              <label className="label">اسم المصروف</label>
              <input className="input text-sm" placeholder="مثال: صيانة أجهزة" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key==='Enter'&&addExpense()} autoFocus/>
            </div>
            <div>
              <label className="label">المبلغ (جنيه)</label>
              <input type="number" className="input text-sm font-mono w-32" min={0} value={newAmount} onChange={e => setNewAmount(Number(e.target.value))}/>
            </div>
            <button onClick={addExpense} disabled={saving||!newName.trim()} className="btn-primary h-10 px-4 text-sm">
              {saving?<span className="spinner" style={{width:15,height:15}}/>:'+ إضافة'}
            </button>
            <button onClick={()=>setShowAdd(false)} className="btn-ghost h-10 px-3"><X size={16}/></button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <PLCard label="إيرادات الشهر"   value={gross}         color="var(--ps-blue-light)" bg="rgba(0,87,255,.1)"    border="rgba(0,87,255,.2)"    icon={<ArrowUpRight size={18}/>}/>
        <PLCard label="إجمالي المصاريف" value={totalExpenses}  color="var(--ps-red)"         bg="rgba(255,61,90,.08)" border="rgba(255,61,90,.2)"   icon={<ArrowDownRight size={18}/>}/>
        <PLCard label="صافي الربح"      value={Math.abs(net)}
          color={isProfit?'var(--ps-green)':'var(--ps-red)'}
          bg={isProfit?'rgba(0,229,160,.08)':'rgba(255,61,90,.08)'}
          border={isProfit?'rgba(0,229,160,.2)':'rgba(255,61,90,.2)'}
          icon={isProfit?<TrendingUp size={18}/>:<TrendingDown size={18}/>}
          sub={isProfit?`▲ ${profitPct}% من الإيرادات`:`▼ خسارة ${profitPct}%`}
        />
      </div>

      {gross > 0 && (
        <div className="rounded-2xl p-5" style={{ background:'var(--ps-card)', border:'1px solid var(--ps-border)' }}>
          <div className="flex justify-between text-xs text-ps-muted mb-3 font-mono"><span>توزيع الإيرادات</span><span>{gross.toLocaleString()} جنيه</span></div>
          <div className="h-5 rounded-full overflow-hidden flex gap-0.5" style={{ background:'var(--ps-surface)' }}>
            <div className="h-full rounded-r-full transition-all duration-1000" style={{ width:`${expensesPct}%`, background:'linear-gradient(90deg,var(--ps-red),rgba(255,61,90,.7))' }}/>
            {isProfit && <div className="h-full rounded-l-full transition-all duration-1000" style={{ width:`${profitPct}%`, background:'linear-gradient(90deg,rgba(0,229,160,.7),var(--ps-green))' }}/>}
          </div>
          <div className="flex gap-5 mt-3 text-xs">
            <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm inline-block" style={{ background:'var(--ps-red)' }}/><span className="text-ps-muted">مصاريف ({expensesPct}%)</span></span>
            {isProfit && <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm inline-block" style={{ background:'var(--ps-green)' }}/><span className="text-ps-muted">ربح صافي ({profitPct}%)</span></span>}
          </div>
        </div>
      )}

      <div className="rounded-2xl overflow-hidden" style={{ background:'var(--ps-card)', border:'1px solid var(--ps-border)' }}>
        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor:'var(--ps-border)' }}>
          <h2 className="font-semibold text-sm text-ps-text">تفاصيل المصاريف</h2>
          <span className="text-xs text-ps-muted">✏️ اضغط للتعديل</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><span className="spinner" style={{ width:24,height:24 }}/></div>
        ) : expenses.length === 0 ? (
          <div className="py-12 text-center text-ps-muted"><p className="text-4xl mb-3">📋</p><p className="text-sm">لا توجد مصاريف — اضغط "إضافة مصروف"</p></div>
        ) : (
          <>
            <div>
              {expenses.map((e, i) => {
                const pct = totalExpenses > 0 ? Math.round((Number(e.amount) / totalExpenses) * 100) : 0
                const isEditing = editingId === e.id
                return (
                  <div key={e.id} className="px-5 py-4 border-b transition-colors" style={{ borderColor:'var(--ps-border)', background: isEditing?'var(--ps-surface)':'transparent' }}
                    onMouseEnter={ev => !isEditing && ((ev.currentTarget as HTMLElement).style.background = 'var(--ps-surface)')}
                    onMouseLeave={ev => !isEditing && ((ev.currentTarget as HTMLElement).style.background = 'transparent')}>
                    {isEditing ? (
                      <div className="flex gap-3 items-center flex-wrap">
                        <input className="input text-sm flex-1 min-w-32" value={editName} onChange={e => setEditName(e.target.value)} autoFocus onKeyDown={ev => ev.key==='Enter'&&saveEdit(e.id)}/>
                        <input type="number" className="input font-mono text-sm w-28" min={0} value={editAmount} onChange={e => setEditAmount(Number(e.target.value))}/>
                        <button onClick={()=>saveEdit(e.id)} disabled={saving} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background:'rgba(0,229,160,.1)',color:'var(--ps-green)',border:'1px solid rgba(0,229,160,.2)' }}>
                          {saving?<span className="spinner" style={{width:14,height:14}}/>:<Check size={16}/>}
                        </button>
                        <button onClick={cancelEdit} className="w-9 h-9 rounded-xl flex items-center justify-center btn-ghost"><X size={16}/></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <div className="flex justify-between mb-2">
                            <span className="text-sm text-ps-text">{e.name}</span>
                            <span className="font-mono font-semibold text-sm text-ps-text">{Number(e.amount).toLocaleString()} <span className="text-ps-muted text-xs">جنيه</span></span>
                          </div>
                          <div className="h-1 rounded-full overflow-hidden" style={{ background:'var(--ps-surface)' }}>
                            <div className="h-full rounded-full transition-all duration-700" style={{ width:`${pct}%`, background:`hsl(${220+i*25},80%,60%)` }}/>
                          </div>
                        </div>
                        <span className="text-xs text-ps-muted font-mono w-8 text-left">{pct}%</span>
                        <div className="flex gap-1 flex-shrink-0">
                          <button onClick={()=>startEdit(e)} className="w-8 h-8 rounded-lg flex items-center justify-center text-ps-muted hover:text-ps-blue-light transition-colors hover:bg-blue-500/10"><Edit2 size={14}/></button>
                          <button onClick={()=>deleteExpense(e.id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-ps-muted hover:text-ps-red transition-colors hover:bg-red-500/10"><Trash2 size={14}/></button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="flex items-center justify-between px-5 py-4 border-t" style={{ borderColor:'var(--ps-border)', background:'rgba(0,0,0,.2)' }}>
              <span className="font-bold text-ps-text">الإجمالي الشهري</span>
              <span className="font-mono font-bold text-xl" style={{ color:'var(--ps-red)' }}>{totalExpenses.toLocaleString()} <span className="text-sm opacity-70">جنيه</span></span>
            </div>
          </>
        )}
      </div>

      <p className="text-center text-ps-muted text-xs opacity-50 font-mono">* المصاريف قابلة للتعديل في أي وقت · تُخصم تلقائياً من الإيرادات</p>
    </div>
  )
}
