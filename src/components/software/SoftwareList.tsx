import type { Software } from '../../types/dtos'
import SoftwareCard from './SoftwareCard'

// ---------------------------------------------------------------------------
// SoftwareList — responsive grid of SoftwareCard items
// Empty array: renders nothing (caller owns the empty-state message).
// ---------------------------------------------------------------------------

type Props = {
  items: Software[]
}

export default function SoftwareList({ items }: Props) {
  if (items.length === 0) return null

  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((sw) => (
        <li key={sw.id}>
          <SoftwareCard software={sw} />
        </li>
      ))}
    </ul>
  )
}
