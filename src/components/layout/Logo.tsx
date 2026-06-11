// ---------------------------------------------------------------------------
// Logo — IA-dex brand lockup (dex-cell mark + wordmark).
// The mark is the same hexagonal "dex cell" used by the favicon.
// `markOnly` renders just the glyph. `size` controls the lockup scale.
// ---------------------------------------------------------------------------

type Props = {
  markOnly?: boolean
  size?: 'md' | 'lg'
  className?: string
}

function Mark({ px }: { px: number }) {
  return (
    <svg width={px} height={px} viewBox="0 0 32 32" fill="none" aria-hidden="true" className="shrink-0">
      <defs>
        <linearGradient id="ia-dex-mark" x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7C5CFF" />
          <stop offset="1" stopColor="#22D3EE" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#ia-dex-mark)" />
      <path d="M16 5.5 L24.7 10.5 L24.7 21.5 L16 26.5 L7.3 21.5 L7.3 10.5 Z" fill="none" stroke="#0B1020" strokeWidth="2" strokeOpacity="0.35" />
      <path d="M16 11 L20.3 13.5 L20.3 18.5 L16 21 L11.7 18.5 L11.7 13.5 Z" fill="#0B1020" />
      <circle cx="16" cy="16" r="1.7" fill="url(#ia-dex-mark)" />
    </svg>
  )
}

export default function Logo({ markOnly = false, size = 'md', className = '' }: Props) {
  const isLg = size === 'lg'
  return (
    <span className={`inline-flex items-center ${isLg ? 'gap-3' : 'gap-2.5'} ${className}`}>
      <Mark px={isLg ? 40 : 28} />
      {!markOnly && (
        <span className={`font-display font-bold tracking-tight text-text ${isLg ? 'text-3xl' : 'text-lg'}`}>
          IA
          <span className="bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-transparent">dex</span>
        </span>
      )}
    </span>
  )
}
