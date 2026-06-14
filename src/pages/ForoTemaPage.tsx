import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useForoTema } from '../hooks/useForoTema'
import { useAuth } from '../hooks/useAuth'
import MensajeItem from '../components/foro/MensajeItem'
import { formatFecha } from '../lib/date'
import * as foroService from '../services/foroService'

// ---------------------------------------------------------------------------
// ForoTemaPage — full thread view for a single TemaForo.
// Route: /foro/:id
//
// Layout: full-width back link + two columns on desktop (conversation | stats
// aside). Stacks on mobile (aside hidden). Tema header + mensajes + responder.
// Responder: visible only to authenticated users; empty contenido blocked.
// Delete handlers (design D5, D6) via window.confirm. States: loading,
// not-found, error, thread. All error strings are fixed Spanish.
// ---------------------------------------------------------------------------

export default function ForoTemaPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const currentUserId = user?.id ?? null

  const { tema, mensajes, loading, error, refetch } = useForoTema(id ?? '')

  // Responder form state
  const [contenido, setContenido] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [responderError, setResponderError] = useState<string | null>(null)

  // Tema delete state
  const [eliminandoTema, setEliminandoTema] = useState(false)

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleResponder = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!tema || !id) return
    const trimmed = contenido.trim()
    if (!trimmed) return

    setEnviando(true)
    setResponderError(null)

    try {
      await foroService.crearMensaje({ tema_foro_id: id, contenido: trimmed })
      setContenido('')
      refetch()
    } catch {
      setResponderError('No se pudo publicar la respuesta. Intentá de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  const handleEliminarMensaje = async (mensajeId: string) => {
    if (!window.confirm('¿Eliminar este mensaje?')) return
    try {
      await foroService.eliminarMensaje(mensajeId)
      refetch()
    } catch {
      // Non-blocking: refetch will reflect truth; UI stays consistent.
    }
  }

  const handleEliminarTema = async () => {
    if (!id) return
    if (!window.confirm('¿Eliminar este tema y todas sus respuestas?')) return

    setEliminandoTema(true)
    try {
      await foroService.eliminarTemaForo(id)
      navigate('/foro')
    } catch {
      setEliminandoTema(false)
    }
  }

  // -------------------------------------------------------------------------
  // Render states
  // -------------------------------------------------------------------------

  if (loading) {
    return <p className="text-muted">Cargando…</p>
  }

  if (error !== null) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-error">No se pudo cargar el tema. Intentá de nuevo.</p>
        <Link to="/foro" className="w-fit text-sm text-accent transition-opacity hover:opacity-80">
          ← Volver al foro
        </Link>
      </div>
    )
  }

  if (tema === null) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-muted">Tema no encontrado.</p>
        <Link to="/foro" className="w-fit text-sm text-accent transition-opacity hover:opacity-80">
          ← Volver al foro
        </Link>
      </div>
    )
  }

  const temaIsOwn = currentUserId !== null && tema.user_id === currentUserId
  const temaAuthorLabel = temaIsOwn ? 'vos' : `Usuario ${tema.user_id.slice(0, 8)}`

  return (
    <div className="flex flex-col gap-6">
      {/* Back link */}
      <Link to="/foro" className="w-fit text-sm text-accent transition-opacity hover:opacity-80">
        ← Volver al foro
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_19rem]">
        {/* Main — conversation */}
        <div className="order-1 flex flex-col gap-6">
          {/* Tema header */}
          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-5">
            <div className="flex items-start justify-between gap-4">
              <h1 className="font-display text-2xl font-bold text-text">{tema.titulo}</h1>
              {temaIsOwn && (
                <button
                  type="button"
                  onClick={() => { void handleEliminarTema() }}
                  disabled={eliminandoTema}
                  className="shrink-0 text-sm text-error transition-opacity hover:opacity-80 disabled:opacity-50"
                >
                  {eliminandoTema ? 'Eliminando…' : 'Eliminar tema'}
                </button>
              )}
            </div>
            <p className="dex-label text-[11px] text-muted">
              {temaAuthorLabel} · {formatFecha(tema.created_at)}
            </p>
            {tema.cuerpo !== null && tema.cuerpo !== '' && (
              <p className="mt-2 whitespace-pre-wrap text-text">{tema.cuerpo}</p>
            )}
          </div>

          {/* Mensajes list */}
          <section className="flex flex-col gap-3">
            <h2 className="font-display flex items-center gap-2.5 text-lg font-semibold text-text">
              <span className="h-4 w-1 shrink-0 rounded-full bg-gradient-to-b from-accent to-accent-2" aria-hidden="true" />
              {mensajes.length === 0 ? 'Sin respuestas' : `${mensajes.length} respuesta${mensajes.length !== 1 ? 's' : ''}`}
            </h2>
            {mensajes.length > 0 && (
              <ul className="flex flex-col gap-3">
                {mensajes.map((msg) => (
                  <MensajeItem
                    key={msg.id}
                    mensaje={msg}
                    currentUserId={currentUserId}
                    onEliminar={(msgId) => { void handleEliminarMensaje(msgId) }}
                  />
                ))}
              </ul>
            )}
          </section>

          {/* Responder form — authenticated users only */}
          {currentUserId !== null && (
            <form
              onSubmit={(e) => { void handleResponder(e) }}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5"
            >
              <label className="flex flex-col gap-1 text-sm text-muted">
                Tu respuesta
                <textarea
                  value={contenido}
                  onChange={(e) => setContenido(e.target.value)}
                  disabled={enviando}
                  rows={4}
                  required
                  className="mt-1 resize-y rounded-md border border-border bg-bg px-3 py-2 text-text transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-50"
                />
              </label>
              {responderError !== null && <p className="text-sm text-error">{responderError}</p>}
              <button
                type="submit"
                disabled={enviando}
                className="w-fit rounded-md bg-accent px-4 py-2 text-sm font-semibold text-bg shadow-glow transition-transform hover:-translate-y-px disabled:opacity-50"
              >
                {enviando ? 'Publicando…' : 'Responder'}
              </button>
            </form>
          )}
        </div>

        {/* Aside — stats (desktop) */}
        <aside className="order-2 hidden flex-col gap-4 lg:flex">
          <div className="flex flex-col gap-0.5 rounded-2xl border border-border bg-surface p-5">
            <span className="dex-label text-3xl font-bold text-text">{mensajes.length}</span>
            <span className="text-sm text-muted">{mensajes.length === 1 ? 'respuesta' : 'respuestas'}</span>
          </div>
          {currentUserId === null && (
            <div className="rounded-2xl border border-border bg-surface p-5 text-sm text-muted">
              Iniciá sesión para sumarte al debate.
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
