import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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

  // Hero command bar → hand the query to the search page via ?q=.
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const q = query.trim()
    navigate(q === '' ? '/buscar' : `/buscar?q=${encodeURIComponent(q)}`)
  }

  return (
    <div className="flex flex-col">
      {/* Full-bleed hero */}
      <section className="relative flex min-h-[60vh] items-center overflow-hidden px-6 pt-28 pb-16 sm:px-8 lg:min-h-[82vh] lg:px-12">
        <div
          aria-hidden="true"
          className="dex-grid pointer-events-none absolute inset-0 opacity-50 [mask-image:radial-gradient(120%_90%_at_30%_40%,black,transparent_75%)]"
        />
        <div
          aria-hidden="true"
          className="orb-float pointer-events-none absolute -left-32 -top-40 h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--color-accent)_70%,transparent),transparent_65%)] opacity-50 blur-[90px]"
        />
        <div
          aria-hidden="true"
          className="orb-float-2 pointer-events-none absolute -bottom-48 -right-20 h-[32rem] w-[32rem] rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--color-accent-2)_65%,transparent),transparent_65%)] opacity-40 blur-[100px]"
        />
        <div
          aria-hidden="true"
          className="orb-float pointer-events-none absolute right-[24%] top-[20%] h-[22rem] w-[22rem] rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--color-accent-3)_70%,transparent),transparent_65%)] opacity-30 blur-[110px]"
        />

        <div className="relative max-w-[760px]">
          <p className="dex-label mb-5 text-[11px] text-accent-2">
            Índice de IA · Catálogo cinematográfico
          </p>
          <h1 className="font-display mb-5 text-[clamp(2.75rem,6.5vw,4.6rem)] font-bold leading-[1.04] tracking-[-0.02em]">
            <span className="text-text">Aprendé </span>
            <span className="neural-text">Inteligencia Artificial</span>
          </h1>
          <p className="mb-7 max-w-[560px] text-body-lg leading-relaxed text-muted">
            El índice cinematográfico del software de IA, catalogado por temas y clasificaciones.
            Explorá, mirá y dominá las herramientas que están redefiniendo el mundo.
          </p>

          {/* Command search bar */}
          <form
            role="search"
            onSubmit={handleSearch}
            className="flex max-w-[560px] items-center gap-2.5 rounded-2xl border border-border-strong bg-surface/80 p-[7px] pl-4 shadow-pop backdrop-blur-md"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-muted" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscá una herramienta, tema o concepto…"
              aria-label="Buscar"
              className="min-w-0 flex-1 border-none bg-transparent text-[15px] text-text outline-none placeholder:text-muted"
            />
            <button
              type="submit"
              className="dex-label shrink-0 rounded-[9px] bg-accent px-[18px] py-[11px] text-[11px] text-on-accent shadow-glow transition-transform hover:-translate-y-0.5"
            >
              Buscar
            </button>
          </form>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/roadmap"
              className="dex-label inline-flex items-center gap-2 rounded-[10px] border border-border bg-surface/70 px-[18px] py-3 text-[11px] text-text no-underline backdrop-blur-md transition-colors hover:border-accent/60"
            >
              ▸ Ver roadmap · Empezá tu camino
            </Link>
          </div>
        </div>
      </section>

      {/* Quick-access tiles — overlap the hero's lower edge */}
      <div className="relative z-[5] -mt-7 grid gap-3 px-4 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
        {QUICK_LINKS.map((q) => (
          <Link
            key={q.to}
            to={q.to}
            className="qtile group flex flex-col gap-1.5 rounded-xl border border-border bg-surface/85 p-[18px] no-underline backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/60"
          >
            <span className="text-accent-2" aria-hidden="true">{q.icon}</span>
            <span className="font-display font-semibold text-text transition-colors group-hover:text-accent-strong">
              {q.label}
            </span>
            <span className="dex-label text-[9px] text-muted">{q.desc}</span>
          </Link>
        ))}
      </div>

      {/* Rails */}
      <div className="mt-12 flex flex-col gap-8">
        {/* Featured rail */}
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
      </div>

      {/* Podio — popularity & rating leaderboards (ranking DTOs, not posters) */}
      <div className="mt-12 px-4 sm:px-8">
        <h2 className="font-display mb-5 flex items-center gap-3 text-xl font-semibold tracking-[-0.015em] text-text">
          <span className="h-[18px] w-1 shrink-0 rounded-sm bg-gradient-to-b from-accent to-accent-2" aria-hidden="true" />
          Podio del catálogo
        </h2>
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
    </div>
  )
}
