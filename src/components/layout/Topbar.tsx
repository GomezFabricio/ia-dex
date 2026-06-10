import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

// ---------------------------------------------------------------------------
// Topbar — app bar with brand link and auth slot
// Auth slot: blank while loading | email + sign-out button when authenticated
//            | login link when anonymous
// signOut errors are caught and logged to avoid unhandled rejections
// (orchestrator ruling: signOut throws on supabase error — must catch here)
// ---------------------------------------------------------------------------

export default function Topbar() {
  const { user, loading, signOut } = useAuth()

  const handleSignOut = () => {
    signOut().catch((err: unknown) => {
      console.warn('Error al cerrar sesión:', err)
    })
  }

  return (
    <header className="col-span-2 flex items-center justify-between px-6 py-3 bg-surface border-b border-surface">
      <Link to="/" className="text-lg font-bold text-text hover:text-accent transition-colors">
        IA-dex
      </Link>

      <div className="flex items-center gap-4">
        {!loading && user && (
          <>
            <span className="text-sm text-muted">{user.email}</span>
            <button
              onClick={handleSignOut}
              className="text-sm text-muted hover:text-text transition-colors"
            >
              Cerrar sesión
            </button>
          </>
        )}
        {!loading && !user && (
          <Link to="/login" className="text-sm text-accent hover:text-text transition-colors">
            Iniciar sesión
          </Link>
        )}
      </div>
    </header>
  )
}
