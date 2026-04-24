import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import {
  startShift, endShift, getActiveShift, getAllActiveShifts,
  getShiftHistory, getShiftPreview, setStaffPin, getAllStaff
} from '@/lib/shifts'
import {
  Clock, LogIn, LogOut, Wallet, AlertTriangle, Users,
  CheckCircle, Lock, Eye, EyeOff, Gamepad2, Package,
  TrendingUp, ShieldCheck, X
} from 'lucide-react'
import { toast } from 'sonner'
import { format, formatDistanceToNow } from 'date-fns'
import { ar } from 'date-fns/locale'

interface ShiftData {
  id: string; staff_id: string; started_at: string; ended_at: string | null;
  opening_cash: number; closing_cash: number | null; expected_cash: number | null;
  cash_difference: number | null; sessions_revenue: number; sales_revenue: number;
  total_revenue: number; cash_taken: number; cash_left: number; pin_verified: boolean;
  staff?: { name: string; role: string }
}

interface Preview {
  sessionsRevenue: number; salesRevenue: number; total: number;
  sessionsCount: number; salesCount: number;
}

// ── PIN Input Component ─────────────────────────────────────
function PinInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label?: string }) {
  const [show, setShow] = useState(false)
  return (
    <div>
      {label && <label className="label">{label}</label>}
      <div className="relative">
        <Lock size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: 'var(--ps-muted)' }}
        />
        <input
          type={show ? 'text' : 'password'}
          inputMode="numeric"
          maxLength={6}
          className="input pr-9 font-mono text-center text-xl tracking-[0.5em]"
          placeholder="••••"
          value={value}
          onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        />
        <button type="button" onClick={() => setShow(!show)}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-ps-muted hover:text-ps-text transition-colors"
        >
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </div>
  )
}

// ── Cash Row ─────────────────────────────────────────────────
function CashRow({ label, value, color, big }: { label: string; value: number; color?: string; big?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b last:border-0"
      style={{ borderColor: 'var(--ps-border)' }}
    >
      <span className={big ? 'font-semibold text-ps-text' : 'text-sm text-ps-muted'}>{label}</span>
      <span className={`font-mono font-bold ${big ? 'text-xl' : 'text-base'}`}
        style={{ color: color || 'var(--ps-text)' }}
      >
        {value >= 0 ? '' : ''}{Math.abs(value).toLocaleString()} جنيه
      </span>
    </div>
  )
}

