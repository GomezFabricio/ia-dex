import { Link } from 'react-router-dom'
import type { Software } from '../../types/dtos'
import { useImageOk } from '../../hooks/useImageOk'

// ---------------------------------------------------------------------------
// SoftwareCard — preview card linking to /software/:id
// Null policy: cards OMIT null optional fields (ficha owns field-coverage proof).
// Placeholder shown when imagen_url is null — no broken img.
// `position` (optional, 1-based) renders a mono "dex entry" number — the
// catalog-index motif of the brand. Omitted when not provided.
// ---------------------------------------------------------------------------

type Props = {
  software: Software
  position?: number
}

export default function SoftwareCard({ software, position }: Props) {
  const { id, nombre, imagen_url, descripcion_corta, licencia, anio_lanzamiento } = software
  // Same threshold as the detail banner so an image either shows in BOTH the
  // card and the ficha, or the lettered placeholder shows in both (consistency).
  const img = useImageOk(imagen_url, 200)

  return (
    <Link
      to={`/software/${id}`}
      className="group relative flex flex-col gap-3 rounded-xl border border-border bg-surface p-3 no-underline shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/60 hover:shadow-glow"
    >
      {/* Image region */}
      <div className="relative">
        {img.show && imagen_url ? (
          <img
            src={imagen_url}
            alt={nombre}
            {...img.imgProps}
            className="h-32 w-full rounded-lg object-cover ring-1 ring-inset ring-border"
          />
        ) : (
          <div
            className="flex h-32 w-full items-center justify-center rounded-lg bg-gradient-to-br from-surface-2 to-bg font-display text-4xl font-bold text-accent ring-1 ring-inset ring-border"
            aria-hidden="true"
          >
            {nombre[0]}
          </div>
        )}

        {position !== undefined && (
          <span className="dex-label absolute left-2 top-2 rounded-md bg-bg/80 px-1.5 py-0.5 text-[11px] text-accent-2 ring-1 ring-border backdrop-blur-sm">
            #{String(position).padStart(3, '0')}
          </span>
        )}
      </div>

      {/* Name */}
      <span className="px-1 font-display font-semibold text-text">{nombre}</span>

      {/* Short description — omit when null */}
      {descripcion_corta !== null && descripcion_corta !== undefined && (
        <span className="px-1 text-sm text-muted">{descripcion_corta}</span>
      )}

      {/* Footer chips — omit when null */}
      {(licencia !== null && licencia !== undefined) ||
      (anio_lanzamiento !== null && anio_lanzamiento !== undefined) ? (
        <div className="mt-auto flex items-center gap-2 px-1 pt-1">
          {licencia !== null && licencia !== undefined && (
            <span className="dex-label rounded border border-accent/30 bg-accent/10 px-2 py-0.5 text-[11px] text-accent-strong">
              {licencia}
            </span>
          )}
          {anio_lanzamiento !== null && anio_lanzamiento !== undefined && (
            <span className="dex-label text-[11px] text-muted">{anio_lanzamiento}</span>
          )}
        </div>
      ) : null}
    </Link>
  )
}
