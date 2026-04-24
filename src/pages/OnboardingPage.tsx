import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { Building2, MapPin, Phone, CheckCircle, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'

const STEPS = [
  { icon: '🎮', title: 'أهلاً بيك في PS Lounge Manager', sub: 'هنضبط حسابك في أقل من دقيقة' },
  { icon: '🏪', title: 'معلومات المحل', sub: 'الاسم والعنوان ورقم التليفون' },
  { icon: '✅', title: 'جاهز!', sub: 'تم إعداد حسابك بنجاح' },
]

export default function OnboardingPage({ onDone }: { onDone: () => void }) {
  const { user } = useAuth()
  const [step, setStep]         = useState(0)
  const [loading, setLoading]   = useState(false)
  const [form, setForm] = useState({
    branchName: '',
    address: '',
    phone: '',
  })

  const handleSetup = async () => {
    if (!form.branchName.trim()) { toast.error('أدخل اسم المحل'); return }
    if (!user) return
    setLoading(true)

    const { error } = await supabase.rpc('setup_new_branch', {
      p_user_id:     user.id,
      p_branch_name: form.branchName.trim(),
      p_address:     form.address.trim() || null,
      p_phone:       form.phone.trim() || null,
    })

    if (error) {
      toast.error('حدث خطأ أثناء الإعداد — ' + error.message)
      setLoading(false)
      return
    }

    setStep(2)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{
      background: 'var(--ps-darker)',
      backgroundImage: `radial-gradient(ellipse 80% 50% at 50% -10%, rgba(0,87,255,.12) 0%, transparent 60%)`,
    }}>
      {/* Grid bg */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `linear-gradient(rgba(0,87,255,.025) 1px, transparent 1px), linear-gradient(90deg, rgba(0,87,255,.025) 1px, transparent 1px)`,
        backgroundSize: '52px 52px',
      }}/>

      <div className="relative w-full max-w-md animate-fade-in">

        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-8">
          {STEPS.map((_, i) => (
            <div key={i} className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === step ? 32 : 8,
                background: i <= step ? 'var(--ps-blue)' : 'var(--ps-border)',
              }}
            />
          ))}
        </div>

        {/* Step card */}
        <div className="card p-8" style={{ boxShadow: '0 24px 64px rgba(0,0,0,.6)' }}>

          {/* Step 0 — Welcome */}
          {step === 0 && (
            <div className="text-center space-y-6">
              <div className="text-6xl">{STEPS[0].icon}</div>
              <div>
                <h1 className="text-2xl font-bold text-ps-text mb-2">{STEPS[0].title}</h1>
                <p className="text-ps-muted">{STEPS[0].sub}</p>
              </div>
              <div className="space-y-3 text-right">
                {[
                  ['🎮', '10 أجهزة PS4/PS5 جاهزة'],
                  ['👥', 'نظام عملاء ومكافآت'],
                  ['🛒', 'مخزن البضاعة والكروت'],
                  ['⏰', 'شيفتات وكاش مطابقة'],
                  ['📊', 'تقارير وتحليلات'],
                ].map(([icon, text]) => (
                  <div key={text} className="flex items-center gap-3 px-4 py-3 rounded-xl"
                    style={{ background: 'var(--ps-surface)', border: '1px solid var(--ps-border)' }}>
                    <span className="text-lg">{icon}</span>
                    <span className="text-sm text-ps-text">{text}</span>
                    <CheckCircle size={16} className="mr-auto" style={{ color: 'var(--ps-green)' }}/>
                  </div>
                ))}
              </div>
              <button onClick={() => setStep(1)} className="btn-primary w-full h-12 text-base gap-2">
                ابدأ الإعداد <ChevronRight size={18}/>
              </button>
              <p className="text-ps-muted text-xs">تجربة مجانية 14 يوم — لا يلزم كارت بنكي</p>
            </div>
          )}

          {/* Step 1 — Branch info */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                  style={{ background: 'rgba(0,87,255,.1)', border: '1px solid rgba(0,87,255,.2)' }}>
                  <Building2 size={20} style={{ color: 'var(--ps-blue-light)' }}/>
                </div>
                <div>
                  <h2 className="font-bold text-ps-text">{STEPS[1].title}</h2>
                  <p className="text-xs text-ps-muted">{STEPS[1].sub}</p>
                </div>
              </div>

              <div>
                <label className="label">اسم المحل *</label>
                <input className="input" placeholder="مثال: قاعة PS الرئيسية"
                  value={form.branchName}
                  onChange={e => setForm(f => ({ ...f, branchName: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleSetup()}
                  autoFocus
                />
              </div>

              <div>
                <label className="label">
                  <span className="flex items-center gap-1.5">
                    <MapPin size={11}/> العنوان (اختياري)
                  </span>
                </label>
                <input className="input" placeholder="الحي / المنطقة / المدينة"
                  value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                />
              </div>

              <div>
                <label className="label">
                  <span className="flex items-center gap-1.5">
                    <Phone size={11}/> رقم الموبايل (اختياري)
                  </span>
                </label>
                <input className="input" dir="ltr" placeholder="01xxxxxxxxx"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep(0)} className="btn-ghost flex-1">رجوع</button>
                <button onClick={handleSetup} disabled={loading || !form.branchName.trim()} className="btn-primary flex-2 flex-1">
                  {loading
                    ? <span className="spinner" style={{ width: 18, height: 18 }}/>
                    : <><CheckCircle size={16}/>إنشاء الحساب</>
                  }
                </button>
              </div>
            </div>
          )}

          {/* Step 2 — Done */}
          {step === 2 && (
            <div className="text-center space-y-6">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto"
                style={{ background: 'rgba(0,229,160,.1)', border: '2px solid rgba(0,229,160,.3)', boxShadow: '0 0 32px rgba(0,229,160,.2)' }}>
                <CheckCircle size={40} style={{ color: 'var(--ps-green)' }}/>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-ps-text mb-2">تم الإعداد بنجاح! 🎉</h2>
                <p className="text-ps-muted">تم إنشاء <span className="font-semibold text-ps-text">{form.branchName}</span> مع 10 أجهزة جاهزة</p>
              </div>
              <div className="rounded-xl p-4 space-y-2 text-right text-sm"
                style={{ background: 'var(--ps-surface)', border: '1px solid var(--ps-border)' }}>
                <p className="text-ps-muted text-xs font-semibold uppercase tracking-wider mb-3">الخطوات القادمة</p>
                {[
                  'ابدأ جلسة على أي جهاز من لوحة التحكم',
                  'أضف عملاءك في صفحة العملاء',
                  'أضف مصاريف المحل في صفحة المصاريف',
                  'أضف بضاعتك وكروت النت في المخزن',
                ].map((t, i) => (
                  <div key={i} className="flex items-center gap-2 text-ps-muted">
                    <span className="font-mono text-xs" style={{ color: 'var(--ps-blue-light)' }}>{i+1}.</span>
                    {t}
                  </div>
                ))}
              </div>
              <button onClick={onDone} className="btn-primary w-full h-12 text-base gap-2">
                🎮 ادخل لوحة التحكم
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
