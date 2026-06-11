import { useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTema } from '../hooks/useTema'
import { useSoftwarePorTema } from '../hooks/useSoftwarePorTema'
import SoftwareList from '../components/software/SoftwareList'
import StarRating from '../components/ui/StarRating'

// ---------------------------------------------------------------------------
// TemaPage — detail page for a single tema with its software list
// Reads :temaSlug from params. Both hooks called unconditionally at top level.
// useSoftwarePorTema uses the skip variant until tema.id is available.
// D4 state pattern: loading / error+retry / not-found / data
// Client-side filter: useState + useMemo placed BEFORE early returns (hooks rules).
// Filters by nombre + descripcion_corta (D6 deviation: card-visible fields only).
// ---------------------------------------------------------------------------

export default function TemaPage() {
  const { temaSlug } = useParams<{ temaSlug: string }>()
  const slug = temaSlug ?? ''

  const tema = useTema(slug)
  const software = useSoftwarePorTema(tema.data?.id)

  // Filter state — declared before early returns to satisfy rules of hooks
  const [filtro, setFiltro] = useState('')

  // Filtered list — recomputed only when software.data or filtro changes
  const softwareFiltrado = useMemo(() => {
    const q = filtro.trim().toLowerCase()
    if (q === '') return software.data
    return software.data.filter(
      (sw) =>
        sw.nombre.toLowerCase().includes(q) ||
        (sw.descripcion_corta ?? '').toLowerCase().includes(q),
    )
  }, [software.data, filtro])

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
        <StarRating key={temaData.id} tipo="tema" contenidoId={temaData.id} />
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
        <div className="flex flex-col gap-4">
          <input
            type="text"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Filtrar en este tema…"
            aria-label="Filtrar software del tema"
            className="w-full rounded-md bg-surface px-3 py-2 text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
          />

          {softwareFiltrado.length === 0 ? (
            <p className="text-muted">Sin coincidencias en este tema.</p>
          ) : (
            <SoftwareList items={softwareFiltrado} />
          )}
        </div>
      )}
    </div>
  )
}
