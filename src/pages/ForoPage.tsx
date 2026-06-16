import { useState } from 'react'
import { useForoTemas } from '../hooks/useForoTemas'
import { useAuth } from '../hooks/useAuth'
import { useRequireAuth } from '../hooks/useRequireAuth'
import TemaForoItem from '../components/foro/TemaForoItem'
import Modal from '../components/ui/Modal'

// ---------------------------------------------------------------------------
// ForoPage — listing page for temas_foro.
// Layout: full-width header + two columns on desktop (thread list | aside with
// the "Nuevo tema" CTA + stats). Stacks on mobile. The new-topic form lives in
// a modal so the layout never shifts.
// Visitor access: list is fully readable; writing requires auth (requireAuth).
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
    setFormOpen(true)
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
    } catch {
      // Fixed Spanish copy — never surface the raw service/Postgres message.
      setSubmitError('No se pudo crear el tema. Intentá de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 pt-4">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <p className="dex-label text-[11px] text-accent-2">Comunidad</p>
          <h1 className="font-display text-[clamp(2rem,4.5vw,2.8rem)] font-bold tracking-[-0.02em] text-text">
            Foro
          </h1>
          <p className="text-sm text-muted">Debatí sobre las herramientas del catálogo.</p>
        </div>
        <button
          type="button"
          onClick={handleNuevoTemaClick}
          className="font-display inline-flex items-center gap-2 rounded-[11px] bg-accent px-[18px] py-3 font-semibold text-on-accent shadow-glow transition-transform hover:-translate-y-0.5"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nuevo tema
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_19rem]">
        {/* Main — thread list */}
        <div className="order-2 flex min-w-0 flex-col gap-4 lg:order-1">
          {loading ? (
            <p className="text-muted">Cargando temas…</p>
          ) : error !== null ? (
            <p className="text-error">No se pudieron cargar los temas. Intentá de nuevo.</p>
          ) : temas.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted">
              Todavía no hay temas. ¡Sé el primero en abrir uno!
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {temas.map((tema) => (
                <TemaForoItem key={tema.id} tema={tema} currentUserId={currentUserId} />
              ))}
            </ul>
          )}
        </div>

        {/* Aside — CTA + stats */}
        <aside className="order-1 flex min-w-0 flex-col gap-4 lg:order-2">
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5">
            <h2 className="font-display text-base font-semibold text-text">Iniciá un debate</h2>
            <p className="text-sm text-muted">
              Compartí una duda o recomendación sobre el software del catálogo.
            </p>
            <button
              type="button"
              onClick={handleNuevoTemaClick}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 font-semibold text-bg shadow-glow transition-transform hover:-translate-y-px"
            >
              <span className="text-base leading-none">+</span> Nuevo tema
            </button>
          </div>

          {!loading && error === null && (
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-accent/20 to-accent-2/10 text-accent ring-1 ring-border" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </span>
              <div className="flex flex-col">
                <span className="dex-label text-lg font-semibold text-text">{temas.length}</span>
                <span className="text-xs text-muted">{temas.length === 1 ? 'tema en debate' : 'temas en debate'}</span>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* New-topic modal */}
      <Modal
        open={formOpen && currentUserId !== null}
        onClose={() => setFormOpen(false)}
        labelledBy="nuevo-tema-title"
      >
        <form onSubmit={(e) => { void handleSubmit(e) }} className="flex flex-col gap-4">
          <h2 id="nuevo-tema-title" className="font-display text-xl font-bold text-text">
            Nuevo tema
          </h2>
          <label className="flex flex-col gap-1 text-sm text-muted">
            Título
            <input
              type="text"
              required
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              disabled={enviando}
              className="mt-1 rounded-md border border-border bg-bg px-3 py-2 text-text transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-50"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            Cuerpo (opcional)
            <textarea
              value={cuerpo}
              onChange={(e) => setCuerpo(e.target.value)}
              disabled={enviando}
              rows={4}
              className="mt-1 resize-y rounded-md border border-border bg-bg px-3 py-2 text-text transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-50"
            />
          </label>
          {submitError !== null && <p className="text-sm text-error">{submitError}</p>}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              disabled={enviando}
              className="rounded-md border border-border px-4 py-2 text-sm text-muted transition-colors hover:text-text disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando}
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-bg shadow-glow transition-transform hover:-translate-y-px disabled:opacity-50"
            >
              {enviando ? 'Publicando…' : 'Publicar tema'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
