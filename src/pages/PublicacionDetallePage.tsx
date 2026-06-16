import { useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { usePublicacion } from '../hooks/usePublicacion'
import { usePublicaciones } from '../hooks/usePublicaciones'
import VideoEmbed from '../components/software/VideoEmbed'
import Modal from '../components/ui/Modal'
import StarRating from '../components/ui/StarRating'
import { formatFecha } from '../lib/date'
import { hueFor, washFor } from '../lib/hue'
import { sanitizeHtml, htmlToText, looksLikeHtml } from '../lib/sanitizeHtml'
import type { PublicacionConAutor } from '../types/dtos'

// ---------------------------------------------------------------------------
// PublicacionDetallePage — single publicacion by :slug (publicaciones S2).
// Reads :slug via usePublicacion(slug). D4 states: loading / error+retry /
// not-found / data. A null result is the NOT-FOUND state.
//
// cuerpo renders as rich text: new bodies are HTML produced by the editor and
// are sanitized (DOMPurify) before dangerouslySetInnerHTML inside a .dex-prose
// container; legacy plain-text bodies (no tags) keep their whitespace-pre-wrap
// rendering. looksLikeHtml() picks the path; sanitizeHtml is the trust boundary.
// imagen_url renders directly in <img src> with object-cover, BYPASSING the
// useImageOk 200px gate (author-curated images, per ST3). video_url renders via
// VideoEmbed + toEmbedUrl. Author name comes from autorNombre (Capability 4).
//
// "Seguí leyendo" surfaces related (same tema/clasificación, fallback latest)
// publications at the foot of the article.
// ---------------------------------------------------------------------------

// Compact card for the "Seguí leyendo" related strip.
function RelacionadaCard({ pub }: { pub: PublicacionConAutor }) {
  const fecha = formatFecha(pub.created_at)
  const wash = washFor(hueFor(pub.id))

  return (
    <Link
      to={`/blog/${pub.slug}`}
      className="qtile group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface no-underline transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/60 hover:shadow-glow"
    >
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
              className="font-display absolute inset-0 grid place-items-center text-[3rem] font-bold leading-none text-[color-mix(in_oklab,var(--color-text)_12%,transparent)]"
            >
              {pub.titulo.charAt(0)}
            </span>
          </>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <h3 className="font-display line-clamp-2 text-base font-semibold leading-tight text-text">
          {pub.titulo}
        </h3>
        <span className="dex-label mt-auto text-[9px] text-muted">
          {pub.autorNombre}
          {fecha !== '' && <> · {fecha}</>}
        </span>
      </div>
    </Link>
  )
}

export default function PublicacionDetallePage() {
  const { slug: slugParam } = useParams<{ slug: string }>()
  const slug = slugParam ?? ''

  const { data, loading, error, refetch } = usePublicacion(slug)

  // Single-image lightbox: tracks the active image URL and its gallery index for
  // accessible alt text. null when closed (no carousel — Modal's Esc/backdrop
  // handles dismissal).
  const [lightbox, setLightbox] = useState<{ url: string; index: number } | null>(null)

  // Related feed for "Seguí leyendo": all published pubs, preferring ones that
  // share this pub's tema/clasificación, falling back to latest, excluding the
  // current pub. Computed client-side from the feed (small scale).
  const { data: todas, loading: todasLoading } = usePublicaciones()
  const relacionadas = useMemo<PublicacionConAutor[]>(() => {
    if (data === null) return []
    const otras = todas.filter((p) => p.id !== data.id)
    const mismoTema = otras.filter(
      (p) =>
        (data.tema_id !== null && p.tema_id === data.tema_id) ||
        (data.clasificacion_si_id !== null &&
          p.clasificacion_si_id === data.clasificacion_si_id),
    )
    const ids = new Set(mismoTema.map((p) => p.id))
    const resto = otras.filter((p) => !ids.has(p.id))
    return [...mismoTema, ...resto].slice(0, 3)
  }, [todas, data])

  // Sanitize the HTML body once per fetched row (not on every render). Lives up
  // here with the other hooks so it runs before the early returns below (React
  // hooks rules). `data` may still be null here — guard with optional chaining;
  // an empty string is the no-body fallback. Depends on the whole `data` object
  // (matching the relacionadas memo) so the linter's inferred deps line up.
  const cuerpoSanitizado = useMemo(
    () => (data?.cuerpo ? sanitizeHtml(data.cuerpo) : ''),
    [data],
  )

  // Loading state
  if (loading) {
    return (
      <div className="mx-auto max-w-[1400px] px-6 pt-12 sm:px-8 lg:px-12">
        <p className="text-muted">Cargando…</p>
      </div>
    )
  }

  // Error state
  if (error !== null) {
    return (
      <div className="mx-auto flex max-w-[1400px] flex-col gap-2 px-6 pt-12 sm:px-8 lg:px-12">
        <p className="text-muted">No se pudieron cargar los datos</p>
        <button
          type="button"
          onClick={refetch}
          className="self-start text-accent transition-colors hover:text-text"
        >
          Reintentar
        </button>
      </div>
    )
  }

  // Not-found state — maybeSingle returned null
  if (data === null) {
    return (
      <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-6 pt-12 sm:px-8 lg:px-12">
        <p className="text-muted">No se encontró la publicación solicitada.</p>
        <Link to="/blog" className="text-sm text-muted transition-colors hover:text-text">
          ← Volver al blog
        </Link>
      </div>
    )
  }

  // Data present
  const pub = data
  const fecha = formatFecha(pub.created_at)
  const enlacesFiltrados = pub.enlaces.filter((e) => e.url)
  // Word count from the TEXT, not the markup, so HTML tags never inflate it.
  const textoCuerpo = pub.cuerpo !== null ? htmlToText(pub.cuerpo) : ''
  const palabrasCuerpo =
    textoCuerpo === '' ? 0 : textoCuerpo.split(/\s+/).filter(Boolean).length
  // Only show a reading-time badge for posts long enough to be meaningful.
  const minutosLectura = palabrasCuerpo >= 50 ? Math.max(1, Math.round(palabrasCuerpo / 200)) : 0

  return (
    <div className="flex flex-col">
      {/* Header */}
      <section className="relative overflow-hidden px-6 pt-24 pb-6 sm:px-8 lg:px-12">
        <div
          aria-hidden="true"
          className="dex-grid pointer-events-none absolute inset-0 opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent)]"
        />
        <div
          aria-hidden="true"
          className="orb-float pointer-events-none absolute -top-36 left-[10%] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--color-accent)_60%,transparent),transparent_65%)] opacity-30 blur-[100px]"
        />
        <div className="relative mx-auto max-w-[820px]">
          <Link
            to="/blog"
            className="dex-label mb-5 inline-block text-[10px] text-muted transition-colors hover:text-text"
          >
            ← Blog
          </Link>
          <p className="dex-label mb-3.5 text-[11px] text-accent-2">Publicación</p>
          <h1 className="font-display mb-4 text-[clamp(2rem,4.5vw,3rem)] font-bold leading-[1.07] tracking-[-0.02em] text-text">
            {pub.titulo}
          </h1>
          <p className="dex-label text-[10px] text-muted">
            {pub.autorNombre}
            {fecha !== '' && <> · {fecha}</>}
            {minutosLectura > 0 && <> · {minutosLectura} min de lectura</>}
          </p>

          {/* Per-article rating widget — self-styling, key resets state per slug */}
          <div className="mt-4">
            <StarRating key={pub.id} tipo="publicacion" contenidoId={pub.id} />
          </div>
        </div>
      </section>

      {/* Body */}
      <article className="mx-auto flex w-full max-w-[820px] flex-col gap-8 px-6 pb-16 sm:px-8 lg:px-12">
        {/* Author-curated image — direct render, no useImageOk gate */}
        {pub.imagen_url !== null && pub.imagen_url !== '' && (
          <div className="overflow-hidden rounded-[18px] border border-border">
            <img
              src={pub.imagen_url}
              alt={pub.titulo}
              className="aspect-video w-full object-cover"
            />
          </div>
        )}

        {/* Galería — author-curated images, direct render (no useImageOk gate),
            rendered only when there is at least one image */}
        {pub.imagenes.length > 0 && (
          <section className="reveal flex flex-col gap-3">
            <h2 className="font-display mb-3.5 flex items-center gap-3 text-xl font-semibold text-text">
              <span
                className="h-[18px] w-1 shrink-0 rounded-sm bg-gradient-to-b from-accent to-accent-2"
                aria-hidden="true"
              />
              Galería
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {pub.imagenes.map((url, index) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => setLightbox({ url, index })}
                  aria-label={`Ampliar imagen ${index + 1} de la galería`}
                  className="overflow-hidden rounded-[14px] border border-border transition-colors hover:border-accent/60"
                >
                  <img
                    src={url}
                    alt={`Imagen ${index + 1} de la galería`}
                    className="aspect-video w-full object-cover"
                  />
                </button>
              ))}
            </div>
            <Modal
              open={lightbox !== null}
              onClose={() => setLightbox(null)}
              maxWidthClassName="max-w-5xl"
            >
              {lightbox !== null && (
                <>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setLightbox(null)}
                      aria-label="Cerrar imagen"
                      className="absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface text-muted transition-colors hover:border-accent/60 hover:text-text"
                    >
                      ×
                    </button>
                    <img
                      src={lightbox.url}
                      alt={`Imagen ${lightbox.index + 1} de la galería`}
                      className="h-auto w-full object-contain"
                    />
                  </div>
                </>
              )}
            </Modal>
          </section>
        )}

        {/* cuerpo — sanitized HTML for new rich-text bodies, plain text (line
            breaks preserved) for legacy bodies */}
        {pub.cuerpo !== null &&
          pub.cuerpo !== '' &&
          (looksLikeHtml(pub.cuerpo) ? (
            <div
              className="dex-prose text-body-lg leading-relaxed text-text"
              dangerouslySetInnerHTML={{ __html: cuerpoSanitizado }}
            />
          ) : (
            <div className="whitespace-pre-wrap text-body-lg leading-relaxed text-text">
              {pub.cuerpo}
            </div>
          ))}

        {/* Video */}
        {pub.video_url !== null && pub.video_url !== '' && (
          <section className="reveal">
            <h2 className="font-display mb-3.5 flex items-center gap-3 text-xl font-semibold text-text">
              <span
                className="h-[18px] w-1 shrink-0 rounded-sm bg-gradient-to-b from-accent to-accent-2"
                aria-hidden="true"
              />
              Video
            </h2>
            <div className="overflow-hidden rounded-[18px] border border-border">
              <VideoEmbed url={pub.video_url} nombre={pub.titulo} />
            </div>
          </section>
        )}

        {/* Enlaces de interés — hidden when empty after filtering */}
        {enlacesFiltrados.length > 0 && (
          <section className="reveal flex flex-col gap-3">
            <div className="dex-label text-[10px] text-muted">Enlaces de interés</div>
            <div className="flex flex-wrap gap-2.5">
              {enlacesFiltrados.map((enlace, index) => (
                <a
                  key={index}
                  href={enlace.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-[10px] border border-border bg-surface px-3.5 py-2.5 text-sm text-text no-underline transition-colors hover:border-accent/60 hover:text-accent-strong"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-accent-2"
                    aria-hidden="true"
                  >
                    <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
                  </svg>
                  {enlace.titulo}
                </a>
              ))}
            </div>
          </section>
        )}
      </article>

      {/* Seguí leyendo — related / latest publications. Skeleton while the feed
          loads so the section reserves space instead of popping in. */}
      {(todasLoading || relacionadas.length > 0) && (
        <section className="border-t border-border">
          <div className="mx-auto w-full max-w-[1400px] px-6 py-12 sm:px-8 lg:px-12">
            <h2 className="font-display mb-6 flex items-center gap-3 text-xl font-semibold text-text">
              <span
                className="h-[18px] w-1 shrink-0 rounded-sm bg-gradient-to-b from-accent to-accent-2"
                aria-hidden="true"
              />
              Seguí leyendo
            </h2>
            {todasLoading ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="skeleton h-64 rounded-2xl" />
                ))}
              </div>
            ) : (
              <ul className="grid list-none grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {relacionadas.map((p) => (
                  <li key={p.id}>
                    <RelacionadaCard pub={p} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
