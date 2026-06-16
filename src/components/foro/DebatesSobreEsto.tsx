import { Link } from 'react-router-dom'
import { useForoTemas } from '../../hooks/useForoTemas'
import { formatFecha } from '../../lib/date'
import { foroFiltroHref } from '../../lib/foroScope'
import type { ForoScopeTipo } from '../../types/dtos'

// ---------------------------------------------------------------------------
// DebatesSobreEsto — "Debates" section embedded on a herramienta / tema / sí
// detail page. Previews the most recent debates scoped to that entity and links
// to the foro filtered to it (where "Nuevo tema" pre-selects this scope).
// Always rendered so the foro is reachable from the entity even with 0 debates.
// ---------------------------------------------------------------------------

type Props = {
  tipo: ForoScopeTipo
  id: string
  max?: number
}

export default function DebatesSobreEsto({ tipo, id, max = 4 }: Props) {
  const { temas, loading, error } = useForoTemas(tipo, id)
  const foroHref = foroFiltroHref(tipo, id)
  const preview = temas.slice(0, max)

  return (
    <section className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 px-6 pb-12 sm:px-8 lg:px-12">
      <header className="flex flex-wrap items-center gap-3">
        <span
          className="h-[18px] w-1 shrink-0 rounded-sm bg-gradient-to-b from-accent to-accent-2"
          aria-hidden="true"
        />
        <h2 className="font-display m-0 text-xl font-semibold tracking-[-0.015em] text-text">
          Debates
        </h2>
        {!loading && error === null && temas.length > 0 && (
          <span className="dex-label rounded-full border border-border px-[9px] py-[3px] text-[10px] text-muted">
            {temas.length} {temas.length === 1 ? 'debate' : 'debates'}
          </span>
        )}
        <Link
          to={foroHref}
          className="dex-label ml-auto text-[10px] text-accent no-underline transition-transform hover:translate-x-0.5"
        >
          Ir al foro →
        </Link>
      </header>

      {loading ? (
        <p className="text-sm text-muted">Cargando debates…</p>
      ) : error !== null ? (
        <p className="text-sm text-muted">No se pudieron cargar los debates.</p>
      ) : temas.length === 0 ? (
        <Link
          to={foroHref}
          className="qtile flex items-center justify-between gap-4 rounded-2xl border border-dashed border-border bg-surface/40 p-5 no-underline transition-all duration-200 hover:border-accent/60"
        >
          <span className="text-sm text-muted">
            Todavía no hay debates sobre esto. ¿Abrís el primero?
          </span>
          <span className="dex-label shrink-0 text-[10px] text-accent">Abrir debate →</span>
        </Link>
      ) : (
        <>
          <ul className="grid list-none grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
            {preview.map((tema) => (
              <li key={tema.id}>
                <Link
                  to={`/foro/${tema.id}`}
                  className="qtile group flex h-full flex-col gap-2 rounded-2xl border border-border bg-surface p-5 no-underline transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/60 hover:shadow-glow"
                >
                  <span className="dex-label text-[9px] text-accent-2">Debate</span>
                  <h3 className="font-display line-clamp-2 text-base font-semibold leading-tight tracking-[-0.01em] text-text">
                    {tema.titulo}
                  </h3>
                  <span className="dex-label mt-auto text-[9px] text-muted">
                    {tema.autorNombre} · {formatFecha(tema.created_at)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {temas.length > preview.length && (
            <Link
              to={foroHref}
              className="dex-label w-fit text-[10px] text-accent no-underline transition-transform hover:translate-x-0.5"
            >
              Ver los {temas.length} debates →
            </Link>
          )}
        </>
      )}
    </section>
  )
}