export default function ShiftsPage() {
  const { user, isAdmin } = useAuth()
  const [myShift, setMyShift]       = useState<ShiftData | null>(null)
  const [allActive, setAllActive]   = useState<ShiftData[]>([])
  const [history, setHistory]       = useState<ShiftData[]>([])
  const [loading, setLoading]       = useState(true)
  const [preview, setPreview]       = useState<Preview | null>(null)

  // Start shift form
  const [openingCash, setOpeningCash] = useState(0)
  const [starting, setStarting]       = useState(false)

  // End shift modal
  const [showEndModal, setShowEndModal] = useState(false)
  const [pin, setPin]                   = useState('')
  const [pinError, setPinError]         = useState('')
  const [closingCash, setClosingCash]   = useState(0)
  const [cashTaken, setCashTaken]       = useState(0)
  const [cashLeft, setCashLeft]         = useState(0)
  const [ending, setEnding]             = useState(false)

  // Admin: set PIN modal
  const [showPinModal, setShowPinModal]   = useState(false)
  const [staffList, setStaffList]         = useState<{ id: string; name: string; role: string }[]>([])
  const [selectedStaff, setSelectedStaff] = useState('')
  const [newPin, setNewPin]               = useState('')
  const [settingPin, setSettingPin]       = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [mine, active, hist] = await Promise.all([
      getActiveShift(user.id),
      isAdmin ? getAllActiveShifts() : Promise.resolve([]),
      isAdmin ? getShiftHistory(20) : Promise.resolve([]),
    ])
    setMyShift(mine as ShiftData | null)
    setAllActive(active as ShiftData[])
    setHistory(hist as ShiftData[])
    setLoading(false)
  }, [user, isAdmin])

  useEffect(() => { load() }, [load])

  // Load preview when end modal opens
  useEffect(() => {
    if (showEndModal && myShift && user) {
      getShiftPreview(user.id, myShift.started_at).then(setPreview)
    }
  }, [showEndModal, myShift, user])

  // Auto-fill closing cash based on preview
  useEffect(() => {
    if (preview && myShift) {
      const expected = myShift.opening_cash + preview.total
      setClosingCash(expected)
      setCashTaken(preview.total)
      setCashLeft(myShift.opening_cash)
    }
  }, [preview, myShift])

  // Auto-split cash taken/left
  useEffect(() => {
    if (preview && myShift) {
      const totalRevenue = preview.total
      const diff = closingCash - myShift.opening_cash
      setCashTaken(Math.min(Math.max(diff, 0), totalRevenue))
      setCashLeft(Math.max(closingCash - Math.min(Math.max(diff, 0), totalRevenue), 0))
    }
  }, [closingCash, preview, myShift])

  const handleStart = async () => {
    if (!user) return
    setStarting(true)
    const { data, error } = await startShift(user.id, openingCash)
    if (error) toast.error((error as Error).message)
    else { toast.success('✓ بدأ الشيفت'); setMyShift(data as ShiftData); load() }
    setStarting(false)
  }

  const handleEnd = async () => {
    if (!myShift || !user) return
    if (!pin) { setPinError('أدخل الـ PIN'); return }
    setPinError('')
    setEnding(true)

    const { data, error } = await endShift(myShift.id, pin, closingCash, cashTaken, cashLeft)

    if (error) {
      const msg = (error as Error).message
      if (msg.includes('PIN')) { setPinError('PIN غير صحيح ❌'); setEnding(false); return }
      toast.error(msg)
    } else {
      const s = data as ShiftData
      const diff = s.cash_difference || 0
      if (Math.abs(diff) < 1) toast.success('✓ انتهى الشيفت — الكاش مطابق تماماً 👌')
      else if (diff < 0) toast.warning(`انتهى الشيفت — عجز ${Math.abs(diff).toFixed(0)} جنيه ⚠️`)
      else toast.success(`✓ انتهى الشيفت — زيادة ${diff.toFixed(0)} جنيه`)

      setMyShift(null)
      setShowEndModal(false)
      setPin('')
      load()
    }
    setEnding(false)
  }

  const handleSetPin = async () => {
    if (!selectedStaff || newPin.length < 4) return
    setSettingPin(true)
    const { error } = await setStaffPin(selectedStaff, newPin)
    if (error) toast.error('فشل تعيين PIN')
    else { toast.success('✓ تم تعيين PIN بنجاح'); setShowPinModal(false); setNewPin('') }
    setSettingPin(false)
  }

  const openPinModal = async () => {
    const staff = await getAllStaff()
    setStaffList(staff as { id: string; name: string; role: string }[])
    setShowPinModal(true)
  }

  const expected = myShift && preview
    ? myShift.opening_cash + preview.total
    : 0
  const cashDiff = closingCash - expected

  if (loading) return (
    <div className="flex justify-center py-20"><span className="spinner" style={{ width: 32, height: 32 }} /></div>
  )

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ps-text">الشيفتات</h1>
          <p className="text-ps-muted text-sm mt-0.5">إدارة الشيفتات ومطابقة الكاش بالـ PIN</p>
        </div>
        {isAdmin && (
          <button onClick={openPinModal} className="btn-outline gap-2 text-sm">
            <ShieldCheck size={15} />إدارة PIN الموظفين
          </button>
        )}
      </div>

      {/* MY SHIFT CARD */}
      <div className="rounded-2xl p-5" style={{
        background: 'var(--ps-card)',
        border: `1px solid ${myShift ? 'rgba(0,229,160,0.25)' : 'var(--ps-border)'}`,
        boxShadow: myShift ? '0 0 24px rgba(0,229,160,0.06)' : 'none',
      }}>
        <div className="flex items-center gap-2 mb-5">
          <Clock size={16} style={{ color: myShift ? 'var(--ps-green)' : 'var(--ps-muted)' }} />
          <h2 className="font-semibold text-ps-text">شيفتي الحالي</h2>
          {myShift && (
            <span className="badge badge-active mr-auto">
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              {formatDistanceToNow(new Date(myShift.started_at), { locale: ar, addSuffix: false })}
            </span>
          )}
        </div>

        {!myShift ? (
          /* ── Start shift form ── */
          <div className="space-y-4 max-w-sm">
            <p className="text-ps-muted text-sm">لا يوجد شيفت نشط — ابدأ شيفتك الآن</p>
            <div>
              <label className="label">رصيد الدرج عند البداية</label>
              <input type="number" className="input font-mono text-lg" value={openingCash}
                onChange={e => setOpeningCash(Number(e.target.value))} min={0} placeholder="0"
              />
              <p className="text-xs text-ps-muted mt-1">الكاش الموجود في الدرج قبل بدء الشيفت</p>
            </div>
            <button onClick={handleStart} disabled={starting} className="btn-primary gap-2">
              {starting ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <LogIn size={16} />}
              بدء الشيفت
            </button>
          </div>
        ) : (
          /* ── Active shift summary ── */
          <div className="space-y-4">
            {/* Live stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: 'رصيد الفتح',    val: `${myShift.opening_cash} جنيه`, color: 'var(--ps-muted)',      icon: <Wallet size={14}/> },
                { label: 'جلسات الأجهزة', val: preview ? `${preview.sessionsRevenue} جنيه` : '...', color: 'var(--ps-blue-light)', icon: <Gamepad2 size={14}/> },
                { label: 'مبيعات البضاعة',val: preview ? `${preview.salesRevenue} جنيه` : '...',   color: 'var(--ps-cyan)',       icon: <Package size={14}/> },
                { label: 'إجمالي الإيراد', val: preview ? `${preview.total} جنيه` : '...',          color: 'var(--ps-green)',      icon: <TrendingUp size={14}/> },
              ].map((s, i) => (
                <div key={i} className="rounded-xl p-3" style={{ background: 'var(--ps-surface)', border: '1px solid var(--ps-border)' }}>
                  <div className="flex items-center gap-1.5 text-ps-muted text-xs mb-1.5">
                    <span style={{ color: s.color }}>{s.icon}</span>
                    {s.label}
                  </div>
                  <p className="font-mono font-bold text-sm" style={{ color: s.color }}>{s.val}</p>
                </div>
              ))}
            </div>

            <button onClick={() => { setShowEndModal(true) }} className="btn-danger gap-2 w-full sm:w-auto">
              <LogOut size={16} />إنهاء الشيفت
            </button>
          </div>
        )}
      </div>

      {/* ADMIN: Active shifts */}
      {isAdmin && allActive.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
          <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: 'var(--ps-border)' }}>
            <Users size={15} style={{ color: 'var(--ps-purple)' }} />
            <h2 className="font-semibold text-sm text-ps-text">الشيفتات النشطة ({allActive.length})</h2>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--ps-border)' }}>
            {allActive.map(s => (
              <div key={s.id} className="flex items-center gap-4 px-5 py-4"
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--ps-surface)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                  style={{ background: 'rgba(155,109,255,0.1)', border: '1px solid rgba(155,109,255,0.25)', color: 'var(--ps-purple)' }}
                >{s.staff?.name?.[0] || '?'}</div>
                <div className="flex-1">
                  <p className="font-semibold text-sm text-ps-text">{s.staff?.name}</p>
                  <p className="text-xs text-ps-muted">
                    بدأ {formatDistanceToNow(new Date(s.started_at), { locale: ar, addSuffix: true })}
                    {' · '}فتح بـ {s.opening_cash} جنيه
                  </p>
                </div>
                <div className="text-left">
                  <p className="font-mono font-bold text-sm" style={{ color: 'var(--ps-gold)' }}>
                    {(s.sessions_revenue + s.sales_revenue).toFixed(0)} جنيه
                  </p>
                  <p className="text-xs text-ps-muted">إجمالي حتى الآن</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ADMIN: Shift history */}
      {isAdmin && history.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
          <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--ps-border)' }}>
            <h2 className="font-semibold text-sm text-ps-text">سجل الشيفتات</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-ps-muted" style={{ borderColor: 'var(--ps-border)' }}>
                  {['الموظف','التاريخ','أجهزة','بضاعة','الإجمالي','الكاش الفعلي','العجز/الزيادة','أخد','ضل'].map(h => (
                    <th key={h} className="text-right px-4 py-3 font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map(s => {
                  const diff = s.cash_difference || 0
                  return (
                    <tr key={s.id} className="border-b transition-colors" style={{ borderColor: 'var(--ps-border)' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--ps-surface)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    >
                      <td className="px-4 py-3.5 font-medium text-ps-text whitespace-nowrap">{s.staff?.name}</td>
                      <td className="px-4 py-3.5 text-ps-muted text-xs whitespace-nowrap">
                        {s.ended_at ? format(new Date(s.ended_at), 'dd/MM · HH:mm') : '—'}
                      </td>
                      <td className="px-4 py-3.5 font-mono" style={{ color: 'var(--ps-blue-light)' }}>{s.sessions_revenue}</td>
                      <td className="px-4 py-3.5 font-mono" style={{ color: 'var(--ps-cyan)' }}>{s.sales_revenue}</td>
                      <td className="px-4 py-3.5 font-mono font-bold" style={{ color: 'var(--ps-gold)' }}>{s.total_revenue}</td>
                      <td className="px-4 py-3.5 font-mono text-ps-text">{s.closing_cash ?? '—'}</td>
                      <td className="px-4 py-3.5 font-mono font-bold whitespace-nowrap"
                        style={{ color: Math.abs(diff) < 1 ? 'var(--ps-green)' : diff > 0 ? 'var(--ps-green)' : 'var(--ps-red)' }}
                      >
                        {Math.abs(diff) < 1 ? '✓ مطابق' : diff > 0 ? `+${diff.toFixed(0)}` : `${diff.toFixed(0)}`}
                      </td>
                      <td className="px-4 py-3.5 font-mono" style={{ color: 'var(--ps-purple)' }}>{s.cash_taken || 0}</td>
                      <td className="px-4 py-3.5 font-mono text-ps-muted">{s.cash_left || 0}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          END SHIFT MODAL
      ══════════════════════════════════════════════════════ */}
      {showEndModal && myShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => { setShowEndModal(false); setPin('') }} />
          <div className="relative w-full max-w-lg rounded-2xl animate-scale-in overflow-hidden"
            style={{ background: 'var(--ps-card)', border: '1px solid rgba(255,61,90,0.2)', boxShadow: '0 32px 80px rgba(0,0,0,0.8)' }}
          >
            {/* Red top stripe */}
            <div className="h-px w-full" style={{ background: 'linear-gradient(90deg,transparent,rgba(255,61,90,0.7),transparent)' }} />

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: 'var(--ps-border)' }}>
              <div>
                <p className="font-bold text-ps-text text-lg">إنهاء الشيفت</p>
                <p className="text-xs text-ps-muted mt-0.5">
                  بدأ {format(new Date(myShift.started_at), 'HH:mm')} — {formatDistanceToNow(new Date(myShift.started_at), { locale: ar })}
                </p>
              </div>
              <button onClick={() => { setShowEndModal(false); setPin('') }} className="btn-ghost p-1.5"><X size={18} /></button>
            </div>

            <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">

              {/* Revenue breakdown (read-only) */}
              {preview && (
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--ps-border)' }}>
                  <div className="px-4 py-2.5 text-xs font-semibold text-ps-muted uppercase tracking-wider"
                    style={{ background: 'var(--ps-surface)' }}
                  >ملخص الشيفت</div>
                  <div className="px-4 py-2 divide-y" style={{ borderColor: 'var(--ps-border)' }}>
                    <CashRow label={`جلسات الأجهزة (${preview.sessionsCount} جلسة)`} value={preview.sessionsRevenue} color="var(--ps-blue-light)" />
                    <CashRow label={`مبيعات البضاعة (${preview.salesCount} فاتورة)`}   value={preview.salesRevenue}    color="var(--ps-cyan)" />
                    <CashRow label="رصيد الفتح"  value={myShift.opening_cash} color="var(--ps-muted)" />
                    <CashRow label="إجمالي الكاش المتوقع" value={expected} color="var(--ps-gold)" big />
                  </div>
                </div>
              )}

              {/* Closing cash input */}
              <div>
                <label className="label">الكاش الفعلي في الدرج الآن</label>
                <input type="number" className="input font-mono text-lg" min={0}
                  value={closingCash} onChange={e => setClosingCash(Number(e.target.value))}
                />
                {/* Difference indicator */}
                {preview && (
                  <div className={`flex items-center gap-2 mt-2 text-sm font-semibold`}
                    style={{ color: Math.abs(cashDiff) < 1 ? 'var(--ps-green)' : cashDiff < 0 ? 'var(--ps-red)' : 'var(--ps-green)' }}
                  >
                    {Math.abs(cashDiff) < 1
                      ? <><CheckCircle size={14} />الكاش مطابق تماماً ✓</>
                      : cashDiff < 0
                        ? <><AlertTriangle size={14} />عجز {Math.abs(cashDiff).toFixed(0)} جنيه</>
                        : <><CheckCircle size={14} />زيادة {cashDiff.toFixed(0)} جنيه</>
                    }
                  </div>
                )}
              </div>

              {/* Cash split */}
              <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--ps-surface)', border: '1px solid var(--ps-border)' }}>
                <p className="text-xs font-semibold text-ps-muted uppercase tracking-wider">توزيع الكاش</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">هتاخدها معاك 🎯</label>
                    <input type="number" className="input font-mono" min={0}
                      value={cashTaken} onChange={e => { setCashTaken(Number(e.target.value)); setCashLeft(Math.max(closingCash - Number(e.target.value), 0)) }}
                    />
                    <p className="text-xs text-ps-muted mt-1">الإيرادات اللي بتسلمها</p>
                  </div>
                  <div>
                    <label className="label">هتضلها في الدرج 🗄️</label>
                    <input type="number" className="input font-mono" min={0}
                      value={cashLeft} onChange={e => { setCashLeft(Number(e.target.value)); setCashTaken(Math.max(closingCash - Number(e.target.value), 0)) }}
                    />
                    <p className="text-xs text-ps-muted mt-1">رصيد فتح الشيفت الجاي</p>
                  </div>
                </div>
                {Math.abs(cashTaken + cashLeft - closingCash) > 0.5 && (
                  <p className="text-xs" style={{ color: 'var(--ps-red)' }}>
                    ⚠️ المجموع ({(cashTaken + cashLeft).toFixed(0)}) مش بيساوي الكاش الفعلي ({closingCash})
                  </p>
                )}
              </div>

              {/* PIN */}
              <div>
                <PinInput label="PIN الخاص بيك لتأكيد الإنهاء 🔐" value={pin} onChange={v => { setPin(v); setPinError('') }} />
                {pinError && (
                  <p className="text-sm mt-2 font-semibold" style={{ color: 'var(--ps-red)' }}>{pinError}</p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t flex gap-3" style={{ borderColor: 'var(--ps-border)', background: 'rgba(0,0,0,0.2)' }}>
              <button onClick={() => { setShowEndModal(false); setPin('') }} className="btn-ghost flex-1">إلغاء</button>
              <button onClick={handleEnd} disabled={ending || pin.length < 4} className="btn-danger flex-1 py-3 text-base">
                {ending
                  ? <span className="spinner" style={{ width: 18, height: 18 }} />
                  : <><Lock size={15} />تأكيد الإنهاء</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ ADMIN: Set PIN Modal ══ */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={() => setShowPinModal(false)} />
          <div className="relative w-full max-w-sm rounded-2xl animate-scale-in"
            style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)', boxShadow: '0 24px 64px rgba(0,0,0,0.7)' }}
          >
            <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--ps-border)' }}>
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} style={{ color: 'var(--ps-gold)' }} />
                <p className="font-bold text-ps-text">تعيين PIN للموظفين</p>
              </div>
              <button onClick={() => setShowPinModal(false)} className="btn-ghost p-1.5"><X size={17} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="label">اختر الموظف</label>
                <select className="input text-sm" value={selectedStaff} onChange={e => setSelectedStaff(e.target.value)}>
                  <option value="">-- اختر --</option>
                  {staffList.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.role === 'admin' ? 'أدمن' : 'موظف'})</option>
                  ))}
                </select>
              </div>
              {selectedStaff && (
                <PinInput label="الـ PIN الجديد (4-6 أرقام)" value={newPin} onChange={setNewPin} />
              )}
            </div>
            <div className="p-5 border-t flex gap-3" style={{ borderColor: 'var(--ps-border)' }}>
              <button onClick={() => setShowPinModal(false)} className="btn-ghost flex-1">إلغاء</button>
              <button onClick={handleSetPin} disabled={settingPin || !selectedStaff || newPin.length < 4} className="btn-primary flex-1">
                {settingPin ? <span className="spinner" style={{ width: 16, height: 16 }} /> : '✓ حفظ PIN'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
