import { useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useSoftware } from '../hooks/useSoftware'
import { useRecomendaciones } from '../hooks/useRecomendaciones'
import VideoEmbed from '../components/software/VideoEmbed'
import SoftwareList from '../components/software/SoftwareList'
import StarRating from '../components/ui/StarRating'
import * as eventosService from '../services/eventosService'

// ---------------------------------------------------------------------------
// SoftwareDetallePage — ficha completa de un software por id
// Reads :id from params. Both hooks called unconditionally at top level.
// useRecomendaciones uses the skip variant until tema_id resolves.
//
// Vista event: fires once per id regardless of fetch outcome (StrictMode
// double-fire in dev is accepted per design ruling — no guard).
//
// D4 state pattern: loading / error+retry / not-found / data
// Field null policy: all text fields render "—" when null; VideoEmbed returns
// null when video_url is absent; url_acceso renders as anchor when non-null.
// ---------------------------------------------------------------------------

export default function SoftwareDetallePage() {
  const { id } = useParams<{ id: string }>()
  const softwareId = id ?? ''

  const software = useSoftware(softwareId)
  const recos = useRecomendaciones(software.data?.tema_id, softwareId)

  // Vista event — fires once per softwareId change; fail-soft (eventosService never throws)
  useEffect(() => {
    void eventosService.registrarEvento({ tipo: 'vista', software_id: softwareId })
  }, [softwareId])

  // Loading state
  if (software.loading) {
    return <p className="text-muted">Cargando…</p>
  }

  // Error state
  if (software.error !== null) {
    return (
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
    )
  }

  // Not-found state
  if (!software.loading && software.error === null && software.data === null) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-muted">No se encontró el software solicitado.</p>
        <Link
          to="/catalogo"
          className="text-sm text-muted hover:text-text transition-colors"
        >
          ← Volver al catálogo
        </Link>
      </div>
    )
  }

  // Data present — render ficha
  const sw = software.data!

  return (
    <div className="flex flex-col gap-6">
      {/* Back-link */}
      <Link
        to="/catalogo"
        className="text-sm text-muted hover:text-text transition-colors"
      >
        ← Volver al catálogo
      </Link>

      {/* Imagen — placeholder div with nombre[0] when imagen_url is null */}
      {sw.imagen_url !== null && sw.imagen_url !== undefined ? (
        <img
          src={sw.imagen_url}
          alt={sw.nombre}
          className="w-full max-h-72 object-cover rounded-lg"
        />
      ) : (
        <div className="w-full max-h-72 h-48 rounded-lg bg-surface flex items-center justify-center text-5xl font-semibold text-accent">
          {sw.nombre[0]}
        </div>
      )}

      {/* Nombre */}
      <h1 className="text-2xl font-semibold text-text">{sw.nombre}</h1>
      <StarRating key={sw.id} tipo="software" contenidoId={sw.id} />

      {/* Descripcion corta — "—" when null */}
      <p className="text-muted">
        {sw.descripcion_corta !== null && sw.descripcion_corta !== undefined
          ? sw.descripcion_corta
          : '—'}
      </p>

      {/* Video embed — renders nothing when video_url is null */}
      <VideoEmbed url={sw.video_url} nombre={sw.nombre} />

      {/* Definition list — all text fields with Spanish labels */}
      <dl className="flex flex-col gap-3">
        <div>
          <dt className="text-sm text-muted">Objetivo</dt>
          <dd className="text-text">
            {sw.objetivo !== null && sw.objetivo !== undefined ? sw.objetivo : '—'}
          </dd>
        </div>

        <div>
          <dt className="text-sm text-muted">Licencia</dt>
          <dd className="text-text">
            {sw.licencia !== null && sw.licencia !== undefined ? sw.licencia : '—'}
          </dd>
        </div>

        <div>
          <dt className="text-sm text-muted">Año de lanzamiento</dt>
          <dd className="text-text">
            {sw.anio_lanzamiento !== null && sw.anio_lanzamiento !== undefined
              ? sw.anio_lanzamiento
              : '—'}
          </dd>
        </div>

        <div>
          <dt className="text-sm text-muted">Autor/Referencia</dt>
          <dd className="text-text">
            {sw.autor_referencia !== null && sw.autor_referencia !== undefined
              ? sw.autor_referencia
              : '—'}
          </dd>
        </div>

        <div>
          <dt className="text-sm text-muted">Enlace de acceso</dt>
          <dd className="text-text">
            {sw.url_acceso !== null && sw.url_acceso !== undefined ? (
              <a
                href={sw.url_acceso}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:text-text"
              >
                {sw.url_acceso}
              </a>
            ) : (
              '—'
            )}
          </dd>
        </div>
      </dl>

      {/* Recomendaciones — hidden when empty, errored, or still loading with no results */}
      {!recos.loading && recos.error === null && recos.data.length > 0 && (
        <section className="flex flex-col gap-4 w-full">
          <h2 className="text-xl font-semibold text-text">Recomendaciones</h2>
          <SoftwareList items={recos.data} />
        </section>
      )}
    </div>
  )
}
