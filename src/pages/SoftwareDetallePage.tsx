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
import InlineEdit from '../components/admin/InlineEdit'
import { useIsAdmin } from '../hooks/useIsAdmin'
import { hueFor, washFor } from '../lib/hue'
import * as eventosService from '../services/eventosService'
import * as softwareService from '../services/softwareService'
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
  // Admin gate for the edit-only spec rows (Imagen / Video) that exist solely as
  // edit anchors — they must not leak into the public view. InlineEdit still
  // gates its own pencil; this only decides which rows to MOUNT. Called
  // unconditionally (Rules of Hooks) before the state early-returns below.
  const isAdmin = useIsAdmin()
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
            {/* Each cell is a block <div> (grid child). InlineEdit wraps only the <dd> content so
                the pencil sits inline next to the value — no inline <span> as a grid child. */}
            <div className="border-t border-border py-3.5">
              <dt className="dex-label mb-1.5 text-[9px] text-muted">Objetivo</dt>
              <dd className="text-sm leading-relaxed text-text">
                <InlineEdit
                  value={sw.objetivo}
                  variant="textarea"
                  label="el objetivo"
                  onSave={(next) =>
                    softwareService.editar(sw.id, { objetivo: next as string | null }).then(() => {})
                  }
                  onSaved={software.refetch}
                >
                  <span>{sw.objetivo ?? '—'}</span>
                </InlineEdit>
              </dd>
            </div>
            <div className="border-t border-border py-3.5">
              <dt className="dex-label mb-1.5 text-[9px] text-muted">Descripción</dt>
              <dd className="text-sm leading-relaxed text-text">
                <InlineEdit
                  value={sw.descripcion_corta}
                  variant="textarea"
                  label="la descripción"
                  onSave={(next) =>
                    softwareService
                      .editar(sw.id, { descripcion_corta: next as string | null })
                      .then(() => {})
                  }
                  onSaved={software.refetch}
                >
                  <span>{sw.descripcion_corta ?? '—'}</span>
                </InlineEdit>
              </dd>
            </div>
            {/* Imagen — edit-only anchor; admins only. The public cover lives in the
                hero, so this row would only duplicate it for non-admins. */}
            {isAdmin && (
              <div className="border-t border-border py-3.5">
                <dt className="dex-label mb-1.5 text-[9px] text-muted">Imagen</dt>
                <dd className="text-sm leading-relaxed text-text">
                  <InlineEdit
                    value={sw.imagen_url}
                    variant="image"
                    label="la imagen"
                    uploadPrefix="software"
                    uploadEntityId={sw.id}
                    onSave={(next) =>
                      softwareService.editar(sw.id, { imagen_url: next as string | null }).then(() => {})
                    }
                    onSaved={software.refetch}
                  >
                    <ImageSpecValue value={sw.imagen_url} />
                  </InlineEdit>
                </dd>
              </div>
            )}
            <div className="border-t border-border py-3.5">
              <dt className="dex-label mb-1.5 text-[9px] text-muted">Licencia</dt>
              <dd className="dex-label text-[13px] text-text">
                <InlineEdit
                  value={sw.licencia}
                  variant="text"
                  label="la licencia"
                  onSave={(next) =>
                    softwareService.editar(sw.id, { licencia: next as string | null }).then(() => {})
                  }
                  onSaved={software.refetch}
                >
                  <span>{sw.licencia ?? '—'}</span>
                </InlineEdit>
              </dd>
            </div>
            <div className="border-t border-border py-3.5">
              <dt className="dex-label mb-1.5 text-[9px] text-muted">Año de lanzamiento</dt>
              <dd className="dex-label text-[13px] text-text">
                <InlineEdit
                  value={sw.anio_lanzamiento}
                  variant="number"
                  label="el año de lanzamiento"
                  onSave={(next) =>
                    softwareService
                      .editar(sw.id, { anio_lanzamiento: next as number | null })
                      .then(() => {})
                  }
                  onSaved={software.refetch}
                >
                  <span>{sw.anio_lanzamiento ?? '—'}</span>
                </InlineEdit>
              </dd>
            </div>
            <div className="border-t border-border py-3.5">
              <dt className="dex-label mb-1.5 text-[9px] text-muted">Autor de referencia</dt>
              <dd className="text-sm leading-relaxed text-text">
                <InlineEdit
                  value={sw.autor_referencia}
                  variant="text"
                  label="el autor"
                  onSave={(next) =>
                    softwareService
                      .editar(sw.id, { autor_referencia: next as string | null })
                      .then(() => {})
                  }
                  onSaved={software.refetch}
                >
                  <span>{sw.autor_referencia ?? '—'}</span>
                </InlineEdit>
              </dd>
            </div>
            <div className="border-t border-border py-3.5">
              <dt className="dex-label mb-1.5 text-[9px] text-muted">Acceso</dt>
              <dd className="text-sm leading-relaxed text-text">
                <InlineEdit
                  value={sw.url_acceso}
                  variant="url"
                  label="la URL de acceso"
                  onSave={(next) =>
                    softwareService.editar(sw.id, { url_acceso: next as string | null }).then(() => {})
                  }
                  onSaved={software.refetch}
                >
                  {sw.url_acceso != null ? (
                    <a
                      href={sw.url_acceso}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-accent-2 transition-colors hover:text-text"
                    >
                      {sw.url_acceso}
                    </a>
                  ) : (
                    <span>—</span>
                  )}
                </InlineEdit>
              </dd>
            </div>
            {/* Video — edit-only anchor; admins only (avoids leaking the raw YouTube
                URL to the public). The public VideoEmbed is in a separate gated
                <section> below (Decision 6, design.md line 407). Always rendered for
                admins so they can ADD a video even when video_url is null. */}
            {isAdmin && (
              <div className="border-t border-border py-3.5">
                <dt className="dex-label mb-1.5 text-[9px] text-muted">Video</dt>
                <dd className="text-sm leading-relaxed text-text">
                  <InlineEdit
                    value={sw.video_url}
                    variant="youtube"
                    label="el video"
                    onSave={(next) =>
                      softwareService.editar(sw.id, { video_url: next as string | null }).then(() => {})
                    }
                    onSaved={software.refetch}
                  >
                    <span>{sw.video_url ?? '—'}</span>
                  </InlineEdit>
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* SI Classification chips — grouped by criterio axis (additive, no existing chip replaced) */}
        {!clasificacionesSI.loading && clasificacionesSI.data.length > 0 && (
          <SIChipGroups clasificaciones={clasificacionesSI.data} />
        )}

        {/* Public video embed — gated on a set value; visible to everyone when present. */}
        {sw.video_url != null && (
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
// ImageSpecValue — the <dd>-content portion for the imagen_url InlineEdit cell.
// Shows a small thumbnail when set, an em dash when empty. Rendered inside the
// <dd> of the Imagen grid cell; the SpecRow <div> container lives at the call
// site so it (not the InlineEdit <span>) is the direct <dl> grid child.
// The hero background is aria-hidden/decorative, so this is the stable, visible
// edit anchor; on save + refetch the hero re-validates via useImageOk.
// ---------------------------------------------------------------------------

function ImageSpecValue({ value }: { value: string | null | undefined }) {
  const isEmpty = value === null || value === undefined || value === ''

  if (isEmpty) return <span>—</span>

  return (
    <img
      src={value}
      alt=""
      className="h-12 w-auto rounded-md border border-border object-cover"
    />
  )
}

