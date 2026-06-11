import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { useAuth } from '../hooks/useAuth'
import Modal from '../components/ui/Modal'
import { RequireAuthContext } from './require-auth-context'

// ---------------------------------------------------------------------------
// RequireAuthProvider — owns the "sign in to continue" modal and exposes
// requireAuth() to descendants. Anonymous write attempts (valorar, foro) open
// the modal instead of a hard redirect, so the user keeps their place.
// Mounted inside AppLayout so it has both router and auth context.
// ---------------------------------------------------------------------------

export function RequireAuthProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const requireAuth = useCallback((): User | null => {
    if (user) return user
    setOpen(true)
    return null
  }, [user])

  const goToLogin = () => {
    setOpen(false)
    navigate('/login')
  }

  return (
    <RequireAuthContext.Provider value={requireAuth}>
      {children}

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="auth-modal-title">
        <div className="flex flex-col gap-2">
          <h2 id="auth-modal-title" className="font-display text-xl font-bold text-text">
            Necesitás iniciar sesión
          </h2>
          <p className="text-sm text-muted">
            Para valorar contenido o participar en el foro tenés que tener una sesión activa.
            Explorar el catálogo es libre.
          </p>
        </div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md border border-border px-4 py-2 text-sm text-muted transition-colors hover:text-text"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={goToLogin}
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-bg shadow-glow transition-transform hover:-translate-y-px"
          >
            Iniciar sesión
          </button>
        </div>
      </Modal>
    </RequireAuthContext.Provider>
  )
}
