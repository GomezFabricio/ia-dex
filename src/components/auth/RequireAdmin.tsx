import type { ReactNode } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useIsAdmin } from '../../hooks/useIsAdmin'

// ---------------------------------------------------------------------------
// RequireAdmin — route-level guard for the /admin subtree. Wraps either an
// explicit `children` element or, with no children, renders <Outlet/> so it can
// be used as a layout route.
//
// SECURITY NOTE: this guard is a UI convenience ONLY. The admin role lives in
// client-readable AuthContext and is therefore SPOOFABLE in the browser —
// hiding the UI does NOT protect data. The authoritative enforcement is the
// database: RLS policies gated on puede_gestionar_contenido() reject any write
// (and hide drafts on read) for a non-admin, regardless of what the client
// renders. (ADM1, design Decision 9)
//
// Flicker avoidance (design Decision 9): auth resolves in two independent
// stages — `loading` flips false once the session is known, but `role` is
// fetched from profiles AFTER that and is null while in flight. Redirecting on
// "not admin" before the role resolves would bounce a real admin to '/'. So we
// hold a neutral loading state while either the session OR (for a logged-in
// user) the role is still pending. Only once both are settled do we decide.
// ---------------------------------------------------------------------------

export default function RequireAdmin({ children }: { children?: ReactNode }) {
  const { loading, user, role } = useAuth()
  const isAdmin = useIsAdmin()

  // Still resolving: session not hydrated, OR a logged-in user whose role
  // fetch has not landed yet (role === null). Do NOT redirect here.
  const roleResolving = user !== null && role === null
  if (loading || roleResolving) {
    return (
      <div className="mx-auto max-w-[1400px] px-6 pt-24 sm:px-8 lg:px-12">
        <p className="text-muted">Verificando acceso…</p>
      </div>
    )
  }

  // Resolved and not an admin → never render the admin UI. Redirect home.
  if (!isAdmin) {
    return <Navigate to="/" replace />
  }

  // Resolved admin → render the protected subtree.
  return <>{children ?? <Outlet />}</>
}
