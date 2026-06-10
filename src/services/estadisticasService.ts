import { supabase } from '../lib/supabase'
import type {
  Software,
  SoftwareRating,
  SoftwarePopular,
  SoftwareRatingRow,
  SoftwarePopularRow,
} from '../types/dtos'

/**
 * Coalesces a nullable view row into the non-null SoftwarePopular DTO (D3).
 * Rows with null software_id are filtered out before calling this.
 */
function toSoftwarePopular(row: SoftwarePopularRow): SoftwarePopular {
  return {
    software_id: row.software_id ?? '',
    nombre: row.nombre ?? '',
    vistas: row.vistas ?? 0,
  }
}

/**
 * Coalesces a nullable view row into the non-null SoftwareRating DTO (D3).
 * Rows with null software_id are filtered out before calling this.
 */
function toSoftwareRating(row: SoftwareRatingRow): SoftwareRating {
  return {
    software_id: row.software_id ?? '',
    nombre: row.nombre ?? '',
    promedio: row.promedio ?? 0,
    cantidad_votos: row.cantidad_votos ?? 0,
  }
}

/**
 * Returns the most-visited software from v_software_populares.
 * Returns [] on empty view (cold-start safe, SC-01).
 */
export async function softwarePopulares(
  limite = 5,
): Promise<SoftwarePopular[]> {
  const { data, error } = await supabase
    .from('v_software_populares')
    .select('*')
    .order('vistas', { ascending: false })
    .limit(limite)

  if (error) throw error

  return (data ?? [])
    .filter((row): row is SoftwarePopularRow & { software_id: string } =>
      row.software_id !== null,
    )
    .map(toSoftwarePopular)
}

/**
 * Returns the highest-rated software from v_software_rating.
 * Returns [] on empty view (cold-start safe, SC-01).
 */
export async function mejorValorados(limite = 5): Promise<SoftwareRating[]> {
  const { data, error } = await supabase
    .from('v_software_rating')
    .select('*')
    .order('promedio', { ascending: false })
    .limit(limite)

  if (error) throw error

  return (data ?? [])
    .filter((row): row is SoftwareRatingRow & { software_id: string } =>
      row.software_id !== null,
    )
    .map(toSoftwareRating)
}

/**
 * Recommends software combining popularity data and optional tema filter.
 *
 * Algorithm (R10.3):
 * 1. Fetch all v_software_populares rows (vistas data).
 * 2. Fetch software filtered by temaId when provided; all software otherwise.
 * 3. Merge: rank by vistas desc (absent = 0), tiebreak by nombre asc.
 * 4. Return first `limite` items as Software[].
 *
 * Cold-start: if v_software_populares is empty, falls back to alphabetical
 * software list (SC-02).
 */
export async function recomendaciones(
  temaId?: string,
  limite = 5,
): Promise<Software[]> {
  const popularesQuery = supabase
    .from('v_software_populares')
    .select('*')
    .order('vistas', { ascending: false })

  let softwareQuery = supabase.from('software').select('*')
  if (temaId !== undefined) {
    softwareQuery = softwareQuery.eq('tema_id', temaId)
  }

  const [popularesResult, softwareResult] = await Promise.all([
    popularesQuery,
    softwareQuery,
  ])

  if (popularesResult.error) throw popularesResult.error
  if (softwareResult.error) throw softwareResult.error

  const softwareRows: Software[] = softwareResult.data ?? []

  // Build a vistas lookup map keyed by software_id
  const vistasMap = new Map<string, number>()
  for (const row of popularesResult.data ?? []) {
    if (row.software_id !== null) {
      vistasMap.set(row.software_id, row.vistas ?? 0)
    }
  }

  // Sort: vistas desc (absent = 0), then nombre asc
  const sorted = [...softwareRows].sort((a, b) => {
    const vA = vistasMap.get(a.id) ?? 0
    const vB = vistasMap.get(b.id) ?? 0
    if (vB !== vA) return vB - vA
    return a.nombre.localeCompare(b.nombre)
  })

  return sorted.slice(0, limite)
}
