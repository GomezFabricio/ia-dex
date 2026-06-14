import type { SoftwarePopular } from '../../types/dtos'
import RankingRow from './RankingRow'

// ---------------------------------------------------------------------------
// RankingListPopular — renders a <ol> of SoftwarePopular items via RankingRow.
// Owns es-AR Intl formatting for vistas: "1.250 vistas" / "1 vista" (singular).
// Returns null when items is empty — caller owns empty state.
// ---------------------------------------------------------------------------

const vistasFmt = new Intl.NumberFormat('es-AR')

function formatVistas(vistas: number): string {
  const formatted = vistasFmt.format(vistas)
  return vistas === 1 ? `${formatted} vista` : `${formatted} vistas`
}

type Props = {
  items: SoftwarePopular[]
  /** id → slug lookup built by the parent from useSoftwareTodos(). */
  slugMap: ReadonlyMap<string, string>
}

export default function RankingListPopular({ items, slugMap }: Props) {
  if (items.length === 0) return null

  return (
    <ol className="flex flex-col gap-1">
      {items.map((item, index) => (
        <RankingRow
          key={item.software_id}
          position={index + 1}
          softwareSlug={slugMap.get(item.software_id) ?? item.software_id}
          nombre={item.nombre}
          metricText={formatVistas(item.vistas)}
        />
      ))}
    </ol>
  )
}
