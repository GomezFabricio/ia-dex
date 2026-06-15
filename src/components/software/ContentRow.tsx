import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Software } from '../../types/dtos'
import PosterCard from './PosterCard'

// ---------------------------------------------------------------------------
// ContentRow — the Netflix-style horizontal rail (and a grid fallback).
// Recreates the rail anatomy from the design handoff (Rail.dc.html):
//   - header: a gradient accent bar + display title + optional count chip +
//     an optional right-aligned "Ver todo →" link
//   - rail track: a scroll-snap flex row of PosterCards with a next-card peek
//     and a hidden scrollbar; left/right chevron buttons scroll it ~one viewport
//     at a time. Arrows are ALWAYS keyboard-operable (real <button>s), not
//     hover-only, and the section is a labelled region for screen readers.
//   - layout='grid': the same PosterCards in an auto-fill grid (no arrows) —
//     for Catálogo / Buscar result pages.
//
// dexStart lets a caller continue catalog numbering across rails (defaults to 1).
// ---------------------------------------------------------------------------

type Props = {
  titulo: string
  items: Software[]
  count?: string | number
  verTodoHref?: string
  /** Resolve a tema id → its display name, used for each card's kicker. */
  temaNombrePorId?: (id: string) => string | undefined
  layout?: 'rail' | 'grid'
  /** 1-based catalog number of the first item (rails can continue numbering). */
  dexStart?: number
  /** Hide the built-in header (caller renders its own); titulo still labels the region. */
  hideHeader?: boolean
}

export default function ContentRow({
  titulo,
  items,
  count,
  verTodoHref,
  temaNombrePorId,
  layout = 'rail',
  dexStart = 1,
  hideHeader = false,
}: Props) {
  const trackRef = useRef<HTMLUListElement>(null)
  const isGrid = layout === 'grid'

  // Arrows appear ONLY when the track actually overflows (so a rail whose cards
  // all fit shows none). A ResizeObserver keeps this in sync with viewport /
  // content changes; its first (async) callback seeds the value — no synchronous
  // setState in the effect body.
  const [overflowing, setOverflowing] = useState(false)
  useEffect(() => {
    const track = trackRef.current
    if (track === null || isGrid) return
    const ro = new ResizeObserver(() => {
      setOverflowing(track.scrollWidth - track.clientWidth > 4)
    })
    ro.observe(track)
    return () => ro.disconnect()
  }, [isGrid, items.length])

  if (items.length === 0) return null

  const showArrows = !isGrid && overflowing

  // Wrap-around scroll: at the right end, looping forward jumps to the start; at
  // the start, looping back jumps to the end — an "infinite" feel without cloning.
  function scrollByDir(dir: 1 | -1) {
    const track = trackRef.current
    if (!track) return
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    const maxScroll = track.scrollWidth - track.clientWidth
    // Generous edge tolerance: scroll-snap + the track's side padding rest the
    // first/last card a few dozen px shy of 0 / maxScroll, so a tight threshold
    // would miss the "at the edge" state and never wrap.
    const EDGE = 40
    const atEnd = track.scrollLeft >= maxScroll - EDGE
    const atStart = track.scrollLeft <= EDGE
    if (dir === 1 && atEnd) {
      track.scrollTo({ left: 0, behavior })
    } else if (dir === -1 && atStart) {
      track.scrollTo({ left: maxScroll, behavior })
    } else {
      track.scrollBy({ left: dir * track.clientWidth * 0.82, behavior })
    }
  }

  return (
    <section role="region" aria-label={titulo} className="relative">
      {/* Header */}
      {!hideHeader && (
      <header className="flex items-center gap-3 px-4 pb-3.5 sm:px-8">
        <span
          className="h-[18px] w-1 shrink-0 rounded-sm bg-gradient-to-b from-accent to-accent-2"
          aria-hidden="true"
        />
        <h2 className="font-display m-0 text-xl font-semibold tracking-[-0.015em] text-text">{titulo}</h2>
        {count !== undefined && count !== '' && (
          <span className="dex-label rounded-full border border-border px-[9px] py-[3px] text-[10px] text-muted">
            {count}
          </span>
        )}
        {verTodoHref && (
          <Link
            to={verTodoHref}
            className="dex-label ml-auto rounded-md px-1.5 py-1 text-[10px] text-muted no-underline transition-colors hover:text-text"
          >
            Ver todo →
          </Link>
        )}
      </header>
      )}

      {isGrid ? (
        <ul className="grid list-none grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-4 px-4 pb-4 sm:px-8">
          {items.map((sw, i) => (
            <li key={sw.id}>
              <PosterCard software={sw} dex={dexStart + i} temaNombre={temaNombrePorId?.(sw.tema_id)} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="relative">
          <ul
            ref={trackRef}
            data-rail
            className="flex snap-x snap-mandatory list-none gap-4 overflow-x-auto scroll-smooth px-4 pb-6 pr-[12%] sm:px-8"
          >
            {items.map((sw, i) => (
              <li key={sw.id} className="w-[clamp(200px,60vw,260px)] shrink-0 snap-start">
                <PosterCard software={sw} dex={dexStart + i} temaNombre={temaNombrePorId?.(sw.tema_id)} />
              </li>
            ))}
          </ul>

          {showArrows && (
            <>
              <button
                type="button"
                onClick={() => scrollByDir(-1)}
                aria-label="Desplazar a la izquierda"
                className="absolute left-3.5 top-1/2 z-30 grid h-[42px] w-[42px] -translate-y-1/2 place-items-center rounded-full border border-border bg-bg/80 text-text backdrop-blur-md transition-opacity hover:bg-surface-2"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => scrollByDir(1)}
                aria-label="Desplazar a la derecha"
                className="absolute right-3.5 top-1/2 z-30 grid h-[42px] w-[42px] -translate-y-1/2 place-items-center rounded-full border border-border bg-bg/80 text-text backdrop-blur-md transition-opacity hover:bg-surface-2"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            </>
          )}
        </div>
      )}
    </section>
  )
}
