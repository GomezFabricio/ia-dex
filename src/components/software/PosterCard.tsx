import { Link } from 'react-router-dom'
import type { Software } from '../../types/dtos'
import { useImageOk } from '../../hooks/useImageOk'

// ---------------------------------------------------------------------------
// PosterCard — the rail (poster) variant of a software card.
// Netflix-style 3:4 poster linking to /software/:id. Recreates the
// "cine-neural" poster anatomy from the design handoff (Rail.dc.html):
//   - layered placeholder (dex-grid + theme wash + giant initial) when no
//     usable image, OR a blurred-cover + image when imagen_url passes useImageOk
//   - a `#003` dex-label chip (zero-padded catalog number) top-left
//   - a cyan play badge top-right when video_url is set
//   - a bottom scrim with the tema kicker, the name (font-display), and a
//     hover/focus-reveal "peek" block (objetivo + license/year chips + CTA)
// Hover/focus (desktop @media(hover:hover) + focus-within for a11y) lifts the
// card (scale + accent border + glow), Ken-Burns-zooms the artwork, and reveals
// the peek. Driven by the `.poster-*` CSS classes that ship in IA-dex's design.
//
// Theme-agnostic: the per-card "wash" is derived from the accent TOKENS
// (--color-accent / -2 / -3), so it adapts to light/dark automatically instead
// of the prototype's hardcoded hex.
// ---------------------------------------------------------------------------

type Props = {
  software: Software
  /** 1-based catalog index → rendered as the zero-padded `#003` dex chip. */
  dex?: number
  /** Resolved tema name, shown as the bottom kicker. Omitted when undefined. */
  temaNombre?: string
}

// The three brand accents, as CSS-var references so the wash follows the theme.
const HUES = ['var(--color-accent)', 'var(--color-accent-2)', 'var(--color-accent-3)'] as const

// Deterministic hue pick so cards aren't monotone but stay stable per software.
function hueFor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return HUES[h % HUES.length]
}

// Per-card ambient wash (mirrors washFor() in the design prototype).
function washFor(hue: string): string {
  return (
    `radial-gradient(135% 120% at 26% 0%, color-mix(in oklab, ${hue} 60%, transparent), transparent 64%), ` +
    `linear-gradient(155deg, color-mix(in oklab, ${hue} 30%, transparent), transparent 72%)`
  )
}

export default function PosterCard({ software, dex, temaNombre }: Props) {
  const { id, nombre, imagen_url, video_url, objetivo, licencia, anio_lanzamiento, tema_id } = software
  // Same 200px threshold as SoftwareCard / the ficha banner, so an image either
  // shows everywhere or the lettered placeholder shows everywhere (consistency).
  const img = useImageOk(imagen_url, 200)

  const hue = hueFor(tema_id || id)
  const wash = washFor(hue)
  const initial = nombre.charAt(0)

  return (
    <Link
      to={`/software/${id}`}
      aria-label={`${nombre}, ver ficha`}
      className="poster-card group/poster relative block overflow-hidden rounded-xl border border-border bg-surface no-underline outline-none transition-[transform,box-shadow,border-color] duration-200 focus-visible:scale-[1.06] focus-visible:border-accent/60 focus-visible:shadow-glow"
    >
      {/* Poster artwork area — taller-than-wide 3:4 */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-surface-2">
        {img.show && imagen_url ? (
          <>
            {/* Blurred cover behind so letterboxed art still fills the frame */}
            <img
              src={imagen_url}
              alt=""
              aria-hidden="true"
              className="poster-img absolute inset-0 h-full w-full scale-110 object-cover blur-xl"
            />
            <img
              src={imagen_url}
              alt={nombre}
              {...img.imgProps}
              className="poster-img absolute inset-0 h-full w-full object-cover"
            />
          </>
        ) : (
          <>
            {/* dex lattice */}
            <div className="dex-grid poster-img absolute inset-0 opacity-45" aria-hidden="true" />
            {/* theme wash */}
            <div className="poster-img absolute inset-0" style={{ background: wash }} aria-hidden="true" />
            {/* giant initial */}
            <div
              className="font-display absolute inset-0 grid place-items-center text-[5.875rem] font-bold leading-none"
              style={{ color: `color-mix(in oklab, ${hue} 42%, transparent)` }}
              aria-hidden="true"
            >
              {initial}
            </div>
          </>
        )}

        {/* dex catalog number — top-left */}
        {dex !== undefined && (
          <span className="dex-label absolute left-3 top-3 rounded-md border border-accent-2/30 bg-bg/60 px-[7px] py-[3px] text-[9.5px] text-accent-2 backdrop-blur-sm">
            #{String(dex).padStart(3, '0')}
          </span>
        )}

        {/* play badge — top-right when there is a video */}
        {video_url !== null && video_url !== undefined && (
          <span
            className="absolute right-3 top-3 grid h-[30px] w-[30px] place-items-center rounded-full border border-accent-2/65 bg-bg/55 backdrop-blur-sm"
            aria-hidden="true"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" className="text-accent-2">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        )}

        {/* Bottom scrim to near-black so the title sits on dark regardless of art */}
        <div
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(7,10,20,0.95),rgba(7,10,20,0.4)_46%,transparent_78%)]"
          aria-hidden="true"
        />

        {/* Bottom content over the scrim */}
        <div className="absolute inset-x-0 bottom-0 p-3.5">
          {temaNombre !== undefined && (
            <div className="dex-label mb-[5px] text-[9px] text-[rgba(234,237,251,0.62)]">{temaNombre}</div>
          )}
          <div className="font-display text-[16px] font-semibold leading-[1.18] tracking-[-0.01em] text-[#EAEDFB]">
            {nombre}
          </div>

          {/* Hover/focus reveal — objetivo + license/year + CTA */}
          <div className="poster-peek mt-[9px]">
            {objetivo !== null && objetivo !== undefined && (
              <p className="m-0 line-clamp-2 text-[12px] leading-[1.45] text-[rgba(234,237,251,0.82)]">
                {objetivo}
              </p>
            )}
            {((licencia !== null && licencia !== undefined) ||
              (anio_lanzamiento !== null && anio_lanzamiento !== undefined)) && (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {licencia !== null && licencia !== undefined && (
                  <span className="dex-label rounded-[5px] bg-white/[0.08] px-[7px] py-[3px] text-[9px] text-[#EAEDFB]">
                    {licencia}
                  </span>
                )}
                {anio_lanzamiento !== null && anio_lanzamiento !== undefined && (
                  <span className="dex-label rounded-[5px] bg-white/[0.08] px-[7px] py-[3px] text-[9px] text-[rgba(234,237,251,0.78)]">
                    {anio_lanzamiento}
                  </span>
                )}
              </div>
            )}
            <div className="dex-label mt-2.5 text-[10px] text-accent-2">Ver ficha →</div>
          </div>
        </div>
      </div>
    </Link>
  )
}
