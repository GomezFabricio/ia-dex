import { Link } from 'react-router-dom'
import { useSoftwarePopulares } from '../hooks/useSoftwarePopulares'
import { useMejorValorados } from '../hooks/useMejorValorados'
import { useRecomendacionesGlobales } from '../hooks/useRecomendacionesGlobales'
import RankingListPopular from '../components/software/RankingListPopular'
import RankingListRating from '../components/software/RankingListRating'
import SoftwareList from '../components/software/SoftwareList'

// ---------------------------------------------------------------------------
// InicioPage — home dashboard.
// Three independent sections, each with its own D4 state quartet (loading /
// error+retry / empty / data). A failure in one section MUST NOT affect others.
// Section is a local non-exported helper — deliberately not shared.
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

      {loading && <p className="text-muted">Cargando…</p>}

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
  const recomendaciones = useRecomendacionesGlobales(5)

  return (
    <div className="flex flex-col gap-8">
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
              className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-bg no-underline shadow-glow transition-transform hover:-translate-y-0.5"
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

      {/* Ranking sections — 2-column grid on large screens */}
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

      {/* Recos — full width; SoftwareList owns its internal grid */}
      <Section
        titulo="Populares del catálogo"
        loading={recomendaciones.loading}
        error={recomendaciones.error}
        refetch={recomendaciones.refetch}
        isEmpty={recomendaciones.data.length === 0}
        emptyMessage="No hay software cargado todavía."
      >
        <SoftwareList items={recomendaciones.data} />
      </Section>
    </div>
  )
}
