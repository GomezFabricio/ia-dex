// ---------------------------------------------------------------------------
// Per-content accent hue + ambient wash, derived from the brand TOKENS (not
// hardcoded hex) so they follow the active theme. Shared by PosterCard (rail
// posters) and the SoftwareDetallePage marquee hero so a given software always
// reads as the same color across the app.
// ---------------------------------------------------------------------------

const HUES = ['var(--color-accent)', 'var(--color-accent-2)', 'var(--color-accent-3)'] as const

// Deterministic hue pick so cards aren't monotone but stay stable per software.
export function hueFor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return HUES[h % HUES.length]
}

// Ambient wash bleeding from the top-left (mirrors washFor() in the prototype).
export function washFor(hue: string): string {
  return (
    `radial-gradient(135% 120% at 26% 0%, color-mix(in oklab, ${hue} 60%, transparent), transparent 64%), ` +
    `linear-gradient(155deg, color-mix(in oklab, ${hue} 30%, transparent), transparent 72%)`
  )
}
