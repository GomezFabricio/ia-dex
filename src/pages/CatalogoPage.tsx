import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTemas } from '../hooks/useTemas'
import { useSoftwarePorTema } from '../hooks/useSoftwarePorTema'
import { useSoftwareTodos } from '../hooks/useSoftwareTodos'
import ContentRow from '../components/software/ContentRow'
import type { Tema } from '../types/dtos'

// ---------------------------------------------------------------------------
// CatalogoPage — "cine-neural" catalogue browse (redesign).
// Full-bleed hero + a sticky toolbar (Rieles/Cuadrícula view toggle).
// "Rieles": one Netflix rail per tema (ghost-number header + "Ver tema").
// "Cuadrícula": every tool in one poster grid. Recreates the catalogo screen
// from the design handoff. Each rail owns its own fetch so one failure is local.
// ---------------------------------------------------------------------------

// One rail per tema — isolated fetch, custom ghost-number header, hidden rail
// header. Renders nothing while loading / on error / when empty.
function CatalogoTemaRail({ tema, orden }: { tema: Tema; orden: number }) {
  const { data, loading, error } = useSoftwarePorTema(tema.id)
  if (loading || error !== null || data.length === 0) return null

  return (
    <section id={`cat-tema-${tema.id}`} className="reveal scroll-mt-[120px] pt-6">
      <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-4 pb-1.5 sm:px-8">
        <span className="font-display text-[40px] font-bold leading-none text-[color-mix(in_oklab,var(--color-text)_14%,transparent)]">
          {String(orden).padStart(2, '0')}
        </span>
        <div className="flex-1">
          <h2 className="font-display text-xl font-semibold tracking-[-0.015em] text-text">{tema.nombre}</h2>
          <span className="dex-label text-[9px] text-muted">{data.length} herramientas</span>
        </div>
        <Link to={`/catalogo/${tema.slug}`} className="dex-label shrink-0 text-[10px] text-accent-2 no-underline transition-colors hover:text-text">
          Ver tema →
        </Link>
      </div>
      <ContentRow titulo={tema.nombre} items={data} hideHeader />
    </section>
  )
}

export default function CatalogoPage() {
  const temas = useTemas()
  const todos = useSoftwareTodos()
  const [view, setView] = useState<'rieles' | 'grid'>('rieles')

  const temaNombrePorId = useMemo(() => {
    const byId = new Map(temas.data.map((t) => [t.id, t.nombre]))
    return (temaId: string) => byId.get(temaId)
  }, [temas.data])

  const seg = (active: boolean) =>
    [
      'dex-label rounded-lg px-3.5 py-2 text-[10px] transition-colors',
      active ? 'bg-accent text-on-accent' : 'text-muted hover:text-text',
    ].join(' ')

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden px-6 pt-24 pb-8 sm:px-8 lg:px-12">
        <div
          aria-hidden="true"
          className="dex-grid pointer-events-none absolute inset-0 opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent)]"
        />
        <div
          aria-hidden="true"
          className="orb-float pointer-events-none absolute -left-16 -top-40 h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--color-accent)_60%,transparent),transparent_65%)] opacity-35 blur-[100px]"
        />
        <div className="relative mx-auto max-w-[1400px]">
          <p className="dex-label mb-3.5 text-[11px] text-accent-2">
            Catálogo · {todos.loading ? '…' : `${todos.data.length} herramientas`}
          </p>
          <h1 className="font-display mb-3.5 text-[clamp(2.25rem,5vw,3.4rem)] font-bold tracking-[-0.02em] text-text">
            Explorá el catálogo
          </h1>
          <p className="max-w-[580px] text-body-lg leading-relaxed text-muted">
            Todo el software de IA, organizado por los temas del curso. Navegá por rieles o cambiá a
            cuadrícula para escanear en densidad.
          </p>
        </div>
      </section>

      {/* Sticky toolbar — Rieles/Cuadrícula view toggle */}
      <div className="sticky top-14 z-20 border-b border-border bg-bg/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] justify-end px-4 py-3 sm:px-8">
          <div className="flex shrink-0 gap-1 rounded-[11px] border border-border bg-surface-2 p-1">
            <button type="button" onClick={() => setView('rieles')} className={seg(view === 'rieles')}>
              Rieles
            </button>
            <button type="button" onClick={() => setView('grid')} className={seg(view === 'grid')}>
              Cuadrícula
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {view === 'grid' ? (
        <div className="mx-auto w-full max-w-[1400px] py-6 pb-16">
          {todos.loading && <div className="skeleton mx-4 h-96 rounded-2xl sm:mx-8" aria-hidden="true" />}
          {!todos.loading && todos.error !== null && (
            <div className="flex flex-col gap-2 px-4 sm:px-8">
              <p className="text-muted">No se pudieron cargar los datos</p>
              <button type="button" onClick={todos.refetch} className="self-start text-accent transition-colors hover:text-text">
                Reintentar
              </button>
            </div>
          )}
          {!todos.loading && todos.error === null && (
            <ContentRow titulo="Catálogo" items={todos.data} layout="grid" temaNombrePorId={temaNombrePorId} hideHeader />
          )}
        </div>
      ) : (
        <div className="flex flex-col pb-16 pt-1">
          {temas.loading && <div className="skeleton mx-4 mt-6 h-72 rounded-2xl sm:mx-8" aria-hidden="true" />}
          {temas.data.map((t, i) => (
            <CatalogoTemaRail key={t.id} tema={t} orden={i + 1} />
          ))}
        </div>
      )}
    </div>
  )
}
