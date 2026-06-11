import { createContext } from 'react'
import type { User } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// RequireAuthContext — provides the action-level auth gate (ADR D3).
// requireAuth() returns the current user, or null after opening a modal that
// invites anonymous visitors to sign in. Split into its own module so the
// provider file only exports a component (react-refresh/only-export-components).
// ---------------------------------------------------------------------------

export type RequireAuthFn = () => User | null

export const RequireAuthContext = createContext<RequireAuthFn | null>(null)
