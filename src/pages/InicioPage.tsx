import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useSoftwarePopulares } from '../hooks/useSoftwarePopulares'
import { useMejorValorados } from '../hooks/useMejorValorados'
import { useRecomendacionesGlobales } from '../hooks/useRecomendacionesGlobales'
import { useSoftwarePorTema } from '../hooks/useSoftwarePorTema'
import { useTemas } from '../hooks/useTemas'
import type { Tema } from '../types/dtos'
import RankingListPopular from '../components/software/RankingListPopular'
import RankingListRating from '../components/software/RankingListRating'
import ContentRow from '../components/software/ContentRow'

// ---------------------------------------------------------------------------
// InicioPage — "cine-neural" home.
// Software lists are now Netflix-style horizontal rails (ContentRow + PosterCard);
// the popularity/rating leaderboards stay as the "Podio" rankings (they use
// ranking DTOs that lack the full Software fields a poster needs).
// Each section keeps its own D4 state quartet (loading / error+retry / empty /
// data) so a failure in one rail NEVER takes down the others.
// Section + TemaRail are local non-exported helpers — deliberately not shared.
// ---------------------------------------------------------------------------

type SectionProps = {
  titulo: string
  loading: boolean
  error: Error | null
  refetch: () => void
  isEmpty: boolean
  emptyMessage: string
  children: React.ReactNode
}

function Section({ titulo, loading, error, refetch, isEmpty, emptyMessage, children }: SectionProps) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2.5 font-display text-lg font-semibold text-text">
        <span
          className="h-4 w-1 rounded-full bg-gradient-to-b from-accent to-accent-2"
          aria-hidden="true"
        />
        {titulo}
      </h2>

      {loading && <div className="skeleton h-24 w-full rounded-xl" aria-hidden="true" />}

      {!loading && error !== null && (
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
      )}

      {!loading && error === null && isEmpty && (
        <p className="text-muted">{emptyMessage}</p>
      )}

      {!loading && error === null && !isEmpty && children}
    </section>
  )
}

// ---------------------------------------------------------------------------
// TemaRail — one rail per tema. Lives in its own component so each tema gets an
// isolated useSoftwarePorTema fetch (hooks can't run in a loop). Renders nothing
// while loading / on error / when empty — the home stays clean and a single
// tema's failure can't break the page. ContentRow already returns null on [].
// ---------------------------------------------------------------------------

function TemaRail({ tema, temaNombrePorId }: { tema: Tema; temaNombrePorId: (id: string) => string | undefined }) {
  const { data, loading, error } = useSoftwarePorTema(tema.id)

  if (loading || error !== null || data.length === 0) return null

  return (
    <ContentRow
      titulo={tema.nombre}
      items={data}
      count={`${data.length} herramientas`}
      verTodoHref={`/catalogo/${tema.slug}`}
      temaNombrePorId={temaNombrePorId}
    />
  )
}

// ---------------------------------------------------------------------------

// Quick-access entry points surfaced on the welcome hero.
const iconProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

const QUICK_LINKS = [
  {
    to: '/catalogo',
    label: 'Catálogo',
    desc: 'El software por tema',
    icon: (
      <svg {...iconProps}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
    ),
  },
  {
    to: '/clasificaciones',
    label: 'Clasificaciones',
    desc: 'Categorías de SI',
    icon: (
      <svg {...iconProps}><path d="M12 2 2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
    ),
  },
  {
    to: '/buscar',
    label: 'Buscar',
    desc: 'Por filtros o por voz',
    icon: (
      <svg {...iconProps}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
    ),
  },
  {
    to: '/foro',
    label: 'Foro',
    desc: 'Debatí con la comunidad',
    icon: (
      <svg {...iconProps}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
    ),
  },
]

