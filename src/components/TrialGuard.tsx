import { useBranch } from '@/lib/branch-context'

interface Props { children: React.ReactNode }

export default function TrialGuard({ children }: Props) {
  const { branch, loading } = useBranch()

  if (loading) return null

  // No plan info yet → allow through
  if (!branch) return <>{children}</>

  // Pro/Basic → always allow
  if (branch.plan === 'basic' || branch.plan === 'pro') return <>{children}</>

  // Trial → check expiry
  if (branch.plan === 'trial' && branch.plan_expires_at) {
    const expired = new Date(branch.plan_expires_at) < new Date()
    if (expired) return (
      <div className="min-h-screen flex items-center justify-center p-6"
        style={{ background:'var(--ps-darker)' }}>
        <div className="max-w-md w-full text-center space-y-6">
          <div className="text-6xl">⏰</div>
          <div>
            <h1 className="text-2xl font-bold text-ps-text mb-2">انتهت فترة التجربة</h1>
            <p className="text-ps-muted">فترة الـ 14 يوم المجانية انتهت — قم بترقية حسابك للاستمرار</p>
          </div>

          <div className="rounded-2xl p-6 text-right space-y-3"
            style={{ background:'var(--ps-card)', border:'1px solid var(--ps-border)' }}>
            <p className="font-semibold text-ps-text mb-4">الخطط المتاحة</p>
            {[
              { name:'الخطة الأساسية', price:'99 جنيه/شهر', features:['10 أجهزة', 'CRM كامل', 'تقارير أساسية'] },
              { name:'الخطة الاحترافية', price:'199 جنيه/شهر', features:['أجهزة غير محدودة', 'تحليلات متقدمة', 'دعم أولوية', 'API access'], highlight: true },
            ].map(p => (
              <div key={p.name} className="rounded-xl p-4 transition-all"
                style={{
                  background: p.highlight ? 'rgba(0,87,255,.08)' : 'var(--ps-surface)',
                  border: `1px solid ${p.highlight ? 'rgba(0,87,255,.3)' : 'var(--ps-border)'}`,
                }}>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-sm text-ps-text">{p.name}</span>
                  <span className="font-mono font-bold text-sm" style={{ color: p.highlight ? 'var(--ps-blue-light)' : 'var(--ps-gold)' }}>{p.price}</span>
                </div>
                <div className="space-y-1">
                  {p.features.map(f => (
                    <p key={f} className="text-xs text-ps-muted flex items-center gap-1.5">
                      <span style={{ color: p.highlight ? 'var(--ps-blue-light)' : 'var(--ps-green)' }}>✓</span>{f}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <a href="mailto:support@pslounge.app?subject=طلب ترقية الخطة"
            className="btn-primary w-full h-12 text-base flex items-center justify-center gap-2 no-underline">
            💳 ترقية الحساب الآن
          </a>

          <p className="text-xs text-ps-muted">
            للدعم: <span className="font-mono" style={{ color:'var(--ps-blue-light)' }}>support@pslounge.app</span>
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
