import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// AuthContextValue — approved contract (design D1, orchestrator ruling #2)
// signOut included per design AuthContextValue (conscious expansion over spec)
// role added for AD1/AD9: fetched from profiles after session resolves; null
// while unauthenticated or while the profiles fetch is in flight.
// ---------------------------------------------------------------------------

export type AuthContextValue = {
  user: User | null      // derived from session
  session: Session | null
  loading: boolean       // true until getSession resolves
  passwordRecovery: boolean  // true once a PASSWORD_RECOVERY event has fired (X3)
  role: 'user' | 'admin' | null  // from profiles.role; null when unauthenticated or pending
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
