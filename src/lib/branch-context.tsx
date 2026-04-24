import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { Branch } from '@/types'
import { useAuth } from '@/lib/auth-context'

interface BranchContextValue {
  branch:   Branch | null
  branchId: string | null
  loading:  boolean
  refetch:  () => Promise<void>
}

const BranchContext = createContext<BranchContextValue | null>(null)

export function BranchProvider({ children }: { children: ReactNode }) {
  const { profile, loading: authLoading } = useAuth()
  const [branch, setBranch]   = useState<Branch | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchBranch = async (id: string) => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('branches').select('*').eq('id', id).single()
      setBranch(data as Branch ?? null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authLoading) return
    const id = profile?.branch_id
    if (id) { fetchBranch(id) }
    else { setBranch(null); setLoading(false) }
  }, [profile?.branch_id, authLoading])

  const refetch = async () => {
    const id = profile?.branch_id
    if (id) await fetchBranch(id)
  }

  return (
    <BranchContext.Provider value={{
      branch, branchId: profile?.branch_id ?? null, loading, refetch,
    }}>
      {children}
    </BranchContext.Provider>
  )
}

export function useBranch() {
  const ctx = useContext(BranchContext)
  if (!ctx) throw new Error('useBranch must be inside BranchProvider')
  return ctx
}
