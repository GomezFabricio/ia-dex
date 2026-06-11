import { useState } from 'react'
import { useForoTemas } from '../hooks/useForoTemas'
import { useAuth } from '../hooks/useAuth'
import { useRequireAuth } from '../hooks/useRequireAuth'
import TemaForoItem from '../components/foro/TemaForoItem'

// ---------------------------------------------------------------------------
// ForoPage — listing page for temas_foro.
// Visitor access: list is fully readable without auth prompt (spec SC-01).
// 'Nuevo tema' button:
//   - Anon:  calls requireAuth() → navigates to /login, form never opens.
//   - Auth:  toggles inline form with titulo (required) + cuerpo (optional).
// Form: controlled state, trim validation on submit, enviando flag.
//   On success: crear() → list refetches → form collapses + clears.
// States: loading, empty, error, list.
// ---------------------------------------------------------------------------

export default function ForoPage() {
  const { temas, loading, error, crear } = useForoTemas()
  const { user } = useAuth()
  const requireAuth = useRequireAuth()

  const currentUserId = user?.id ?? null

  // Form state
  const [formOpen, setFormOpen] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [cuerpo, setCuerpo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const handleNuevoTemaClick = () => {
    const authed = requireAuth()
    if (!authed) return
    setFormOpen((prev) => !prev)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const trimmedTitulo = titulo.trim()
    if (!trimmedTitulo) return

    setEnviando(true)
    setSubmitError(null)

    try {
      await crear({ titulo: trimmedTitulo, cuerpo: cuerpo.trim() || undefined })
      setTitulo('')
      setCuerpo('')
      setFormOpen(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setSubmitError(`No se pudo crear el tema: ${msg}`)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto py-6 px-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text">Foro</h1>
        <button
          type="button"
          onClick={handleNuevoTemaClick}
          className="px-4 py-2 bg-accent text-bg rounded font-medium hover:opacity-90 transition-opacity"
        >
          Nuevo tema
        </button>
      </div>

      {/* Inline form — only rendered when user authenticated and toggled */}
      {formOpen && currentUserId !== null && (
        <form
          onSubmit={(e) => { void handleSubmit(e) }}
          className="flex flex-col gap-3 p-4 bg-surface rounded"
        >
          <label className="flex flex-col gap-1 text-sm text-muted">
            Título
            <input
              type="text"
              required
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              disabled={enviando}
              className="mt-1 px-3 py-2 bg-bg border border-muted rounded text-text focus:outline-none focus:border-accent disabled:opacity-50"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            Cuerpo (opcional)
            <textarea
              value={cuerpo}
              onChange={(e) => setCuerpo(e.target.value)}
              disabled={enviando}
              rows={4}
              className="mt-1 px-3 py-2 bg-bg border border-muted rounded text-text focus:outline-none focus:border-accent disabled:opacity-50 resize-y"
            />
          </label>
          {submitError !== null && (
            <p className="text-error text-sm">{submitError}</p>
          )}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={enviando}
              className="px-4 py-2 bg-accent text-bg rounded font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {enviando ? 'Publicando…' : 'Publicar tema'}
            </button>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              disabled={enviando}
              className="px-4 py-2 text-muted hover:text-text transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* List states */}
      {loading ? (
        <p className="text-muted">Cargando temas...</p>
      ) : error !== null ? (
        <p className="text-error">{error}</p>
      ) : temas.length === 0 ? (
        <p className="text-muted">No hay temas todavía.</p>
      ) : (
        <ul className="divide-y divide-surface">
          {temas.map((tema) => (
            <TemaForoItem
              key={tema.id}
              tema={tema}
              currentUserId={currentUserId}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
