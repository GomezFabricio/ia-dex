import { supabase } from '../lib/supabase'
import type { Tema } from '../types/dtos'

/**
 * Returns all temas ordered by orden asc.
 * Returns [] on empty table.
 */
export async function listarTemas(): Promise<Tema[]> {
  const { data, error } = await supabase
    .from('temas')
    .select('*')
    .order('orden')

  if (error) throw error
  return data ?? []
}

/**
 * Returns a single Tema by slug, or null when not found.
 * Throws PostgrestError on network/server error.
 */
export async function obtenerTema(slug: string): Promise<Tema | null> {
  const { data, error } = await supabase
    .from('temas')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw error
  return data ?? null
}
