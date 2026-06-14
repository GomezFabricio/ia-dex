import { useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTema } from '../hooks/useTema'
import { useSoftwarePorTema } from '../hooks/useSoftwarePorTema'
import { useClasificacionesPorSoftwareIds } from '../hooks/useClasificacionesPorSoftwareIds'
import PosterCard from '../components/software/PosterCard'
import StarRating from '../components/ui/StarRating'
import type { ClasificacionConCriterio, CriterioSI } from '../types/dtos'

// ---------------------------------------------------------------------------
// TemaPage — "cine-neural" tema detail (si-taxonomy S3 rewrite, UX rev 2).
// Full-bleed ghost-number hero + software grid: each tool appears ONCE with its
// SI categories rendered as chips grouped per axis below the card.
// Replaces the per-axis-rail model (each software appeared in every axis rail
// it belonged to — M2M meant a single tool showed 6-7× per tema page).
//
// Data flow:
//   useTema(slug)                           → tema meta
//   useSoftwarePorTema(tema.id)             → Software[] (tema's tools)
//   useClasificacionesPorSoftwareIds(ids)   → Map<swId, ClasificacionConCriterio[]>
//
// Each PosterCard receives the software once; SIChipGroups renders the axis
// chips from the per-software junction slice. D4 states: loading / error+retry
// / not-found / data.
// ---------------------------------------------------------------------------

