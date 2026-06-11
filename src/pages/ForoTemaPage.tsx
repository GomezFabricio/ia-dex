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
// Layout: tema header (titulo, author, date, cuerpo) + mensajes list + responder.
// Responder: visible only to authenticated users; empty contenido blocked.
// Delete handlers (design D5, D6):
//   - Mensaje: window.confirm('¿Eliminar este mensaje?') → eliminarMensaje → refetch.
//   - Tema: window.confirm('¿Eliminar este tema y todas sus respuestas?') →
//     eliminarTemaForo → navigate('/foro'). Button visible only if currentUser owns tema.
// States: loading, not-found (tema null), error, thread.
// All error strings are fixed Spanish — never exposes error.message (spec).
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
    return (
      <div className="max-w-2xl mx-auto py-6 px-4">
        <p className="text-muted">Cargando...</p>
      </div>
    )
  }

  if (error !== null) {
    return (
      <div className="max-w-2xl mx-auto py-6 px-4">
        <p className="text-error">No se pudo cargar el tema. Intentá de nuevo.</p>
        <Link to="/foro" className="text-accent hover:opacity-80 transition-opacity text-sm mt-2 inline-block">
          ← Volver al foro
        </Link>
      </div>
    )
  }

  if (tema === null) {
    return (
      <div className="max-w-2xl mx-auto py-6 px-4 flex flex-col gap-3">
        <p className="text-muted">Tema no encontrado.</p>
        <Link to="/foro" className="text-accent hover:opacity-80 transition-opacity text-sm">
          ← Volver al foro
        </Link>
      </div>
    )
  }

  const temaIsOwn = currentUserId !== null && tema.user_id === currentUserId
  const temaAuthorLabel =
    temaIsOwn ? 'vos' : `Usuario ${tema.user_id.slice(0, 8)}`

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto py-6 px-4">
      {/* Back link */}
      <Link to="/foro" className="text-accent hover:opacity-80 transition-opacity text-sm w-fit">
        ← Volver al foro
      </Link>

      {/* Tema header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-bold text-text">{tema.titulo}</h1>
          {temaIsOwn && (
            <button
              type="button"
              onClick={() => { void handleEliminarTema() }}
              disabled={eliminandoTema}
              className="text-error text-sm hover:opacity-80 transition-opacity disabled:opacity-50 shrink-0"
            >
              {eliminandoTema ? 'Eliminando…' : 'Eliminar tema'}
            </button>
          )}
        </div>
        <p className="text-muted text-sm">
          {temaAuthorLabel} · {formatFecha(tema.created_at)}
        </p>
        {tema.cuerpo !== null && tema.cuerpo !== '' && (
          <p className="text-text mt-2 whitespace-pre-wrap">{tema.cuerpo}</p>
        )}
      </div>

      {/* Mensajes list */}
      <section className="flex flex-col gap-0">
        <h2 className="text-lg font-semibold text-text mb-2">
          {mensajes.length === 0 ? 'Sin respuestas' : `${mensajes.length} respuesta${mensajes.length !== 1 ? 's' : ''}`}
        </h2>
        {mensajes.length > 0 && (
          <ul>
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
          className="flex flex-col gap-3 p-4 bg-surface rounded"
        >
          <label className="flex flex-col gap-1 text-sm text-muted">
            Tu respuesta
            <textarea
              value={contenido}
              onChange={(e) => setContenido(e.target.value)}
              disabled={enviando}
              rows={4}
              required
              className="mt-1 px-3 py-2 bg-bg border border-muted rounded text-text focus:outline-none focus:border-accent disabled:opacity-50 resize-y"
            />
          </label>
          {responderError !== null && (
            <p className="text-error text-sm">{responderError}</p>
          )}
          <button
            type="submit"
            disabled={enviando}
            className="px-4 py-2 bg-accent text-bg rounded font-medium hover:opacity-90 transition-opacity disabled:opacity-50 w-fit"
          >
            {enviando ? 'Publicando…' : 'Responder'}
          </button>
        </form>
      )}
    </div>
  )
}
