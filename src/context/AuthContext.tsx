import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { AuthContext } from './auth-context-value'
import type { AuthContextValue } from './auth-context-value'

// ---------------------------------------------------------------------------
// AuthProvider — StrictMode-safe session hydration + auth state subscription
// Context shape and AuthContext object live in auth-context-value.ts to comply
// with the react-refresh/only-export-components rule (ADR D2).
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Single effect coordinates hydration and live updates so `loading`
    // transitions true -> false exactly once, even under StrictMode
    // double-mount (the INITIAL_SESSION event covers hydration).
    let active = true

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      if (active) {
        setSession(s)
        setLoading(false)
      }
    })

    // Fallback hydration in case INITIAL_SESSION was emitted before the
    // subscription attached (supabase-js replays it, but getSession is cheap
    // and guarantees the loading state resolves).
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (active) {
        setSession(s)
        setLoading(false)
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  // user is derived from session — single source of truth (design D1)
  const value: AuthContextValue = {
    user: session?.user ?? null,
    session,
    loading,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
