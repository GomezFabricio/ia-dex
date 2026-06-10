import { useContext } from 'react'
import { AuthContext } from '../context/auth-context-value'
import type { AuthContextValue } from '../context/auth-context-value'

// ---------------------------------------------------------------------------
// useAuth — consumes AuthContext and throws if called outside AuthProvider
// Returns the full AuthContextValue including signOut (design D1 / ADR D2,
// orchestrator ruling: signOut included in return for ergonomics)
// ---------------------------------------------------------------------------

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
