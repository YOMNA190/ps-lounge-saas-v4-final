import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useBranch } from '@/lib/branch-context'
import { supabase } from '@/lib/supabase'
import { Building2, User, Lock, AlertTriangle, Check, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

type Tab = 'branch' | 'account' | 'password'

export default function SettingsPage() {
  const { profile, user, updatePassword } = useAuth()
  const { branch, branchId, refetch }      = useBranch()
  const [tab, setTab] = useState<Tab>('branch')

  // Branch form
  const [branchName,     setBranchName]     = useState(branch?.name     || '')
  const [branchAddress,  setBranchAddress]  = useState(branch?.address  || '')
  const [branchPhone,    setBranchPhone]    = useState(branch?.phone     || '')
  const [loyaltyLimit,   setLoyaltyLimit]   = useState(branch?.loyalty_limit || 10000)
  const [savingBranch,   setSavingBranch]   = useState(false)

  // Account form
  const [displayName,    setDisplayName]    = useState(profile?.name || '')
  const [savingAccount,  setSavingAccount]  = useState(false)

  // Password form
  const [currentPass,    setCurrentPass]    = useState('')
  const [newPass,        setNewPass]        = useState('')
  const [confirmPass,    setConfirmPass]    = useState('')
  const [showPass,       setShowPass]       = useState(false)
  const [savingPass,     setSavingPass]     = useState(false)

  // ── Save Branch ──
  const saveBranch = async () => {
    if (!branchName.trim()) { toast.error('اسم المحل مطلوب'); return }
    setSavingBranch(true)
    const { error } = await supabase.from('branches').update({
      name:          branchName.trim(),
      address:       branchAddress.trim() || null,
      phone:         branchPhone.trim()   || null,
      loyalty_limit: loyaltyLimit,
    }).eq('id', branchId)
    if (error) toast.error('فشل الحفظ')
    else { toast.success('✓ تم حفظ بيانات المحل'); refetch() }
    setSavingBranch(false)
  }

  // ── Save Account ──
  const saveAccount = async () => {
    if (!displayName.trim()) { toast.error('الاسم مطلوب'); return }
    setSavingAccount(true)
    const { error } = await supabase.from('profiles').update({ name: displayName.trim() }).eq('id', user?.id)
    if (error) toast.error('فشل الحفظ')
    else toast.success('✓ تم حفظ البيانات')
    setSavingAccount(false)
  }

  // ── Change Password ──
  const changePassword = async () => {
    if (newPass.length < 8)          { toast.error('كلمة المرور يجب أن تكون 8 أحرف على الأقل'); return }
    if (newPass !== confirmPass)      { toast.error('كلمتا المرور غير متطابقتين'); return }
    setSavingPass(true)
    // Re-authenticate first
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email:    user?.email || '',
      password: currentPass,
    })
    if (signInErr) { toast.error('كلمة المرور الحالية غير صحيحة'); setSavingPass(false); return }

    const { error } = await updatePassword(newPass)
    if (error) toast.error('فشل تحديث كلمة المرور')
    else { toast.success('✓ تم تحديث كلمة المرور'); setCurrentPass(''); setNewPass(''); setConfirmPass('') }
    setSavingPass(false)
  }

  const planColors: Record<string, string> = {
    trial: 'var(--ps-gold)',
    basic: 'var(--ps-blue-light)',
    pro:   'var(--ps-green)',
  }
  const planLabel: Record<string, string> = {
    trial: 'تجربة مجانية',
    basic: 'الخطة الأساسية',
    pro:   'الخطة الاحترافية',
  }

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key:'branch',   label:'المحل',    icon: <Building2 size={15}/> },
    { key:'account',  label:'الحساب',   icon: <User size={15}/> },
    { key:'password', label:'كلمة المرور', icon: <Lock size={15}/> },
  ]

  return (
    <div className="space-y-5 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-ps-text">الإعدادات</h1>
        <p className="text-ps-muted text-sm mt-0.5">إدارة بيانات المحل والحساب</p>
      </div>

      {/* Plan badge */}
      {branch && (
        <div className="rounded-2xl p-4 flex items-center gap-4"
          style={{ background:'var(--ps-card)', border:'1px solid var(--ps-border)' }}>
          <div className="flex-1">
            <p className="text-xs text-ps-muted mb-1">الخطة الحالية</p>
            <p className="font-bold" style={{ color: planColors[branch.plan] || 'var(--ps-muted)' }}>
              {planLabel[branch.plan] || branch.plan}
            </p>
          </div>
          {branch.plan === 'trial' && branch.plan_expires_at && (
            <div className="text-left">
              <p className="text-xs text-ps-muted">تنتهي في</p>
              <p className="font-mono font-bold text-sm" style={{ color:'var(--ps-gold)' }}>
                {new Date(branch.plan_expires_at).toLocaleDateString('ar-EG')}
              </p>
              {new Date(branch.plan_expires_at) < new Date() && (
                <p className="text-xs mt-1" style={{ color:'var(--ps-red)' }}>⚠️ انتهت التجربة</p>
              )}
            </div>
          )}
          {branch.plan === 'trial' && (
            <button className="btn-primary text-sm px-4">ترقية الخطة</button>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background:'var(--ps-surface)', border:'1px solid var(--ps-border)' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all"
            style={tab===t.key
              ? { background:'var(--ps-card)', color:'var(--ps-text)', border:'1px solid var(--ps-border)', boxShadow:'0 2px 8px rgba(0,0,0,.3)' }
              : { color:'var(--ps-muted)' }}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ── Branch Tab ── */}
      {tab === 'branch' && (
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-ps-text flex items-center gap-2"><Building2 size={17}/>بيانات المحل</h2>
          <div>
            <label className="label">اسم المحل *</label>
            <input className="input" value={branchName} onChange={e => setBranchName(e.target.value)} placeholder="قاعة PS الرئيسية"/>
          </div>
          <div>
            <label className="label">العنوان</label>
            <input className="input" value={branchAddress} onChange={e => setBranchAddress(e.target.value)} placeholder="الحي / المنطقة / المدينة"/>
          </div>
          <div>
            <label className="label">رقم الموبايل</label>
            <input className="input" dir="ltr" value={branchPhone} onChange={e => setBranchPhone(e.target.value)} placeholder="01xxxxxxxxx"/>
          </div>
          <div>
            <label className="label">حد مكافأة الولاء (جنيه)</label>
            <input type="number" className="input font-mono" value={loyaltyLimit}
              onChange={e => setLoyaltyLimit(Number(e.target.value))} min={1000}/>
            <p className="text-xs text-ps-muted mt-1">لما العميل يصل لهذا المبلغ في الشهر — يستحق مكافأة</p>
          </div>
          <button onClick={saveBranch} disabled={savingBranch} className="btn-primary gap-2">
            {savingBranch ? <span className="spinner" style={{width:15,height:15}}/> : <Check size={15}/>}
            حفظ بيانات المحل
          </button>
        </div>
      )}

      {/* ── Account Tab ── */}
      {tab === 'account' && (
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-ps-text flex items-center gap-2"><User size={17}/>بيانات الحساب</h2>
          <div>
            <label className="label">الاسم</label>
            <input className="input" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="اسمك الكامل"/>
          </div>
          <div>
            <label className="label">البريد الإلكتروني</label>
            <input className="input" value={user?.email || ''} disabled
              style={{ opacity:.5, cursor:'not-allowed' }} dir="ltr"/>
            <p className="text-xs text-ps-muted mt-1">البريد الإلكتروني لا يمكن تغييره</p>
          </div>
          <div>
            <label className="label">الصلاحية</label>
            <div className="input flex items-center gap-2" style={{ opacity:.6, cursor:'default' }}>
              <span className="w-2 h-2 rounded-full" style={{ background: profile?.role === 'admin' ? 'var(--ps-blue)' : 'var(--ps-muted)' }}/>
              {profile?.role === 'admin' ? 'أدمن' : 'موظف'}
            </div>
          </div>
          <button onClick={saveAccount} disabled={savingAccount} className="btn-primary gap-2">
            {savingAccount ? <span className="spinner" style={{width:15,height:15}}/> : <Check size={15}/>}
            حفظ البيانات
          </button>
        </div>
      )}

      {/* ── Password Tab ── */}
      {tab === 'password' && (
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-ps-text flex items-center gap-2"><Lock size={17}/>تغيير كلمة المرور</h2>
          <div>
            <label className="label">كلمة المرور الحالية</label>
            <div className="relative">
              <input type={showPass?'text':'password'} className="input"
                style={{ paddingLeft:'2.8rem' }} value={currentPass}
                onChange={e => setCurrentPass(e.target.value)} dir="ltr" placeholder="••••••••"/>
              <button type="button" onClick={() => setShowPass(p=>!p)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ps-muted hover:text-ps-text">
                {showPass ? <EyeOff size={15}/> : <Eye size={15}/>}
              </button>
            </div>
          </div>
          <div>
            <label className="label">كلمة المرور الجديدة</label>
            <input type="password" className="input" value={newPass}
              onChange={e => setNewPass(e.target.value)} dir="ltr"
              placeholder="8 أحرف على الأقل" minLength={8}/>
          </div>
          <div>
            <label className="label">تأكيد كلمة المرور الجديدة</label>
            <input type="password" className="input" value={confirmPass}
              onChange={e => setConfirmPass(e.target.value)} dir="ltr" placeholder="••••••••"/>
            {confirmPass && newPass !== confirmPass && (
              <p className="text-xs mt-1" style={{ color:'var(--ps-red)' }}>كلمتا المرور غير متطابقتين</p>
            )}
          </div>
          <button onClick={changePassword} disabled={savingPass || !currentPass || newPass !== confirmPass} className="btn-primary gap-2">
            {savingPass ? <span className="spinner" style={{width:15,height:15}}/> : <Check size={15}/>}
            تحديث كلمة المرور
          </button>
        </div>
      )}

      {/* Danger Zone */}
      <div className="rounded-2xl p-5" style={{ background:'rgba(255,61,90,.04)', border:'1px solid rgba(255,61,90,.15)' }}>
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={16} style={{ color:'var(--ps-red)' }}/>
          <p className="font-semibold text-sm" style={{ color:'var(--ps-red)' }}>منطقة الخطر</p>
        </div>
        <p className="text-ps-muted text-sm mb-4">هذه الإجراءات لا يمكن التراجع عنها</p>
        <button
          onClick={() => { if (confirm('هل أنت متأكد من تسجيل الخروج؟')) supabase.auth.signOut() }}
          className="btn-ghost text-sm gap-2" style={{ border:'1px solid rgba(255,61,90,.2)', color:'var(--ps-red)' }}>
          تسجيل الخروج من كل الأجهزة
        </button>
      </div>
    </div>
  )
}
