import React, { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { Eye, EyeOff, AlertCircle, CheckCircle, ArrowRight, Loader2 } from 'lucide-react'

type AuthMode = 'login' | 'register' | 'forgot' | 'forgot_sent' | 'verify_email'

const BG = () => (
  <>
    <div className="absolute inset-0 pointer-events-none" style={{
      backgroundImage: `linear-gradient(rgba(0,87,255,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,87,255,.03) 1px,transparent 1px)`,
      backgroundSize: '52px 52px',
    }}/>
    <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full pointer-events-none"
      style={{ background: 'radial-gradient(circle,rgba(0,87,255,.1) 0%,transparent 70%)', filter: 'blur(40px)' }}/>
    <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full pointer-events-none"
      style={{ background: 'radial-gradient(circle,rgba(155,109,255,.06) 0%,transparent 70%)', filter: 'blur(40px)' }}/>
  </>
)

const PSLogo = () => (
  <div className="text-center mb-8">
    <div className="inline-block mb-4">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{
        background: 'linear-gradient(135deg,rgba(0,87,255,.15),rgba(61,139,255,.08))',
        border: '1px solid rgba(0,87,255,.3)',
        boxShadow: '0 0 40px rgba(0,87,255,.2)',
      }}>
        <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
          <path d="M8 28L8 12L18 12Q26 12 26 18Q26 22 22 23L26 28" stroke="#3d8bff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          <path d="M14 28Q14 32 20 32Q32 32 32 24Q32 20 26 20" stroke="#9b6dff" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.7"/>
        </svg>
      </div>
    </div>
    <h1 className="font-display text-4xl tracking-[0.12em] text-ps-text mb-1">PS LOUNGE</h1>
    <p className="text-ps-muted text-sm tracking-wider">نظام إدارة قاعة البلايستيشن</p>
  </div>
)

