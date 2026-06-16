import type { MensajeForoConAutor } from '../../types/dtos'
import { formatFecha } from '../../lib/date'
import { hueFor, washFor } from '../../lib/hue'

// ---------------------------------------------------------------------------
// MensajeItem — single reply in a foro thread (cine-neural).
// Wash avatar (from user_id) + author + date header, then the message body.
// Delete button: rendered when the viewer OWNS the message (currentUserId ===
// mensaje.user_id) OR is an admin (moderation of inappropriate replies). Fires
// raw mensaje.id; the page owns the confirm + service call (design D6). RLS
// enforces the same author-OR-admin rule server-side.
// ---------------------------------------------------------------------------

type Props = {
  mensaje: MensajeForoConAutor
  currentUserId: string | null
  isAdmin: boolean
  onEliminar: (id: string) => void
}

export default function MensajeItem({ mensaje, currentUserId, isAdmin, onEliminar }: Props) {
  const isOwn = currentUserId !== null && mensaje.user_id === currentUserId
  const authorLabel = isOwn ? 'vos' : mensaje.autorNombre
  const wash = washFor(hueFor(mensaje.user_id))
  const initial = (isOwn ? 'V' : mensaje.autorNombre.charAt(0)).toUpperCase()

  return (
    <li className="flex gap-3.5 rounded-2xl border border-border bg-surface/50 p-4">
      <span
        className="font-display grid h-[42px] w-[42px] shrink-0 place-items-center rounded-xl border border-border text-[14px] font-bold text-[#EAEDFB]"
        style={{ background: wash }}
        aria-hidden="true"
      >
        {initial}
      </span>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex flex-wrap items-baseline gap-2">
          <span className="font-display text-sm font-semibold text-text">{authorLabel}</span>
          <span className="dex-label min-w-0 break-words text-[9px] text-faint">{formatFecha(mensaje.created_at)}</span>
          {(isOwn || isAdmin) && (
            <button
              type="button"
              onClick={() => onEliminar(mensaje.id)}
              className="ml-auto shrink-0 text-xs text-error transition-opacity hover:opacity-80"
            >
              Eliminar
            </button>
          )}
        </div>
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-text">{mensaje.contenido}</p>
      </div>
    </li>
  )
}
