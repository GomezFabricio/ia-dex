import { supabase } from '../lib/supabase'
import type {
  ClasificacionConCriterio,
  ClasificacionSI,
  CriterioSI,
  Enlace,
} from '../types/dtos'
import type { Json, Tables, TablesUpdate } from '../types/database.types'

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

/**
 * Maps a raw row from the embedded select (clasificaciones_si + criterio:criterios_si(*))
 * to ClasificacionConCriterio, parsing enlaces along the way.
 */
function toClasificacionConCriterio(
  row: ClasificacionRow & { criterio: CriterioSI },
): ClasificacionConCriterio {
  return {
    ...row,
    enlaces: parseEnlaces(row.enlaces),
    criterio: row.criterio,
  }
}

/**
 * Returns all clasificaciones ordered by orden asc, with enlaces parsed
 * and criterio embedded.
 */
export async function listarClasificaciones(): Promise<ClasificacionConCriterio[]> {
  const { data, error } = await supabase
    .from('clasificaciones_si')
    .select('*, criterio:criterios_si(*)')
    .order('orden')

  if (error) throw error
  return (data ?? []).map((row) =>
    toClasificacionConCriterio(row as ClasificacionRow & { criterio: CriterioSI }),
  )
}

/**
 * Returns a single ClasificacionConCriterio by slug with enlaces parsed
 * and criterio embedded, or null when not found.
 */
export async function obtenerClasificacion(
  slug: string,
): Promise<ClasificacionConCriterio | null> {
  const { data, error } = await supabase
    .from('clasificaciones_si')
    .select('*, criterio:criterios_si(*)')
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return toClasificacionConCriterio(data as ClasificacionRow & { criterio: CriterioSI })
}

/**
 * Returns all criterios_si ordered by orden asc.
 */
export async function listarCriterios(): Promise<CriterioSI[]> {
  const { data, error } = await supabase
    .from('criterios_si')
    .select('*')
    .order('orden')

  if (error) throw error
  return data ?? []
}

/**
 * Returns all clasificaciones_si linked to the given softwareId via the
 * software_clasificaciones junction, with criterio embedded.
 */
export async function listarClasificacionesDeSoftware(
  softwareId: string,
): Promise<ClasificacionConCriterio[]> {
  const { data, error } = await supabase
    .from('software_clasificaciones')
    .select('clasificaciones_si(*, criterios_si(*))')
    .eq('software_id', softwareId)

  if (error) throw error

  const rows = (data ?? []) as Array<{
    clasificaciones_si: (ClasificacionRow & { criterios_si: CriterioSI }) | null
  }>

  return rows
    .map((r) => r.clasificaciones_si)
    .filter((c): c is ClasificacionRow & { criterios_si: CriterioSI } => c !== null)
    .map((c) =>
      toClasificacionConCriterio({
        ...c,
        criterio: c.criterios_si,
      }),
    )
}

/**
 * Batch variant: returns a Map<softwareId, ClasificacionConCriterio[]> for all
 * software IDs in the given list. One single query via `.in()` filter.
 * Used by TemaPage to build per-axis rails without N+1 fetches.
 */
export async function listarClasificacionesPorSoftwareIds(
  softwareIds: string[],
): Promise<Map<string, ClasificacionConCriterio[]>> {
  if (softwareIds.length === 0) return new Map()

  const { data, error } = await supabase
    .from('software_clasificaciones')
    .select('software_id, clasificaciones_si(*, criterios_si(*))')
    .in('software_id', softwareIds)

  if (error) throw error

  const result = new Map<string, ClasificacionConCriterio[]>()

  const rows = (data ?? []) as Array<{
    software_id: string
    clasificaciones_si: (ClasificacionRow & { criterios_si: CriterioSI }) | null
  }>

  for (const row of rows) {
    const { software_id, clasificaciones_si: raw } = row
    if (!raw) continue
    const clasif = toClasificacionConCriterio({ ...raw, criterio: raw.criterios_si })
    const arr = result.get(software_id) ?? []
    arr.push(clasif)
    result.set(software_id, arr)
  }

  return result
}

// ---------------------------------------------------------------------------
// Admin writes — guarded FIRST by auth.getUser() throwing 'Requiere sesión'
// when there is no session. The guard is only a friendly early error; RLS
// (puede_gestionar_contenido()) is the authoritative enforcement — a logged-in
// non-admin still gets a row-level rejection from Postgres. (IE8)
// ---------------------------------------------------------------------------

async function requireUser() {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Requiere sesión')
  return user
}

/**
 * Updates a clasificacion_si by id and returns the updated row as ClasificacionSI
 * (flat row with enlaces parsed back to Enlace[] at the write boundary, same
 * contract as the read mappers). The criterio embed is NOT re-selected here — an
 * UPDATE on clasificaciones_si alone yields a bare row; the page refetches the
 * full ClasificacionConCriterio via its own read. This return is a confirm/throw
 * vehicle, not a re-render source.
 *
 * Throws 'Requiere sesión' before any network call when unauthenticated.
 */
export async function editar(
  id: string,
  patch: TablesUpdate<'clasificaciones_si'>,
): Promise<ClasificacionSI> {
  await requireUser()

  // IE3-ENLACES-SER: filter incomplete rows and serialize Enlace[] → Json before
  // hitting the DB. Empty array serializes to [] (not null). This is the inverse
  // of the parseEnlaces read boundary at the top of this file.
  const serialized: TablesUpdate<'clasificaciones_si'> =
    'enlaces' in patch && Array.isArray(patch.enlaces)
      ? {
          ...patch,
          enlaces: (patch.enlaces as unknown as Enlace[]).filter(
            (e) => e.titulo.trim() !== '' && e.url.trim() !== '',
          ) as unknown as Json,
        }
      : patch

  const { data, error } = await supabase
    .from('clasificaciones_si')
    .update(serialized)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return { ...data, enlaces: parseEnlaces(data.enlaces) }
}
