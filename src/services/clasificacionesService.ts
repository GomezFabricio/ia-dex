import { supabase } from '../lib/supabase'
import type { ClasificacionSI, Enlace } from '../types/dtos'
import type { Tables } from '../types/database.types'

type ClasificacionRow = Tables<'clasificaciones_si'>

/**
 * Parses the raw Json enlaces column into Enlace[].
 * Gracefully returns [] on null, non-array, or malformed JSON.
 */
function parseEnlaces(raw: unknown): Enlace[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (item): item is Enlace =>
      item !== null &&
      typeof item === 'object' &&
      typeof (item as Record<string, unknown>).titulo === 'string' &&
      typeof (item as Record<string, unknown>).url === 'string',
  )
}

function toClasificacion(row: ClasificacionRow): ClasificacionSI {
  return {
    ...row,
    enlaces: parseEnlaces(row.enlaces),
  }
}

/**
 * Returns all clasificaciones ordered by orden asc, with enlaces parsed.
 */
export async function listarClasificaciones(): Promise<ClasificacionSI[]> {
  const { data, error } = await supabase
    .from('clasificaciones_si')
    .select('*')
    .order('orden')

  if (error) throw error
  return (data ?? []).map(toClasificacion)
}

/**
 * Returns a single ClasificacionSI by slug with enlaces parsed, or null.
 */
export async function obtenerClasificacion(
  slug: string,
): Promise<ClasificacionSI | null> {
  const { data, error } = await supabase
    .from('clasificaciones_si')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return toClasificacion(data)
}
