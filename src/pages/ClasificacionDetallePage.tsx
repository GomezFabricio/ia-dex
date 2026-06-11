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
    <div className="flex max-w-4xl flex-col gap-8">
      {/* Back-link */}
      <Link to="/clasificaciones" className="w-fit text-sm text-muted transition-colors hover:text-text">
        ← Volver a clasificaciones
      </Link>

      {/* Hero header — title beside the diagram */}
      <header className="relative overflow-hidden rounded-3xl border border-border bg-surface p-6 sm:p-8">
        <div
          aria-hidden="true"
          className="dex-grid pointer-events-none absolute inset-0 opacity-30 [mask-image:radial-gradient(80%_120%_at_15%_0%,black,transparent)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent/15 blur-3xl"
        />
        <div className="relative grid items-center gap-6 sm:grid-cols-[1fr_auto]">
          <div className="flex flex-col gap-3">
            <span className="dex-label inline-flex w-fit items-center gap-2 rounded-full border border-border bg-bg/60 px-3 py-1 text-[11px] uppercase tracking-widest text-accent-2">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-2" aria-hidden="true" />
              Clasificación de SI
            </span>
            <h1 className="font-display text-3xl font-bold text-text sm:text-4xl">{data.nombre}</h1>
            <StarRating key={data.id} tipo="clasificacion_si" contenidoId={data.id} />
          </div>
          {data.imagen_url !== null && data.imagen_url !== undefined && (
            <div className="mx-auto grid h-32 w-32 place-items-center rounded-2xl border border-border bg-bg/40 p-3 backdrop-blur-sm sm:h-40 sm:w-40">
              <img src={data.imagen_url} alt={data.nombre} className="max-h-full max-w-full object-contain" />
            </div>
          )}
        </div>
      </header>

      {/* En qué consiste — clean body */}
      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2.5 font-display text-xl font-semibold text-text">
          <span className="h-5 w-1 rounded-full bg-gradient-to-b from-accent to-accent-2" aria-hidden="true" />
          En qué consiste
        </h2>
        <p className="text-base leading-relaxed text-muted sm:text-lg">{data.en_que_consiste ?? '—'}</p>
      </section>

      {/* Ejemplos — accent callout */}
      <section className="flex gap-4 rounded-2xl border border-accent/25 bg-accent/[0.06] p-5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1v.2h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z" />
          </svg>
        </span>
        <div className="flex flex-col gap-1.5">
          <h2 className="font-display text-base font-semibold text-text">Ejemplos</h2>
          <p className="leading-relaxed text-muted">{data.ejemplos ?? '—'}</p>
        </div>
      </section>

      {/* Enlaces de interés — section hidden when list is empty after filtering */}
      {enlacesFiltrados.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2.5 font-display text-xl font-semibold text-text">
            <span className="h-5 w-1 rounded-full bg-gradient-to-b from-accent to-accent-2" aria-hidden="true" />
            Enlaces de interés
          </h2>
          <div className="flex flex-wrap gap-2">
            {enlacesFiltrados.map((enlace, index) => (
              <a
                key={index}
                href={enlace.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text no-underline transition-colors hover:border-accent/60 hover:text-accent-strong"
              >
                {enlace.titulo}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M7 17 17 7M7 7h10v10" />
                </svg>
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
