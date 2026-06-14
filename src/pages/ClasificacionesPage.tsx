import { Link } from 'react-router-dom'
import { useClasificaciones } from '../hooks/useClasificaciones'

// ---------------------------------------------------------------------------
// ClasificacionesPage — lists all clasificaciones as navigable cards
// D4 state pattern: loading / error+retry / empty / data
// ---------------------------------------------------------------------------

export default function ClasificacionesPage() {
  const { data, loading, error, refetch } = useClasificaciones()

  return (
    <div className="flex flex-col gap-6 pt-4">
      <div className="flex flex-col gap-2">
        <p className="dex-label text-[11px] text-accent-2">Clasificaciones · Sistemas inteligentes</p>
        <h1 className="font-display text-[clamp(2rem,4vw,2.75rem)] font-bold tracking-[-0.02em] text-text">
          Categorías de SI
        </h1>
        <p className="text-sm text-muted">Cómo se piensan y se actúan los sistemas inteligentes del curso.</p>
      </div>

      {loading && <p className="text-muted">Cargando…</p>}

      {!loading && error !== null && (
        <div className="flex flex-col gap-2">
          <p className="text-muted">No se pudieron cargar los datos</p>
          <button
            type="button"
            onClick={refetch}
            className="text-accent hover:text-text self-start transition-colors"
          >
            Reintentar
          </button>
        </div>
      )}

      {!loading && error === null && data.length === 0 && (
        <p className="text-muted">No hay clasificaciones disponibles todavía.</p>
      )}

      {!loading && error === null && data.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((clasificacion, i) => (
            <li key={clasificacion.id}>
              <Link
                to={`/clasificaciones/${clasificacion.slug}`}
                className="group flex h-full flex-col gap-2 rounded-xl border border-border bg-surface p-5 no-underline shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/60 hover:shadow-glow"
              >
                <span className="dex-label text-[11px] text-accent-2">{String(i + 1).padStart(2, '0')}</span>
                <span className="font-display text-lg font-semibold text-text transition-colors group-hover:text-accent-strong">
                  {clasificacion.nombre}
                </span>
                <span className="dex-label mt-auto inline-flex items-center gap-1 pt-2 text-[11px] uppercase tracking-wider text-accent transition-transform group-hover:translate-x-0.5">
                  Ver detalle →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