export default function InicioPage() {
  const populares = useSoftwarePopulares(5)
  const mejorValorados = useMejorValorados(5)
  const recomendaciones = useRecomendacionesGlobales(12)
  const temas = useTemas()

  // tema_id → tema.nombre resolver for poster kickers (built once per data change).
  const temaNombrePorId = useMemo(() => {
    const byId = new Map(temas.data.map((t) => [t.id, t.nombre]))
    return (id: string) => byId.get(id)
  }, [temas.data])

  return (
    <div className="flex flex-col gap-10">
      {/* Welcome hero */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-surface p-8 sm:p-10">
        <div
          aria-hidden="true"
          className="dex-grid pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(90%_120%_at_15%_0%,black,transparent)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl"
        />
        <div className="relative flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            <span className="dex-label inline-flex w-fit items-center gap-2 rounded-full border border-border bg-bg/60 px-3 py-1 text-[11px] uppercase tracking-widest text-accent-2">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-2" aria-hidden="true" />
              Índice de IA
            </span>
            <h1 className="max-w-2xl font-display text-4xl font-bold leading-tight sm:text-5xl">
              Bienvenido a{' '}
              <span className="bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-transparent">
                IA-dex
              </span>
            </h1>
            <p className="max-w-2xl text-base text-muted sm:text-lg">
              El índice del software de inteligencia artificial, catalogado por los temas y las
              clasificaciones del curso. Explorá, compará y valorá herramientas — sin vueltas.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              to="/catalogo"
              className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-on-accent no-underline shadow-glow transition-transform hover:-translate-y-0.5"
            >
              Explorar catálogo
            </Link>
            <Link
              to="/buscar"
              className="rounded-lg border border-border bg-bg/40 px-5 py-2.5 font-medium text-text no-underline transition-colors hover:border-accent/60 hover:text-accent-strong"
            >
              Buscar herramienta
            </Link>
          </div>

          {/* Quick-access tiles */}
          <div className="grid gap-3 pt-2 sm:grid-cols-2 lg:grid-cols-4">
            {QUICK_LINKS.map((q) => (
              <Link
                key={q.to}
                to={q.to}
                className="group flex flex-col gap-1.5 rounded-xl border border-border bg-bg/40 p-4 no-underline transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/60 hover:bg-surface"
              >
                <span className="text-accent" aria-hidden="true">{q.icon}</span>
                <span className="font-display font-semibold text-text transition-colors group-hover:text-accent-strong">
                  {q.label}
                </span>
                <span className="text-xs text-muted">{q.desc}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured rail — full-bleed within the page column */}
      {!recomendaciones.loading && recomendaciones.error === null && recomendaciones.data.length > 0 && (
        <ContentRow
          titulo="Populares del catálogo"
          items={recomendaciones.data}
          verTodoHref="/catalogo"
          temaNombrePorId={temaNombrePorId}
        />
      )}
      {recomendaciones.loading && (
        <div className="skeleton mx-4 h-72 rounded-xl sm:mx-8" aria-hidden="true" />
      )}
      {!recomendaciones.loading && recomendaciones.error !== null && (
        <div className="flex flex-col gap-2 px-4 sm:px-8">
          <p className="text-muted">No se pudieron cargar los datos</p>
          <button
            type="button"
            onClick={recomendaciones.refetch}
            className="text-accent hover:text-text self-start transition-colors"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Per-tema rails — one isolated fetch each, render only when they have data */}
      {temas.data.map((tema) => (
        <TemaRail key={tema.id} tema={tema} temaNombrePorId={temaNombrePorId} />
      ))}

      {/* Podio — popularity & rating leaderboards (ranking DTOs, not posters) */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          titulo="Más vistos"
          loading={populares.loading}
          error={populares.error}
          refetch={populares.refetch}
          isEmpty={populares.data.length === 0}
          emptyMessage="Aún no hay visitas registradas."
        >
          <RankingListPopular items={populares.data} />
        </Section>

        <Section
          titulo="Mejor valorados"
          loading={mejorValorados.loading}
          error={mejorValorados.error}
          refetch={mejorValorados.refetch}
          isEmpty={mejorValorados.data.length === 0}
          emptyMessage="Aún no hay valoraciones registradas."
        >
          <RankingListRating items={mejorValorados.data} />
        </Section>
      </div>
    </div>
  )
}