export default function LoginPage() {
  const { signIn, signUp, resetPassword } = useAuth()
  const [mode, setMode]       = useState<AuthMode>('login')
  const [name, setName]       = useState('')
  const [email, setEmail]     = useState('')
  const [password, setPass]   = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShow]   = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const reset = (next: AuthMode) => { setError(''); setMode(next) }

  // ── Translate Supabase errors to Arabic ──────────────────
  const arabicError = (msg: string): string => {
    if (!msg) return 'حدث خطأ غير متوقع'
    const m = msg.toLowerCase()
    if (m.includes('already registered') || m.includes('already been registered') || m.includes('user already exists'))
      return 'هذا البريد مسجّل مسبقاً — سجّل دخول أو استرجع كلمة المرور'
    if (m.includes('invalid login') || m.includes('invalid credentials') || m.includes('email not confirmed') && mode === 'login')
      return 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
    if (m.includes('email not confirmed'))
      return 'يرجى تأكيد بريدك الإلكتروني أولاً — تحقق من صندوق الوارد'
    if (m.includes('password') && m.includes('short'))
      return 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'
    if (m.includes('rate limit') || m.includes('too many'))
      return 'طلبات كثيرة — انتظر دقيقة ثم حاول مرة أخرى'
    if (m.includes('network') || m.includes('fetch'))
      return 'خطأ في الاتصال — تحقق من الإنترنت'
    if (m.includes('user not found') || m.includes('no user'))
      return 'لا يوجد حساب بهذا البريد'
    return 'حدث خطأ — حاول مرة أخرى'
  }

  // ── LOGIN ─────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setLoading(true)
    const { error } = await signIn(email, password)
    if (error) setError(arabicError(error.message))
    setLoading(false)
  }

  // ── REGISTER ──────────────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!name.trim())        { setError('أدخل اسمك الكامل'); return }
    if (password.length < 6) { setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return }
    if (password !== confirm) { setError('كلمتا المرور غير متطابقتين'); return }
    setLoading(true)
    const { error } = await signUp(email, password, name.trim())
    if (error) {
      setError(arabicError(error.message))
    } else {
      // Supabase might require email confirmation depending on settings
      setMode('verify_email')
    }
    setLoading(false)
  }

  // ── FORGOT PASSWORD ───────────────────────────────────────
  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setLoading(true)
    const { error } = await resetPassword(email)
    if (error) setError(arabicError(error.message))
    else setMode('forgot_sent')
    setLoading(false)
  }

  const Spinner = () => <Loader2 size={16} className="animate-spin"/>

  const ErrorBox = () => error ? (
    <div className="flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm" style={{
      background: 'rgba(255,61,90,.08)', border: '1px solid rgba(255,61,90,.2)', color: 'var(--ps-red)',
    }}>
      <AlertCircle size={15} className="mt-0.5 flex-shrink-0"/>
      <span>{error}</span>
    </div>
  ) : null

  const Submit = ({ label }: { label: string }) => (
    <button type="submit" disabled={loading} className="btn-primary w-full h-11 text-base">
      {loading ? <span className="flex items-center justify-center gap-2"><Spinner/> جاري التحميل...</span> : label}
    </button>
  )

  const EyeToggle = () => (
    <button type="button" onClick={() => setShow(p => !p)}
      className="absolute left-3 top-1/2 -translate-y-1/2 text-ps-muted hover:text-ps-text transition-colors">
      {showPass ? <EyeOff size={15}/> : <Eye size={15}/>}
    </button>
  )

  // ── EMAIL VERIFY ──────────────────────────────────────────
  if (mode === 'verify_email') return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <BG/>
      <div className="relative w-full max-w-sm animate-fade-in">
        <PSLogo/>
        <div className="card p-8 text-center space-y-5" style={{ boxShadow: '0 24px 64px rgba(0,0,0,.6)' }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
            style={{ background: 'rgba(0,87,255,.1)', border: '2px solid rgba(0,87,255,.3)' }}>
            <span style={{ fontSize: 32 }}>📧</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-ps-text mb-2">تحقق من بريدك الإلكتروني</h2>
            <p className="text-ps-muted text-sm">
              أرسلنا رابط التأكيد إلى <span className="font-semibold text-ps-text">{email}</span>
              <br/>افتح الرابط ثم عود هنا لتسجيل الدخول
            </p>
          </div>
          <div className="rounded-xl p-3 text-xs text-ps-muted" style={{ background: 'var(--ps-surface)', border: '1px solid var(--ps-border)' }}>
            💡 لو مش لاقيه في الـ Inbox، اتحقق من Spam
          </div>
          <button onClick={() => reset('login')} className="btn-ghost w-full gap-2">
            <ArrowRight size={16}/>رجوع لتسجيل الدخول
          </button>
        </div>
      </div>
    </div>
  )

  // ── FORGOT SENT ───────────────────────────────────────────
  if (mode === 'forgot_sent') return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <BG/>
      <div className="relative w-full max-w-sm animate-fade-in">
        <PSLogo/>
        <div className="card p-8 text-center space-y-5" style={{ boxShadow: '0 24px 64px rgba(0,0,0,.6)' }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
            style={{ background: 'rgba(0,229,160,.1)', border: '2px solid rgba(0,229,160,.3)' }}>
            <CheckCircle size={32} style={{ color: 'var(--ps-green)' }}/>
          </div>
          <div>
            <h2 className="text-xl font-bold text-ps-text mb-2">تم إرسال الرابط!</h2>
            <p className="text-ps-muted text-sm">
              تحقق من بريدك <span className="font-semibold text-ps-text">{email}</span>
              <br/>وافتح رابط إعادة تعيين كلمة المرور
            </p>
          </div>
          <button onClick={() => reset('login')} className="btn-ghost w-full gap-2">
            <ArrowRight size={16}/>رجوع لتسجيل الدخول
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <BG/>
      <div className="relative w-full max-w-sm animate-fade-in">
        <PSLogo/>
        <div className="card p-8" style={{ boxShadow: '0 24px 64px rgba(0,0,0,.6)' }}>

          {/* ── LOGIN ── */}
          {mode === 'login' && (
            <>
              <h2 className="text-lg font-semibold mb-6 text-ps-text">تسجيل الدخول</h2>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="label">البريد الإلكتروني</label>
                  <input type="email" className="input" placeholder="admin@pslounge.com"
                    value={email} onChange={e => setEmail(e.target.value)} required dir="ltr" autoFocus/>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="label mb-0">كلمة المرور</label>
                    <button type="button" onClick={() => reset('forgot')}
                      className="text-xs transition-colors" style={{ color: 'var(--ps-blue-light)' }}>
                      نسيت كلمة المرور؟
                    </button>
                  </div>
                  <div className="relative">
                    <input type={showPass ? 'text' : 'password'} className="input"
                      placeholder="••••••••" style={{ paddingLeft: '2.8rem' }}
                      value={password} onChange={e => setPass(e.target.value)} required dir="ltr"/>
                    <EyeToggle/>
                  </div>
                </div>
                <ErrorBox/>
                <Submit label="دخول"/>
              </form>
              <div className="mt-5 pt-5 border-t text-center" style={{ borderColor: 'var(--ps-border)' }}>
                <p className="text-ps-muted text-sm">
                  مش عندك حساب؟{' '}
                  <button onClick={() => reset('register')} className="font-semibold transition-colors"
                    style={{ color: 'var(--ps-blue-light)' }}>سجّل دلوقتي</button>
                </p>
              </div>
            </>
          )}

          {/* ── REGISTER ── */}
          {mode === 'register' && (
            <>
              <div className="flex items-center gap-3 mb-6">
                <button onClick={() => reset('login')} className="text-ps-muted hover:text-ps-text transition-colors">
                  <ArrowRight size={18}/>
                </button>
                <h2 className="text-lg font-semibold text-ps-text">إنشاء حساب جديد</h2>
              </div>
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="label">الاسم الكامل</label>
                  <input className="input" placeholder="اسمك الكامل"
                    value={name} onChange={e => setName(e.target.value)} required autoFocus/>
                </div>
                <div>
                  <label className="label">البريد الإلكتروني</label>
                  <input type="email" className="input" placeholder="you@example.com"
                    value={email} onChange={e => setEmail(e.target.value)} required dir="ltr"/>
                </div>
                <div>
                  <label className="label">كلمة المرور</label>
                  <div className="relative">
                    <input type={showPass ? 'text' : 'password'} className="input"
                      placeholder="6 أحرف على الأقل" style={{ paddingLeft: '2.8rem' }}
                      value={password} onChange={e => setPass(e.target.value)} required dir="ltr" minLength={6}/>
                    <EyeToggle/>
                  </div>
                </div>
                <div>
                  <label className="label">تأكيد كلمة المرور</label>
                  <input type="password" className="input" placeholder="••••••••"
                    value={confirm} onChange={e => setConfirm(e.target.value)} required dir="ltr"/>
                  {confirm && password !== confirm && (
                    <p className="text-xs mt-1" style={{ color: 'var(--ps-red)' }}>كلمتا المرور غير متطابقتين</p>
                  )}
                </div>
                <ErrorBox/>
                <div className="rounded-xl p-3 text-xs text-ps-muted" style={{ background: 'var(--ps-surface)', border: '1px solid var(--ps-border)' }}>
                  ✅ تجربة مجانية <span className="font-semibold text-ps-text">14 يوم</span> — لا يلزم كارت بنكي
                </div>
                <Submit label="إنشاء الحساب"/>
              </form>
              <div className="mt-5 pt-5 border-t text-center" style={{ borderColor: 'var(--ps-border)' }}>
                <p className="text-ps-muted text-sm">
                  عندك حساب؟{' '}
                  <button onClick={() => reset('login')} className="font-semibold transition-colors"
                    style={{ color: 'var(--ps-blue-light)' }}>سجّل دخول</button>
                </p>
              </div>
            </>
          )}

          {/* ── FORGOT PASSWORD ── */}
          {mode === 'forgot' && (
            <>
              <div className="flex items-center gap-3 mb-6">
                <button onClick={() => reset('login')} className="text-ps-muted hover:text-ps-text transition-colors">
                  <ArrowRight size={18}/>
                </button>
                <h2 className="text-lg font-semibold text-ps-text">استرجاع كلمة المرور</h2>
              </div>
              <p className="text-sm text-ps-muted mb-5">أدخل بريدك وهنبعتلك رابط إعادة التعيين</p>
              <form onSubmit={handleForgot} className="space-y-4">
                <div>
                  <label className="label">البريد الإلكتروني</label>
                  <input type="email" className="input" placeholder="you@example.com"
                    value={email} onChange={e => setEmail(e.target.value)} required dir="ltr" autoFocus/>
                </div>
                <ErrorBox/>
                <Submit label="إرسال رابط الاسترداد"/>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-ps-muted text-xs mt-5 font-mono tracking-wider opacity-50">
          PS LOUNGE v4.0 · POWERED BY SUPABASE
        </p>
      </div>
    </div>
  )
}
