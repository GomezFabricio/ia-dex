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
      <h2 className="text-lg font-semibold text-text">{titulo}</h2>

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

export default function InicioPage() {
  const populares = useSoftwarePopulares(5)
  const mejorValorados = useMejorValorados(5)
  const recomendaciones = useRecomendacionesGlobales(5)

  return (
    <div className="flex flex-col gap-8">
      {/* Hero */}
      <section className="flex flex-col gap-4 bg-surface rounded-lg p-6 border border-surface">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-text">IA-dex</h1>
          <p className="text-muted">
            Explorá el catálogo de software de inteligencia artificial, organizado por los temas del curso.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/catalogo"
            className="bg-accent text-bg px-4 py-2 rounded-md font-medium hover:opacity-90 transition-opacity no-underline"
          >
            Ver catálogo
          </Link>
          <Link
            to="/buscar"
            className="border border-accent text-accent px-4 py-2 rounded-md font-medium hover:bg-surface transition-colors no-underline"
          >
            Buscar software
          </Link>
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
