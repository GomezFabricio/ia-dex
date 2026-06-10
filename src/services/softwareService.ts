import { supabase } from '../lib/supabase'
import type { Software, FiltrosBusqueda } from '../types/dtos'

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
