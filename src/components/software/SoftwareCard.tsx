import { Link } from 'react-router-dom'
import type { Software } from '../../types/dtos'

// ---------------------------------------------------------------------------
// SoftwareCard — preview card linking to /software/:id
// Null policy: cards OMIT null optional fields (ficha owns field-coverage proof).
// Placeholder div shown when imagen_url is null — no broken img.
// ---------------------------------------------------------------------------

type Props = {
  software: Software
}

export default function SoftwareCard({ software }: Props) {
  const { id, nombre, imagen_url, descripcion_corta, licencia, anio_lanzamiento } = software

  return (
    <Link
      to={`/software/${id}`}
      className="bg-surface rounded-lg p-4 hover:border-accent border border-surface transition-colors flex flex-col gap-2 no-underline"
    >
      {/* Image region */}
      {imagen_url ? (
        <img
          src={imagen_url}
          alt={nombre}
          className="w-full h-32 object-cover rounded"
        />
      ) : (
        <div
          className="w-full h-32 rounded bg-bg flex items-center justify-center text-3xl font-semibold text-accent"
          aria-hidden="true"
        >
          {nombre[0]}
        </div>
      )}

      {/* Name */}
      <span className="font-semibold text-text">{nombre}</span>

      {/* Short description — omit when null */}
      {descripcion_corta !== null && descripcion_corta !== undefined && (
        <span className="text-sm text-muted">{descripcion_corta}</span>
      )}

      {/* Footer chips — omit when null */}
      {(licencia !== null && licencia !== undefined) ||
      (anio_lanzamiento !== null && anio_lanzamiento !== undefined) ? (
        <div className="flex items-center gap-2 mt-auto">
          {licencia !== null && licencia !== undefined && (
            <span className="text-xs bg-bg text-accent rounded px-2 py-0.5">
              {licencia}
            </span>
          )}
          {anio_lanzamiento !== null && anio_lanzamiento !== undefined && (
            <span className="text-xs text-muted">{anio_lanzamiento}</span>
          )}
        </div>
      ) : null}
    </Link>
  )
}
