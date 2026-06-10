import { Link } from 'react-router-dom'

// ---------------------------------------------------------------------------
// RankingRow — presentational <li> for a single ranking entry.
// Receives preformatted metricText — never sees raw DTOs.
// Formatting is owned by RankingListPopular / RankingListRating wrappers.
// ---------------------------------------------------------------------------

type Props = {
  position: number
  softwareId: string
  nombre: string
  metricText: string
}

export default function RankingRow({ position, softwareId, nombre, metricText }: Props) {
  return (
    <li className="flex items-center justify-between gap-2 py-1">
      <span className="text-muted w-6 shrink-0">{position}.</span>
      <Link
        to={`/software/${softwareId}`}
        className="flex-1 text-accent hover:text-text transition-colors"
      >
        {nombre}
      </Link>
      <span className="text-text font-semibold shrink-0">{metricText}</span>
    </li>
  )
}
