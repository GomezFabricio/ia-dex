import type { MensajeForo } from '../../types/dtos'
import { formatFecha } from '../../lib/date'

// ---------------------------------------------------------------------------
// MensajeItem — single message row in a foro thread.
// Props:
//   mensaje       — MensajeForo row from listarMensajes
//   currentUserId — from useAuth().user?.id ?? null; null for visitors
//   onEliminar    — fires raw mensaje.id; page owns confirm + service call (design D6)
// Author label: own content → 'vos', else 'Usuario ' + user_id.slice(0, 8)
// Delete button: rendered ONLY when currentUserId === mensaje.user_id
// ---------------------------------------------------------------------------

type Props = {
  mensaje: MensajeForo
  currentUserId: string | null
  onEliminar: (id: string) => void
}

export default function MensajeItem({ mensaje, currentUserId, onEliminar }: Props) {
  const isOwn = currentUserId !== null && mensaje.user_id === currentUserId
  const authorLabel = isOwn ? 'vos' : `Usuario ${mensaje.user_id.slice(0, 8)}`

  return (
    <li className="flex flex-col gap-2 py-4 border-b border-surface last:border-0">
      <div className="flex items-start justify-between gap-4">
        <p className="text-text flex-1">{mensaje.contenido}</p>
        {isOwn && (
          <button
            type="button"
            onClick={() => onEliminar(mensaje.id)}
            className="text-error text-sm hover:opacity-80 transition-opacity shrink-0"
          >
            Eliminar
          </button>
        )}
      </div>
      <p className="text-muted text-xs">
        {authorLabel} · {formatFecha(mensaje.created_at)}
      </p>
    </li>
  )
}
