import { useState, useId } from 'react'
import Modal from '../ui/Modal'
import VideoEmbed from '../software/VideoEmbed'
import { toEmbedUrl } from '../../lib/youtube'
import { subirImagenContenido } from '../../lib/contenidoStorage'
import type { ContenidoPrefix } from '../../lib/contenidoStorage'
import { useIsAdmin } from '../../hooks/useIsAdmin'
import type { Enlace } from '../../types/dtos'

// ---------------------------------------------------------------------------
// InlineEdit — reusable, entity-agnostic inline field editor for admins.
//
// Gating: useIsAdmin() is the UI gate ONLY (RLS puede_gestionar_contenido() is
// the real authority). Non-admin → children are rendered byte-for-byte with no
// wrapper, no pencil, no layout shift. Admin → children plus an always-visible
// pencil button (a real <button>, ≥44px touch target, focus-visible ring, usable
// under @media (hover: none) — NOT hover-only, NOT a global edit-mode toggle).
//
// The pencil opens the reusable Modal holding the variant edit form. The page
// supplies the actual persistence via onSave (so this component never imports an
// entity service) and an optional onSaved refetch callback.
// ---------------------------------------------------------------------------

export type InlineEditVariant =
  | 'text' // single-line   <input type="text">
  | 'textarea' // multi-line    <textarea>
  | 'url' // single-line   <input type="url"> (browser hint only)
  | 'number' // <input type="number">, parsed to number | null
  | 'youtube' // url + live VideoEmbed preview, validated by toEmbedUrl
  | 'image' // URL paste OR file upload, live <img> preview, stored as a URL string
  | 'enlaces' // Enlace[] add/remove rows (titulo + url)

export type InlineEditValue = string | number | Enlace[] | null

type Props = {
  /** Current persisted value. Seeds the draft when the editor opens. */
  value: InlineEditValue
  /** Which control + normalization/validation rules to apply. */
  variant: InlineEditVariant
  /** Spanish field label → Modal heading + pencil aria-label. */
  label: string
  /** Page-provided persistence. Receives the normalized value. */
  onSave: (next: InlineEditValue) => Promise<void>
  /** Page refetch on success (e.g. re-pull the entity to re-render). */
  onSaved?: () => void
  /** Read-only rendering of the field (shown to everyone). */
  children: React.ReactNode
  /** Optional Modal width override (defaults per variant). */
  maxWidthClassName?: string
  /** image variant only — entity prefix for the upload key. */
  uploadPrefix?: ContenidoPrefix
  /** image variant only — entity id for the upload key. */
  uploadEntityId?: string
}

// Canonical form-control class copied from PublicacionFormPage (single source of
// styling truth for inputs/textarea across the admin surface).
const inputClass =
  'bg-bg border border-border text-text rounded-lg px-3 py-2 placeholder:text-muted transition-colors focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30'

// Default Modal width per variant (the prop overrides this when provided).
const DEFAULT_WIDTH: Record<InlineEditVariant, string> = {
  text: 'max-w-md',
  url: 'max-w-md',
  number: 'max-w-md',
  textarea: 'max-w-lg',
  youtube: 'max-w-lg',
  image: 'max-w-lg',
  enlaces: 'max-w-xl',
}

/**
 * Normalizes the draft for persistence (IE7). Empty string → null for every
 * scalar variant (clearing a field nulls it). number → number | null. enlaces
 * are passed through unchanged (page/service handles blank-row filtering).
 * textarea is NOT trimmed so line breaks survive; text/url are trimmed.
 */
function normalize(
  variant: InlineEditVariant,
  draft: InlineEditValue,
): InlineEditValue {
  if (variant === 'enlaces') {
    return Array.isArray(draft) ? draft : []
  }

  if (variant === 'number') {
    if (draft === '' || draft === null) return null
    return Number(draft)
  }

  // text / textarea / url / youtube / image: scalar string fields.
  if (draft === null) return null
  const str = typeof draft === 'string' ? draft : String(draft)
  const candidate = variant === 'textarea' ? str : str.trim()
  return candidate === '' ? null : candidate
}

/**
 * Validates the normalized value (IE4 variants). Returns a Spanish error string
 * to block the save, or null when valid. Empty (→null) is always allowed so a
 * field can be cleared.
 */
function validate(
  variant: InlineEditVariant,
  normalized: InlineEditValue,
): string | null {
  if (variant === 'youtube') {
    if (normalized === null) return null
    return toEmbedUrl(normalized as string) === null
      ? 'Enlace de YouTube no válido'
      : null
  }

  if (variant === 'number') {
    if (normalized === null) return null
    return Number.isNaN(normalized as number) ? 'Ingresá un número válido' : null
  }

  return null
}

// Pencil icon — inline SVG (no icon library in the project). Attributes mirror
// the repo's canonical 24x24 line-icon family (navIcons / ThemeToggle).
function PencilIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  )
}

