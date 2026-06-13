import { supabase } from '../lib/supabase'
import type {
  Software,
  FiltrosBusqueda,
  BusquedaInteligenteRequest,
  BusquedaInteligenteResponse,
} from '../types/dtos'

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
