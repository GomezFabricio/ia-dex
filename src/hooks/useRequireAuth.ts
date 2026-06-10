import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { useAuth } from './useAuth'

// ---------------------------------------------------------------------------
// useRequireAuth — returns a stable callback (ADR D3: action-level auth gate)
//
// Usage: const requireAuth = useRequireAuth()
//   const handleWrite = () => {
//     const user = requireAuth()   // navigates to /login if anon; returns null
//     if (!user) return
//     // ... perform write action
//   }
//
// Does NOT navigate on render. Caller invokes inside event handlers only.
// ---------------------------------------------------------------------------

export function useRequireAuth(): () => User | null {
  const { user } = useAuth()
  const navigate = useNavigate()

  return useCallback(() => {
    if (!user) {
      navigate('/login')
      return null
    }
    return user
  }, [user, navigate])
}
