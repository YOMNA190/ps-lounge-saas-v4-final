import { useState, useEffect, useCallback } from 'react'
import { getTodaySessions, subscribeToSessions } from '@/lib/sessions'
import { supabase } from '@/lib/supabase'
import { ClipboardList, RefreshCw, Clock, Gamepad2, User } from 'lucide-react'
import type { Session } from '@/types'

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading]   = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await getTodaySessions()
    setSessions(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const ch = subscribeToSessions(load)
    return () => { supabase.removeChannel(ch) }
  }, [load])

  const totalRevenue = sessions.reduce((s, r) => s + (r.cost || 0), 0)
  const totalMinutes = sessions.reduce((s, r) => {
    if (!r.ended_at || !r.started_at) return s
    return s + (new Date(r.ended_at).getTime() - new Date(r.started_at).getTime()) / 60000
  }, 0)

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ps-text">جلسات اليوم</h1>
          <p className="text-ps-muted text-sm mt-0.5">{sessions.length} جلسة مكتملة</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Stats pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm"
              style={{ background: 'rgba(255,200,67,0.08)', border: '1px solid rgba(255,200,67,0.15)' }}
            >
              <span className="text-ps-muted text-xs">إجمالي:</span>
              <span className="font-mono font-bold" style={{ color: 'var(--ps-gold)' }}>
                {totalRevenue.toLocaleString()} جنيه
              </span>
            </div>
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm"
              style={{ background: 'rgba(0,87,255,0.06)', border: '1px solid rgba(0,87,255,0.12)' }}
            >
              <Clock size={13} style={{ color: 'var(--ps-blue-light)' }} />
              <span className="font-mono font-bold" style={{ color: 'var(--ps-blue-light)' }}>
                {Math.floor(totalMinutes / 60)}س {Math.round(totalMinutes % 60)}د
              </span>
            </div>
          </div>
          <button onClick={load} className="btn-ghost p-2.5"
            style={{ border: '1px solid var(--ps-border)' }}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--ps-border)' }}>
        {loading ? (
          <div className="flex items-center justify-center py-20"
            style={{ background: 'var(--ps-card)' }}
          >
            <span className="spinner" style={{ width: 28, height: 28 }} />
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20"
            style={{ background: 'var(--ps-card)' }}
          >
            <ClipboardList size={40} style={{ color: 'var(--ps-border-hi)', marginBottom: 12 }} />
            <p className="text-ps-muted text-sm">لا توجد جلسات مكتملة اليوم</p>
          </div>
        ) : (
          <div style={{ background: 'var(--ps-card)' }}>
            {/* Table header */}
            <div className="grid grid-cols-[1fr_1fr_auto_auto] sm:grid-cols-[1.5fr_1fr_1fr_auto_auto_auto] px-4 py-3 border-b text-xs font-semibold text-ps-muted tracking-widest uppercase"
              style={{ borderColor: 'var(--ps-border)' }}
            >
              <span>الجهاز</span>
              <span className="hidden sm:block">العميل</span>
              <span className="hidden sm:block">اللعبة</span>
              <span>النوع</span>
              <span className="hidden sm:block">المدة</span>
              <span>التكلفة</span>
            </div>

            {/* Rows */}
            <div className="divide-y" style={{ borderColor: 'var(--ps-border)' }}>
              {sessions.map((s, i) => {
                const durationMin = s.ended_at && s.started_at
                  ? Math.round((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000)
                  : 0
                return (
                  <div key={s.id}
                    className="grid grid-cols-[1fr_1fr_auto_auto] sm:grid-cols-[1.5fr_1fr_1fr_auto_auto_auto] px-4 py-3.5 items-center text-sm transition-colors"
                    style={{
                      borderColor: 'var(--ps-border)',
                      animationDelay: `${i * 0.03}s`,
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--ps-surface)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    {/* Device */}
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: 'rgba(0,87,255,0.08)', border: '1px solid rgba(0,87,255,0.12)' }}
                      >
                        <Gamepad2 size={13} style={{ color: 'var(--ps-blue-light)' }} />
                      </div>
                      <span className="font-medium text-ps-text">{s.device?.name || `#${s.device_id}`}</span>
                    </div>

                    {/* Customer */}
                    <div className="hidden sm:flex items-center gap-1.5 text-ps-muted">
                      {s.customer
                        ? <><User size={12} /><span className="truncate">{s.customer.name}</span></>
                        : <span className="text-ps-border">—</span>
                      }
                    </div>

                    {/* Game */}
                    <div className="hidden sm:block text-ps-muted truncate text-xs">
                      {s.game_played || <span style={{ color: 'var(--ps-border)' }}>—</span>}
                    </div>

                    {/* Mode */}
                    <span className="text-xs font-mono font-bold px-2 py-1 rounded-lg"
                      style={s.mode === 'single'
                        ? { background: 'rgba(0,87,255,0.08)', color: 'var(--ps-blue-light)' }
                        : { background: 'rgba(155,109,255,0.08)', color: 'var(--ps-purple)' }
                      }
                    >{s.mode === 'single' ? 'S' : 'M'}</span>

                    {/* Duration */}
                    <span className="hidden sm:block font-mono text-xs text-ps-muted">
                      {durationMin >= 60
                        ? `${Math.floor(durationMin/60)}س ${durationMin%60}د`
                        : `${durationMin}د`
                      }
                    </span>

                    {/* Cost */}
                    <span className="font-mono font-bold text-sm" style={{ color: 'var(--ps-gold)' }}>
                      {s.cost} جنيه
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Footer total */}
            <div className="flex items-center justify-between px-4 py-3 border-t text-sm font-bold"
              style={{ borderColor: 'var(--ps-border)', background: 'rgba(0,0,0,0.2)' }}
            >
              <span className="text-ps-muted font-normal">{sessions.length} جلسة</span>
              <span className="font-mono text-base" style={{ color: 'var(--ps-gold)' }}>
                {totalRevenue.toLocaleString()} جنيه
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
