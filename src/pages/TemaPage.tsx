import { useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTema } from '../hooks/useTema'
import { useSoftwarePorTema } from '../hooks/useSoftwarePorTema'
import { useClasificaciones } from '../hooks/useClasificaciones'
import ContentRow from '../components/software/ContentRow'
import StarRating from '../components/ui/StarRating'
import type { Software } from '../types/dtos'

// ---------------------------------------------------------------------------
// TemaPage — "cine-neural" tema detail (redesign).
// Full-bleed ghost-number hero (big tema número + name + description + rating)
// over Netflix rails: the tema's software grouped by clasificación de SI, plus a
// catch-all rail for tools without one. Recreates the tema screen from the design
// handoff. Both hooks run unconditionally; software uses the skip variant until
// tema.id resolves. D4 states: loading / error+retry / not-found / data.
// ---------------------------------------------------------------------------

export default function TemaPage() {
  const { temaSlug } = useParams<{ temaSlug: string }>()
  const slug = temaSlug ?? ''

  const tema = useTema(slug)
  const software = useSoftwarePorTema(tema.data?.id)
  const clasifs = useClasificaciones()

  // Group the tema's software into rails by clasificación; tools without one fall
  // into a final "Otras herramientas" rail. Rebuilt only when data changes.
  const rails = useMemo(() => {
    const byClasif = new Map<string, Software[]>()
    const sinClasif: Software[] = []
    for (const sw of software.data) {
      if (sw.clasificacion_si_id !== null && sw.clasificacion_si_id !== undefined) {
        const arr = byClasif.get(sw.clasificacion_si_id) ?? []
        arr.push(sw)
        byClasif.set(sw.clasificacion_si_id, arr)
      } else {
        sinClasif.push(sw)
      }
    }
    const nombrePorId = new Map(clasifs.data.map((c) => [c.id, c.nombre]))
    const out = [...byClasif.entries()].map(([cid, items]) => ({
      key: cid,
      titulo: nombrePorId.get(cid) ?? 'Clasificación de SI',
      items,
    }))
    if (sinClasif.length > 0) out.push({ key: 'sin', titulo: 'Otras herramientas', items: sinClasif })
    return out
  }, [software.data, clasifs.data])

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

      {/* Rails */}
      <div className="flex flex-col gap-2 pb-16 pt-4">
        {software.loading && <div className="skeleton mx-4 h-72 rounded-2xl sm:mx-8" aria-hidden="true" />}

        {!software.loading && software.error !== null && (
          <div className="mx-auto flex max-w-[1400px] flex-col gap-2 px-4 sm:px-8">
            <p className="text-muted">No se pudieron cargar los datos</p>
            <button type="button" onClick={software.refetch} className="self-start text-accent transition-colors hover:text-text">
              Reintentar
            </button>
          </div>
        )}

        {!software.loading && software.error === null && software.data.length === 0 && (
          <p className="mx-auto max-w-[1400px] px-4 text-muted sm:px-8">
            Este tema no tiene software cargado todavía.
          </p>
        )}

        {!software.loading &&
          software.error === null &&
          rails.map((rail) => (
            <ContentRow
              key={rail.key}
              titulo={rail.titulo}
              items={rail.items}
              count={`${rail.items.length} herramientas`}
            />
          ))}
      </div>
    </div>
  )
}
