import { useState } from 'react'
import { Link } from 'react-router-dom'
import * as publicacionesService from '../../services/publicacionesService'
import type { PublicacionConAutor } from '../../types/dtos'

// ---------------------------------------------------------------------------
// ContenidoDidactico — the per-tema "Contenido didáctico" section.
//
// PUBLIC (isAdmin === false): renders read-only cards exactly as TemaPage did
// before — each publicacion is a <Link> tile, no reorder affordances.
//
// ADMIN (isAdmin === true): the same visual cards become inline-reorderable.
// To avoid the link-vs-drag conflict, the card body is a plain <div> (not a
// Link) that is draggable, with a control row carrying ↑/↓ buttons plus a
// dedicated "Leer →" Link so the admin can still open the article. Every
// reorder (drag-drop or a ↑/↓ click) is OPTIMISTIC: local state updates
// instantly, then the new 0-based order is persisted via the
// reordenar_material_tema RPC. On a persist error the list reverts to the
// `publicaciones` prop and a subtle inline error is shown.
//
// The move primitive (moveItem) is the same clamp+splice logic as
// PublicacionFormPage's moveImagen, kept identical so the two reorder UIs can
// never diverge — here it returns the reordered array instead of mutating
// state directly (we need the value to both render and persist).
// ---------------------------------------------------------------------------

interface ContenidoDidacticoProps {
  publicaciones: PublicacionConAutor[]
  isAdmin: boolean
  temaId: string
}

export default function ContenidoDidactico({
  publicaciones,
  isAdmin,
  temaId,
}: ContenidoDidacticoProps) {
  const [items, setItems] = useState<PublicacionConAutor[]>(publicaciones)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  // No prop→state sync effect on purpose: TemaPage gates this section on
  // `!loading && error === null && data.length > 0`, so any refetch or tema
  // change toggles that gate and REMOUNTS this component fresh (reinforced by a
  // key={temaId} on the mount). `items` is therefore the sole source of truth
  // for display order within a mount — which also means an optimistic reorder is
  // never clobbered by a stale `publicaciones` reference.

  // Pure index move — the ONE reorder primitive, copied from
  // PublicacionFormPage.moveImagen (clamp out-of-range, splice). Returns the
  // reordered array (no-op clamp returns the original reference unchanged).
  function moveItem(from: number, to: number): PublicacionConAutor[] {
    if (
      from === to ||
      from < 0 ||
      to < 0 ||
      from >= items.length ||
      to >= items.length
    ) {
      return items
    }
    const next = [...items]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    return next
  }

  // Optimistic reorder + persist: show the new order immediately, then write it
  // through the RPC. On failure, revert to the prop (NOT to stale local state)
  // so the UI mirrors the last server-confirmed order.
  async function handleMove(from: number, to: number) {
    // Serialize: ignore a move while a save is in flight so rapid ↑/↓ clicks
    // can't fire overlapping RPCs that land out of order (DB/UI divergence).
    if (saving) return
    const prev = items
    const next = moveItem(from, to)
    if (next === prev) return
    setItems(next)
    setSaving(true)
    setError(null)
    try {
      await publicacionesService.reordenarMaterialTema(
        temaId,
        next.map((p) => p.id),
      )
      setSaving(false)
    } catch {
      // Revert ONLY this failed move (to the pre-move local order), not the
      // fetched prop — any earlier successful reorder in this mount stays.
      setItems(prev)
      setError('No se pudo guardar el orden.')
      setSaving(false)
    }
  }

  return (
    <section className="mx-auto w-full max-w-[1400px] px-4 pt-2 sm:px-8">
      <header className="mb-4 flex items-center gap-3">
        <span
          className="h-[18px] w-1 shrink-0 rounded-sm bg-gradient-to-b from-accent to-accent-2"
          aria-hidden="true"
        />
        <h2 className="font-display m-0 text-xl font-semibold tracking-[-0.015em] text-text">
          Contenido didáctico
        </h2>
        {isAdmin && saving && (
          <span className="text-xs text-muted">Guardando orden…</span>
        )}
        {isAdmin && error !== null && (
          <span className="text-xs text-error">{error}</span>
        )}
      </header>
      <ul className="grid list-none grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
        {items.map((pub, i) =>
          isAdmin ? (
            <li
              key={pub.id}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex !== null) void handleMove(dragIndex, i)
                setDragIndex(null)
              }}
              onDragEnd={() => setDragIndex(null)}
            >
              <div className="qtile flex cursor-move flex-col gap-2 rounded-2xl border border-border bg-surface p-5">
                <span className="dex-label text-[9px] text-accent-2">Publicación</span>
                <h3 className="font-display text-base font-semibold leading-tight tracking-[-0.01em] text-text">
                  {pub.titulo}
                </h3>
                <span className="dex-label text-[9px] text-muted">{pub.autorNombre}</span>
                <div className="mt-1.5 flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => void handleMove(i, i - 1)}
                      disabled={saving || i === 0}
                      aria-label={`Mover "${pub.titulo}" antes`}
                      className="rounded-md border border-border px-2 py-1 text-xs text-muted transition-colors hover:border-accent/60 hover:text-text disabled:opacity-40"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleMove(i, i + 1)}
                      disabled={saving || i === items.length - 1}
                      aria-label={`Mover "${pub.titulo}" después`}
                      className="rounded-md border border-border px-2 py-1 text-xs text-muted transition-colors hover:border-accent/60 hover:text-text disabled:opacity-40"
                    >
                      ↓
                    </button>
                  </div>
                  <Link
                    to={`/blog/${pub.slug}`}
                    className="dex-label text-[10px] text-accent no-underline transition-transform hover:translate-x-0.5"
                  >
                    Leer →
                  </Link>
                </div>
              </div>
            </li>
          ) : (
            <li key={pub.id}>
              <Link
                to={`/blog/${pub.slug}`}
                className="qtile group flex flex-col gap-2 rounded-2xl border border-border bg-surface p-5 no-underline transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/60 hover:shadow-glow"
              >
                <span className="dex-label text-[9px] text-accent-2">Publicación</span>
                <h3 className="font-display text-base font-semibold leading-tight tracking-[-0.01em] text-text">
                  {pub.titulo}
                </h3>
                <span className="dex-label text-[9px] text-muted">{pub.autorNombre}</span>
                <span className="dex-label mt-1.5 text-[10px] text-accent transition-transform group-hover:translate-x-0.5">
                  Leer →
                </span>
              </Link>
            </li>
          ),
        )}
      </ul>
    </section>
  )
}
