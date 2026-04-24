import { useState, useEffect } from 'react'
import { Alert } from '@/types'
import { getUnreadAlerts, markAlertRead } from '@/lib/shifts'
import { Bell, AlertTriangle, Clock, Package } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatDistanceToNow } from 'date-fns'
import { ar } from 'date-fns/locale'

const ICONS = {
  low_stock:       Package,
  long_session:    Clock,
  shift_reminder:  Bell,
}

export default function AlertsBell() {
  const [alerts, setAlerts]   = useState<Alert[]>([])
  const [open, setOpen]       = useState(false)

  const load = async () => {
    const data = await getUnreadAlerts()
    setAlerts(data as Alert[])
  }

  useEffect(() => {
    load()
    // Realtime alerts
    const ch = supabase.channel('alerts_rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alerts' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  const handleRead = async (id: number) => {
    await markAlertRead(id)
    setAlerts(a => a.filter(x => x.id !== id))
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className="relative btn-ghost p-2.5"
        style={{ border: '1px solid var(--ps-border)' }}
      >
        <Bell size={17} />
        {alerts.length > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-xs font-bold flex items-center justify-center"
            style={{ background: 'var(--ps-red)', color: '#fff', fontSize: 10 }}
          >{alerts.length > 9 ? '9+' : alerts.length}</span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-2 w-80 rounded-2xl z-50 overflow-hidden shadow-2xl"
            style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)', boxShadow: '0 16px 48px rgba(0,0,0,0.6)' }}
          >
            <div className="px-4 py-3.5 border-b flex items-center justify-between" style={{ borderColor: 'var(--ps-border)' }}>
              <p className="font-semibold text-sm text-ps-text">التنبيهات</p>
              {alerts.length > 0 && (
                <span className="badge" style={{ background: 'rgba(255,61,90,0.1)', color: 'var(--ps-red)', border: '1px solid rgba(255,61,90,0.2)' }}>
                  {alerts.length} جديد
                </span>
              )}
            </div>

            {alerts.length === 0 ? (
              <div className="py-10 text-center text-ps-muted text-sm">
                <Bell size={24} style={{ opacity: 0.2, margin: '0 auto 8px' }} />
                لا توجد تنبيهات
              </div>
            ) : (
              <div className="divide-y max-h-80 overflow-y-auto" style={{ borderColor: 'var(--ps-border)' }}>
                {alerts.map(a => {
                  const Icon = ICONS[a.type] || AlertTriangle
                  return (
                    <div key={a.id} className="flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-colors"
                      style={{ background: 'transparent' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--ps-surface)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                      onClick={() => handleRead(a.id)}
                    >
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: 'rgba(255,200,67,0.1)', border: '1px solid rgba(255,200,67,0.2)' }}
                      >
                        <Icon size={14} style={{ color: 'var(--ps-gold)' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-ps-text leading-tight">{a.title}</p>
                        <p className="text-xs text-ps-muted mt-0.5 leading-relaxed">{a.message}</p>
                        <p className="text-xs mt-1 font-mono" style={{ color: 'var(--ps-muted)', opacity: 0.6 }}>
                          {formatDistanceToNow(new Date(a.created_at), { locale: ar, addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
