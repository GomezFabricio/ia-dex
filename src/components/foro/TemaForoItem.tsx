import { Link } from 'react-router-dom'
import type { TemaForo } from '../../types/dtos'
import { formatFecha } from '../../lib/date'

// ---------------------------------------------------------------------------
// TemaForoItem — single row in the foro listing.
// Props:
//   tema          — TemaForo row from listarTemasForo
//   currentUserId — from useAuth().user?.id ?? null; null for visitors
// Author label: own content → 'vos', else 'Usuario ' + user_id.slice(0, 8)
// Links to /foro/:id for the full thread view (PR-3).
// ---------------------------------------------------------------------------

type Props = {
  tema: TemaForo
  currentUserId: string | null
}

export default function TemaForoItem({ tema, currentUserId }: Props) {
  const authorLabel =
    currentUserId !== null && tema.user_id === currentUserId
      ? 'vos'
      : `Usuario ${tema.user_id.slice(0, 8)}`

  return (
    <li className="flex flex-col gap-1 py-3 border-b border-surface last:border-0">
      <Link
        to={`/foro/${tema.id}`}
        className="text-accent hover:text-text font-medium transition-colors"
      >
        {tema.titulo}
      </Link>
      <p className="text-muted text-sm">
        {authorLabel} · {formatFecha(tema.created_at)}
      </p>
    </li>
  )
}
