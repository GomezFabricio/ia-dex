import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useClasificaciones } from '../hooks/useClasificaciones'
import { useCriterios } from '../hooks/useCriterios'
import { useClasificacionCount } from '../hooks/useClasificacionCount'
import { hueFor, washFor } from '../lib/hue'
import type { ClasificacionConCriterio } from '../types/dtos'

// ---------------------------------------------------------------------------
// ClasificacionesPage — "cine-neural" SI-classification index (si-taxonomy S3).
// Full-bleed hero + 7 axis sections (one per criterio ordered by `orden`), each
// containing the ClasifTile grid for categories of that axis. Tool counts come
// from the software_clasificaciones junction (no per-tile query). D4 states.
// ---------------------------------------------------------------------------

function ClasifTile({
  clasif,
  index,
  count,
}: {
  clasif: ClasificacionConCriterio
  index: number
  count: number
}) {
  const wash = washFor(hueFor(clasif.id))

  return (
    <Link
      to={`/clasificaciones/${clasif.slug}`}
      className="qtile group relative block aspect-[7/5] overflow-hidden rounded-2xl border border-border bg-surface no-underline transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/60 hover:shadow-glow"
    >
      <div aria-hidden="true" className="absolute inset-0" style={{ background: wash }} />
      <div aria-hidden="true" className="dex-grid absolute inset-0 opacity-25" />
      <span
        aria-hidden="true"
        className="font-display absolute -top-2 right-3 text-[5rem] font-bold leading-none text-[color-mix(in_oklab,var(--color-text)_10%,transparent)]"
      >
        {String(index).padStart(2, '0')}
      </span>
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 p-5">
        <span className="dex-label text-[9px] text-accent-2">Clasificación SI</span>
        <h3 className="font-display text-lg font-semibold leading-tight tracking-[-0.01em] text-text">
          {clasif.nombre}
        </h3>
        <span className="dex-label text-[9px] text-muted">
          {count} {count === 1 ? 'herramienta' : 'herramientas'} · Concepto
        </span>
        <span className="dex-label mt-1.5 text-[10px] text-accent transition-transform group-hover:translate-x-0.5">
          Explorar →
        </span>
      </div>
    </Link>
  )
}

export default function ClasificacionesPage() {
  const { data, loading, error, refetch } = useClasificaciones()
  const criterios = useCriterios()
  const countMap = useClasificacionCount()

  const clasificaciones = data

  // Group categories by criterio_id for section rendering.
  const porCriterio = useMemo(() => {
    const m = new Map<string, ClasificacionConCriterio[]>()
    for (const c of clasificaciones) {
      if (!c.criterio_id) continue
      const arr = m.get(c.criterio_id) ?? []
      arr.push(c)
      m.set(c.criterio_id, arr)
    }
    return m
  }, [clasificaciones])

  const isLoading = loading || criterios.loading || countMap.loading
  const hasError = error !== null || criterios.error !== null || countMap.error !== null
  const retryAll = () => {
    refetch()
    criterios.refetch()
    countMap.refetch()
  }

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden px-6 pt-24 pb-6 sm:px-8 lg:px-12">
        <div
          aria-hidden="true"
          className="dex-grid pointer-events-none absolute inset-0 opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent)]"
        />
        <div
          aria-hidden="true"
          className="orb-float-2 pointer-events-none absolute -right-12 -top-32 h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--color-accent-2)_55%,transparent),transparent_65%)] opacity-30 blur-[100px]"
        />
        <div className="relative mx-auto max-w-[1400px]">
          <p className="dex-label mb-3.5 text-[11px] text-accent-2">
            Sistemas Inteligentes · {clasificaciones.length} conceptos
          </p>
          <h1 className="font-display mb-3.5 text-[clamp(2.25rem,5vw,3.4rem)] font-bold tracking-[-0.02em] text-text">
            Clasificaciones de SI
          </h1>
          <p className="max-w-[580px] text-body-lg leading-relaxed text-muted">
            Las grandes familias conceptuales que organizan el software del catálogo. Cada una agrupa
            herramientas que comparten un mismo enfoque.
          </p>
        </div>
      </section>

      {/* Sections by axis */}
      <div className="mx-auto w-full max-w-[1400px] px-6 pb-16 sm:px-8 lg:px-12">
        {isLoading && <div className="skeleton h-80 w-full rounded-2xl" aria-hidden="true" />}

        {!isLoading && hasError && (
          <div className="flex flex-col gap-2">
            <p className="text-muted">No se pudieron cargar los datos</p>
            <button
              type="button"
              onClick={retryAll}
              className="self-start text-accent transition-colors hover:text-text"
            >
              Reintentar
            </button>
          </div>
        )}

        {!isLoading && !hasError && clasificaciones.length === 0 && (
          <p className="text-muted">No hay clasificaciones disponibles todavía.</p>
        )}

        {!isLoading && !hasError && clasificaciones.length > 0 && (
          <div className="flex flex-col gap-10">
            {criterios.data.map((criterio) => {
              const items = porCriterio.get(criterio.id) ?? []
              if (items.length === 0) return null
              return (
                <section key={criterio.id}>
                  <h2 className="font-display mb-5 text-[clamp(1.1rem,2.5vw,1.4rem)] font-semibold tracking-[-0.01em] text-text">
                    {criterio.nombre}
                  </h2>
                  <ul className="grid list-none grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
                    {items.map((c, i) => (
                      <li key={c.id}>
                        <ClasifTile
                          clasif={c}
                          index={i + 1}
                          count={countMap.data.get(c.id) ?? 0}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
