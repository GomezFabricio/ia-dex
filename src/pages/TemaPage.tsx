import { useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTema } from '../hooks/useTema'
import { useSoftwarePorTema } from '../hooks/useSoftwarePorTema'
import PosterCard from '../components/software/PosterCard'
import StarRating from '../components/ui/StarRating'

// ---------------------------------------------------------------------------
// TemaPage — "cine-neural" tema detail (redesign phase 8).
// A full-bleed tema hero (kicker + neural-text name + description + rating) over
// a poster grid of the tema's software, with a client-side filter. Both hooks
// run unconditionally; useSoftwarePorTema uses the skip variant until tema.id
// resolves. D4 states: loading / error+retry / not-found / data. The filter
// matches nombre + descripcion_corta (card-visible fields only, per D6).
// ---------------------------------------------------------------------------

export default function TemaPage() {
  const { temaSlug } = useParams<{ temaSlug: string }>()
  const slug = temaSlug ?? ''

  const tema = useTema(slug)
  const software = useSoftwarePorTema(tema.data?.id)

  const [filtro, setFiltro] = useState('')

  const softwareFiltrado = useMemo(() => {
    const q = filtro.trim().toLowerCase()
    if (q === '') return software.data
    return software.data.filter(
      (sw) =>
        sw.nombre.toLowerCase().includes(q) ||
        (sw.descripcion_corta ?? '').toLowerCase().includes(q),
    )
  }, [software.data, filtro])

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
        <button
          type="button"
          onClick={tema.refetch}
          className="self-start text-accent transition-colors hover:text-text"
        >
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
      {/* Tema hero */}
      <section className="relative flex min-h-[42vh] items-end overflow-hidden px-6 pt-24 pb-10 sm:px-8 lg:px-12">
        <div
          aria-hidden="true"
          className="dex-grid pointer-events-none absolute inset-0 opacity-30 [mask-image:radial-gradient(90%_120%_at_20%_0%,black,transparent)]"
        />
        <div
          aria-hidden="true"
          className="orb-float pointer-events-none absolute -left-24 -top-36 h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--color-accent)_60%,transparent),transparent_65%)] opacity-40 blur-[100px]"
        />
        <div
          aria-hidden="true"
          className="orb-float-2 pointer-events-none absolute -right-16 top-0 h-80 w-80 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--color-accent-2)_55%,transparent),transparent_65%)] opacity-30 blur-[100px]"
        />
        <div className="relative max-w-[760px]">
          <p className="dex-label mb-4 text-[11px] text-accent-2">Catálogo · Tema</p>
          <h1 className="font-display neural-text mb-4 text-[clamp(2.25rem,5vw,3.4rem)] font-bold leading-[1.06] tracking-[-0.02em]">
            {temaData.nombre}
          </h1>
          {temaData.descripcion !== null && temaData.descripcion !== undefined && (
            <p className="mb-5 max-w-[600px] text-body-lg leading-relaxed text-muted">
              {temaData.descripcion}
            </p>
          )}
          <StarRating key={temaData.id} tipo="tema" contenidoId={temaData.id} />
        </div>
      </section>

      {/* Software grid */}
      <div className="mx-auto w-full max-w-[1400px] px-6 pb-16 sm:px-8 lg:px-12">
        {software.loading && (
          <div className="skeleton h-72 w-full rounded-2xl" aria-hidden="true" />
        )}

        {!software.loading && software.error !== null && (
          <div className="flex flex-col gap-2">
            <p className="text-muted">No se pudieron cargar los datos</p>
            <button
              type="button"
              onClick={software.refetch}
              className="self-start text-accent transition-colors hover:text-text"
            >
              Reintentar
            </button>
          </div>
        )}

        {!software.loading && software.error === null && software.data.length === 0 && (
          <p className="text-muted">Este tema no tiene software cargado todavía.</p>
        )}

        {!software.loading && software.error === null && software.data.length > 0 && (
          <div className="flex flex-col gap-5">
            {/* Filter + section header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display flex items-center gap-3 text-xl font-semibold tracking-[-0.015em] text-text">
                <span className="h-[18px] w-1 shrink-0 rounded-sm bg-gradient-to-b from-accent to-accent-2" aria-hidden="true" />
                Herramientas
                <span className="dex-label rounded-full border border-border px-2 py-[3px] text-[10px] text-muted">
                  {softwareFiltrado.length}
                </span>
              </h2>
              <label className="flex items-center gap-2 rounded-xl border border-border bg-surface/70 px-3 py-2 backdrop-blur-md focus-within:border-accent/60">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-muted" aria-hidden="true">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <input
                  type="text"
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                  placeholder="Filtrar en este tema…"
                  aria-label="Filtrar software del tema"
                  className="w-44 border-none bg-transparent text-sm text-text outline-none placeholder:text-muted"
                />
              </label>
            </div>

            {softwareFiltrado.length === 0 ? (
              <p className="text-muted">Sin coincidencias en este tema.</p>
            ) : (
              <ul className="grid list-none grid-cols-[repeat(auto-fill,minmax(165px,1fr))] gap-4">
                {softwareFiltrado.map((sw, i) => (
                  <li key={sw.id}>
                    <PosterCard software={sw} dex={i + 1} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
