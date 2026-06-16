import { Link } from 'react-router-dom'
import type { TemaForoConAutor } from '../../types/dtos'
import { formatFecha } from '../../lib/date'
import { hueFor, washFor } from '../../lib/hue'
import { scopeLabel } from '../../lib/foroScope'

// ---------------------------------------------------------------------------
// TemaForoItem — single thread card in the foro listing (cine-neural).
// A wash avatar (derived from user_id) + title + author + date + chevron.
// Author label: own content → 'vos', else the resolved autorNombre. Links to
// /foro/:id.
// ---------------------------------------------------------------------------

type Props = {
  tema: TemaForoConAutor
  currentUserId: string | null
}

export default function TemaForoItem({ tema, currentUserId }: Props) {
  const isOwn = currentUserId !== null && tema.user_id === currentUserId
  const authorLabel = isOwn ? 'vos' : tema.autorNombre
  const wash = washFor(hueFor(tema.user_id))
  const initial = (isOwn ? 'V' : tema.autorNombre.charAt(0)).toUpperCase()

  return (
    <li>
      <Link
        to={`/foro/${tema.id}`}
        className="qtile group flex items-center gap-4 rounded-2xl border border-border bg-surface/55 p-5 no-underline transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/60 hover:shadow-glow"
      >
        <span
          className="font-display grid h-[46px] w-[46px] shrink-0 place-items-center rounded-xl border border-border text-[15px] font-bold text-[#EAEDFB]"
          style={{ background: wash }}
          aria-hidden="true"
        >
          {initial}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h2 className="font-display truncate text-[17px] font-semibold tracking-[-0.01em] text-text transition-colors group-hover:text-accent-strong">
            {tema.titulo}
          </h2>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-sm text-muted">{authorLabel}</span>
            <span className="dex-label text-[9px] text-faint">{formatFecha(tema.created_at)}</span>
            {tema.scope !== null && (
              <span className="dex-label rounded-full border border-accent/35 bg-accent/[0.12] px-2 py-0.5 text-[9px] text-accent-strong">
                {scopeLabel(tema.scope.tipo)} · {tema.scope.nombre}
              </span>
            )}
          </div>
        </div>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted" aria-hidden="true">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </Link>
    </li>
  )
}
