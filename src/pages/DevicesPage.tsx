import React from 'react'
import { useDevices } from '@/hooks/useDevices'
import { useAuth } from '@/lib/auth-context'
import DeviceCard from '@/components/devices/DeviceCard'
import { useDashboard } from '@/hooks/useDashboard'
import { TrendingUp, Wallet, Activity, Coins, Zap } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string
  sub?: string
  icon: React.ReactNode
  accent: string
  glow: string
}

function StatCard({ label, value, sub, icon, accent, glow }: StatCardProps) {
  return (
    <div className="stat-card animate-fade-in" style={{ border: `1px solid ${glow}22` }}>
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${glow}15`, border: `1px solid ${glow}22`, color: accent }}
        >
          {icon}
        </div>
        <span className="text-xs text-ps-muted font-mono opacity-60">{label}</span>
      </div>
      <p className="text-2xl font-bold font-mono leading-none" style={{ color: accent }}>{value}</p>
      {sub && <p className="text-xs text-ps-muted mt-1.5">{sub}</p>}
      {/* Glow stripe bottom */}
      <div className="absolute bottom-0 inset-x-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${glow}40, transparent)` }}
      />
    </div>
  )
}

export default function DevicesPage() {
  const { devices, loading, refetch } = useDevices()
  const { isAdmin }  = useAuth()
  const { summary }  = useDashboard()

  const activeCount = devices.filter(d => d.active_session).length
  const idleCount   = devices.length - activeCount

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ps-text tracking-tight">لوحة التحكم</h1>
          <p className="text-ps-muted text-sm mt-0.5">
            <span style={{ color: 'var(--ps-green)' }} className="font-mono font-semibold">{activeCount}</span>
            <span className="mx-1">نشط</span>
            <span className="text-ps-border mx-1">·</span>
            <span className="font-mono font-semibold">{idleCount}</span>
            <span className="mx-1">فارغ</span>
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
          style={{
            background: 'rgba(0,229,160,0.08)',
            border: '1px solid rgba(0,229,160,0.18)',
            color: 'var(--ps-green)',
          }}
        >
          <Zap size={12} className="animate-pulse" />
          Realtime
        </div>
      </div>

      {/* Admin stat cards */}
      {isAdmin && summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="إيرادات اليوم"    value={`${summary.revenue_today.toLocaleString()}`}   sub="جنيه مصري"   icon={<Coins size={17}/>}    accent="var(--ps-gold)"       glow="#ffc843" />
          <StatCard label="إيرادات الشهر"    value={`${summary.gross_revenue.toLocaleString()}`}   sub="جنيه مصري"   icon={<TrendingUp size={17}/>} accent="var(--ps-blue-light)" glow="#0057ff" />
          <StatCard label="صافي الربح"        value={`${Math.abs(summary.net_profit).toLocaleString()}`}
            sub={summary.net_profit >= 0 ? '▲ ربح' : '▼ خسارة'}
            icon={<Wallet size={17}/>}
            accent={summary.net_profit >= 0 ? 'var(--ps-green)' : 'var(--ps-red)'}
            glow={summary.net_profit >= 0 ? '#00e5a0' : '#ff3d5a'}
          />
          <StatCard label="جلسات اليوم"      value={`${summary.total_sessions_today}`}             sub="جلسة مكتملة"  icon={<Activity size={17}/>}  accent="var(--ps-purple)"     glow="#9b6dff" />
        </div>
      )}

      {/* Devices grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="rounded-2xl h-52 animate-pulse"
              style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {devices.map(device => (
            <DeviceCard key={device.id} device={device} onUpdate={refetch} />
          ))}
        </div>
      )}
    </div>
  )
}
