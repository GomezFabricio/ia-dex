import { useSoftwarePopulares } from '../hooks/useSoftwarePopulares'
import { useMejorValorados } from '../hooks/useMejorValorados'
import RankingListPopular from '../components/software/RankingListPopular'
import RankingListRating from '../components/software/RankingListRating'

// ---------------------------------------------------------------------------
// EstadisticasPage — top-10 rankings by views and rating.
// Two independent sections, each with its own D4 state quartet (loading /
// error+retry / empty / data). <ol> semantics via RankingList wrappers.
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

export default function EstadisticasPage() {
  const populares = useSoftwarePopulares(10)
  const mejorValorados = useMejorValorados(10)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-text">Estadísticas</h1>
        <p className="text-muted">Rankings de vistas y valoraciones del catálogo.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          titulo="Software más visto"
          loading={populares.loading}
          error={populares.error}
          refetch={populares.refetch}
          isEmpty={populares.data.length === 0}
          emptyMessage="Aún no hay visitas registradas."
        >
          <RankingListPopular items={populares.data} />
        </Section>

        <Section
          titulo="Software mejor valorado"
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
