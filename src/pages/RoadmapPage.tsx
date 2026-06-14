import { useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useRoadmap } from '../hooks/useRoadmap'
import ContentRow from '../components/software/ContentRow'

// ---------------------------------------------------------------------------
// RoadmapPage — "cine-neural" pedagogical spine (redesign phase 6).
// A full-bleed intro hero with an aggregate progress bar, then a vertical spine:
// one node per stage (a tema, ordered by `orden`), each a card with status, the
// tema description, a complete/uncomplete toggle, a link into the tema, and a
// mini poster rail of its featured software. On lg+ a sticky stage index sits to
// the left. Progress source (DB when authed / localStorage when anon), the
// migration on sign-in, and optimistic toggling all live in useRoadmap (PR-7).
// ---------------------------------------------------------------------------

export default function RoadmapPage() {
  const { etapas, progreso, loading, error, toggleProgreso, total, completados } = useRoadmap()

  const pct = total > 0 ? Math.round((completados / total) * 100) : 0

  // tema_id → tema.nombre resolver for the mini-rail poster kickers.
  const temaNombrePorId = useMemo(() => {
    const byId = new Map(etapas.map((e) => [e.tema.id, e.tema.nombre]))
    return (temaId: string) => byId.get(temaId)
  }, [etapas])

  // Stage card refs so "Continuar" / the index can scroll to a stage.
  const stageRefs = useRef<(HTMLDivElement | null)[]>([])
  const scrollToStage = (i: number) =>
    stageRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const continuar = () => {
    const next = etapas.findIndex((e) => !progreso.has(e.tema.id))
    scrollToStage(next === -1 ? 0 : next)
  }

  // Loading state
  if (loading) {
    return (
      <div className="mx-auto max-w-[1400px] px-6 pt-12 sm:px-8 lg:px-12">
        <div className="skeleton h-10 w-72 rounded-lg" aria-hidden="true" />
        <div className="skeleton mt-6 h-64 w-full rounded-2xl" aria-hidden="true" />
      </div>
    )
  }

  // Error state
  if (error !== null) {
    return (
      <div className="mx-auto max-w-[1400px] px-6 pt-12 sm:px-8 lg:px-12">
        <p className="text-muted">No se pudo cargar el roadmap. Recargá la página.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {/* Intro hero */}
      <section className="relative overflow-hidden px-6 pt-24 pb-12 sm:px-8 lg:px-12">
        <div
          aria-hidden="true"
          className="dex-grid pointer-events-none absolute inset-0 opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent)]"
        />
        <div
          aria-hidden="true"
          className="orb-float pointer-events-none absolute -right-16 -top-44 h-[32rem] w-[32rem] rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--color-accent)_60%,transparent),transparent_65%)] opacity-40 blur-[100px]"
        />
        <div className="relative max-w-[900px]">
          <p className="dex-label mb-4 text-[11px] text-accent-2">Roadmap · Espina pedagógica</p>
          <h1 className="font-display neural-text mb-4 text-[clamp(2.5rem,5.5vw,3.8rem)] font-bold leading-[1.05] tracking-[-0.02em]">
            Tu camino en la IA
          </h1>
          <p className="mb-7 max-w-[560px] text-body-lg leading-relaxed text-muted">
            Una ruta de {total} etapa{total === 1 ? '' : 's'}, de los fundamentos a la IA aplicada.
            Avanzá a tu ritmo y marcá lo que vayas dominando.
          </p>

          {/* Aggregate progress */}
          <div className="max-w-[520px]">
            <div className="mb-2.5 flex items-baseline justify-between">
              <span className="dex-label text-[11px] text-text">
                {completados} de {total} completadas
              </span>
              <span className="dex-label text-[11px] text-accent-2">{pct}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full border border-border bg-surface-2">
              <div
                className="h-full rounded-full bg-[image:var(--gradient-neural)] shadow-glow transition-[width] duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            {total > 0 && (
              <button
                type="button"
                onClick={continuar}
                className="font-display mt-5 inline-flex items-center gap-2.5 rounded-[11px] bg-accent px-5 py-3 text-[15px] font-semibold text-on-accent shadow-glow transition-transform hover:-translate-y-0.5"
              >
                {completados === 0 ? 'Empezar' : completados === total ? 'Repasar' : 'Continuar'}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Spine */}
      <div className="mx-auto grid w-full max-w-[1400px] gap-10 px-6 pb-20 pt-4 sm:px-8 lg:grid-cols-[auto_1fr] lg:px-12">
        {/* Sticky stage index (lg+) */}
        <nav aria-label="Etapas del roadmap" className="hidden lg:block">
          <ul className="sticky top-20 flex list-none flex-col gap-1.5">
            {etapas.map((etapa, i) => {
              const done = progreso.has(etapa.tema.id)
              return (
                <li key={etapa.tema.id}>
                  <button
                    type="button"
                    onClick={() => scrollToStage(i)}
                    className="flex items-center gap-3 py-1.5 text-left transition-opacity hover:opacity-100"
                  >
                    <span className={`font-display w-6 text-[13px] font-bold ${done ? 'text-accent-2' : 'text-faint'}`}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className={`dex-label text-[9px] ${done ? 'text-text' : 'text-muted'}`}>
                      {etapa.tema.nombre}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Stage cards on a gradient spine */}
        <div className="relative">
          {/* Spine track + completion fill */}
          <div aria-hidden="true" className="absolute bottom-10 left-[17px] top-2 w-0.5 bg-border-strong/80" />
          <div
            aria-hidden="true"
            className="absolute left-[17px] top-2 w-0.5 origin-top bg-gradient-to-b from-accent to-accent-2 shadow-[0_0_12px_color-mix(in_oklab,var(--color-accent-2)_60%,transparent)] transition-transform duration-500"
            style={{ bottom: '2.5rem', transform: `scaleY(${total > 0 ? completados / total : 0})` }}
          />

          {etapas.map((etapa, i) => {
            const done = progreso.has(etapa.tema.id)
            return (
              <div
                key={etapa.tema.id}
                ref={(el) => { stageRefs.current[i] = el }}
                className="reveal relative scroll-mt-20 pb-10 pl-[52px]"
              >
                {/* Spine node */}
                <span
                  aria-hidden="true"
                  className={`absolute left-[9px] top-1.5 grid h-4 w-4 place-items-center rounded-full border-2 ${
                    done
                      ? 'border-transparent bg-[image:var(--gradient-neural)] shadow-glow'
                      : 'border-border-strong bg-surface'
                  }`}
                />

                <div className="overflow-hidden rounded-[18px] border border-border bg-surface/50">
                  <div className="px-6 pt-5">
                    <div className="mb-2.5 flex flex-wrap items-center gap-2.5">
                      <span className={`dex-label text-[10px] ${done ? 'text-accent-2' : 'text-muted'}`}>
                        Etapa {String(i + 1).padStart(2, '0')}
                      </span>
                      <span
                        className={`dex-label rounded-full border px-2 py-[3px] text-[9px] ${
                          done
                            ? 'border-success/40 bg-success/15 text-success'
                            : 'border-border bg-surface-2 text-muted'
                        }`}
                      >
                        {done ? 'Completado' : 'Pendiente'}
                      </span>
                    </div>

                    <h2 className="font-display mb-2.5 text-[clamp(1.4rem,3vw,1.85rem)] font-semibold tracking-[-0.015em] text-text">
                      {etapa.tema.nombre}
                    </h2>
                    {etapa.tema.descripcion !== null && (
                      <p className="mb-4 max-w-[640px] text-[14.5px] leading-relaxed text-muted">
                        {etapa.tema.descripcion}
                      </p>
                    )}

                    <div className="mb-2 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => toggleProgreso(etapa.tema.id)}
                        aria-pressed={done}
                        className={`dex-label inline-flex items-center gap-2 rounded-[9px] border px-3.5 py-2.5 text-[10px] transition-colors ${
                          done
                            ? 'border-success/40 bg-success/15 text-success hover:bg-success/20'
                            : 'border-accent/40 bg-accent/[0.12] text-accent-strong hover:bg-accent/20'
                        }`}
                      >
                        {done ? (
                          <>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
                            Completado
                          </>
                        ) : (
                          'Marcar como completado'
                        )}
                      </button>
                      <Link
                        to={`/catalogo/${etapa.tema.slug}`}
                        className="dex-label inline-flex items-center gap-1.5 rounded-[9px] border border-border px-3.5 py-2.5 text-[10px] text-accent-2 no-underline transition-colors hover:border-accent/60"
                      >
                        Explorar tema →
                      </Link>
                    </div>
                  </div>

                  {/* Featured software mini-rail */}
                  <div className="pt-2 pb-3.5">
                    <ContentRow
                      titulo="Destacados"
                      items={etapa.destacados}
                      temaNombrePorId={temaNombrePorId}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
