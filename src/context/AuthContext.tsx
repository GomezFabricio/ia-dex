import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { AuthContext } from './auth-context-value'
import type { AuthContextValue } from './auth-context-value'

// ---------------------------------------------------------------------------
// AuthProvider — StrictMode-safe session hydration + auth state subscription
// Context shape and AuthContext object live in auth-context-value.ts to comply
// with the react-refresh/only-export-components rule (ADR D2).
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // active flag prevents stale state updates after StrictMode cleanup
    let active = true

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (active) {
        setSession(s)
        setLoading(false)
      }
    })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const signOut = () => supabase.auth.signOut().then(() => undefined)

  // user is derived from session — single source of truth (design D1)
  const value: AuthContextValue = {
    user: session?.user ?? null,
    session,
    loading,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
