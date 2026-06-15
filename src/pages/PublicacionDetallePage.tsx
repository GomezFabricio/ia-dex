import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { usePublicacion } from '../hooks/usePublicacion'
import VideoEmbed from '../components/software/VideoEmbed'
import Modal from '../components/ui/Modal'
import { formatFecha } from '../lib/date'

// ---------------------------------------------------------------------------
// PublicacionDetallePage — single publicacion by :slug (publicaciones S2).
// Reads :slug via usePublicacion(slug). D4 states: loading / error+retry /
// not-found / data. A null result is the NOT-FOUND state.
//
// cuerpo renders as plain text with whitespace-pre-wrap (NO markdown, per D10).
// imagen_url renders directly in <img src> with object-cover, BYPASSING the
// useImageOk 200px gate (author-curated images, per ST3). video_url renders via
// VideoEmbed + toEmbedUrl. Author name comes from autorNombre (Capability 4).
// ---------------------------------------------------------------------------

export default function PublicacionDetallePage() {
  const { slug: slugParam } = useParams<{ slug: string }>()
  const slug = slugParam ?? ''

  const { data, loading, error, refetch } = usePublicacion(slug)

  // Single-image lightbox: tracks the active image URL and its gallery index for
  // accessible alt text. null when closed (no carousel — Modal's Esc/backdrop
  // handles dismissal).
  const [lightbox, setLightbox] = useState<{ url: string; index: number } | null>(null)

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
          </p>
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

        {/* cuerpo — plain text, line breaks preserved (no markdown) */}
        {pub.cuerpo !== null && pub.cuerpo !== '' && (
          <div className="whitespace-pre-wrap text-body-lg leading-relaxed text-text">
            {pub.cuerpo}
          </div>
        )}

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
    </div>
  )
}
