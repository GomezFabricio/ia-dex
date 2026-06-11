import { useState } from 'react'
import type { ContenidoTipo } from '../../types/dtos'
import { useValoracion } from '../../hooks/useValoracion'
import { useRequireAuth } from '../../hooks/useRequireAuth'

// ---------------------------------------------------------------------------
// StarRating — interactive star-rating widget
// Props: tipo + contenidoId (key={contenidoId} on mount sites handles param reset)
// Design decisions:
//   D2: StarRating reads useValoracion and useRequireAuth; no pending action needed
//   Fill precedence: hover > miVoto > Math.round(promedio)
//   Anon: click → requireAuth() → /login; miVoto always null for anon
//   Saving: stars disabled (disabled={saving||loading}); opacity-50 on button row
//   Save error: inline text-error below stars; stars remain visible
//   Load error: text-error + Reintentar button, no stars
// ---------------------------------------------------------------------------

const formatLabel = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

type Props = {
  tipo: ContenidoTipo
  contenidoId: string
}

export default function StarRating({ tipo, contenidoId }: Props) {
  const { promedio, cantidad, miVoto, loading, saving, error, guardar, refetch } =
    useValoracion(tipo, contenidoId)
  const requireAuth = useRequireAuth()

  const [hover, setHover] = useState<number | null>(null)

  // Loading state — data not yet available (first load)
  if (loading && cantidad === 0 && miVoto === null && !saving) {
    return (
      <div className="flex items-center gap-2 text-muted text-sm" aria-busy="true">
        <span className="animate-pulse">★★★★★</span>
        <span>Cargando valoración…</span>
      </div>
    )
  }

  // Load error state — initial fetch failed (no data loaded yet)
  if (error !== null && !loading && !saving && promedio === 0 && cantidad === 0) {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-error text-sm">No se pudo cargar la valoración.</p>
        <button
          type="button"
          onClick={refetch}
          className="text-accent hover:text-text text-sm self-start transition-colors"
        >
          Reintentar
        </button>
      </div>
    )
  }

  const fillCount = hover ?? miVoto ?? Math.round(promedio)

  const handleClick = (n: number) => {
    const user = requireAuth()
    if (!user) return
    guardar(n)
  }

  const votoLabel = (n: number) => (n === 1 ? 'Valorar con 1 estrella' : `Valorar con ${n} estrellas`)

  const voteCountLabel =
    cantidad === 0
      ? 'Sin valoraciones'
      : cantidad === 1
        ? `${formatLabel.format(promedio)} (1 voto)`
        : `${formatLabel.format(promedio)} (${cantidad} votos)`

  return (
    <div className="flex flex-col gap-1">
      <div className={`flex items-center gap-1 ${saving ? 'opacity-50' : ''}`}>
        {[1, 2, 3, 4, 5].map((n) => {
          const isFilled = n <= fillCount
          const isOwnVote = miVoto !== null && n === miVoto
          const colorClass = isFilled
            ? isOwnVote
              ? 'text-accent font-bold'
              : 'text-accent'
            : 'text-muted'

          return (
            <button
              key={n}
              type="button"
              aria-label={votoLabel(n)}
              disabled={saving || loading}
              className={`text-2xl leading-none transition-colors cursor-pointer disabled:cursor-default ${colorClass}`}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(null)}
              onClick={() => handleClick(n)}
            >
              ★
            </button>
          )
        })}
        <span className="text-muted text-sm ml-1">{voteCountLabel}</span>
      </div>

      {/* Save error — inline, stars remain visible */}
      {error !== null && (
        <p className="text-error text-sm">No se pudo guardar la valoración. Intentá de nuevo.</p>
      )}
    </div>
  )
}
