import { Link } from 'react-router-dom'
import { useState } from 'react'
import { usePublicaciones } from '../hooks/usePublicaciones'
import { useIsAdmin } from '../hooks/useIsAdmin'
import { formatFecha } from '../lib/date'
import { hueFor, washFor } from '../lib/hue'
import type { PublicacionConAutor } from '../types/dtos'

// ---------------------------------------------------------------------------
// BlogPage — "cine-neural" publicaciones feed (publicaciones S2).
// Full-bleed hero + a feed of published publicaciones, newest-first, each
// linking to its /blog/:slug detail page. Two views, toggled and persisted in
// localStorage: LIST (a real-blog feed — newest post featured full-width, the
// rest as horizontal rows) and GRID (uniform cards). D4 states: loading /
// error+retry / not-found-or-empty / data. Author-curated thumbnails render
// directly (no useImageOk gate); a lettered placeholder over a per-item wash
// otherwise.
// ---------------------------------------------------------------------------

type BlogView = 'list' | 'grid'
const VIEW_KEY = 'blog:view'

function readStoredView(): BlogView {
  try {
    return localStorage.getItem(VIEW_KEY) === 'grid' ? 'grid' : 'list'
  } catch {
    return 'list'
  }
}

// Plain-text excerpt from the body: collapse whitespace; CSS line-clamp truncates.
function excerptOf(cuerpo: string | null): string {
  if (cuerpo === null) return ''
  return cuerpo.replace(/\s+/g, ' ').trim()
}

// Thumbnail or lettered placeholder. Sizing/rounding comes from `className` so
// each variant (featured / list / grid) can shape its own frame.
function Thumb({ pub, className }: { pub: PublicacionConAutor; className?: string }) {
  const wash = washFor(hueFor(pub.id))
  return (
    <div className={`relative overflow-hidden ${className ?? ''}`}>
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
  )
}

// Featured (newest) — full-width hero card, only in LIST view.
function PublicacionFeatured({ pub }: { pub: PublicacionConAutor }) {
  const fecha = formatFecha(pub.created_at)
  const ex = excerptOf(pub.cuerpo)

  return (
    <Link
      to={`/blog/${pub.slug}`}
      className="qtile group relative flex flex-col gap-5 overflow-hidden rounded-3xl border border-border bg-surface p-5 no-underline transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/60 hover:shadow-glow lg:flex-row lg:gap-7 lg:p-6"
    >
      <Thumb pub={pub} className="aspect-[16/9] w-full shrink-0 rounded-2xl lg:w-[58%]" />
      <div className="flex flex-1 flex-col gap-3 lg:py-2">
        <span className="dex-label text-[10px] text-accent-2">Última publicación</span>
        <h2 className="font-display line-clamp-3 text-[clamp(1.5rem,3vw,2.25rem)] font-bold leading-tight tracking-[-0.02em] text-text">
          {pub.titulo}
        </h2>
        {ex !== '' && (
          <p className="line-clamp-3 text-base leading-relaxed text-muted lg:line-clamp-4">{ex}</p>
        )}
        <div className="mt-auto flex items-center justify-between gap-3 pt-1">
          <span className="dex-label text-[10px] text-muted">
            {pub.autorNombre}
            {fecha !== '' && <> · {fecha}</>}
          </span>
          <span aria-hidden="true" className="dex-label text-[11px] text-accent transition-transform group-hover:translate-x-0.5">
            Leer →
          </span>
        </div>
      </div>
    </Link>
  )
}

