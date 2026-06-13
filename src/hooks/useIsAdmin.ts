import { useAuth } from './useAuth'

// ---------------------------------------------------------------------------
// useIsAdmin — returns true only when the authenticated user has role 'admin'.
// Consumes AuthContext via useAuth (same pattern as useAuth.ts, ADR D2).
// Returns false while unauthenticated, while the profiles fetch is in flight,
// or when the user has role 'user'. (AD1/AD9)
// ---------------------------------------------------------------------------

export function useIsAdmin(): boolean {
  const { role } = useAuth()
  return role === 'admin'
}
