import { Link } from 'react-router-dom'

// ---------------------------------------------------------------------------
// RankingRow — presentational <li> for a single ranking entry.
// Receives preformatted metricText — never sees raw DTOs.
// Formatting is owned by RankingListPopular / RankingListRating wrappers.
// ---------------------------------------------------------------------------

type Props = {
  position: number
  softwareSlug: string
  nombre: string
  metricText: string
}

export default function RankingRow({ position, softwareSlug, nombre, metricText }: Props) {
  return (
    <li className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface/60">
      <span
        className={`dex-label w-7 shrink-0 text-right text-sm ${
          position <= 3 ? 'text-accent-2' : 'text-muted'
        }`}
      >
        {String(position).padStart(2, '0')}
      </span>
      <Link
        to={`/software/${softwareSlug}`}
        className="flex-1 text-text no-underline transition-colors group-hover:text-accent-strong"
      >
        {nombre}
      </Link>
      <span className="dex-label shrink-0 text-sm text-text">{metricText}</span>
    </li>
  )
}
