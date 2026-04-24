import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'
import { Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react'

export default function ResetPasswordPage() {
  const { updatePassword } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [showPass, setShowPass]   = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [done, setDone]           = useState(false)

  // Supabase puts the token in the URL hash on redirect
  useEffect(() => {
    const hash = window.location.hash
    if (!hash.includes('access_token')) {
      // No token — redirect to login
      navigate('/login', { replace: true })
    }
  }, [navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 8)  { setError('كلمة المرور يجب أن تكون 8 أحرف على الأقل'); return }
    if (password !== confirm)  { setError('كلمتا المرور غير متطابقتين'); return }
    setLoading(true)
    const { error } = await updatePassword(password)
    if (error) setError('فشل تحديث كلمة المرور — حاول مرة أخرى')
    else setDone(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background:'var(--ps-darker)' }}>
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage:`linear-gradient(rgba(0,87,255,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,87,255,.03) 1px,transparent 1px)`,
        backgroundSize:'52px 52px',
      }}/>

      <div className="relative w-full max-w-sm animate-fade-in">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background:'linear-gradient(135deg,rgba(0,87,255,.15),rgba(61,139,255,.08))', border:'1px solid rgba(0,87,255,.3)' }}>
            <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
              <path d="M8 28 L8 12 L18 12 Q26 12 26 18 Q26 22 22 23 L26 28" stroke="#3d8bff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              <path d="M14 28 Q14 32 20 32 Q32 32 32 24 Q32 20 26 20" stroke="#9b6dff" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.7"/>
            </svg>
          </div>
          <h1 className="font-display text-3xl tracking-widest text-ps-text">PS LOUNGE</h1>
        </div>

        <div className="card p-8" style={{ boxShadow:'0 24px 64px rgba(0,0,0,.6)' }}>
          {done ? (
            <div className="text-center space-y-5">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
                style={{ background:'rgba(0,229,160,.1)', border:'2px solid rgba(0,229,160,.3)' }}>
                <CheckCircle size={32} style={{ color:'var(--ps-green)' }}/>
              </div>
              <div>
                <h2 className="text-xl font-bold text-ps-text mb-2">تم تحديث كلمة المرور!</h2>
                <p className="text-ps-muted text-sm">يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة</p>
              </div>
              <button onClick={() => navigate('/login', { replace: true })} className="btn-primary w-full h-11">
                تسجيل الدخول
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold mb-2 text-ps-text">كلمة مرور جديدة</h2>
              <p className="text-ps-muted text-sm mb-6">اختر كلمة مرور قوية لحسابك</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">كلمة المرور الجديدة</label>
                  <div className="relative">
                    <input type={showPass?'text':'password'} className="input"
                      placeholder="8 أحرف على الأقل" style={{ paddingLeft:'2.8rem' }}
                      value={password} onChange={e => setPassword(e.target.value)}
                      required dir="ltr" minLength={8} autoFocus/>
                    <button type="button" onClick={() => setShowPass(p=>!p)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-ps-muted hover:text-ps-text transition-colors">
                      {showPass ? <EyeOff size={15}/> : <Eye size={15}/>}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="label">تأكيد كلمة المرور</label>
                  <input type="password" className="input" placeholder="••••••••"
                    value={confirm} onChange={e => setConfirm(e.target.value)}
                    required dir="ltr"/>
                  {confirm && password !== confirm && (
                    <p className="text-xs mt-1" style={{ color:'var(--ps-red)' }}>كلمتا المرور غير متطابقتين</p>
                  )}
                </div>

                {error && (
                  <div className="flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm"
                    style={{ background:'rgba(255,61,90,.08)', border:'1px solid rgba(255,61,90,.2)', color:'var(--ps-red)' }}>
                    <AlertCircle size={15}/>{error}
                  </div>
                )}

                <button type="submit" disabled={loading || password !== confirm} className="btn-primary w-full h-11 text-base">
                  {loading
                    ? <span className="flex items-center justify-center gap-2"><span className="spinner" style={{width:16,height:16}}/>جاري الحفظ...</span>
                    : 'تحديث كلمة المرور'
                  }
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
