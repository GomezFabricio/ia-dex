import { useParams, Link } from 'react-router-dom'
import { useTema } from '../hooks/useTema'
import { useSoftwarePorTema } from '../hooks/useSoftwarePorTema'
import SoftwareList from '../components/software/SoftwareList'

// ---------------------------------------------------------------------------
// TemaPage — detail page for a single tema with its software list
// Reads :temaSlug from params. Both hooks called unconditionally at top level.
// useSoftwarePorTema uses the skip variant until tema.id is available.
// D4 state pattern: loading / error+retry / not-found / data
// ---------------------------------------------------------------------------

export default function TemaPage() {
  const { temaSlug } = useParams<{ temaSlug: string }>()
  const slug = temaSlug ?? ''

  const tema = useTema(slug)
  const software = useSoftwarePorTema(tema.data?.id)

  // Loading state — either hook still resolving
  if (tema.loading) {
    return <p className="text-muted">Cargando…</p>
  }

  // Error state for tema fetch
  if (tema.error !== null) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-muted">No se pudieron cargar los datos</p>
        <button
          type="button"
          onClick={tema.refetch}
          className="text-accent hover:text-text self-start transition-colors"
        >
          Reintentar
        </button>
      </div>
    )
  }

  // Not-found state — maybeSingle returned null
  if (!tema.loading && tema.error === null && tema.data === null) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-muted">No se encontró el tema solicitado.</p>
        <Link
          to="/catalogo"
          className="text-sm text-muted hover:text-text transition-colors"
        >
          ← Volver al catálogo
        </Link>
      </div>
    )
  }

  // Data present — render tema detail
  const temaData = tema.data!

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <Link
          to="/catalogo"
          className="text-sm text-muted hover:text-text transition-colors"
        >
          ← Volver al catálogo
        </Link>
        <h1 className="text-2xl font-semibold text-text">{temaData.nombre}</h1>
        {temaData.descripcion !== null && temaData.descripcion !== undefined && (
          <p className="text-muted">{temaData.descripcion}</p>
        )}
      </div>

      {/* Software section */}
      {software.loading && <p className="text-muted">Cargando…</p>}

      {!software.loading && software.error !== null && (
        <div className="flex flex-col gap-2">
          <p className="text-muted">No se pudieron cargar los datos</p>
          <button
            type="button"
            onClick={software.refetch}
            className="text-accent hover:text-text self-start transition-colors"
          >
            Reintentar
          </button>
        </div>
      )}

      {!software.loading && software.error === null && software.data.length === 0 && (
        <p className="text-muted">Este tema no tiene software cargado todavía.</p>
      )}

      {!software.loading && software.error === null && software.data.length > 0 && (
        <SoftwareList items={software.data} />
      )}
    </div>
  )
}
