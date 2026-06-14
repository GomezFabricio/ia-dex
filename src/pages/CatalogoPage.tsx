import { Link } from 'react-router-dom'
import { useTemas } from '../hooks/useTemas'

// ---------------------------------------------------------------------------
// CatalogoPage — lists all temas as navigable cards
// D4 state pattern: loading / error+retry / empty / data
// ---------------------------------------------------------------------------

export default function CatalogoPage() {
  const { data, loading, error, refetch } = useTemas()

  return (
    <div className="flex flex-col gap-6 pt-4">
      <div className="flex flex-col gap-2">
        <p className="dex-label text-[11px] text-accent-2">Catálogo · Temas del curso</p>
        <h1 className="font-display text-[clamp(2rem,4vw,2.75rem)] font-bold tracking-[-0.02em] text-text">
          Explorá por tema
        </h1>
        <p className="text-sm text-muted">El software de IA, organizado por los temas del curso.</p>
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
        <p className="text-muted">No hay temas disponibles todavía.</p>
      )}

      {!loading && error === null && data.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((tema, i) => (
            <li key={tema.id}>
              <Link
                to={`/catalogo/${tema.slug}`}
                className="group flex h-full flex-col gap-2 rounded-xl border border-border bg-surface p-5 no-underline shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/60 hover:shadow-glow"
              >
                <span className="dex-label text-[11px] text-accent-2">{String(i + 1).padStart(2, '0')}</span>
                <span className="font-display text-lg font-semibold text-text transition-colors group-hover:text-accent-strong">
                  {tema.nombre}
                </span>
                {tema.descripcion !== null && tema.descripcion !== undefined && (
                  <span className="line-clamp-3 text-sm text-muted">{tema.descripcion}</span>
                )}
                <span className="dex-label mt-auto inline-flex items-center gap-1 pt-2 text-[11px] uppercase tracking-wider text-accent transition-transform group-hover:translate-x-0.5">
                  Ver software →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
