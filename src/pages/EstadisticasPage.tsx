import { Link } from 'react-router-dom'
import { useSoftwarePopulares } from '../hooks/useSoftwarePopulares'
import { useMejorValorados } from '../hooks/useMejorValorados'
import { useSoftwareTodos } from '../hooks/useSoftwareTodos'
import { useTemas } from '../hooks/useTemas'
import { useClasificaciones } from '../hooks/useClasificaciones'
import { useCountUp } from '../hooks/useCountUp'
import { hueFor, washFor } from '../lib/hue'

// ---------------------------------------------------------------------------
// EstadisticasPage — "cine-neural" catalogue numbers (redesign).
// Full-bleed hero + a count-up stat grid (tools / temas / clasificaciones / total
// views) + the podio (top-10 by views and by rating). Recreates the estadísticas
// screen from the design handoff. Each ranking keeps its D4 state quartet.
// ---------------------------------------------------------------------------

// 128400 → "128.4k"
function fmtNum(n: number): string {
  return n >= 1000 ? (n / 1000).toFixed(1).replace('.0', '') + 'k' : String(n)
}

function StatCard({ value, label, format }: { value: number; label: string; format?: boolean }) {
  const animated = useCountUp(value)
  return (
    <div className="reveal rounded-2xl border border-border bg-surface/55 p-6">
      <div className="dex-label text-[46px] font-bold leading-none text-text">
        {format ? fmtNum(animated) : animated}
      </div>
      <div className="dex-label mt-3 text-[10px] text-muted">{label}</div>
    </div>
  )
}

// Cine podio row — ghost rank + wash initial tile + name + metric (hover rank bar).
function PodioRow({
  rank,
  softwareId,
  nombre,
  metric,
}: {
  rank: number
  softwareId: string
  nombre: string
  metric: string
}) {
  const wash = washFor(hueFor(softwareId))
  return (
    <Link
      to={`/software/${softwareId}`}
      className="ranking-row relative flex items-center gap-4 overflow-hidden rounded-xl px-4 py-3 no-underline transition-colors hover:bg-surface-2"
    >
      <span className="rank-bar absolute bottom-2 left-0 top-2 w-[3px] rounded bg-accent-2" aria-hidden="true" />
      <span className="font-display w-[46px] shrink-0 text-center text-[40px] font-bold leading-none text-[color-mix(in_oklab,var(--color-accent-2)_32%,transparent)]">
        {rank}
      </span>
      <span
        className="font-display grid h-[60px] w-[46px] shrink-0 place-items-center rounded-[9px] border border-border text-[22px] font-bold text-[#EAEDFB]"
        style={{ background: wash }}
        aria-hidden="true"
      >
        {nombre.charAt(0)}
      </span>
      <span className="font-display min-w-0 flex-1 truncate text-[15px] font-semibold text-text">{nombre}</span>
      <span className="dex-label shrink-0 text-[11px] text-accent-2">{metric}</span>
    </Link>
  )
}

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
    <section className="rounded-[18px] border border-border bg-surface/50 p-2">
      <h2 className="dex-label px-4 pb-2.5 pt-3.5 text-[10px] text-muted">{titulo}</h2>

      {loading && <p className="px-4 pb-3 text-muted">Cargando…</p>}

      {!loading && error !== null && (
        <div className="flex flex-col gap-2 px-4 pb-3">
          <p className="text-muted">No se pudieron cargar los datos</p>
          <button type="button" onClick={refetch} className="self-start text-accent transition-colors hover:text-text">
            Reintentar
          </button>
        </div>
      )}

      {!loading && error === null && isEmpty && <p className="px-4 pb-3 text-muted">{emptyMessage}</p>}

      {!loading && error === null && !isEmpty && children}
    </section>
  )
}

export default function EstadisticasPage() {
  const populares = useSoftwarePopulares(100)
  const mejorValorados = useMejorValorados(10)
  const todos = useSoftwareTodos()
  const temas = useTemas()
  const clasifs = useClasificaciones()

  const totalVistas = populares.data.reduce((acc, item) => acc + (item.vistas ?? 0), 0)
  const topVistos = populares.data.slice(0, 10)

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden px-6 pt-24 pb-6 sm:px-8 lg:px-12">
        <div
          aria-hidden="true"
          className="dex-grid pointer-events-none absolute inset-0 opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent)]"
        />
        <div className="relative mx-auto max-w-[1400px]">
          <p className="dex-label mb-3.5 text-[11px] text-accent-2">Estadísticas del índice</p>
          <h1 className="font-display text-[clamp(2rem,4.5vw,3rem)] font-bold tracking-[-0.02em] text-text">
            El catálogo en números
          </h1>
        </div>
      </section>

      {/* Stat cards */}
      <div className="mx-auto w-full max-w-[1400px] px-6 pb-2 sm:px-8 lg:px-12">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-4">
          <StatCard value={todos.data.length} label="Herramientas indexadas" />
          <StatCard value={temas.data.length} label="Temas pedagógicos" />
          <StatCard value={clasifs.data.length} label="Clasificaciones de SI" />
          <StatCard value={totalVistas} label="Vistas totales" format />
        </div>
      </div>

      {/* Podio */}
      <div className="mx-auto w-full max-w-[1400px] px-6 py-8 pb-16 sm:px-8 lg:px-12">
        <div className="grid gap-6 lg:grid-cols-2">
          <Section
            titulo="Más vistos"
            loading={populares.loading}
            error={populares.error}
            refetch={populares.refetch}
            isEmpty={topVistos.length === 0}
            emptyMessage="Aún no hay visitas registradas."
          >
            <div className="flex flex-col">
              {topVistos.map((item, i) => (
                <PodioRow
                  key={item.software_id}
                  rank={i + 1}
                  softwareId={item.software_id}
                  nombre={item.nombre}
                  metric={`${fmtNum(item.vistas ?? 0)} vistas`}
                />
              ))}
            </div>
          </Section>

          <Section
            titulo="Mejor valorados"
            loading={mejorValorados.loading}
            error={mejorValorados.error}
            refetch={mejorValorados.refetch}
            isEmpty={mejorValorados.data.length === 0}
            emptyMessage="Aún no hay valoraciones registradas."
          >
            <div className="flex flex-col">
              {mejorValorados.data.map((item, i) => (
                <PodioRow
                  key={item.software_id}
                  rank={i + 1}
                  softwareId={item.software_id}
                  nombre={item.nombre}
                  metric={`${(item.promedio ?? 0).toFixed(1)} ★`}
                />
              ))}
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}