export default function TemaPage() {
  const { temaSlug } = useParams<{ temaSlug: string }>()
  const slug = temaSlug ?? ''

  const tema = useTema(slug)
  const software = useSoftwarePorTema(tema.data?.id)

  // Batch junction fetch — skip until software list is ready.
  const softwareIds = useMemo(
    () => software.data.map((sw) => sw.id),
    [software.data],
  )
  const junctionMap = useClasificacionesPorSoftwareIds(
    software.loading ? [] : softwareIds,
  )

  // Loading state
  if (tema.loading) {
    return (
      <div className="mx-auto max-w-[1400px] px-6 pt-12 sm:px-8 lg:px-12">
        <p className="text-muted">Cargando…</p>
      </div>
    )
  }

  // Error state
  if (tema.error !== null) {
    return (
      <div className="mx-auto flex max-w-[1400px] flex-col gap-2 px-6 pt-12 sm:px-8 lg:px-12">
        <p className="text-muted">No se pudieron cargar los datos</p>
        <button type="button" onClick={tema.refetch} className="self-start text-accent transition-colors hover:text-text">
          Reintentar
        </button>
      </div>
    )
  }

  // Not-found state
  if (tema.data === null) {
    return (
      <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-6 pt-12 sm:px-8 lg:px-12">
        <p className="text-muted">No se encontró el tema solicitado.</p>
        <Link to="/catalogo" className="text-sm text-muted transition-colors hover:text-text">
          ← Volver al catálogo
        </Link>
      </div>
    )
  }

  const temaData = tema.data

  return (
    <div className="flex flex-col">
      {/* Ghost-number hero */}
      <section className="relative overflow-hidden px-6 pt-24 pb-6 sm:px-8 lg:px-12">
        <div
          aria-hidden="true"
          className="dex-grid pointer-events-none absolute inset-0 opacity-[0.38] [mask-image:linear-gradient(to_bottom,black,transparent)]"
        />
        <div
          aria-hidden="true"
          className="orb-float pointer-events-none absolute -top-36 left-[10%] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--color-accent)_60%,transparent),transparent_65%)] opacity-30 blur-[100px]"
        />
        <div className="relative mx-auto flex max-w-[1400px] flex-wrap items-end gap-6">
          <span className="font-display text-[clamp(4rem,10vw,7rem)] font-bold leading-[0.9] text-[color-mix(in_oklab,var(--color-accent)_30%,transparent)]">
            #{String(temaData.orden).padStart(3, '0')}
          </span>
          <div className="min-w-[280px] flex-1">
            <p className="dex-label mb-3 text-[11px] text-accent-2">Tema · Etapa pedagógica</p>
            <h1 className="font-display mb-3.5 text-[clamp(2rem,4.5vw,3rem)] font-bold tracking-[-0.02em] text-text">
              {temaData.nombre}
            </h1>
            {temaData.descripcion !== null && temaData.descripcion !== undefined && (
              <p className="mb-3.5 max-w-[620px] text-body-lg leading-relaxed text-muted">{temaData.descripcion}</p>
            )}
            <StarRating key={temaData.id} tipo="tema" contenidoId={temaData.id} />
          </div>
        </div>
      </section>

      {/* Software grid — each tool shown exactly once with per-axis SI chips */}
      <div className="pb-16 pt-4">
        {/* Loading skeleton */}
        {(software.loading || junctionMap.loading) && (
          <div className="skeleton mx-4 h-72 rounded-2xl sm:mx-8" aria-hidden="true" />
        )}

        {/* Error */}
        {!software.loading && software.error !== null && (
          <div className="mx-auto flex max-w-[1400px] flex-col gap-2 px-4 sm:px-8">
            <p className="text-muted">No se pudieron cargar los datos</p>
            <button type="button" onClick={software.refetch} className="self-start text-accent transition-colors hover:text-text">
              Reintentar
            </button>
          </div>
        )}

        {/* Empty */}
        {!software.loading && software.error === null && software.data.length === 0 && (
          <p className="mx-auto max-w-[1400px] px-4 text-muted sm:px-8">
            Este tema no tiene software cargado todavía.
          </p>
        )}

        {/* Data — one card per software, chips below each */}
        {!software.loading &&
          !junctionMap.loading &&
          software.error === null &&
          software.data.length > 0 && (
            <div className="mx-auto max-w-[1400px] px-4 sm:px-8">
              <header className="mb-4 flex items-center gap-3">
                <span
                  className="h-[18px] w-1 shrink-0 rounded-sm bg-gradient-to-b from-accent to-accent-2"
                  aria-hidden="true"
                />
                <h2 className="font-display m-0 text-xl font-semibold tracking-[-0.015em] text-text">
                  Herramientas
                </h2>
                <span className="dex-label rounded-full border border-border px-[9px] py-[3px] text-[10px] text-muted">
                  {software.data.length} {software.data.length === 1 ? 'herramienta' : 'herramientas'}
                </span>
              </header>

              <ul className="grid list-none grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-6">
                {software.data.map((sw, i) => {
                  const clasifs = junctionMap.data.get(sw.id) ?? []
                  return (
                    <li key={sw.id} className="flex flex-col gap-3">
                      <PosterCard software={sw} dex={i + 1} />
                      {clasifs.length > 0 && (
                        <CollapsibleSIChips softwareId={sw.id} clasificaciones={clasifs} />
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CollapsibleSIChips — wraps SIChipGroups behind a toggle button.
// Folded by default; expands on click revealing per-axis chips.
// Each card manages its own open/closed state (local, no shared context).
// ---------------------------------------------------------------------------

function CollapsibleSIChips({
  softwareId,
  clasificaciones,
}: {
  softwareId: string
  clasificaciones: ClasificacionConCriterio[]
}) {
  const [open, setOpen] = useState(false)
  const panelId = `si-chips-${softwareId}`

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-surface/60"
      >
        <span className="dex-label text-[9px] text-accent-2">Clasificación SI</span>
        <svg
          aria-hidden="true"
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`shrink-0 text-accent-2 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div id={panelId} className="mt-1.5">
          <SIChipGroups clasificaciones={clasificaciones} />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// SIChipGroups — per-axis SI classification chip groups (reused from
// SoftwareDetallePage pattern). Groups ClasificacionConCriterio[] by criterio.id,
// ordered by criterio.orden. Renders nothing when array is empty.
// ---------------------------------------------------------------------------

function SIChipGroups({ clasificaciones }: { clasificaciones: ClasificacionConCriterio[] }) {
  const groups = useMemo(() => {
    const byAxis = new Map<string, { criterio: CriterioSI; items: ClasificacionConCriterio[] }>()
    for (const c of clasificaciones) {
      const key = c.criterio.id
      if (!byAxis.has(key)) {
        byAxis.set(key, { criterio: c.criterio, items: [] })
      }
      byAxis.get(key)!.items.push(c)
    }
    return [...byAxis.values()].sort((a, b) => a.criterio.orden - b.criterio.orden)
  }, [clasificaciones])

  if (groups.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      {groups.map(({ criterio, items }) => (
        <div key={criterio.id}>
          <div className="dex-label mb-1.5 text-[9px] text-accent-2">{criterio.nombre}</div>
          <div className="flex flex-wrap gap-1.5">
            {items.map((cat) => (
              <span
                key={cat.id}
                className="dex-label rounded-full border border-border bg-surface/70 px-2 py-0.5 text-[9px] text-text"
              >
                {cat.nombre}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
