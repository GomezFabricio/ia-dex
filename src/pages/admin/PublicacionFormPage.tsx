import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import * as publicacionesService from '../../services/publicacionesService'
import { listarTemas } from '../../services/temasService'
import { listarClasificaciones } from '../../services/clasificacionesService'
import { slugify } from '../../lib/slug'
import { toEmbedUrl } from '../../lib/youtube'
import type { Enlace, Tema, ClasificacionConCriterio } from '../../types/dtos'
import type { TablesInsert, TablesUpdate } from '../../types/database.types'

// ---------------------------------------------------------------------------
// PublicacionFormPage — create/edit form, controlled inputs + useState (NO
// forms library). Mounted under RequireAdmin.
//
// CREATE-ID approach (solves the image-path chicken-and-egg): the image upload
// path is `{publicacionId}/{filename}`, but a brand-new post has no id yet. So
// for a NEW publicacion we generate `workingId = crypto.randomUUID()` ON MOUNT
// and use it BOTH as the Storage path prefix AND as the row id passed to
// crear({ id: workingId, ... }). This lets the user upload an image before the
// first save. On edit, workingId is the existing row id.
//
// SLUG auto/override (SG1): while the user has NOT manually edited the slug
// field (`slugTouched === false`), the slug mirrors slugify(titulo) live on
// every keystroke. The moment the user edits the slug input, slugTouched flips
// true and the auto-overwrite stops — their value wins from then on.
// ---------------------------------------------------------------------------

type Estado = 'borrador' | 'publicado'

