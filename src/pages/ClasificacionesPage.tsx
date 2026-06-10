import { Link } from 'react-router-dom'
import { useClasificaciones } from '../hooks/useClasificaciones'

// ---------------------------------------------------------------------------
// ClasificacionesPage — lists all clasificaciones as navigable cards
// D4 state pattern: loading / error+retry / empty / data
// ---------------------------------------------------------------------------

export default function ClasificacionesPage() {
  const { data, loading, error, refetch } = useClasificaciones()

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-text">Clasificaciones de SI</h1>

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
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map((clasificacion) => (
            <li key={clasificacion.id}>
              <Link
                to={`/clasificaciones/${clasificacion.slug}`}
                className="bg-surface rounded-lg p-4 flex flex-col gap-1 border border-surface hover:border-accent transition-colors no-underline"
              >
                <span className="font-semibold text-text">{clasificacion.nombre}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
