import { useState, useEffect } from 'react'
import { getDeviceRevenue, getTopCustomers, getTopGames } from '@/lib/analytics'
import { DailyDeviceRevenue, TopCustomer, TopGame } from '@/types'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts'
import { BarChart3, Trophy, Gamepad2, TrendingUp, Clock } from 'lucide-react'

const COLORS = ['#0057ff','#9b6dff','#00e5a0','#ffc843','#ff3d5a','#00c8e0','#3d8bff','#c084fc','#34d399','#fb923c']

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl px-4 py-3 text-sm"
      style={{ background: '#0d0d1a', border: '1px solid #24244a', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}
    >
      <p className="text-ps-muted text-xs mb-1">{label}</p>
      <p className="font-mono font-bold" style={{ color: 'var(--ps-gold)' }}>
        {payload[0].value.toLocaleString()} جنيه
      </p>
    </div>
  )
}

export default function AnalyticsPage() {
  const [devRevenue, setDevRevenue]   = useState<DailyDeviceRevenue[]>([])
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([])
  const [topGames, setTopGames]       = useState<TopGame[]>([])
  const [days, setDays]               = useState(7)
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([getDeviceRevenue(days), getTopCustomers(3), getTopGames(6)])
      .then(([dr, tc, tg]) => { setDevRevenue(dr); setTopCustomers(tc); setTopGames(tg) })
      .finally(() => setLoading(false))
  }, [days])

  const deviceSummary = devRevenue.reduce<Record<string, { name: string; revenue: number; sessions: number }>>((acc, row) => {
    if (!acc[row.device_name]) acc[row.device_name] = { name: row.device_name, revenue: 0, sessions: 0 }
    acc[row.device_name].revenue  += Number(row.total_revenue)
    acc[row.device_name].sessions += Number(row.session_count)
    return acc
  }, {})
  const barData = Object.values(deviceSummary).sort((a, b) => b.revenue - a.revenue)

  if (loading) return (
    <div className="flex items-center justify-center h-72">
      <span className="spinner" style={{ width: 32, height: 32 }} />
    </div>
  )

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ps-text">التحليلات</h1>
          <p className="text-ps-muted text-sm mt-0.5">تقارير الأداء التفصيلية</p>
        </div>
        <div className="flex gap-1.5">
          {[7, 14, 30].map(d => (
            <button key={d} onClick={() => setDays(d)}
              className="px-4 py-2 rounded-xl text-sm font-mono font-semibold transition-all duration-200"
              style={days === d ? {
                background: 'rgba(0,87,255,0.12)',
                border: '1px solid rgba(0,87,255,0.3)',
                color: 'var(--ps-blue-light)',
              } : {
                background: 'var(--ps-surface)',
                border: '1px solid var(--ps-border)',
                color: 'var(--ps-muted)',
              }}
            >{d}Y</button>
          ))}
        </div>
      </div>

      {/* Bar chart */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(0,87,255,0.1)', border: '1px solid rgba(0,87,255,0.2)' }}
          >
            <BarChart3 size={16} style={{ color: 'var(--ps-blue-light)' }} />
          </div>
          <div>
            <h2 className="font-semibold text-ps-text text-sm">الإيرادات لكل جهاز</h2>
            <p className="text-xs text-ps-muted">آخر {days} أيام</p>
          </div>
        </div>

        {barData.length === 0 ? (
          <div className="h-52 flex items-center justify-center text-ps-muted text-sm">لا توجد بيانات</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barData} margin={{ top: 4, right: 4, left: -16, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a30" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#52527a', fontSize: 11, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#52527a', fontSize: 11, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
              <Bar dataKey="revenue" radius={[6, 6, 0, 0]} maxBarSize={52}>
                {barData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]}
                    style={{ filter: `drop-shadow(0 0 8px ${COLORS[i % COLORS.length]}40)` }}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Device table + highlights */}
      <div className="grid lg:grid-cols-2 gap-4">

        {/* Device revenue table */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
          <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: 'var(--ps-border)' }}>
            <TrendingUp size={15} style={{ color: 'var(--ps-purple)' }} />
            <h2 className="font-semibold text-sm text-ps-text">أداء الأجهزة</h2>
          </div>
          <div className="p-4 space-y-2">
            {barData.length === 0 ? (
              <p className="text-ps-muted text-sm text-center py-6">لا بيانات</p>
            ) : barData.map((d, i) => (
              <div key={d.name} className="flex items-center gap-3 p-3 rounded-xl transition-colors"
                style={{ background: 'var(--ps-surface)' }}
              >
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: COLORS[i % COLORS.length], boxShadow: `0 0 8px ${COLORS[i % COLORS.length]}60` }}
                />
                <span className="text-sm text-ps-text flex-1 font-mono">{d.name}</span>
                <span className="text-xs text-ps-muted">{d.sessions} جلسة</span>
                <span className="font-mono font-bold text-sm" style={{ color: 'var(--ps-gold)' }}>
                  {d.revenue.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly highlights */}
        <div className="space-y-4">
          {/* Top customers */}
          <div className="rounded-2xl" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
            <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: 'var(--ps-border)' }}>
              <Trophy size={15} style={{ color: 'var(--ps-gold)' }} />
              <h2 className="font-semibold text-sm text-ps-text">أكثر 3 عملاء لعباً</h2>
              <span className="text-xs text-ps-muted mr-auto">هذا الشهر</span>
            </div>
            <div className="p-4 space-y-2">
              {topCustomers.length === 0 ? (
                <p className="text-ps-muted text-sm text-center py-4">لا بيانات</p>
              ) : topCustomers.map((c, i) => (
                <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ background: 'var(--ps-surface)' }}
                >
                  <span className="font-display text-2xl w-6 text-center leading-none"
                    style={{ color: ['#ffc843','#c0c0d0','#cd7f32'][i] }}
                  >
                    {['١','٢','٣'][i]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-ps-text truncate">{c.name}</p>
                    <div className="flex items-center gap-2 text-xs text-ps-muted">
                      <Clock size={10} />
                      <span>{c.total_hours}س</span>
                      <span>·</span>
                      <span>{c.session_count} جلسة</span>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="font-mono font-bold text-sm" style={{ color: 'var(--ps-gold)' }}>{c.total_spent}</p>
                    <p className="text-xs text-ps-muted">جنيه</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top games */}
          <div className="rounded-2xl" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
            <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: 'var(--ps-border)' }}>
              <Gamepad2 size={15} style={{ color: 'var(--ps-green)' }} />
              <h2 className="font-semibold text-sm text-ps-text">أكثر الألعاب لعباً</h2>
            </div>
            <div className="p-4 space-y-3">
              {topGames.length === 0 ? (
                <p className="text-ps-muted text-sm text-center py-4">لا بيانات</p>
              ) : topGames.map((g, i) => (
                <div key={g.game_played}>
                  <div className="flex justify-between mb-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-mono text-xs text-ps-muted w-4">{i + 1}</span>
                      <span className="text-ps-text font-medium">{g.game_played}</span>
                    </div>
                    <span className="text-xs text-ps-muted font-mono">{g.play_count}×</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--ps-surface)' }}>
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${(g.play_count / (topGames[0]?.play_count || 1)) * 100}%`,
                        background: COLORS[i % COLORS.length],
                        boxShadow: `0 0 8px ${COLORS[i % COLORS.length]}50`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
