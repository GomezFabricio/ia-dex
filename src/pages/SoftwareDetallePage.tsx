import { useEffect, useMemo, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useSoftware } from '../hooks/useSoftware'
import { useRelacionados } from '../hooks/useRelacionados'
import { useRecomendaciones } from '../hooks/useRecomendaciones'
import { useTemas } from '../hooks/useTemas'
import { useImageOk } from '../hooks/useImageOk'
import { useClasificacionesDeSoftware } from '../hooks/useClasificacionesDeSoftware'
import VideoEmbed from '../components/software/VideoEmbed'
import ContentRow from '../components/software/ContentRow'
import StarRating from '../components/ui/StarRating'
import { hueFor, washFor } from '../lib/hue'
import * as eventosService from '../services/eventosService'
import type { ClasificacionConCriterio, CriterioSI } from '../types/dtos'

// ---------------------------------------------------------------------------
// SoftwareDetallePage — "cine-neural" software ficha (redesign phase 5).
// A full-bleed marquee hero (theme wash or cover art + giant initial, bottom
// scrim, neural-text name, objetivo tagline, license/year/author meta, CTAs +
// rating) over a centered Especificaciones panel, the video, and a Relacionados
// poster rail. Reads :id from params; every hook runs unconditionally so the
// D4 state quartet (loading / error+retry / not-found / data) can early-return.
//
// Related rail: useRelacionados (PR-6 semantic neighbours) is primary; when it
// returns loaded-empty (no embedding / nothing within margin) we fall back to
// useRecomendaciones (same-theme). ContentRow renders nothing on [].
//
// Vista event: fires once per id (ref-guarded against StrictMode double-fire),
// regardless of fetch outcome. Fail-soft — eventosService never throws.
// ---------------------------------------------------------------------------

