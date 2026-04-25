import { createClient } from '@supabase/supabase-js'

// ⚡ Credentials from environment variables ONLY — never hardcoded
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '❌ Missing Supabase env vars! ' +
    'Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your environment.'
  )
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
  {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})

export type SupabaseClient = typeof supabase
