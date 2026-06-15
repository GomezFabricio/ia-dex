import { useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useClasificacion } from '../hooks/useClasificacion'
import { useSoftwarePorClasificacion } from '../hooks/useSoftwarePorClasificacion'
import { usePublicacionesPorClasificacion } from '../hooks/usePublicacionesPorClasificacion'
import { useTemas } from '../hooks/useTemas'
import StarRating from '../components/ui/StarRating'
import ContentRow from '../components/software/ContentRow'
import { hueFor, washFor } from '../lib/hue'
import type { ClasificacionConCriterio } from '../types/dtos'

// ---------------------------------------------------------------------------
// ClasificacionDetallePage — "cine-neural" SI-classification ficha (phase 7).
// A full-bleed split hero: the concept (kicker + name + "en qué consiste" +
// rating) beside a diagram panel (the didactic image with object-contain — never
// cropped — or a lettered placeholder over a per-item wash). Below, a centered
// column with the Ejemplos callout and the Enlaces de interés chips.
// Reads :slug from params. D4 states: loading / error+retry / not-found / data.
// ---------------------------------------------------------------------------

export default function ClasificacionDetallePage() {
  const { slug: slugParam } = useParams<{ slug: string }>()
  const slug = slugParam ?? ''

  const { data, loading, error, refetch } = useClasificacion(slug)
  const tools = useSoftwarePorClasificacion(data?.id)
  const publicaciones = usePublicacionesPorClasificacion(data?.id)
  const temas = useTemas()

  // tema_id → tema.nombre resolver for the tool rail poster kickers.
  const temaNombrePorId = useMemo(() => {
    const byId = new Map(temas.data.map((t) => [t.id, t.nombre]))
    return (temaId: string) => byId.get(temaId)
  }, [temas.data])

  // Loading state
  if (loading) {
    return (
      <div className="mx-auto max-w-[1400px] px-6 pt-12 sm:px-8 lg:px-12">
        <p className="text-muted">Cargando…</p>
      </div>
    )
  }

  // Error state
  if (error !== null) {
    return (
      <div className="mx-auto flex max-w-[1400px] flex-col gap-2 px-6 pt-12 sm:px-8 lg:px-12">
        <p className="text-muted">No se pudieron cargar los datos</p>
        <button
          type="button"
          onClick={refetch}
          className="self-start text-accent transition-colors hover:text-text"
        >
          Reintentar
        </button>
      </div>
    )
  }

  // Not-found state — maybeSingle returned null
  if (data === null) {
    return (
      <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-6 pt-12 sm:px-8 lg:px-12">
        <p className="text-muted">No se encontró la clasificación solicitada.</p>
        <Link to="/clasificaciones" className="text-sm text-muted transition-colors hover:text-text">
          ← Volver a clasificaciones
        </Link>
      </div>
    )
  }

  // Data present — cast to ClasificacionConCriterio (criterio is embedded by the service)
  const clasif = data as ClasificacionConCriterio
  const enlacesFiltrados = clasif.enlaces.filter((e) => e.url)
  const wash = washFor(hueFor(clasif.id))

  return (
    <div className="flex flex-col">
      {/* Split hero — concept beside the diagram */}
      <section className="relative overflow-hidden px-6 pt-24 pb-12 sm:px-8 lg:px-12">
        <div
          aria-hidden="true"
          className="dex-grid pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(80%_120%_at_15%_0%,black,transparent)]"
        />
        <div
          aria-hidden="true"
          className="orb-float pointer-events-none absolute -left-24 -top-40 h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--color-accent)_60%,transparent),transparent_65%)] opacity-40 blur-[100px]"
        />

        <div className="relative mx-auto grid max-w-[1400px] items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          {/* Concept */}
          <div>
            <p className="dex-label mb-4 text-[11px] text-accent-2">
              {clasif.criterio?.nombre ?? 'Clasificación de SI'} → {clasif.nombre}
            </p>
            <h1 className="font-display mb-5 text-[clamp(2.25rem,5vw,3.4rem)] font-bold leading-[1.07] tracking-[-0.02em] text-text">
              {clasif.nombre}
            </h1>
            <p className="mb-5 max-w-[560px] text-body-lg leading-relaxed text-muted">
              {clasif.en_que_consiste ?? '—'}
            </p>
            <StarRating key={clasif.id} tipo="clasificacion_si" contenidoId={clasif.id} />
          </div>

          {/* Diagram panel */}
          <div className="relative">
            <div
              aria-hidden="true"
              className="absolute -inset-3 rounded-[24px] opacity-70 blur-[28px]"
              style={{ background: wash }}
            />
            <div className="glow-ring relative grid aspect-[4/3] place-items-center overflow-hidden rounded-[20px] border border-border-strong bg-bg/50 backdrop-blur-sm">
              <div aria-hidden="true" className="dex-grid absolute inset-0 opacity-50" />
              {clasif.imagen_url !== null && clasif.imagen_url !== undefined ? (
                <img
                  src={clasif.imagen_url}
                  alt={clasif.nombre}
                  className="relative max-h-[80%] max-w-[80%] object-contain drop-shadow-lg"
                />
              ) : (
                <div className="relative px-6 text-center">
                  <div
                    className="font-display text-[clamp(4rem,10vw,5.25rem)] font-bold leading-none"
                    style={{ color: 'color-mix(in oklab, var(--color-accent) 45%, transparent)' }}
                  >
                    {clasif.nombre.charAt(0)}
                  </div>
                  <div className="dex-label mt-3.5 text-[10px] text-muted">Diagrama · concepto</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Ejemplos + enlaces — centered content column */}
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-6 pb-8 sm:px-8 lg:px-12">
        {/* Ejemplos callout */}
        <div className="reveal flex items-start gap-3.5 rounded-2xl border border-accent/30 bg-accent/[0.12] p-5">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-accent-strong" aria-hidden="true">
            <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1v.2h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z" />
          </svg>
          <div>
            <div className="dex-label mb-1.5 text-[10px] text-accent-strong">Ejemplos</div>
            <p className="leading-relaxed text-text">{clasif.ejemplos ?? '—'}</p>
          </div>
        </div>

        {/* Enlaces de interés — hidden when empty after filtering */}
        {enlacesFiltrados.length > 0 && (
          <section className="reveal flex flex-col gap-3">
            <div className="dex-label text-[10px] text-muted">Enlaces de interés</div>
            <div className="flex flex-wrap gap-2.5">
              {enlacesFiltrados.map((enlace, index) => (
                <a
                  key={index}
                  href={enlace.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-[10px] border border-border bg-surface px-3.5 py-2.5 text-sm text-text no-underline transition-colors hover:border-accent/60 hover:text-accent-strong"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-2" aria-hidden="true">
                    <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
                  </svg>
                  {enlace.titulo}
                </a>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Contenido didáctico — per-SI publicaciones (rendered only when ≥1) */}
      {!publicaciones.loading &&
        publicaciones.error === null &&
        publicaciones.data.length > 0 && (
          <section className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 px-6 pb-8 sm:px-8 lg:px-12">
            <header className="flex items-center gap-3">
              <span
                className="h-[18px] w-1 shrink-0 rounded-sm bg-gradient-to-b from-accent to-accent-2"
                aria-hidden="true"
              />
              <h2 className="font-display m-0 text-xl font-semibold tracking-[-0.015em] text-text">
                Contenido didáctico
              </h2>
            </header>
            <ul className="grid list-none grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
              {publicaciones.data.map((pub) => (
                <li key={pub.id}>
                  <Link
                    to={`/blog/${pub.slug}`}
                    className="qtile group flex flex-col gap-2 rounded-2xl border border-border bg-surface p-5 no-underline transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/60 hover:shadow-glow"
                  >
                    <span className="dex-label text-[9px] text-accent-2">Publicación</span>
                    <h3 className="font-display text-base font-semibold leading-tight tracking-[-0.01em] text-text">
                      {pub.titulo}
                    </h3>
                    <span className="dex-label text-[9px] text-muted">{pub.autorNombre}</span>
                    <span className="dex-label mt-1.5 text-[10px] text-accent transition-transform group-hover:translate-x-0.5">
                      Leer →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

      {/* Herramientas de esta categoría — semantic tool rail (software ↔ clasificacion_si) */}
      {!tools.loading && tools.error === null && tools.data.length > 0 && (
        <div className="pb-16 pt-2">
          <ContentRow
            titulo="Herramientas de esta categoría"
            items={tools.data}
            count={`${tools.data.length} herramientas`}
            temaNombrePorId={temaNombrePorId}
            contained
          />
        </div>
      )}
    </div>
  )
}
