import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import Logo from '../components/layout/Logo'

// ---------------------------------------------------------------------------
// RestablecerPage — password reset landing page.
//
// The recovery email links here: supabase-js detects the recovery token in the
// URL (detectSessionInUrl) and fires a PASSWORD_RECOVERY event, which AuthContext
// latches as `passwordRecovery`. The password form renders ONLY during that
// recovery flow — never for a normal logged-in session that navigates here (X3).
// Anything else (expired/used link, direct visit, ordinary session) shows a
// friendly dead-end with a way back to /login.
// ---------------------------------------------------------------------------

const RESET_ERROR_MESSAGES: Record<string, string> = {
  weak_password: 'La contraseña debe tener al menos 6 caracteres.',
  same_password: 'La nueva contraseña debe ser distinta a la anterior.',
}

const FALLBACK_ERROR = 'Ocurrió un error. Intenta de nuevo.'

export default function RestablecerPage() {
  const { loading, passwordRecovery } = useAuth()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)

    if (password !== confirm) {
      setErrorMsg('Las contraseñas no coinciden.')
      return
    }

    setSubmitting(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        setErrorMsg(
          (error.code && RESET_ERROR_MESSAGES[error.code]) ?? FALLBACK_ERROR,
        )
        return
      }
      setDone(true)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-bg p-4">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 bg-[radial-gradient(50%_100%_at_50%_0%,color-mix(in_oklab,var(--color-accent)_22%,transparent),transparent)]"
      />
      <div
        aria-hidden="true"
        className="dex-grid pointer-events-none absolute inset-0 -z-10 opacity-30 [mask-image:radial-gradient(60%_60%_at_50%_30%,black,transparent)]"
      />
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-2xl border border-border bg-surface/90 p-8 shadow-pop backdrop-blur-sm">
        <Link to="/" className="self-center no-underline" aria-label="IA-dex — inicio">
          <Logo />
        </Link>
        <h1 className="text-center font-display text-2xl font-semibold text-text">
          Restablecer contraseña
        </h1>

        {loading && <p className="text-center text-muted">Cargando...</p>}

        {/* Not a recovery flow: expired/used link, direct visit, or ordinary session */}
        {!loading && !passwordRecovery && (
          <div className="flex flex-col gap-4 text-center">
            <p className="text-muted">
              El enlace de recuperación no es válido o ya venció. Pedí uno nuevo
              desde la pantalla de inicio de sesión.
            </p>
            <Link
              to="/login"
              className="text-accent hover:text-text transition-colors"
            >
              Volver a iniciar sesión
            </Link>
          </div>
        )}

        {!loading && passwordRecovery && done && (
          <div className="flex flex-col gap-4 text-center">
            <p className="text-text">Tu contraseña fue actualizada.</p>
            <Link
              to="/"
              className="bg-accent text-bg font-semibold rounded-lg py-2 shadow-glow hover:-translate-y-px transition-transform no-underline"
            >
              Ir al inicio
            </Link>
          </div>
        )}

        {!loading && passwordRecovery && !done && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="new-password" className="text-muted text-sm">
                Nueva contraseña
              </label>
              <input
                id="new-password"
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-bg border border-border text-text rounded-lg px-3 py-2 placeholder:text-muted transition-colors focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
                placeholder="••••••••"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="confirm-password" className="text-muted text-sm">
                Repetir contraseña
              </label>
              <input
                id="confirm-password"
                type="password"
                required
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="bg-bg border border-border text-text rounded-lg px-3 py-2 placeholder:text-muted transition-colors focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
                placeholder="••••••••"
              />
            </div>

            {errorMsg && (
              <p role="alert" className="text-sm text-error">
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="bg-accent text-bg font-semibold rounded-lg py-2 shadow-glow hover:-translate-y-px disabled:translate-y-0 disabled:opacity-50 transition-transform"
            >
              {submitting ? 'Guardando...' : 'Guardar contraseña'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
