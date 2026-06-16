import { supabase } from '../lib/supabase'
import type { Tema } from '../types/dtos'
import type { TablesUpdate } from '../types/database.types'

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
 * Updates a tema by id and returns the updated row.
 * Throws 'Requiere sesión' before any network call when unauthenticated.
 */
export async function editar(
  id: string,
  patch: TablesUpdate<'temas'>,
): Promise<Tema> {
  await requireUser()

  const { data, error } = await supabase
    .from('temas')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}
