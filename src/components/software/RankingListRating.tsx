import type { SoftwareRating } from '../../types/dtos'
import RankingRow from './RankingRow'

// ---------------------------------------------------------------------------
// RankingListRating — renders a <ol> of SoftwareRating items via RankingRow.
// Owns es-AR Intl formatting for ratings: "4,2 ★ (15)".
// Uses decimal comma (es-AR), 1 decimal place for promedio.
// Returns null when items is empty — caller owns empty state.
// ---------------------------------------------------------------------------

const promedioFmt = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

const votosFmt = new Intl.NumberFormat('es-AR')

function formatRating(promedio: number, cantidadVotos: number): string {
  return `${promedioFmt.format(promedio)} ★ (${votosFmt.format(cantidadVotos)})`
}

type Props = {
  items: SoftwareRating[]
}

export default function RankingListRating({ items }: Props) {
  if (items.length === 0) return null

  return (
    <ol className="flex flex-col gap-1">
      {items.map((item, index) => (
        <RankingRow
          key={item.software_id}
          position={index + 1}
          softwareId={item.software_id}
          nombre={item.nombre}
          metricText={formatRating(item.promedio, item.cantidad_votos)}
        />
      ))}
    </ol>
  )
}
