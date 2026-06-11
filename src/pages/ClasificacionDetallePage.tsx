import { useParams, Link } from 'react-router-dom'
import { useClasificacion } from '../hooks/useClasificacion'
import StarRating from '../components/ui/StarRating'

// ---------------------------------------------------------------------------
// ClasificacionDetallePage — detail page for a single ClasificacionSI
// Reads :slug from params. Hero image rendered with object-contain (didactic
// diagram — must never be cropped). Section skipped when imagen_url is null.
// D4 state pattern: loading / error+retry / not-found / data
// ---------------------------------------------------------------------------

export default function ClasificacionDetallePage() {
  const { slug: slugParam } = useParams<{ slug: string }>()
  const slug = slugParam ?? ''

  const { data, loading, error, refetch } = useClasificacion(slug)

  // Loading state
  if (loading) {
    return <p className="text-muted">Cargando…</p>
  }

  // Error state
  if (error !== null) {
    return (
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
    )
  }

  // Not-found state — maybeSingle returned null
  if (data === null) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-muted">No se encontró la clasificación solicitada.</p>
        <Link
          to="/clasificaciones"
          className="text-sm text-muted hover:text-text transition-colors"
        >
          ← Volver a clasificaciones
        </Link>
      </div>
    )
  }

  // Data present — filter enlaces to those with a non-empty url
  const enlacesFiltrados = data.enlaces.filter((e) => e.url)

  return (
    <div className="flex flex-col gap-6">
      {/* Back-link */}
      <Link
        to="/clasificaciones"
        className="text-sm text-muted hover:text-text transition-colors"
      >
        ← Volver a clasificaciones
      </Link>

      {/* Title */}
      <h1 className="text-2xl font-semibold text-text">{data.nombre}</h1>
      <StarRating key={data.id} tipo="clasificacion_si" contenidoId={data.id} />

      {/* Hero image — object-contain (didactic diagram, never cropped) */}
      {data.imagen_url !== null && data.imagen_url !== undefined && (
        <img
          src={data.imagen_url}
          alt={data.nombre}
          className="w-full object-contain max-h-96 rounded-lg bg-surface"
        />
      )}

      {/* En qué consiste */}
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-text">En qué consiste</h2>
        <p className="text-text">{data.en_que_consiste ?? '—'}</p>
      </section>

      {/* Ejemplos */}
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-text">Ejemplos</h2>
        <p className="text-text">{data.ejemplos ?? '—'}</p>
      </section>

      {/* Enlaces de interés — section hidden when list is empty after filtering */}
      {enlacesFiltrados.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-text">Enlaces de interés</h2>
          <ul className="flex flex-col gap-1">
            {enlacesFiltrados.map((enlace, index) => (
              <li key={index}>
                <a
                  href={enlace.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:text-text transition-colors"
                >
                  {enlace.titulo}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