// Card for the GRID (uniform) and LIST (horizontal row) views.
function PublicacionCard({ pub, variant }: { pub: PublicacionConAutor; variant: BlogView }) {
  const fecha = formatFecha(pub.created_at)
  const ex = excerptOf(pub.cuerpo)

  if (variant === 'list') {
    return (
      <Link
        to={`/blog/${pub.slug}`}
        className="qtile group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-border bg-surface p-4 no-underline transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/60 hover:shadow-glow sm:flex-row sm:gap-5"
      >
        <Thumb pub={pub} className="aspect-[16/9] w-full shrink-0 rounded-xl sm:w-64" />
        <div className="flex flex-1 flex-col gap-2">
          <span className="dex-label text-[9px] text-accent-2">Publicación</span>
          <h3 className="font-display line-clamp-2 text-xl font-semibold leading-tight tracking-[-0.01em] text-text">
            {pub.titulo}
          </h3>
          {ex !== '' && (
            <p className="line-clamp-2 text-sm leading-relaxed text-muted sm:line-clamp-3">{ex}</p>
          )}
          <div className="mt-auto flex items-center justify-between gap-3 pt-1">
            <span className="dex-label text-[9px] text-muted">
              {pub.autorNombre}
              {fecha !== '' && <> · {fecha}</>}
            </span>
            <span aria-hidden="true" className="dex-label text-[10px] text-accent transition-transform group-hover:translate-x-0.5">
              Leer →
            </span>
          </div>
        </div>
      </Link>
    )
  }

  // grid
  return (
    <Link
      to={`/blog/${pub.slug}`}
      className="qtile group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface no-underline transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/60 hover:shadow-glow"
    >
      <Thumb pub={pub} className="aspect-[16/9]" />
      <div className="flex flex-1 flex-col gap-2 p-5">
        <span className="dex-label text-[9px] text-accent-2">Publicación</span>
        <h3 className="font-display line-clamp-2 text-lg font-semibold leading-tight tracking-[-0.01em] text-text">
          {pub.titulo}
        </h3>
        {ex !== '' && (
          <p className="line-clamp-2 text-sm leading-relaxed text-muted">{ex}</p>
        )}
        <span className="dex-label mt-auto text-[9px] text-muted">
          {pub.autorNombre}
          {fecha !== '' && <> · {fecha}</>}
        </span>
        <span aria-hidden="true" className="dex-label text-[10px] text-accent transition-transform group-hover:translate-x-0.5">
          Leer →
        </span>
      </div>
    </Link>
  )
}

// Segmented list/grid toggle.
function ViewToggle({ view, onChange }: { view: BlogView; onChange: (v: BlogView) => void }) {
  const btn = (active: boolean) =>
    `grid h-8 w-8 place-items-center rounded-md transition-colors ${
      active ? 'bg-accent text-bg' : 'text-muted hover:text-text'
    }`
  return (
    <div role="group" aria-label="Vista del blog" className="inline-flex items-center gap-1 rounded-[10px] border border-border bg-surface/70 p-1 backdrop-blur-md">
      <button
        type="button"
        onClick={() => onChange('list')}
        aria-pressed={view === 'list'}
        aria-label="Vista lista"
        className={btn(view === 'list')}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => onChange('grid')}
        aria-pressed={view === 'grid'}
        aria-label="Vista cuadrícula"
        className={btn(view === 'grid')}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
        </svg>
      </button>
    </div>
  )
}

export default function BlogPage() {
  const { data, loading, error, refetch } = usePublicaciones()
  const isAdmin = useIsAdmin()
  const [view, setViewState] = useState<BlogView>(readStoredView)

  function setView(v: BlogView) {
    setViewState(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      /* localStorage unavailable — keep the in-memory choice */
    }
  }

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
          <div className="mb-3.5 flex items-center justify-between gap-3">
            <p className="dex-label text-[11px] text-accent-2">Blog · Contenido didáctico</p>
            {isAdmin && (
              <Link
                to="/admin/publicaciones"
                className="dex-label inline-flex shrink-0 items-center gap-1.5 rounded-[10px] border border-border bg-surface/70 px-3.5 py-2 text-[10px] text-text no-underline backdrop-blur-md transition-colors hover:border-accent/60 hover:text-accent-strong"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                Gestionar
              </Link>
            )}
          </div>
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
          <>
            <div className="mb-6 flex items-center justify-end">
              <ViewToggle view={view} onChange={setView} />
            </div>

            {view === 'list' ? (
              <div className="flex flex-col gap-4">
                <PublicacionFeatured pub={data[0]} />
                {data.length > 1 && (
                  <ul className="flex list-none flex-col gap-4">
                    {data.slice(1).map((pub) => (
                      <li key={pub.id}>
                        <PublicacionCard pub={pub} variant="list" />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <ul className="grid list-none grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6">
                {data.map((pub) => (
                  <li key={pub.id}>
                    <PublicacionCard pub={pub} variant="grid" />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  )
}
