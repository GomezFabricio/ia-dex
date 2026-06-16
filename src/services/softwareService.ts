import { supabase } from '../lib/supabase'
import type {
  Software,
  ClasificacionConCriterio,
  FiltrosBusqueda,
  BusquedaInteligenteRequest,
  BusquedaInteligenteResponse,
} from '../types/dtos'
import type { TablesUpdate } from '../types/database.types'
import * as clasificacionesService from './clasificacionesService'

/**
 * Returns all software belonging to the given temaId, ordered by nombre asc.
 */
export async function listarPorTema(temaId: string): Promise<Software[]> {
  const { data, error } = await supabase
    .from('software')
    .select('*')
    .eq('tema_id', temaId)
    .order('nombre')

  if (error) throw error
  return data ?? []
}

/**
 * Returns every software in the catalogue, ordered by nombre asc.
 * Used by the Catálogo grid view and aggregate counts.
 */
export async function listarTodos(): Promise<Software[]> {
  const { data, error } = await supabase
    .from('software')
    .select('*')
    .order('nombre')

  if (error) throw error
  return data ?? []
}

/**
 * Returns all software linked to a clasificacion_si via the M2M junction,
 * ordered by nombre asc.
 */
export async function listarPorClasificacion(clasificacionId: string): Promise<Software[]> {
  const { data, error } = await supabase
    .from('software_clasificaciones')
    .select('software(*)')
    .eq('clasificacion_si_id', clasificacionId)

  if (error) throw error

  const rows = (data ?? []) as Array<{ software: Software | null }>
  return rows
    .map((r) => r.software)
    .filter((s): s is Software => s !== null)
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
}

/**
 * Returns all clasificaciones_si linked to the given softwareId via the junction,
 * with criterio embedded. Delegates to clasificacionesService.
 */
export async function listarClasificacionesDeSoftware(
  softwareId: string,
): Promise<ClasificacionConCriterio[]> {
  return clasificacionesService.listarClasificacionesDeSoftware(softwareId)
}

/**
 * Returns a single Software by id, or null when not found.
 */
export async function obtenerSoftware(id: string): Promise<Software | null> {
  const { data, error } = await supabase
    .from('software')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return data ?? null
}

/**
 * Returns a single Software by slug, or null when not found.
 * slug is UNIQUE NOT NULL so maybeSingle() is safe here.
 */
export async function obtenerPorSlug(slug: string): Promise<Software | null> {
  const { data, error } = await supabase
    .from('software')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw error
  return data ?? null
}

/**
 * Searches software by optional filter fields.
 * All filters are independently optional; undefined filters are not applied.
 * Sanitizes texto to strip PostgREST filter syntax chars (`,`, `(`, `)`)
 * before building the .or() ilike filter (D7).
 */
export async function buscar(filtros: FiltrosBusqueda): Promise<Software[]> {
  let query = supabase.from('software').select('*')

  if (filtros.texto !== undefined) {
    // Strip chars that are PostgREST filter syntax to prevent 400 errors (D7)
    const sanitized = filtros.texto.replace(/[,()]/g, '')
    query = query.or(
      `nombre.ilike.%${sanitized}%,objetivo.ilike.%${sanitized}%`,
    )
  }

  if (filtros.tema_id !== undefined) {
    query = query.eq('tema_id', filtros.tema_id)
  }

  if (filtros.licencia !== undefined) {
    query = query.eq('licencia', filtros.licencia)
  }

  if (filtros.anio_desde !== undefined) {
    query = query.gte('anio_lanzamiento', filtros.anio_desde)
  }

  if (filtros.anio_hasta !== undefined) {
    query = query.lte('anio_lanzamiento', filtros.anio_hasta)
  }

  const { data, error } = await query.order('nombre')

  if (error) throw error
  return data ?? []
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
 * Updates a software by id and returns the updated row.
 * Throws 'Requiere sesión' before any network call when unauthenticated.
 *
 * .select() returns the full row including the internal embedding/fts columns;
 * the Promise<Software> return-type annotation narrows them away structurally
 * (Software is an Omit-subset of the row), mirroring obtenerSoftware.
 */
export async function editar(
  id: string,
  patch: TablesUpdate<'software'>,
): Promise<Software> {
  await requireUser()

  const { data, error } = await supabase
    .from('software')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Calls the buscar Edge Function for hybrid NLP + semantic search.
 * On any error (network, 4xx, 5xx, or timeout) this throws so callers can fall back to buscar().
 * The EF returns resultados without embedding/fts columns — shape matches Software[].
 *
 * The 8 s timeout is passed via the native `timeout` option in @supabase/functions-js
 * (supported since v2.4.0 — verified present in the installed v2.108.1 FunctionsClient).
 * On expiry the internal AbortController fires and the fetch rejects with an AbortError,
 * which supabase-js surfaces as a FunctionsFetchError — caught by useBusqueda's .catch()
 * path, activating the ilike fallback transparently.
 */
export async function buscarInteligente(
  req: BusquedaInteligenteRequest,
): Promise<BusquedaInteligenteResponse> {
  const { data, error } = await supabase.functions.invoke<BusquedaInteligenteResponse>(
    'buscar',
    { body: req, timeout: 8000 },
  )

  if (error) throw error
  if (!data) throw new Error('Empty response from buscar edge function')

  return data
}

/**
 * Returns software semantically related to the given id via the
 * software_relacionados RPC (cosine similarity with an adaptive cutoff).
 * Returns an empty array when the row has no embedding yet or no neighbour falls
 * within the margin — callers fall back to same-theme recommendations.
 * The RPC excludes the row itself and rows without an embedding server-side.
 */
export async function relacionados(id: string, limit = 5): Promise<Software[]> {
  const { data, error } = await supabase.rpc('software_relacionados', {
    p_software_id: id,
    p_limit: limit,
  })

  if (error) throw error
  return data ?? []
}
