import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useForoTemas } from '../hooks/useForoTemas'
import { useAuth } from '../hooks/useAuth'
import { useRequireAuth } from '../hooks/useRequireAuth'
import TemaForoItem from '../components/foro/TemaForoItem'
import ForoScopeSelector, { type ScopeValue } from '../components/foro/ForoScopeSelector'
import Modal from '../components/ui/Modal'
import { scopeHref, scopeLabel } from '../lib/foroScope'
import type { ForoScopeTipo } from '../types/dtos'

// ---------------------------------------------------------------------------
// ForoPage — listing page for temas_foro.
// Layout: full-width header + two columns on desktop (thread list | aside with
// the "Nuevo tema" CTA + stats). Stacks on mobile. The new-topic form lives in
// a modal so the layout never shifts.
// Scope: a ?scope_tipo=&scope_id= query filters the list to debates about one
// catalog entity (a herramienta, tema or sí) and pre-selects it in the create
// modal. No params → the full, general listing.
// Visitor access: list is fully readable; writing requires auth (requireAuth).
// States: loading, empty, error, list.
// ---------------------------------------------------------------------------

// Narrow the raw query-param string to a valid scope dimension (or null).
function parseScopeTipo(raw: string | null): ForoScopeTipo | null {
  return raw === 'software' || raw === 'tema' || raw === 'clasificacion_si' ? raw : null
}

export default function ForoPage() {
  const [searchParams] = useSearchParams()
  const filtroTipo = parseScopeTipo(searchParams.get('scope_tipo'))
  const filtroId = searchParams.get('scope_id')

  const { temas, loading, error, crear, scope } = useForoTemas(filtroTipo, filtroId)
  const { user } = useAuth()
  const requireAuth = useRequireAuth()

  const currentUserId = user?.id ?? null

  // Form state
  const [formOpen, setFormOpen] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [cuerpo, setCuerpo] = useState('')
  const [scopeValue, setScopeValue] = useState<ScopeValue>({ tipo: null, id: null })
  const [enviando, setEnviando] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const handleNuevoTemaClick = () => {
    const authed = requireAuth()
    if (!authed) return
    // Pre-fill the scope from the active filter (e.g. opened from a tool's page).
    setScopeValue(
      filtroTipo !== null && filtroId !== null && filtroId !== ''
        ? { tipo: filtroTipo, id: filtroId }
        : { tipo: null, id: null },
    )
    setSubmitError(null)
    setFormOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const trimmedTitulo = titulo.trim()
    if (!trimmedTitulo) return

    // A chosen dimension requires a concrete entity.
    if (scopeValue.tipo !== null && (scopeValue.id === null || scopeValue.id === '')) {
      setSubmitError('Elegí la herramienta, tema o clasificación sobre la que querés debatir.')
      return
    }

    setEnviando(true)
    setSubmitError(null)

    try {
      await crear({
        titulo: trimmedTitulo,
        cuerpo: cuerpo.trim() || undefined,
        software_id: scopeValue.tipo === 'software' ? scopeValue.id : null,
        tema_id: scopeValue.tipo === 'tema' ? scopeValue.id : null,
        clasificacion_si_id: scopeValue.tipo === 'clasificacion_si' ? scopeValue.id : null,
      })
      setTitulo('')
      setCuerpo('')
      setScopeValue({ tipo: null, id: null })
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
          <p className="text-sm text-muted">Debatí sobre las herramientas, temas y clasificaciones del catálogo.</p>
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

      {/* Active-filter banner — shown when the list is scoped to one entity */}
      {scope !== null && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent/30 bg-accent/[0.08] px-4 py-3">
          <div className="flex flex-wrap items-center gap-2.5 text-sm">
            <span className="dex-label rounded-full border border-accent/35 bg-accent/[0.15] px-2.5 py-1 text-[10px] text-accent-strong">
              {scopeLabel(scope.tipo)}
            </span>
            <span className="font-semibold text-text">{scope.nombre}</span>
            <Link to={scopeHref(scope)} className="text-accent-2 no-underline transition-colors hover:text-text">
              Ver ficha →
            </Link>
          </div>
          <Link to="/foro" className="text-sm text-muted no-underline transition-colors hover:text-text">
            ✕ Ver todo el foro
          </Link>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_19rem]">
        {/* Main — thread list */}
        <div className="order-2 flex min-w-0 flex-col gap-4 lg:order-1">
          {loading ? (
            <p className="text-muted">Cargando temas…</p>
          ) : error !== null ? (
            <p className="text-error">No se pudieron cargar los temas. Intentá de nuevo.</p>
          ) : temas.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted">
              {scope !== null
                ? `Todavía no hay debates sobre ${scope.nombre}. ¡Abrí el primero!`
                : 'Todavía no hay temas. ¡Sé el primero en abrir uno!'}
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
              Compartí una duda o recomendación. Podés enfocarlo en una herramienta, un tema o una clasificación.
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
          {/* Scope picker — mounted only while the modal is open (lazy catalog fetch). */}
          {formOpen && (
            <ForoScopeSelector value={scopeValue} onChange={setScopeValue} disabled={enviando} />
          )}
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
