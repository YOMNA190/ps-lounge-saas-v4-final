import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Package, Reservation } from '@/types'
import { Tag, Clock, Plus, Calendar, CheckCircle, X, Users, User } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { useAuth } from '@/lib/auth-context'

export default function PackagesPage() {
  const { user, isAdmin } = useAuth()
  const [packages, setPackages]       = useState<Package[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [tab, setTab] = useState<'packages' | 'reservations'>('packages')
  const [loading, setLoading] = useState(true)
  const [showAddRes, setShowAddRes] = useState(false)

  // New reservation form
  const [resForm, setResForm] = useState({
    device_id: 1, customer_name: '', phone: '',
    package_id: '', reserved_at: '', mode: 'single' as 'single' | 'multi',
  })

  useEffect(() => {
    Promise.all([
      supabase.from('packages').select('*').eq('is_active', true).order('price'),
      supabase.from('reservations').select('*, device:devices(name,type), customer:customers(name,phone), package:packages(name)')
        .in('status', ['pending','confirmed']).order('reserved_at'),
    ]).then(([pkgRes, resRes]) => {
      setPackages(pkgRes.data as Package[] || [])
      setReservations(resRes.data as Reservation[] || [])
      setLoading(false)
    })
  }, [])

  const handleAddReservation = async () => {
    if (!user || !resForm.reserved_at) return

    let customerId: string | null = null
    if (resForm.customer_name.trim()) {
      const { data: c } = await supabase
        .from('customers').upsert({ name: resForm.customer_name, phone: resForm.phone || null }, { onConflict: 'phone' })
        .select().single()
      customerId = c?.id || null
    }

    const pkg = packages.find(p => p.id === Number(resForm.package_id))
    const { error } = await supabase.from('reservations').insert({
      device_id:    resForm.device_id,
      customer_id:  customerId,
      package_id:   resForm.package_id ? Number(resForm.package_id) : null,
      reserved_at:  resForm.reserved_at,
      duration_mins: pkg?.duration_mins || 60,
      mode:         resForm.mode,
      staff_id:     user.id,
      status:       'confirmed',
    })

    if (error) toast.error('فشل الحجز')
    else { toast.success('✓ تم الحجز'); setShowAddRes(false) }
  }

  const cancelReservation = async (id: string) => {
    await supabase.from('reservations').update({ status: 'cancelled' }).eq('id', id)
    setReservations(r => r.filter(x => x.id !== id))
    toast.success('تم إلغاء الحجز')
  }

  if (loading) return <div className="flex justify-center py-20"><span className="spinner" style={{ width: 28, height: 28 }} /></div>

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ps-text">الباقات والحجوزات</h1>
          <p className="text-ps-muted text-sm mt-0.5">{packages.length} باقة · {reservations.length} حجز قادم</p>
        </div>
        <button onClick={() => setShowAddRes(true)} className="btn-primary gap-2 text-sm">
          <Plus size={15} />حجز جديد
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--ps-surface)', border: '1px solid var(--ps-border)' }}>
        {[{ k: 'packages', l: '🎁 الباقات والعروض' }, { k: 'reservations', l: `📅 الحجوزات (${reservations.length})` }].map(t => (
          <button key={t.k} onClick={() => setTab(t.k as 'packages' | 'reservations')}
            className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
            style={tab === t.k ? { background: 'var(--ps-card)', color: 'var(--ps-text)', border: '1px solid var(--ps-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }
              : { color: 'var(--ps-muted)' }}
          >{t.l}</button>
        ))}
      </div>

      {/* Packages grid */}
      {tab === 'packages' && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {packages.map(p => {
            const hrs = Math.floor(p.duration_mins / 60)
            const mins = p.duration_mins % 60
            return (
              <div key={p.id} className="rounded-2xl p-5 relative overflow-hidden"
                style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}
              >
                {/* Top glow */}
                <div className="absolute top-0 inset-x-0 h-px"
                  style={{ background: p.device_type === 'PS5' ? 'linear-gradient(90deg,transparent,rgba(0,87,255,0.6),transparent)' : 'linear-gradient(90deg,transparent,rgba(155,109,255,0.6),transparent)' }}
                />
                <div className="flex items-start justify-between mb-3">
                  <span className={`badge ${p.device_type === 'PS5' ? '' : ''}`}
                    style={p.device_type === 'PS5'
                      ? { background: 'rgba(0,87,255,0.1)', color: 'var(--ps-blue-light)', border: '1px solid rgba(0,87,255,0.2)' }
                      : { background: 'rgba(155,109,255,0.1)', color: 'var(--ps-purple)', border: '1px solid rgba(155,109,255,0.2)' }
                    }
                  >{p.device_type || 'الكل'}</span>
                  <span className="badge" style={{ background: p.mode === 'single' ? 'rgba(0,229,160,0.08)' : 'rgba(255,200,67,0.08)', color: p.mode === 'single' ? 'var(--ps-green)' : 'var(--ps-gold)', border: `1px solid ${p.mode === 'single' ? 'rgba(0,229,160,0.2)' : 'rgba(255,200,67,0.2)'}` }}>
                    {p.mode === 'single' ? <><User size={10} />Single</> : p.mode === 'multi' ? <><Users size={10} />Multi</> : 'الكل'}
                  </span>
                </div>
                <h3 className="font-bold text-ps-text text-base mb-1">{p.name}</h3>
                {p.description && <p className="text-xs text-ps-muted mb-3">{p.description}</p>}
                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center gap-1.5 text-ps-muted text-sm">
                    <Clock size={14} />
                    <span>{hrs > 0 ? `${hrs}س` : ''}{mins > 0 ? ` ${mins}د` : ''}</span>
                  </div>
                  <span className="font-display text-3xl tracking-wide" style={{ color: 'var(--ps-gold)' }}>
                    {p.price} <span className="text-base font-body font-semibold opacity-70">جنيه</span>
                  </span>
                </div>
              </div>
            )
          })}
          {isAdmin && (
            <button className="rounded-2xl p-5 flex flex-col items-center justify-center gap-2 text-ps-muted transition-all hover:text-ps-text"
              style={{ background: 'var(--ps-surface)', border: '2px dashed var(--ps-border)', minHeight: 140 }}
            >
              <Plus size={24} />
              <span className="text-sm">إضافة باقة جديدة</span>
            </button>
          )}
        </div>
      )}

      {/* Reservations */}
      {tab === 'reservations' && (
        <div className="space-y-2">
          {reservations.length === 0 ? (
            <div className="rounded-2xl py-16 flex flex-col items-center text-ps-muted" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
              <Calendar size={36} style={{ opacity: 0.2, marginBottom: 10 }} />
              <p>لا توجد حجوزات قادمة</p>
            </div>
          ) : reservations.map(r => (
            <div key={r.id} className="flex items-center gap-4 px-5 py-4 rounded-2xl"
              style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm"
                style={{ background: 'rgba(0,87,255,0.08)', border: '1px solid rgba(0,87,255,0.15)', color: 'var(--ps-blue-light)' }}
              >
                {(r.device as { name?: string })?.name?.replace(/\D/g,'') || r.device_id}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm text-ps-text">{(r.device as { name?: string })?.name}</p>
                  {(r.package as { name?: string })?.name && (
                    <span className="badge text-xs" style={{ background: 'rgba(255,200,67,0.08)', color: 'var(--ps-gold)', border: '1px solid rgba(255,200,67,0.2)' }}>
                      <Tag size={9} />{(r.package as { name?: string })?.name}
                    </span>
                  )}
                </div>
                <p className="text-xs text-ps-muted mt-0.5">
                  {(r.customer as { name?: string })?.name || 'عميل غير مسجل'} · {format(new Date(r.reserved_at), 'dd/MM HH:mm')}
                  · {r.duration_mins}د · {r.mode === 'single' ? 'Single' : 'Multi'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="badge" style={{
                  background: r.status === 'confirmed' ? 'rgba(0,229,160,0.08)' : 'rgba(255,200,67,0.08)',
                  color: r.status === 'confirmed' ? 'var(--ps-green)' : 'var(--ps-gold)',
                  border: `1px solid ${r.status === 'confirmed' ? 'rgba(0,229,160,0.2)' : 'rgba(255,200,67,0.2)'}`,
                }}>
                  {r.status === 'confirmed' ? <><CheckCircle size={10} />مؤكد</> : 'معلق'}
                </span>
                <button onClick={() => cancelReservation(r.id)} className="btn-ghost p-1.5 hover:text-ps-red">
                  <X size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Reservation Modal */}
      {showAddRes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={() => setShowAddRes(false)} />
          <div className="relative w-full max-w-md rounded-2xl animate-scale-in"
            style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)', boxShadow: '0 24px 64px rgba(0,0,0,0.7)' }}
          >
            <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--ps-border)' }}>
              <p className="font-bold">حجز جديد</p>
              <button onClick={() => setShowAddRes(false)} className="btn-ghost p-1.5"><X size={17} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">رقم الجهاز</label>
                  <select className="input text-sm" value={resForm.device_id} onChange={e => setResForm(f => ({ ...f, device_id: Number(e.target.value) }))}>
                    {Array.from({ length: 10 }, (_, i) => (
                      <option key={i+1} value={i+1}>جهاز #{i+1}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">النوع</label>
                  <select className="input text-sm" value={resForm.mode} onChange={e => setResForm(f => ({ ...f, mode: e.target.value as 'single' | 'multi' }))}>
                    <option value="single">Single</option>
                    <option value="multi">Multi</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">الباقة (اختياري)</label>
                <select className="input text-sm" value={resForm.package_id} onChange={e => setResForm(f => ({ ...f, package_id: e.target.value }))}>
                  <option value="">بدون باقة</option>
                  {packages.map(p => <option key={p.id} value={p.id}>{p.name} — {p.price} جنيه ({p.duration_mins}د)</option>)}
                </select>
              </div>
              <div>
                <label className="label">موعد الحجز</label>
                <input type="datetime-local" className="input text-sm" dir="ltr"
                  value={resForm.reserved_at} onChange={e => setResForm(f => ({ ...f, reserved_at: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">اسم العميل</label>
                  <input className="input text-sm" placeholder="اختياري" value={resForm.customer_name}
                    onChange={e => setResForm(f => ({ ...f, customer_name: e.target.value }))} />
                </div>
                <div>
                  <label className="label">الموبايل</label>
                  <input className="input text-sm" placeholder="01x" dir="ltr" value={resForm.phone}
                    onChange={e => setResForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="p-5 border-t flex gap-3" style={{ borderColor: 'var(--ps-border)' }}>
              <button onClick={() => setShowAddRes(false)} className="btn-ghost flex-1">إلغاء</button>
              <button onClick={handleAddReservation} className="btn-primary flex-1">✓ تأكيد الحجز</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
