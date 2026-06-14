import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useClasificaciones } from '../hooks/useClasificaciones'
import { useSoftwareTodos } from '../hooks/useSoftwareTodos'
import { hueFor, washFor } from '../lib/hue'
import type { ClasificacionSI } from '../types/dtos'

// ---------------------------------------------------------------------------
// ClasificacionesPage — "cine-neural" SI-classification index (redesign).
// Full-bleed hero + a grid of poster-style tiles: each clasificación as a 7:5
// wash tile with a ghost number, name, tool count and "Explorar →". Recreates
// the clasif-list screen from the design handoff. Tool counts come from one
// all-software fetch (no per-tile query). D4: loading / error+retry / empty / data.
// ---------------------------------------------------------------------------

function ClasifTile({ clasif, index, count }: { clasif: ClasificacionSI; index: number; count: number }) {
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
        <h2 className="font-display text-lg font-semibold leading-tight tracking-[-0.01em] text-text">
          {clasif.nombre}
        </h2>
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
  const todos = useSoftwareTodos()

  // clasificacion_si_id → tool count, from one all-software fetch.
  const countPorClasif = useMemo(() => {
    const counts = new Map<string, number>()
    for (const sw of todos.data) {
      if (sw.clasificacion_si_id !== null && sw.clasificacion_si_id !== undefined) {
        counts.set(sw.clasificacion_si_id, (counts.get(sw.clasificacion_si_id) ?? 0) + 1)
      }
    }
    return counts
  }, [todos.data])

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
            Sistemas Inteligentes · {data.length} conceptos
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

      {/* Tiles */}
      <div className="mx-auto w-full max-w-[1400px] px-6 pb-16 sm:px-8 lg:px-12">
        {loading && <div className="skeleton h-80 w-full rounded-2xl" aria-hidden="true" />}

        {!loading && error !== null && (
          <div className="flex flex-col gap-2">
            <p className="text-muted">No se pudieron cargar los datos</p>
            <button type="button" onClick={refetch} className="self-start text-accent transition-colors hover:text-text">
              Reintentar
            </button>
          </div>
        )}

        {!loading && error === null && data.length === 0 && (
          <p className="text-muted">No hay clasificaciones disponibles todavía.</p>
        )}

        {!loading && error === null && data.length > 0 && (
          <ul className="grid list-none grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
            {data.map((c, i) => (
              <li key={c.id}>
                <ClasifTile clasif={c} index={i + 1} count={countPorClasif.get(c.id) ?? 0} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