export default function InlineEdit({
  value,
  variant,
  label,
  onSave,
  onSaved,
  children,
  maxWidthClassName,
  uploadPrefix,
  uploadEntityId,
}: Props) {
  const isAdmin = useIsAdmin()
  // useId must be called unconditionally (Rules of Hooks), before any early return.
  const headingId = useId()

  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<InlineEditValue>(value)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // IE4-GATE: non-admins see the read-only children verbatim — no wrapper, no
  // pencil, no layout shift. This is the first thing the component does.
  if (!isAdmin) return <>{children}</>

  function openEditor() {
    setDraft(value)
    setError(null)
    setOpen(true)
  }

  function closeEditor() {
    setOpen(false)
  }

  async function handleGuardar() {
    const normalized = normalize(variant, draft)
    const invalid = validate(variant, normalized)
    if (invalid) {
      setError(invalid)
      return // stay open, no onSave call
    }

    setSaving(true)
    setError(null)
    try {
      await onSave(normalized)
      setOpen(false)
      onSaved?.()
    } catch (err: unknown) {
      // IE8: surface RLS / 'Requiere sesión' / any save error verbatim, stay open.
      setError(err instanceof Error ? err.message : 'No se pudo guardar.')
    } finally {
      setSaving(false)
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !uploadPrefix || !uploadEntityId) return
    setUploading(true)
    setError(null)
    try {
      const url = await subirImagenContenido(uploadPrefix, uploadEntityId, file)
      setDraft(url) // preview + becomes the value on Guardar
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo subir la imagen.')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  // --- enlaces editing (mirrors PublicacionFormPage handlers) ---------------
  function addEnlace() {
    setDraft((prev) => [
      ...((prev as Enlace[] | null) ?? []),
      { titulo: '', url: '' },
    ])
  }

  function updateEnlace(index: number, field: keyof Enlace, value: string) {
    setDraft((prev) =>
      ((prev as Enlace[] | null) ?? []).map((e, i) =>
        i === index ? { ...e, [field]: value } : e,
      ),
    )
  }

  function removeEnlace(index: number) {
    setDraft((prev) =>
      ((prev as Enlace[] | null) ?? []).filter((_, i) => i !== index),
    )
  }

  const width = maxWidthClassName ?? DEFAULT_WIDTH[variant]
  const busy = saving || uploading

  return (
    <span className="group inline-flex items-center gap-1">
      {children}
      <button
        type="button"
        onClick={openEditor}
        aria-label={`Editar ${label}`}
        // Real button, 44px hit target (h-11 w-11 = 2.75rem = 44px), focus-visible
        // ring, faint-but-perceptible base opacity (desktop: dimmed until hover/focus;
        // touch: fully visible via (hover:none) override — NEVER hover-only).
        className="inline-flex h-11 w-11 items-center justify-center rounded-md text-muted opacity-40 transition-opacity hover:text-accent group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 [@media(hover:none)]:opacity-70"
      >
        <PencilIcon />
      </button>

      <Modal open={open} onClose={closeEditor} labelledBy={headingId} maxWidthClassName={width}>
        <h2 id={headingId} className="font-display text-lg font-semibold text-text">
          Editar {label}
        </h2>

        <div className="flex flex-col gap-3">
          {variant === 'text' && (
            <input
              type="text"
              value={(draft as string | null) ?? ''}
              onChange={(e) => setDraft(e.target.value)}
              className={inputClass}
              aria-label={label}
            />
          )}

          {variant === 'url' && (
            <input
              type="url"
              value={(draft as string | null) ?? ''}
              onChange={(e) => setDraft(e.target.value)}
              className={inputClass}
              placeholder="https://…"
              aria-label={label}
            />
          )}

          {variant === 'number' && (
            <input
              type="number"
              value={
                draft === null || draft === undefined
                  ? ''
                  : (draft as number | string)
              }
              onChange={(e) => setDraft(e.target.value)}
              className={inputClass}
              aria-label={label}
            />
          )}

          {variant === 'textarea' && (
            <textarea
              rows={6}
              value={(draft as string | null) ?? ''}
              onChange={(e) => setDraft(e.target.value)}
              className={`${inputClass} resize-y`}
              aria-label={label}
            />
          )}

          {variant === 'youtube' && (
            <>
              <input
                type="url"
                value={(draft as string | null) ?? ''}
                onChange={(e) => {
                  setDraft(e.target.value)
                  setError(null)
                }}
                className={inputClass}
                placeholder="https://www.youtube.com/watch?v=…"
                aria-label={label}
              />
              <VideoEmbed url={draft as string | null} nombre={label} />
            </>
          )}

          {variant === 'image' && (
            <>
              <input
                type="url"
                value={(draft as string | null) ?? ''}
                onChange={(e) => setDraft(e.target.value)}
                className={inputClass}
                placeholder="https://… o subí un archivo"
                aria-label={label}
              />
              <label className="self-start rounded-md border border-border px-3.5 py-2 text-sm text-muted transition-colors hover:border-accent/60 hover:text-text cursor-pointer">
                {uploading ? 'Subiendo imagen…' : 'Elegir imagen'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={handleUpload}
                  disabled={uploading || !uploadPrefix || !uploadEntityId}
                  className="sr-only"
                />
              </label>
              {typeof draft === 'string' && draft.trim() !== '' && (
                <img
                  src={draft}
                  alt="Vista previa"
                  className="max-h-48 w-auto rounded-lg border border-border object-contain"
                />
              )}
            </>
          )}

          {variant === 'enlaces' && (
            <div className="flex flex-col gap-3">
              {((draft as Enlace[] | null) ?? []).map((enlace, index) => (
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
                    aria-label={`Quitar enlace ${index + 1}`}
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
          )}

          {error !== null && (
            <p role="alert" className="text-sm text-error">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleGuardar}
              disabled={busy}
              className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-bg shadow-glow transition-transform hover:-translate-y-px disabled:translate-y-0 disabled:opacity-50"
            >
              {uploading ? 'Subiendo imagen…' : saving ? 'Guardando…' : 'Guardar'}
            </button>
            <button
              type="button"
              onClick={closeEditor}
              disabled={busy}
              className="rounded-lg border border-border px-5 py-2 text-sm text-muted transition-colors hover:text-text disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      </Modal>
    </span>
  )
}
