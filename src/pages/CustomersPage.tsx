import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Customer, CustomerMonthlySpending } from '@/types'
import { Users, Search, Plus, Phone, Star, Trophy, X, Gift, Clock, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'
import { getCustomerMonthlySpending, claimCustomerReward } from '@/lib/shifts'
import { useAuth } from '@/lib/auth-context'

const TROPHY_STYLES = [
  { color: 'var(--ps-gold)',  bg: 'rgba(255,200,67,0.1)',  border: 'rgba(255,200,67,0.25)',  emoji: '🥇' },
  { color: '#c0c0d0',         bg: 'rgba(192,192,208,0.1)', border: 'rgba(192,192,208,0.2)',  emoji: '🥈' },
  { color: '#cd8b3a',         bg: 'rgba(205,139,58,0.1)',  border: 'rgba(205,139,58,0.2)',   emoji: '🥉' },
]

export default function CustomersPage() {
  const { isAdmin } = useAuth()
  const [customers, setCustomers]   = useState<Customer[]>([])
  const [spending, setSpending]     = useState<CustomerMonthlySpending[]>([])
  const [search, setSearch]         = useState('')
  const [loading, setLoading]       = useState(true)
  const [tab, setTab]               = useState<'list' | 'loyalty'>('loyalty')
  const [showAdd, setShowAdd]       = useState(false)
  const [newName, setNewName]       = useState('')
  const [newPhone, setNewPhone]     = useState('')
  const [saving, setSaving]         = useState(false)
  const [claimingId, setClaimingId] = useState<string | null>(null)
  const [showLimitModal, setShowLimitModal] = useState<CustomerMonthlySpending | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [cust, spend] = await Promise.all([
      supabase.from('customers').select('*').order('points', { ascending: false }).limit(100)
        .then(r => r.data || []),
      getCustomerMonthlySpending(),
    ])
    setCustomers(cust as Customer[])
    setSpending(spend as CustomerMonthlySpending[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = customers.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search)
  )

  const handleAdd = async () => {
    if (!newName.trim()) return
    setSaving(true)
    const { error } = await supabase.from('customers')
      .insert({ name: newName.trim(), phone: newPhone.trim() || null })
    if (error) toast.error(error.message.includes('unique') ? 'رقم الموبايل موجود مسبقاً' : 'فشل الإضافة')
    else { toast.success('✓ تم إضافة العميل'); setNewName(''); setNewPhone(''); setShowAdd(false); load() }
    setSaving(false)
  }

  const handleClaimReward = async (customerId: string, customerName: string) => {
    setClaimingId(customerId)
    const { data, error } = await claimCustomerReward(customerId)
    if (error) toast.error((error as { message?: string })?.message || 'فشل الاستلام')
    else {
      const d = data as { total_spend: number; total_hours: number; reward: string }
      toast.success(
        `🎉 تم تسجيل المكافأة لـ ${customerName}!\n` +
        `${d.total_spend} جنيه · ${d.total_hours} ساعة هذا الشهر`
      )
      setShowLimitModal(null)
      load()
    }
    setClaimingId(null)
  }

  const eligibleForReward = spending.filter(s => s.limit_exceeded && !s.reward_claimed_this_month)

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ps-text">العملاء</h1>
          <p className="text-ps-muted text-sm mt-0.5">
            {customers.length} عميل
            {eligibleForReward.length > 0 && (
              <span className="mr-2 font-semibold" style={{ color: 'var(--ps-gold)' }}>
                · {eligibleForReward.length} مؤهل للمكافأة 🎁
              </span>
            )}
          </p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary gap-2">
          <Plus size={16} /><span className="hidden sm:inline">عميل جديد</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--ps-surface)', border: '1px solid var(--ps-border)' }}>
        {[
          { k: 'loyalty', l: `🏆 الولاء والإنفاق` },
          { k: 'list',    l: `👥 قائمة العملاء` },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k as 'list' | 'loyalty')}
            className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
            style={tab === t.k
              ? { background: 'var(--ps-card)', color: 'var(--ps-text)', border: '1px solid var(--ps-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }
              : { color: 'var(--ps-muted)' }}
          >{t.l}</button>
        ))}
      </div>

      {/* ── LOYALTY TAB ── */}
      {tab === 'loyalty' && (
        <div className="space-y-4">

          {/* Reward alerts */}
          {eligibleForReward.length > 0 && (
            <div className="rounded-2xl p-4 space-y-2" style={{ background: 'rgba(255,200,67,0.06)', border: '1px solid rgba(255,200,67,0.2)' }}>
              <div className="flex items-center gap-2 mb-3">
                <Gift size={16} style={{ color: 'var(--ps-gold)' }} />
                <p className="font-semibold text-sm" style={{ color: 'var(--ps-gold)' }}>عملاء مؤهلون لمكافأة هذا الشهر!</p>
              </div>
              {eligibleForReward.map(c => (
                <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ background: 'rgba(0,0,0,0.3)' }}
                >
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-ps-text">{c.name}</p>
                    <p className="text-xs text-ps-muted">
                      أنفق <span className="font-mono font-bold" style={{ color: 'var(--ps-gold)' }}>{c.total_spend.toLocaleString()}</span> جنيه
                      · {c.total_hours_this_month.toFixed(1)} ساعة هذا الشهر
                    </p>
                  </div>
                  <button onClick={() => setShowLimitModal(c)} className="btn-outline text-xs px-3 py-2 gap-1">
                    <Gift size={12} />تسجيل المكافأة
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Spending leaderboard */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
            <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--ps-border)' }}>
              <div className="flex items-center gap-2">
                <TrendingUp size={15} style={{ color: 'var(--ps-blue-light)' }} />
                <h2 className="font-semibold text-sm text-ps-text">إنفاق هذا الشهر</h2>
              </div>
              <span className="text-xs text-ps-muted">الحد: 10,000 جنيه</span>
            </div>

            {loading ? (
              <div className="flex justify-center py-12"><span className="spinner" style={{ width: 24, height: 24 }} /></div>
            ) : spending.length === 0 ? (
              <div className="py-12 text-center text-ps-muted text-sm">لا توجد جلسات هذا الشهر</div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--ps-border)' }}>
                {spending.map((c, i) => {
                  const pct = Math.min((c.total_spend / c.monthly_spend_limit) * 100, 100)
                  const isTop3 = i < 3
                  const canClaim = c.limit_exceeded && !c.reward_claimed_this_month
                  return (
                    <div key={c.id} className="px-5 py-4 transition-colors"
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--ps-surface)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        {isTop3
                          ? <span className="text-xl w-8 text-center">{TROPHY_STYLES[i].emoji}</span>
                          : <span className="font-mono text-ps-muted text-xs w-8 text-center">{i + 1}</span>
                        }
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm text-ps-text">{c.name}</p>
                            {c.reward_claimed_this_month && (
                              <span className="badge text-xs" style={{ background: 'rgba(0,229,160,0.08)', color: 'var(--ps-green)', border: '1px solid rgba(0,229,160,0.2)' }}>
                                ✓ استلم مكافأته
                              </span>
                            )}
                            {canClaim && (
                              <span className="badge text-xs" style={{ background: 'rgba(255,200,67,0.1)', color: 'var(--ps-gold)', border: '1px solid rgba(255,200,67,0.25)' }}>
                                🎁 مؤهل للمكافأة
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-ps-muted mt-0.5">
                            <span className="flex items-center gap-1"><Clock size={10} />{c.total_hours_this_month.toFixed(1)} ساعة</span>
                            <span>·</span>
                            <span>أجهزة: <span className="font-mono" style={{ color: 'var(--ps-blue-light)' }}>{c.sessions_spend}</span></span>
                            <span>·</span>
                            <span>بضاعة: <span className="font-mono" style={{ color: 'var(--ps-cyan)' }}>{c.products_spend}</span></span>
                          </div>
                        </div>
                        <div className="text-left flex-shrink-0">
                          <p className="font-mono font-bold" style={{
                            color: c.limit_exceeded ? 'var(--ps-gold)' : 'var(--ps-text)',
                            fontSize: isTop3 ? '1.1rem' : '0.9rem',
                          }}>
                            {c.total_spend.toLocaleString()}
                          </p>
                          <p className="text-xs text-ps-muted text-left">من {c.monthly_spend_limit.toLocaleString()}</p>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="mr-8">
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--ps-surface)' }}>
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${pct}%`,
                              background: c.limit_exceeded
                                ? 'linear-gradient(90deg, var(--ps-gold), #ffaa00)'
                                : pct > 70
                                  ? 'linear-gradient(90deg, var(--ps-blue), var(--ps-purple))'
                                  : 'var(--ps-blue)',
                              boxShadow: c.limit_exceeded ? '0 0 8px rgba(255,200,67,0.5)' : 'none',
                            }}
                          />
                        </div>
                        <p className="text-xs text-ps-muted mt-0.5">
                          {c.limit_exceeded
                            ? <span style={{ color: 'var(--ps-gold)' }}>تجاوز الحد 🎉</span>
                            : `متبقي ${c.limit_remaining.toLocaleString()} جنيه`
                          }
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── LIST TAB ── */}
      {tab === 'list' && (
        <div className="space-y-3">
          <div className="relative">
            <Search size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--ps-muted)' }} />
            <input className="input pr-10" placeholder="ابحث بالاسم أو رقم الموبايل..."
              value={search} onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
            {loading ? (
              <div className="flex justify-center py-16"><span className="spinner" style={{ width: 28, height: 28 }} /></div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-ps-muted">
                <Users size={36} style={{ opacity: 0.2, marginBottom: 10 }} />
                <p>{search ? 'لا نتائج' : 'لا يوجد عملاء بعد'}</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-[1fr_auto_auto] px-4 py-3 border-b text-xs font-semibold text-ps-muted tracking-widest uppercase"
                  style={{ borderColor: 'var(--ps-border)' }}
                >
                  <span>العميل</span>
                  <span className="hidden sm:block mx-6">الموبايل</span>
                  <span>النقاط</span>
                </div>
                <div className="divide-y" style={{ borderColor: 'var(--ps-border)' }}>
                  {filtered.map((c, i) => (
                    <div key={c.id} className="grid grid-cols-[1fr_auto_auto] px-4 py-3.5 items-center transition-colors"
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--ps-surface)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm"
                          style={i < 3
                            ? { background: TROPHY_STYLES[i].bg, border: `1px solid ${TROPHY_STYLES[i].border}`, color: TROPHY_STYLES[i].color }
                            : { background: 'rgba(0,87,255,0.06)', border: '1px solid rgba(0,87,255,0.1)', color: 'var(--ps-blue-light)' }
                          }
                        >{c.name[0]}</div>
                        <div>
                          <p className="font-medium text-sm text-ps-text">{c.name}</p>
                          {c.phone && <p className="text-xs text-ps-muted sm:hidden font-mono" dir="ltr"><Phone size={9} className="inline mr-0.5" />{c.phone}</p>}
                        </div>
                      </div>
                      <div className="hidden sm:flex items-center gap-1.5 text-ps-muted text-xs mx-6 font-mono">
                        {c.phone || '—'}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Star size={13} style={{ color: 'var(--ps-gold)' }} />
                        <span className="font-mono font-bold" style={{ color: 'var(--ps-gold)' }}>{c.points.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Claim Reward Modal */}
      {showLimitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowLimitModal(null)} />
          <div className="relative w-full max-w-sm rounded-2xl animate-scale-in overflow-hidden"
            style={{ background: 'var(--ps-card)', border: '1px solid rgba(255,200,67,0.3)', boxShadow: '0 32px 80px rgba(0,0,0,0.8)' }}
          >
            <div className="h-px" style={{ background: 'linear-gradient(90deg,transparent,rgba(255,200,67,0.8),transparent)' }} />
            <div className="p-6 text-center">
              <div className="text-5xl mb-3">🎉</div>
              <h2 className="text-xl font-bold text-ps-text mb-1">مكافأة الشهر!</h2>
              <p className="text-ps-muted text-sm mb-4">
                <span className="font-semibold text-ps-text">{showLimitModal.name}</span> أنفق
                <span className="font-mono font-bold mx-1" style={{ color: 'var(--ps-gold)' }}>
                  {showLimitModal.total_spend.toLocaleString()}
                </span>
                جنيه هذا الشهر
              </p>

              <div className="rounded-xl p-4 mb-5 text-right space-y-2" style={{ background: 'var(--ps-surface)', border: '1px solid var(--ps-border)' }}>
                <div className="flex justify-between text-sm">
                  <span className="text-ps-muted">ساعات اللعب</span>
                  <span className="font-mono font-bold" style={{ color: 'var(--ps-cyan)' }}>{showLimitModal.total_hours_this_month.toFixed(1)} ساعة</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-ps-muted">جلسات الأجهزة</span>
                  <span className="font-mono" style={{ color: 'var(--ps-blue-light)' }}>{showLimitModal.sessions_spend} جنيه</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-ps-muted">مشتريات البضاعة</span>
                  <span className="font-mono" style={{ color: 'var(--ps-cyan)' }}>{showLimitModal.products_spend} جنيه</span>
                </div>
              </div>

              <div className="rounded-xl p-4 mb-5" style={{ background: 'rgba(255,200,67,0.08)', border: '1px solid rgba(255,200,67,0.2)' }}>
                <p className="font-bold" style={{ color: 'var(--ps-gold)' }}>🎁 المكافأة</p>
                <p className="text-sm text-ps-muted mt-1">يوم كامل مجاني أو الجلسة الجاية على الحساب</p>
                <p className="text-xs mt-2" style={{ color: 'var(--ps-gold)', opacity: 0.7 }}>* المكافأة مرة واحدة لكل شهر</p>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setShowLimitModal(null)} className="btn-ghost flex-1">لاحقاً</button>
                <button
                  onClick={() => handleClaimReward(showLimitModal.id, showLimitModal.name)}
                  disabled={claimingId === showLimitModal.id}
                  className="btn-primary flex-1"
                  style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                >
                  {claimingId === showLimitModal.id
                    ? <span className="spinner" style={{ width: 16, height: 16 }} />
                    : '🎉 تسجيل المكافأة'
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={() => setShowAdd(false)} />
          <div className="relative w-full max-w-sm rounded-2xl animate-scale-in"
            style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)', boxShadow: '0 24px 64px rgba(0,0,0,0.7)' }}
          >
            <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--ps-border)' }}>
              <p className="font-semibold text-ps-text">إضافة عميل جديد</p>
              <button onClick={() => setShowAdd(false)} className="btn-ghost p-1.5"><X size={17} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="label">الاسم *</label>
                <input className="input" placeholder="اسم العميل" value={newName}
                  onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()} />
              </div>
              <div>
                <label className="label">رقم الموبايل</label>
                <input className="input" placeholder="01xxxxxxxxx" value={newPhone}
                  onChange={e => setNewPhone(e.target.value)} dir="ltr" />
              </div>
            </div>
            <div className="p-5 border-t flex gap-3" style={{ borderColor: 'var(--ps-border)' }}>
              <button onClick={() => setShowAdd(false)} className="btn-ghost flex-1">إلغاء</button>
              <button onClick={handleAdd} disabled={saving || !newName.trim()} className="btn-primary flex-1">
                {saving ? <span className="spinner" style={{ width: 16, height: 16 }} /> : 'إضافة'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
