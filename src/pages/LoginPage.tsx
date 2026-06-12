import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Logo from '../components/layout/Logo'

// ---------------------------------------------------------------------------
// AuthError code → Spanish message map (design D7)
// ---------------------------------------------------------------------------

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Correo o contraseña incorrectos.',
  user_already_exists: 'Ya existe una cuenta con este correo.',
  email_exists: 'Ya existe una cuenta con este correo.',
  weak_password: 'La contraseña debe tener al menos 6 caracteres.',
}

const FALLBACK_ERROR = 'Ocurrió un error. Intenta de nuevo.'

function mapAuthError(code: string | undefined): string {
  if (!code) return FALLBACK_ERROR
  return AUTH_ERROR_MESSAGES[code] ?? FALLBACK_ERROR
}

// ---------------------------------------------------------------------------
// LoginPage
// ---------------------------------------------------------------------------

type Mode = 'signin' | 'signup'

export default function LoginPage() {
  const navigate = useNavigate()

  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function toggleMode() {
    setMode(m => (m === 'signin' ? 'signup' : 'signin'))
    setErrorMsg(null)
  }

  // Full-page redirect to Google via Supabase OAuth. On return, supabase-js
  // detects the session in the URL and AuthContext picks it up through
  // onAuthStateChange — no navigate() needed here.
  async function handleGoogle() {
    setSubmitting(true)
    setErrorMsg(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    // Only reached on failure — success navigates away from the page.
    if (error) {
      setErrorMsg(mapAuthError(error.code))
      setSubmitting(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setErrorMsg(null)

    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
          setErrorMsg(mapAuthError(error.code))
          return
        }
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) {
          setErrorMsg(mapAuthError(error.code))
          return
        }
        // autoconfirm is ON — signUp returns an active session immediately (ruling #4)
        // onAuthStateChange fires with SIGNED_IN; navigate right away
      }

      navigate('/', { replace: true })
    } finally {
      setSubmitting(false)
    }
  }

  const isSignIn = mode === 'signin'
  const heading = isSignIn ? 'Iniciar sesión' : 'Registrarse'
  const submitLabel = isSignIn ? 'Ingresar' : 'Crear cuenta'
  const toggleLabel = isSignIn
    ? '¿No tenés cuenta? Registrate'
    : '¿Ya tenés cuenta? Iniciá sesión'

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
        <h1 className="text-center font-display text-2xl font-semibold text-text">{heading}</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-muted text-sm">
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="bg-bg border border-border text-text rounded-lg px-3 py-2 placeholder:text-muted transition-colors focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
              placeholder="tu@correo.com"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-muted text-sm">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete={isSignIn ? 'current-password' : 'new-password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
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
            {submitting ? 'Cargando...' : submitLabel}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-border" />
          <span className="text-muted text-xs">o</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={submitting}
          className="flex items-center justify-center gap-2 rounded-lg border border-border bg-bg py-2 text-sm font-medium text-text transition-colors hover:border-accent disabled:opacity-50"
        >
          {/* Google "G" mark */}
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.57 5.57 0 0 1-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.27 14.29A7.18 7.18 0 0 1 4.89 12c0-.8.14-1.57.38-2.29V6.62H1.29a11.99 11.99 0 0 0 0 10.76l3.98-3.09z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0A11.99 11.99 0 0 0 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
            />
          </svg>
          Continuar con Google
        </button>

        <button
          type="button"
          onClick={toggleMode}
          className="text-muted text-sm text-center hover:text-text transition-colors"
        >
          {toggleLabel}
        </button>
      </div>
    </div>
  )
}
