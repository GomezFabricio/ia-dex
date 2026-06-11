import { Link } from 'react-router-dom'
import type { TemaForo } from '../../types/dtos'
import { formatFecha } from '../../lib/date'

// ---------------------------------------------------------------------------
// TemaForoItem — single thread card in the foro listing.
// Props:
//   tema          — TemaForo row from listarTemasForo
//   currentUserId — from useAuth().user?.id ?? null; null for visitors
// Author label: own content → 'vos', else 'Usuario ' + user_id.slice(0, 8)
// Links to /foro/:id for the full thread view.
// ---------------------------------------------------------------------------

type Props = {
  tema: TemaForo
  currentUserId: string | null
}

export default function TemaForoItem({ tema, currentUserId }: Props) {
  const isOwn = currentUserId !== null && tema.user_id === currentUserId
  const authorLabel = isOwn ? 'vos' : `Usuario ${tema.user_id.slice(0, 8)}`

  return (
    <li>
      <Link
        to={`/foro/${tema.id}`}
        className="group flex items-start gap-3 rounded-xl border border-border bg-surface p-4 no-underline shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/60 hover:shadow-glow"
      >
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-accent/20 to-accent-2/10 text-accent ring-1 ring-border"
          aria-hidden="true"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-display font-semibold text-text transition-colors group-hover:text-accent-strong">
            {tema.titulo}
          </span>
          <span className="dex-label text-[11px] text-muted">
            {authorLabel} · {formatFecha(tema.created_at)}
          </span>
        </div>
      </Link>
    </li>
  )
}
