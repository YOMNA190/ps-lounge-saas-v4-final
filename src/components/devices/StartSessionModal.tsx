import { useState, useEffect } from 'react'
import { Device, Customer, POPULAR_GAMES } from '@/types'
import { startSession } from '@/lib/sessions'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { X, Search, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import clsx from 'clsx'

interface Props { device: Device; onClose: () => void; onSuccess: () => void }

export default function StartSessionModal({ device, onClose, onSuccess }: Props) {
  const { user } = useAuth()
  const [mode, setMode]             = useState<'single' | 'multi'>('single')
  const [game, setGame]             = useState('')
  const [customGame, setCustomGame] = useState('')
  const [search, setSearch]         = useState('')
  const [results, setResults]       = useState<Customer[]>([])
  const [selected, setSelected]     = useState<Customer | null>(null)
  const [loading, setLoading]       = useState(false)
  const [newMode, setNewMode]       = useState(false)
  const [newName, setNewName]       = useState('')
  const [newPhone, setNewPhone]     = useState('')

  useEffect(() => {
    if (search.length < 2) { setResults([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('customers').select('*')
        .or(`name.ilike.%${search}%,phone.ilike.%${search}%`).limit(5)
      setResults(data || [])
    }, 280)
    return () => clearTimeout(t)
  }, [search])

  const handleStart = async () => {
    if (!user) return
    setLoading(true)

    let customerId = selected?.id
    if (newMode && newName.trim()) {
      const { data, error } = await supabase.from('customers')
        .insert({ name: newName.trim(), phone: newPhone.trim() || null }).select().single()
      if (error) { toast.error('فشل إنشاء العميل'); setLoading(false); return }
      customerId = data.id
    }

    const finalGame = game === 'أخرى' ? customGame : game
    try {
      const hourlyRate = mode === 'single'
        ? (device.price_single || 0)
        : (device.price_multi  || 0)

      await startSession(
        device.id,
        customerId,
        mode,
        hourlyRate,
        finalGame || undefined
      )
      toast.success(`✓ بدأت الجلسة على ${device.name}`)
      onSuccess()
    } catch (err) {
      toast.error('فشل بدء الجلسة')
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={onClose} />

      <div className="relative w-full sm:max-w-md animate-slide-up rounded-t-3xl sm:rounded-2xl overflow-hidden"
        style={{
          background: 'var(--ps-card)',
          border: '1px solid var(--ps-border)',
          boxShadow: '0 -8px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.03)',
          maxHeight: '95dvh',
        }}
      >
        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 sm:hidden">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--ps-border-hi)' }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--ps-border)' }}>
          <div>
            <p className="font-bold text-ps-text">بدء جلسة جديدة</p>
            <p className="text-xs text-ps-muted mt-0.5 font-mono">{device.name} · {device.type}</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5 hidden sm:flex"><X size={17} /></button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5 overflow-y-auto" style={{ maxHeight: 'calc(95dvh - 160px)' }}>

          {/* Mode selector */}
          <div>
            <label className="label">نوع اللعب</label>
            <div className="grid grid-cols-2 gap-2">
              {(['single', 'multi'] as const).map(m => (
                <button key={m} onClick={() => setMode(m)}
                  className="py-3.5 px-4 rounded-xl border font-semibold text-sm transition-all duration-200 text-center"
                  style={mode === m ? {
                    background: 'rgba(0,87,255,0.12)',
                    border: '1px solid rgba(0,87,255,0.35)',
                    color: 'var(--ps-blue-light)',
                    boxShadow: '0 0 16px rgba(0,87,255,0.1)',
                  } : {
                    background: 'var(--ps-surface)',
                    border: '1px solid var(--ps-border)',
                    color: 'var(--ps-muted)',
                  }}
                >
                  <span className="text-lg block mb-0.5">{m === 'single' ? '👤' : '👥'}</span>
                  <span>{m === 'single' ? 'Single' : 'Multi'}</span>
                  <span className="block text-xs font-normal opacity-60 mt-0.5">
                    {m === 'single' ? device.price_single : device.price_multi} جنيه/س
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Game picker */}
          <div>
            <label className="label">اللعبة (اختياري)</label>
            <div className="grid grid-cols-2 gap-1.5">
              {POPULAR_GAMES.slice(0, 8).map(g => (
                <button key={g} onClick={() => setGame(g === game ? '' : g)}
                  className="text-xs px-3 py-2.5 rounded-xl border text-right transition-all duration-150"
                  style={game === g ? {
                    background: 'rgba(0,87,255,0.1)',
                    border: '1px solid rgba(0,87,255,0.3)',
                    color: 'var(--ps-blue-light)',
                  } : {
                    background: 'var(--ps-surface)',
                    border: '1px solid var(--ps-border)',
                    color: 'var(--ps-muted)',
                  }}
                >{g}</button>
              ))}
            </div>
            {game === 'أخرى' && (
              <input className="input mt-2 text-sm" placeholder="اكتب اسم اللعبة..."
                value={customGame} onChange={e => setCustomGame(e.target.value)}
              />
            )}
          </div>

          {/* Customer */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="label mb-0">العميل (اختياري)</label>
              <button onClick={() => { setNewMode(!newMode); setSelected(null) }}
                className="text-xs flex items-center gap-1 transition-colors"
                style={{ color: 'var(--ps-blue-light)' }}
              >
                <UserPlus size={11} />
                {newMode ? 'بحث عن عميل' : 'عميل جديد'}
              </button>
            </div>

            {!newMode ? (
              <div className="relative">
                <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: 'var(--ps-muted)' }}
                />
                <input className="input pr-9 text-sm"
                  placeholder="ابحث بالاسم أو الموبايل..."
                  value={selected ? selected.name : search}
                  onChange={e => { setSearch(e.target.value); setSelected(null) }}
                />
                {results.length > 0 && !selected && (
                  <div className="absolute top-full mt-1.5 w-full rounded-xl overflow-hidden z-10 shadow-2xl"
                    style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}
                  >
                    {results.map(c => (
                      <button key={c.id}
                        onClick={() => { setSelected(c); setResults([]); setSearch('') }}
                        className="w-full text-right px-4 py-3 text-sm flex items-center justify-between transition-colors"
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--ps-surface)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                      >
                        <span className="text-ps-text">{c.name}</span>
                        <span className="text-ps-muted text-xs font-mono">{c.phone} · {c.points}pt</span>
                      </button>
                    ))}
                  </div>
                )}
                {selected && (
                  <div className="mt-2 flex items-center justify-between px-3 py-2.5 rounded-xl"
                    style={{ background: 'rgba(0,229,160,0.06)', border: '1px solid rgba(0,229,160,0.2)' }}
                  >
                    <span className="text-sm font-medium" style={{ color: 'var(--ps-green)' }}>{selected.name}</span>
                    <button onClick={() => setSelected(null)} className="text-ps-muted hover:text-ps-red transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <input className="input text-sm" placeholder="الاسم *" value={newName}
                  onChange={e => setNewName(e.target.value)} />
                <input className="input text-sm" placeholder="رقم الموبايل (اختياري)" value={newPhone}
                  onChange={e => setNewPhone(e.target.value)} dir="ltr" />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t flex gap-3" style={{ borderColor: 'var(--ps-border)', background: 'rgba(0,0,0,0.2)' }}>
          <button onClick={onClose} className="btn-ghost flex-1">إلغاء</button>
          <button onClick={handleStart} disabled={loading} className="btn-primary flex-1 text-base py-3">
            {loading
              ? <span className="spinner" style={{ width: 18, height: 18 }} />
              : '🎮 ابدأ الجلسة'
            }
          </button>
        </div>
      </div>
    </div>
  )
}
