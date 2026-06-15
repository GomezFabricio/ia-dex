import { useState } from 'react'
import { Link } from 'react-router-dom'
import { usePublicacionesAdmin } from '../../hooks/usePublicacionesAdmin'
import * as publicacionesService from '../../services/publicacionesService'
import { formatFecha } from '../../lib/date'
import type { PublicacionConAutor } from '../../types/dtos'

// ---------------------------------------------------------------------------
// PublicacionesAdminPage — admin LIST of every publicacion (drafts included via
// RLS). Mounted under RequireAdmin. Each row links to its edit form; a delete
// action (confirm-gated) calls eliminar(id) then refetches the list. The D4
// state quartet (loading / error+retry / empty / data) mirrors BlogPage.
// ---------------------------------------------------------------------------

function EstadoBadge({ estado }: { estado: string }) {
  const isDraft = estado === 'borrador'
  return (
    <span
      className={`dex-label rounded-full px-2.5 py-1 text-[9px] ${
        isDraft
          ? 'border border-border bg-surface text-muted'
          : 'bg-accent/15 text-accent'
      }`}
    >
      {isDraft ? 'Borrador' : 'Publicado'}
    </span>
  )
}

function PublicacionRow({
  pub,
  onDelete,
}: {
  pub: PublicacionConAutor
  onDelete: (pub: PublicacionConAutor) => void
}) {
  const fecha = formatFecha(pub.created_at)

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-3">
          <h3 className="font-display text-lg font-semibold leading-tight text-text">
            {pub.titulo}
          </h3>
          <EstadoBadge estado={pub.estado} />
        </div>
        <span className="dex-label text-[9px] text-muted">
          /{pub.slug}
          {fecha !== '' && <> · {fecha}</>}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <Link
          to={`/admin/publicaciones/${pub.id}/editar`}
          className="rounded-md border border-border px-3.5 py-2 text-sm text-muted no-underline transition-colors hover:border-accent/60 hover:text-text"
        >
          Editar
        </Link>
        <button
          type="button"
          onClick={() => onDelete(pub)}
          className="rounded-md border border-border px-3.5 py-2 text-sm text-error transition-colors hover:border-error/60"
        >
          Eliminar
        </button>
      </div>
    </li>
  )
}

export default function PublicacionesAdminPage() {
  const { data, loading, error, refetch } = usePublicacionesAdmin()
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleDelete(pub: PublicacionConAutor) {
    const ok = window.confirm(
      `¿Eliminar la publicación "${pub.titulo}"? Esta acción no se puede deshacer.`,
    )
    if (!ok) return

    setDeleteError(null)
    try {
      await publicacionesService.eliminar(pub.id)
      refetch()
    } catch (err: unknown) {
      setDeleteError(
        err instanceof Error ? err.message : 'No se pudo eliminar la publicación.',
      )
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1100px] px-6 pt-24 pb-16 sm:px-8 lg:px-12">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <p className="dex-label text-[11px] text-accent-2">Admin · Contenido</p>
          <h1 className="font-display text-[clamp(1.75rem,4vw,2.5rem)] font-bold tracking-[-0.02em] text-text">
            Publicaciones
          </h1>
        </div>
        <Link
          to="/admin/publicaciones/nuevo"
          className="self-start rounded-md bg-accent px-4 py-2 text-sm font-semibold text-bg no-underline shadow-glow transition-transform hover:-translate-y-px sm:self-auto"
        >
          Nueva publicación
        </Link>
      </div>

      {deleteError !== null && (
        <p role="alert" className="mb-4 text-sm text-error">
          {deleteError}
        </p>
      )}

      {/* Loading */}
      {loading && <div className="skeleton h-40 w-full rounded-2xl" aria-hidden="true" />}

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

      {/* Empty */}
      {!loading && error === null && data.length === 0 && (
        <p className="text-muted">
          Todavía no hay publicaciones. Creá la primera con “Nueva publicación”.
        </p>
      )}

      {/* Data */}
      {!loading && error === null && data.length > 0 && (
        <ul className="flex list-none flex-col gap-3">
          {data.map((pub) => (
            <PublicacionRow key={pub.id} pub={pub} onDelete={handleDelete} />
          ))}
        </ul>
      )}
    </div>
  )
}
