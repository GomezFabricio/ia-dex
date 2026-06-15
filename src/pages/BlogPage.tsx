import { Link } from 'react-router-dom'
import { usePublicaciones } from '../hooks/usePublicaciones'
import { formatFecha } from '../lib/date'
import { hueFor, washFor } from '../lib/hue'
import type { PublicacionConAutor } from '../types/dtos'

// ---------------------------------------------------------------------------
// BlogPage — "cine-neural" publicaciones feed (publicaciones S2).
// Full-bleed hero + a card grid of published publicaciones, newest-first, each
// linking to its /blog/:slug detail page. D4 states: loading / error+retry /
// not-found-or-empty / data. Author-curated thumbnails render directly (no
// useImageOk gate); a lettered placeholder over a per-item wash otherwise.
// ---------------------------------------------------------------------------

function PublicacionCard({ pub }: { pub: PublicacionConAutor }) {
  const wash = washFor(hueFor(pub.id))
  const fecha = formatFecha(pub.created_at)

  return (
    <Link
      to={`/blog/${pub.slug}`}
      className="qtile group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-surface no-underline transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/60 hover:shadow-glow"
    >
      {/* Thumbnail or lettered placeholder */}
      <div className="relative aspect-[16/9] overflow-hidden">
        {pub.imagen_url !== null && pub.imagen_url !== '' ? (
          <img
            src={pub.imagen_url}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <>
            <div aria-hidden="true" className="absolute inset-0" style={{ background: wash }} />
            <div aria-hidden="true" className="dex-grid absolute inset-0 opacity-25" />
            <span
              aria-hidden="true"
              className="font-display absolute inset-0 grid place-items-center text-[4rem] font-bold leading-none text-[color-mix(in_oklab,var(--color-text)_12%,transparent)]"
            >
              {pub.titulo.charAt(0)}
            </span>
          </>
        )}
      </div>

      <div className="flex flex-col gap-2 p-5">
        <span className="dex-label text-[9px] text-accent-2">Publicación</span>
        <h3 className="font-display text-lg font-semibold leading-tight tracking-[-0.01em] text-text">
          {pub.titulo}
        </h3>
        <span className="dex-label text-[9px] text-muted">
          {pub.autorNombre}
          {fecha !== '' && <> · {fecha}</>}
        </span>
        <span className="dex-label mt-1.5 text-[10px] text-accent transition-transform group-hover:translate-x-0.5">
          Leer →
        </span>
      </div>
    </Link>
  )
}

export default function BlogPage() {
  const { data, loading, error, refetch } = usePublicaciones()

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden px-6 pt-24 pb-6 sm:px-8 lg:px-12">
        <div
          aria-hidden="true"
          className="dex-grid pointer-events-none absolute inset-0 opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent)]"
        />
        <div
          aria-hidden="true"
          className="orb-float-2 pointer-events-none absolute -right-12 -top-32 h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--color-accent-2)_55%,transparent),transparent_65%)] opacity-30 blur-[100px]"
        />
        <div className="relative mx-auto max-w-[1400px]">
          <p className="dex-label mb-3.5 text-[11px] text-accent-2">Blog · Contenido didáctico</p>
          <h1 className="font-display mb-3.5 text-[clamp(2.25rem,5vw,3.4rem)] font-bold tracking-[-0.02em] text-text">
            Publicaciones
          </h1>
          <p className="max-w-[580px] text-body-lg leading-relaxed text-muted">
            Artículos, guías y notas del equipo sobre software educativo y sistemas inteligentes.
          </p>
        </div>
      </section>

      {/* Feed */}
      <div className="mx-auto w-full max-w-[1400px] px-6 pb-16 sm:px-8 lg:px-12">
        {/* Loading */}
        {loading && <div className="skeleton h-80 w-full rounded-2xl" aria-hidden="true" />}

        {/* Error */}
        {!loading && error !== null && (
          <div className="flex flex-col gap-2">
            <p className="text-muted">No se pudieron cargar los datos</p>
            <button
              type="button"
              onClick={refetch}
              className="self-start text-accent transition-colors hover:text-text"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Empty / not-found */}
        {!loading && error === null && data.length === 0 && (
          <p className="text-muted">No hay publicaciones disponibles todavía.</p>
        )}

        {/* Data */}
        {!loading && error === null && data.length > 0 && (
          <ul className="grid list-none grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6">
            {data.map((pub) => (
              <li key={pub.id}>
                <PublicacionCard pub={pub} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