export default function PublicacionFormPage() {
  const navigate = useNavigate()
  const { id: idParam } = useParams<{ id: string }>()
  const isEdit = idParam !== undefined

  // Stable working id: existing id on edit, fresh uuid on create. Computed once.
  const [workingId] = useState<string>(() => idParam ?? crypto.randomUUID())

  // --- Form fields (controlled) -------------------------------------------
  const [titulo, setTitulo] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [cuerpo, setCuerpo] = useState('')
  const [imagenUrl, setImagenUrl] = useState('')
  const [imagenes, setImagenes] = useState<string[]>([])
  const [videoUrl, setVideoUrl] = useState('')
  const [enlaces, setEnlaces] = useState<Enlace[]>([])
  const [temaId, setTemaId] = useState('')
  const [clasificacionId, setClasificacionId] = useState('')
  const [estado, setEstado] = useState<Estado>('borrador')
  const [firma, setFirma] = useState('')

  // --- Select options ------------------------------------------------------
  const [temas, setTemas] = useState<Tema[]>([])
  const [clasificaciones, setClasificaciones] = useState<ClasificacionConCriterio[]>([])

  // --- UI state ------------------------------------------------------------
  const [loading, setLoading] = useState(isEdit)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadingGalleria, setUploadingGalleria] = useState(false)
  const [galleriaError, setGalleriaError] = useState<string | null>(null)
  const [removingGaleria, setRemovingGaleria] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [videoError, setVideoError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Load select options once.
  useEffect(() => {
    let active = true
    Promise.all([listarTemas(), listarClasificaciones()])
      .then(([t, c]) => {
        if (!active) return
        setTemas(t)
        setClasificaciones(c)
      })
      .catch(() => {
        // Non-fatal: the form still works without the optional FK selects.
      })
    return () => {
      active = false
    }
  }, [])

  // On edit, load the existing row and prefill. The slug is considered "touched"
  // when editing so we never auto-overwrite a persisted slug from the title.
  useEffect(() => {
    if (!isEdit || idParam === undefined) return
    let active = true

    publicacionesService
      .obtenerParaAdmin(idParam)
      .then((pub) => {
        if (!active) return
        if (pub === null) {
          setLoadError('No se encontró la publicación solicitada.')
          setLoading(false)
          return
        }
        setTitulo(pub.titulo)
        setSlug(pub.slug)
        setSlugTouched(true)
        setCuerpo(pub.cuerpo ?? '')
        setImagenUrl(pub.imagen_url ?? '')
        setImagenes(pub.imagenes)
        setVideoUrl(pub.video_url ?? '')
        setEnlaces(pub.enlaces)
        setTemaId(pub.tema_id ?? '')
        setClasificacionId(pub.clasificacion_si_id ?? '')
        setEstado(pub.estado === 'publicado' ? 'publicado' : 'borrador')
        setFirma(pub.firma ?? '')
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (!active) return
        setLoadError(
          err instanceof Error ? err.message : 'No se pudo cargar la publicación.',
        )
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [isEdit, idParam])

  // Title change: also drives the slug while it has not been manually edited.
  function handleTituloChange(value: string) {
    setTitulo(value)
    if (!slugTouched) setSlug(slugify(value))
  }

  function handleSlugChange(value: string) {
    setSlugTouched(true)
    setSlug(value)
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setUploadError(null)
    try {
      const url = await publicacionesService.subirImagen(workingId, file)
      setImagenUrl(url)
    } catch (err: unknown) {
      setUploadError(
        err instanceof Error ? err.message : 'No se pudo subir la imagen.',
      )
    } finally {
      setUploading(false)
    }
  }

  // --- Galería editing -----------------------------------------------------
  // Multi-file upload: sequential loop, append each returned URL on success so
  // partial progress survives a mid-batch failure (vs an all-or-nothing
  // Promise.all). uploadingGalleria gates the submit button while it runs.
  async function handleGalleriaChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploadingGalleria(true)
    setGalleriaError(null)
    try {
      for (const file of Array.from(files)) {
        const url = await publicacionesService.subirImagenGaleria(workingId, file)
        setImagenes((prev) => [...prev, url])
      }
    } catch (err: unknown) {
      setGalleriaError(
        err instanceof Error
          ? err.message
          : 'No se pudo subir una imagen de la galería.',
      )
    } finally {
      setUploadingGalleria(false)
      e.target.value = '' // allow re-selecting the same files
    }
  }

  // Pure index move — the ONE reorder primitive, shared by drag-and-drop AND the
  // up/down buttons so the two can never diverge. Clamps and no-ops out of range.
  function moveImagen(from: number, to: number) {
    setImagenes((prev) => {
      if (
        from === to ||
        from < 0 ||
        to < 0 ||
        from >= prev.length ||
        to >= prev.length
      ) {
        return prev
      }
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  // Remove: optimistic array edit, THEN await best-effort Storage cleanup. The
  // removingGaleria flag gates the submit button so the user cannot save while a
  // delete is still in flight (GAL4-REMOVE).
  async function removeImagen(index: number) {
    const url = imagenes[index]
    setImagenes((prev) => prev.filter((_, i) => i !== index))
    setRemovingGaleria(true)
    try {
      await publicacionesService.eliminarImagenGaleria(url)
    } finally {
      setRemovingGaleria(false)
    }
  }

  // --- Enlaces editing -----------------------------------------------------
  function addEnlace() {
    setEnlaces((prev) => [...prev, { titulo: '', url: '' }])
  }

  function updateEnlace(index: number, field: keyof Enlace, value: string) {
    setEnlaces((prev) =>
      prev.map((e, i) => (i === index ? { ...e, [field]: value } : e)),
    )
  }

  function removeEnlace(index: number) {
    setEnlaces((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    setVideoError(null)

    // ADM5: block submit on an unparseable (non-empty) video_url.
    const trimmedVideo = videoUrl.trim()
    if (trimmedVideo !== '' && toEmbedUrl(trimmedVideo) === null) {
      setVideoError('El enlace de video no es una URL de YouTube válida.')
      return
    }

    // Keep only fully-specified enlaces (both fields present).
    const enlacesLimpios = enlaces.filter(
      (en) => en.titulo.trim() !== '' && en.url.trim() !== '',
    )

    setSubmitting(true)
    try {
      if (isEdit && idParam !== undefined) {
        const patch: TablesUpdate<'publicaciones'> = {
          titulo: titulo.trim(),
          slug: slug.trim(),
          cuerpo: cuerpo === '' ? null : cuerpo,
          imagen_url: imagenUrl === '' ? null : imagenUrl,
          imagenes,
          video_url: trimmedVideo === '' ? null : trimmedVideo,
          enlaces: enlacesLimpios,
          tema_id: temaId === '' ? null : temaId,
          clasificacion_si_id: clasificacionId === '' ? null : clasificacionId,
          estado,
          firma: firma.trim() === '' ? null : firma.trim(),
        }
        await publicacionesService.editar(idParam, patch)
      } else {
        const input: TablesInsert<'publicaciones'> = {
          id: workingId,
          titulo: titulo.trim(),
          slug: slug.trim(),
          cuerpo: cuerpo === '' ? null : cuerpo,
          imagen_url: imagenUrl === '' ? null : imagenUrl,
          imagenes,
          video_url: trimmedVideo === '' ? null : trimmedVideo,
          enlaces: enlacesLimpios,
          tema_id: temaId === '' ? null : temaId,
          clasificacion_si_id: clasificacionId === '' ? null : clasificacionId,
          estado,
          firma: firma.trim() === '' ? null : firma.trim(),
        }
        await publicacionesService.crear(input)
      }
      navigate('/admin/publicaciones')
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error ? err.message : 'No se pudo guardar la publicación.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass =
    'bg-bg border border-border text-text rounded-lg px-3 py-2 placeholder:text-muted transition-colors focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30'

  if (loading) {
    return (
      <div className="mx-auto max-w-[820px] px-6 pt-24 sm:px-8 lg:px-12">
        <p className="text-muted">Cargando…</p>
      </div>
    )
  }

  if (loadError !== null) {
    return (
      <div className="mx-auto flex max-w-[820px] flex-col gap-4 px-6 pt-24 sm:px-8 lg:px-12">
        <p className="text-muted">{loadError}</p>
        <button
          type="button"
          onClick={() => navigate('/admin/publicaciones')}
          className="self-start text-accent transition-colors hover:text-text"
        >
          ← Volver a la lista
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[820px] px-6 pt-24 pb-16 sm:px-8 lg:px-12">
      <p className="dex-label mb-2 text-[11px] text-accent-2">Admin · Contenido</p>
      <h1 className="font-display mb-8 text-[clamp(1.75rem,4vw,2.5rem)] font-bold tracking-[-0.02em] text-text">
        {isEdit ? 'Editar publicación' : 'Nueva publicación'}
      </h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Título */}
        <div className="flex flex-col gap-1">
          <label htmlFor="titulo" className="text-muted text-sm">
            Título
          </label>
          <input
            id="titulo"
            type="text"
            required
            value={titulo}
            onChange={(e) => handleTituloChange(e.target.value)}
            className={inputClass}
            placeholder="Título de la publicación"
          />
        </div>

        {/* Slug */}
        <div className="flex flex-col gap-1">
          <label htmlFor="slug" className="text-muted text-sm">
            Slug
          </label>
          <input
            id="slug"
            type="text"
            value={slug}
            onChange={(e) => handleSlugChange(e.target.value)}
            className={inputClass}
            placeholder="se-genera-del-titulo"
          />
          <span className="text-xs text-muted">
            Se genera del título; podés editarlo manualmente.
          </span>
        </div>

        {/* Cuerpo */}
        <div className="flex flex-col gap-1">
          <label htmlFor="cuerpo" className="text-muted text-sm">
            Cuerpo
          </label>
          <textarea
            id="cuerpo"
            rows={10}
            value={cuerpo}
            onChange={(e) => setCuerpo(e.target.value)}
            className={`${inputClass} resize-y`}
            placeholder="Contenido de la publicación (opcional para un borrador)"
          />
        </div>

        {/* Imagen */}
        <div className="flex flex-col gap-2">
          <span className="text-muted text-sm">Imagen</span>
          <label
            className={`inline-flex w-fit cursor-pointer items-center rounded-md bg-accent px-3 py-2 text-sm font-semibold text-bg transition hover:opacity-90 focus-within:ring-2 focus-within:ring-accent ${
              uploading ? 'pointer-events-none opacity-50' : ''
            }`}
          >
            Elegir imagen
            <input
              id="imagen"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={handleFileChange}
              disabled={uploading}
              className="sr-only"
            />
          </label>
          {uploading && <span className="text-xs text-muted">Subiendo imagen…</span>}
          {uploadError !== null && (
            <span role="alert" className="text-sm text-error">
              {uploadError}
            </span>
          )}
          {imagenUrl !== '' && (
            <div className="flex flex-col gap-2">
              <div className="overflow-hidden rounded-lg border border-border">
                <img
                  src={imagenUrl}
                  alt="Vista previa"
                  className="aspect-video w-full max-w-sm object-cover"
                />
              </div>
              <span className="break-all text-xs text-muted">{imagenUrl}</span>
            </div>
          )}
        </div>

        {/* Galería */}
        <div className="flex flex-col gap-2">
          <span className="text-muted text-sm">Galería</span>
          <label
            className={`inline-flex w-fit cursor-pointer items-center rounded-md bg-accent px-3 py-2 text-sm font-semibold text-bg transition hover:opacity-90 focus-within:ring-2 focus-within:ring-accent ${
              uploadingGalleria || uploading || removingGaleria
                ? 'pointer-events-none opacity-50'
                : ''
            }`}
          >
            Elegir imágenes
            <input
              id="galeria"
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={handleGalleriaChange}
              disabled={uploadingGalleria || uploading || removingGaleria}
              className="sr-only"
            />
          </label>
          {uploadingGalleria && (
            <span className="text-xs text-muted">Subiendo imágenes…</span>
          )}
          {galleriaError !== null && (
            <span role="alert" className="text-sm text-error">
              {galleriaError}
            </span>
          )}
          {imagenes.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {imagenes.map((url, index) => (
                <div
                  key={url}
                  draggable
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragIndex !== null) moveImagen(dragIndex, index)
                    setDragIndex(null)
                  }}
                  onDragEnd={() => setDragIndex(null)}
                  className="flex flex-col gap-1.5 rounded-lg border border-border p-1.5"
                >
                  <div className="overflow-hidden rounded-md border border-border">
                    <img
                      src={url}
                      alt={`Imagen ${index + 1} de la galería`}
                      className="aspect-video w-full object-cover"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveImagen(index, index - 1)}
                        disabled={index === 0}
                        aria-label={`Mover imagen ${index + 1} antes`}
                        className="rounded-md border border-border px-2 py-1 text-xs text-muted transition-colors hover:border-accent/60 hover:text-text disabled:opacity-40"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveImagen(index, index + 1)}
                        disabled={index === imagenes.length - 1}
                        aria-label={`Mover imagen ${index + 1} después`}
                        className="rounded-md border border-border px-2 py-1 text-xs text-muted transition-colors hover:border-accent/60 hover:text-text disabled:opacity-40"
                      >
                        ↓
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeImagen(index)}
                      aria-label={`Quitar imagen ${index + 1}`}
                      className="rounded-md border border-border px-2 py-1 text-xs text-error transition-colors hover:border-error/60"
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Video */}
        <div className="flex flex-col gap-1">
          <label htmlFor="video" className="text-muted text-sm">
            Video (YouTube)
          </label>
          <input
            id="video"
            type="text"
            value={videoUrl}
            onChange={(e) => {
              setVideoUrl(e.target.value)
              if (videoError !== null) setVideoError(null)
            }}
            className={inputClass}
            placeholder="https://www.youtube.com/watch?v=…"
          />
          {videoError !== null && (
            <span role="alert" className="text-sm text-error">
              {videoError}
            </span>
          )}
        </div>

        {/* Enlaces */}
        <div className="flex flex-col gap-3">
          <span className="text-muted text-sm">Enlaces</span>
          {enlaces.map((enlace, index) => (
            <div key={index} className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={enlace.titulo}
                onChange={(e) => updateEnlace(index, 'titulo', e.target.value)}
                className={`${inputClass} sm:flex-1`}
                placeholder="Título del enlace"
                aria-label={`Título del enlace ${index + 1}`}
              />
              <input
                type="text"
                value={enlace.url}
                onChange={(e) => updateEnlace(index, 'url', e.target.value)}
                className={`${inputClass} sm:flex-1`}
                placeholder="https://…"
                aria-label={`URL del enlace ${index + 1}`}
              />
              <button
                type="button"
                onClick={() => removeEnlace(index)}
                className="rounded-md border border-border px-3 py-2 text-sm text-error transition-colors hover:border-error/60"
              >
                Quitar
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addEnlace}
            className="self-start rounded-md border border-border px-3.5 py-2 text-sm text-muted transition-colors hover:border-accent/60 hover:text-text"
          >
            + Agregar enlace
          </button>
        </div>

        {/* Tema */}
        <div className="flex flex-col gap-1">
          <label htmlFor="tema" className="text-muted text-sm">
            Tema
          </label>
          <select
            id="tema"
            value={temaId}
            onChange={(e) => setTemaId(e.target.value)}
            className={inputClass}
          >
            <option value="">Sin tema</option>
            {temas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
        </div>

        {/* Clasificación SI */}
        <div className="flex flex-col gap-1">
          <label htmlFor="clasificacion" className="text-muted text-sm">
            Clasificación (SI)
          </label>
          <select
            id="clasificacion"
            value={clasificacionId}
            onChange={(e) => setClasificacionId(e.target.value)}
            className={inputClass}
          >
            <option value="">Sin clasificación</option>
            {clasificaciones.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>

        {/* Firma — optional byline override (autor_id stays the true creator) */}
        <div className="flex flex-col gap-1">
          <label htmlFor="firma" className="text-muted text-sm">
            Firma (opcional)
          </label>
          <input
            id="firma"
            type="text"
            value={firma}
            onChange={(e) => setFirma(e.target.value)}
            className={inputClass}
            placeholder="Equipo ia-dex"
          />
          <span className="text-xs text-muted">
            Cómo se muestra el autor. Vacío = tu nombre de perfil, o «Equipo ia-dex» si no lo tenés cargado.
          </span>
        </div>

        {/* Estado */}
        <div className="flex flex-col gap-1">
          <label htmlFor="estado" className="text-muted text-sm">
            Estado
          </label>
          <select
            id="estado"
            value={estado}
            onChange={(e) => setEstado(e.target.value === 'publicado' ? 'publicado' : 'borrador')}
            className={inputClass}
          >
            <option value="borrador">Borrador</option>
            <option value="publicado">Publicado</option>
          </select>
        </div>

        {submitError !== null && (
          <p role="alert" className="text-sm text-error">
            {submitError}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting || uploading || uploadingGalleria || removingGaleria}
            className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-bg shadow-glow transition-transform hover:-translate-y-px disabled:translate-y-0 disabled:opacity-50"
          >
            {submitting ? 'Guardando…' : 'Guardar'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/publicaciones')}
            className="rounded-lg border border-border px-5 py-2 text-sm text-muted transition-colors hover:text-text"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
