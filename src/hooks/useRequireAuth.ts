import { useContext } from 'react'
import type { User } from '@supabase/supabase-js'
import { RequireAuthContext } from '../context/require-auth-context'

// ---------------------------------------------------------------------------
// useRequireAuth — returns the action-level auth gate (ADR D3).
//
// Usage: const requireAuth = useRequireAuth()
//   const handleWrite = () => {
//     const user = requireAuth()   // opens the sign-in modal if anon; returns null
//     if (!user) return
//     // ... perform write action
//   }
//
// The gate (and its modal) live in RequireAuthProvider, mounted in AppLayout.
// Does NOT navigate on render. Caller invokes inside event handlers only.
// ---------------------------------------------------------------------------

export function useRequireAuth(): () => User | null {
  const requireAuth = useContext(RequireAuthContext)
  if (!requireAuth) {
    throw new Error('useRequireAuth must be used within a RequireAuthProvider')
  }
  return requireAuth
}