export default function SoftwareDetallePage() {
  const { slug } = useParams<{ slug: string }>()
  const softwareSlug = slug ?? ''

  const software = useSoftware(softwareSlug)
  // Once resolved, use the UUID for hooks that require an id (relacionados, clasificaciones, evento).
  const softwareId = software.data?.id ?? ''
  const relacionados = useRelacionados(softwareId === '' ? undefined : softwareId)
  const recos = useRecomendaciones(software.data?.tema_id, softwareId)
  const temas = useTemas()
  const clasificacionesSI = useClasificacionesDeSoftware(softwareId === '' ? undefined : softwareId)

  // Cover-art gate: hide low-res raster images (they would upscale into a blurry
  // backdrop) and fall back to the wash + lettered placeholder. SVGs always pass.
  const cover = useImageOk(software.data?.imagen_url, 200)

  // tema_id → tema.nombre resolver for the hero kicker + related rail kickers.
  const temaNombrePorId = useMemo(() => {
    const byId = new Map(temas.data.map((t) => [t.id, t.nombre]))
    return (temaId: string) => byId.get(temaId)
  }, [temas.data])

  // "Ver video" jumps to the embed within the <main> scroll container.
  const videoRef = useRef<HTMLElement>(null)
  const scrollToVideo = () => videoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  // Vista event — exactly once per resolved softwareId (dedupes StrictMode + remounts).
  // Fires only after the slug resolves to an id so the FK in eventos is valid.
  const vistaRegistrada = useRef<string | null>(null)
  useEffect(() => {
    if (softwareId === '' || vistaRegistrada.current === softwareId) return
    vistaRegistrada.current = softwareId
    void eventosService.registrarEvento({ tipo: 'vista', software_id: softwareId })
  }, [softwareId])

  // Loading state
  if (software.loading) {
    return (
      <div className="mx-auto max-w-[1400px] px-6 pt-10 sm:px-8 lg:px-12">
        <p className="text-muted">Cargando…</p>
      </div>
    )
  }

  // Error state
  if (software.error !== null) {
    return (
      <div className="mx-auto flex max-w-[1400px] flex-col gap-2 px-6 pt-10 sm:px-8 lg:px-12">
        <p className="text-muted">No se pudieron cargar los datos</p>
        <button
          type="button"
          onClick={software.refetch}
          className="self-start text-accent transition-colors hover:text-text"
        >
          Reintentar
        </button>
      </div>
    )
  }

  // Not-found state
  if (software.data === null) {
    return (
      <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-6 pt-10 sm:px-8 lg:px-12">
        <p className="text-muted">No se encontró el software solicitado.</p>
        <Link to="/catalogo" className="text-sm text-muted transition-colors hover:text-text">
          ← Volver al catálogo
        </Link>
      </div>
    )
  }

  // Data present — render the ficha.
  const sw = software.data
  const hue = hueFor(sw.tema_id || sw.id)
  const wash = washFor(hue)
  const temaNombre = temaNombrePorId(sw.tema_id)
  const railItems = relacionados.data.length > 0 ? relacionados.data : recos.data

  return (
    <div className="flex flex-col">
      {/* Marquee hero */}
      <section className="relative flex min-h-[68vh] items-end overflow-hidden lg:min-h-[80vh]">
        {cover.show && sw.imagen_url ? (
          // Cover art: blurred fill, dimmed so the scrim + text stay readable.
          <img
            src={sw.imagen_url}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-sm"
          />
        ) : (
          <>
            <div aria-hidden="true" className="absolute inset-0" style={{ background: wash }} />
            <div aria-hidden="true" className="dex-grid absolute inset-0 opacity-30" />
            <div
              aria-hidden="true"
              className="font-display pointer-events-none absolute -top-[4%] right-[-2%] select-none text-[34vh] font-bold leading-none"
              style={{ color: `color-mix(in oklab, ${hue} 18%, transparent)` }}
            >
              {sw.nombre.charAt(0)}
            </div>
          </>
        )}

        {/* Bottom→top scrim to near-black so the copy always sits on dark. */}
        <div aria-hidden="true" className="hero-scrim pointer-events-none absolute inset-0" />

        <div className="relative mx-auto w-full max-w-[1400px] px-6 pb-14 sm:px-8 lg:px-12">
          <div className="max-w-[680px]">
            <p className="dex-label mb-4 text-[11px] text-accent-2">{temaNombre ?? 'Software'}</p>
            <h1 className="font-display neural-text mb-4 text-[clamp(2.5rem,6vw,4rem)] font-bold leading-[1.05] tracking-[-0.02em]">
              {sw.nombre}
            </h1>
            {sw.objetivo !== null && sw.objetivo !== undefined && (
              <p className="mb-5 line-clamp-3 max-w-[600px] text-[1.2rem] leading-snug text-text">
                {sw.objetivo}
              </p>
            )}

            {/* Meta chips */}
            <div className="mb-6 flex flex-wrap items-center gap-2">
              {sw.licencia !== null && sw.licencia !== undefined && (
                <span className="dex-label rounded-full border border-accent/35 bg-accent/[0.18] px-2.5 py-1 text-[10px] text-accent-strong">
                  {sw.licencia}
                </span>
              )}
              {sw.anio_lanzamiento !== null && sw.anio_lanzamiento !== undefined && (
                <span className="dex-label rounded-full border border-border bg-surface/70 px-2.5 py-1 text-[10px] text-muted">
                  {sw.anio_lanzamiento}
                </span>
              )}
              {sw.autor_referencia !== null && sw.autor_referencia !== undefined && (
                <span className="text-sm text-muted">{sw.autor_referencia}</span>
              )}
            </div>

            {/* CTAs + rating */}
            <div className="flex flex-wrap items-center gap-3.5">
              {sw.url_acceso !== null && sw.url_acceso !== undefined && (
                <a
                  href={sw.url_acceso}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cta-pulse font-display inline-flex items-center gap-2.5 rounded-[11px] bg-accent px-6 py-3.5 text-[15px] font-semibold text-on-accent no-underline"
                >
                  Ir al sitio
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M7 17 17 7M9 7h8v8" />
                  </svg>
                </a>
              )}
              {sw.video_url !== null && sw.video_url !== undefined && (
                <button
                  type="button"
                  onClick={scrollToVideo}
                  className="inline-flex items-center gap-2.5 rounded-[11px] border border-border-strong bg-surface/75 px-5 py-3.5 text-[15px] font-semibold text-text backdrop-blur-md transition-colors hover:border-accent/60"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                  Ver video
                </button>
              )}
            </div>

            <div className="mt-5">
              <StarRating key={sw.id} tipo="software" contenidoId={sw.id} />
            </div>
          </div>
        </div>
      </section>

      {/* Especificaciones + video — centered content column */}
      <div className="mx-auto w-full max-w-[1400px] px-6 py-10 sm:px-8 lg:px-12">
        <div className="reveal overflow-hidden rounded-[20px] border border-border bg-surface/55">
          <div className="dex-label px-6 pt-5 pb-1 text-[11px] text-accent-2">Especificaciones</div>
          <dl className="grid gap-x-6 px-6 pb-6 sm:grid-cols-2">
            <SpecRow label="Objetivo" value={sw.objetivo} />
            <SpecRow label="Descripción" value={sw.descripcion_corta} />
            <SpecRow label="Licencia" value={sw.licencia} mono />
            <SpecRow label="Año de lanzamiento" value={sw.anio_lanzamiento} mono />
            <SpecRow label="Autor de referencia" value={sw.autor_referencia} />
            <SpecRow label="Acceso" value={sw.url_acceso} href={sw.url_acceso ?? undefined} />
          </dl>
        </div>

        {/* SI Classification chips — grouped by criterio axis (additive, no existing chip replaced) */}
        {!clasificacionesSI.loading && clasificacionesSI.data.length > 0 && (
          <SIChipGroups clasificaciones={clasificacionesSI.data} />
        )}

        {sw.video_url !== null && sw.video_url !== undefined && (
          <section ref={videoRef} id="sw-video" className="reveal mt-8 scroll-mt-20">
            <h2 className="font-display mb-3.5 flex items-center gap-3 text-xl font-semibold text-text">
              <span className="h-[18px] w-1 shrink-0 rounded-sm bg-gradient-to-b from-accent to-accent-2" aria-hidden="true" />
              Video
            </h2>
            <div className="overflow-hidden rounded-[18px] border border-border">
              <VideoEmbed url={sw.video_url} nombre={sw.nombre} />
            </div>
          </section>
        )}
      </div>

      {/* Relacionados — semantic rail (PR-6), same-theme fallback */}
      <div className="pb-16">
        <ContentRow titulo="Relacionados" items={railItems} temaNombrePorId={temaNombrePorId} contained />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SIChipGroups — per-axis SI classification chip groups.
// Groups ClasificacionConCriterio[] by criterio.id, ordered by criterio.orden.
// Renders one labelled group per axis with one dex-label chip per category.
// Renders nothing when the array is empty (no empty container).
// ---------------------------------------------------------------------------

function SIChipGroups({ clasificaciones }: { clasificaciones: ClasificacionConCriterio[] }) {
  const groups = useMemo(() => {
    const byAxis = new Map<string, { criterio: CriterioSI; items: ClasificacionConCriterio[] }>()
    for (const c of clasificaciones) {
      const key = c.criterio.id
      if (!byAxis.has(key)) {
        byAxis.set(key, { criterio: c.criterio, items: [] })
      }
      byAxis.get(key)!.items.push(c)
    }
    return [...byAxis.values()].sort((a, b) => a.criterio.orden - b.criterio.orden)
  }, [clasificaciones])

  if (groups.length === 0) return null

  return (
    <section className="reveal mt-8">
      <h2 className="font-display mb-4 flex items-center gap-3 text-xl font-semibold text-text">
        <span
          className="h-[18px] w-1 shrink-0 rounded-sm bg-gradient-to-b from-accent to-accent-2"
          aria-hidden="true"
        />
        Clasificaciones de SI
      </h2>
      <div className="flex flex-col gap-4">
        {groups.map(({ criterio, items }) => (
          <div key={criterio.id}>
            <div className="dex-label mb-2 text-[10px] text-accent-2">{criterio.nombre}</div>
            <div className="flex flex-wrap gap-2">
              {items.map((cat) => (
                <span
                  key={cat.id}
                  className="dex-label rounded-full border border-border bg-surface/70 px-2.5 py-1 text-[10px] text-text"
                >
                  {cat.nombre}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// SpecRow — one labelled spec cell. Null/empty renders an em dash; a href turns
// the value into an external link; `mono` renders the value as a dex-label.
// ---------------------------------------------------------------------------

type SpecRowProps = {
  label: string
  value: string | number | null | undefined
  href?: string
  mono?: boolean
}

function SpecRow({ label, value, href, mono }: SpecRowProps) {
  const isEmpty = value === null || value === undefined || value === ''

  return (
    <div className="border-t border-border py-3.5">
      <dt className="dex-label mb-1.5 text-[9px] text-muted">{label}</dt>
      <dd className={mono ? 'dex-label text-[13px] text-text' : 'text-sm leading-relaxed text-text'}>
        {isEmpty ? (
          '—'
        ) : href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-accent-2 transition-colors hover:text-text"
          >
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  )
}
