import { Link } from 'react-router-dom'
import { useTemas } from '../hooks/useTemas'

// ---------------------------------------------------------------------------
// CatalogoPage — lists all temas as navigable cards
// D4 state pattern: loading / error+retry / empty / data
// ---------------------------------------------------------------------------

export default function CatalogoPage() {
  const { data, loading, error, refetch } = useTemas()

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-text">Catálogo</h1>

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
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map((tema) => (
            <li key={tema.id}>
              <Link
                to={`/catalogo/${tema.slug}`}
                className="bg-surface rounded-lg p-4 flex flex-col gap-1 border border-surface hover:border-accent transition-colors no-underline"
              >
                <span className="font-semibold text-text">{tema.nombre}</span>
                {tema.descripcion !== null && tema.descripcion !== undefined && (
                  <span className="text-sm text-muted">{tema.descripcion}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
