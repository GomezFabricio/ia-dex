import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import Modal from '../ui/Modal'

// ---------------------------------------------------------------------------
// SidebarAuth — profile card pinned near the top of the sidebar/drawer.
// Signed in  → avatar + name/email card + icon sign-out (with confirmation).
// Signed out → "Iniciar sesión" button.
// `onAction` lets the mobile drawer close itself when navigating.
// ---------------------------------------------------------------------------

type Props = {
  onAction?: () => void
}

export default function SidebarAuth({ onAction }: Props) {
  const { user, loading, signOut } = useAuth()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const handleSignOut = () => {
    setConfirmOpen(false)
    onAction?.()
    signOut().catch((err: unknown) => {
      console.warn('Error al cerrar sesión:', err)
    })
  }

  if (loading) return null

  if (!user) {
    return (
      <Link
        to="/login"
        onClick={onAction}
        className="block rounded-xl bg-accent px-4 py-2.5 text-center text-sm font-semibold text-bg no-underline shadow-glow transition-transform hover:-translate-y-px"
      >
        Iniciar sesión
      </Link>
    )
  }

  const localPart = user.email?.split('@')[0] ?? 'Cuenta'

  return (
    <>
      <div className="flex items-center gap-2.5 rounded-xl border border-border bg-surface/60 p-2.5">
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent/25 to-accent-2/10 font-display text-sm font-semibold text-accent ring-1 ring-border"
          aria-hidden="true"
        >
          {localPart[0]?.toUpperCase() ?? 'U'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-text">{localPart}</p>
          <p className="truncate text-[11px] text-muted" title={user.email}>
            {user.email}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-border text-muted transition-colors hover:border-error/60 hover:text-error"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="M16 17l5-5-5-5M21 12H9" />
          </svg>
        </button>
      </div>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} labelledBy="signout-title">
        <div className="flex flex-col gap-2">
          <h2 id="signout-title" className="font-display text-xl font-bold text-text">
            ¿Cerrar sesión?
          </h2>
          <p className="text-sm text-muted">Vas a tener que iniciar sesión de nuevo para valorar o postear.</p>
        </div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setConfirmOpen(false)}
            className="rounded-md border border-border px-4 py-2 text-sm text-muted transition-colors hover:text-text"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-md bg-error px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Cerrar sesión
          </button>
        </div>
      </Modal>
    </>
  )
}
