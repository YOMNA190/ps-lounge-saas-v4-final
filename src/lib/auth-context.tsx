import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react'
import { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { Profile } from '@/types'

export function requireAdmin(r?: string | null)          { return r === 'admin' }
export function requireStaff(r?: string | null)          { return r === 'admin' || r === 'staff' }
export function canAccessFinancialData(r?: string | null){ return requireAdmin(r) }
export function canManageSessions(r?: string | null)     { return requireStaff(r) }
export function canViewAuditLogs(r?: string | null)      { return requireAdmin(r) }

interface AuthContextValue {
  user:               User | null
  profile:            Profile | null
  session:            Session | null
  loading:            boolean
  isAdmin:            boolean
  isStaff:            boolean
  canAccessFinancial: boolean
  canManageSession:   boolean
  canViewAudit:       boolean
  signIn:         (email: string, password: string)               => Promise<{ error: AuthError | null }>
  signUp:         (email: string, password: string, name: string) => Promise<{ error: AuthError | null }>
  signOut:        ()                                              => Promise<void>
  resetPassword:  (email: string)                                 => Promise<{ error: AuthError | null }>
  updatePassword: (newPassword: string)                           => Promise<{ error: AuthError | null }>
  refreshProfile: ()                                              => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const initialized = useRef(false)

  async function loadProfile(userId: string): Promise<Profile | null> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()
      if (data) return data as Profile
      if (!error || error.code !== 'PGRST116') break
      await new Promise(r => setTimeout(r, 600 * (attempt + 1)))
    }
    return null
  }

  useEffect(() => {
    // 1. Initial session check
    const initSession = async () => {
      try {
        const { data: { session: sess } } = await supabase.auth.getSession()
        setSession(sess)
        setUser(sess?.user ?? null)
        if (sess?.user) {
          const prof = await loadProfile(sess.user.id)
          setProfile(prof)
        }
      } catch (err) {
        console.error('Auth init error:', err)
      } finally {
        setLoading(false)
        initialized.current = true
      }
    }
    initSession()

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, sess) => {
        setSession(sess)
        setUser(sess?.user ?? null)
        if (sess?.user) {
          if (event === 'PASSWORD_RECOVERY') {
            setLoading(false)
            return
          }
          const prof = await loadProfile(sess.user.id)
          setProfile(prof)
        } else {
          setProfile(null)
        }
        setLoading(false)
        initialized.current = true
      }
    )

    // 3. Safety timeout
    const timeout = setTimeout(() => {
      if (!initialized.current) setLoading(false)
    }, 5000)

    return () => { subscription.unsubscribe(); clearTimeout(timeout) }
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  const signUp = async (email: string, password: string, name: string) => {
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { name }, emailRedirectTo: `${window.location.origin}/` },
    })
    return { error }
  }

  const signOut = async () => {
    setProfile(null); setUser(null)
    await supabase.auth.signOut()
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return { error }
  }

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    return { error }
  }

  const refreshProfile = async () => {
    if (user) { const p = await loadProfile(user.id); if (p) setProfile(p) }
  }

  const role = profile?.role

  return (
    <AuthContext.Provider value={{
      user, profile, session, loading,
      isAdmin:            requireAdmin(role),
      isStaff:            requireStaff(role),
      canAccessFinancial: canAccessFinancialData(role),
      canManageSession:   canManageSessions(role),
      canViewAudit:       canViewAuditLogs(role),
      signIn, signUp, signOut, resetPassword, updatePassword, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
