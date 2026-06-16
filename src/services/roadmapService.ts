import { supabase } from '../lib/supabase'
import type { Software, Tema } from '../types/dtos'

// ---------------------------------------------------------------------------
// roadmapService — data access for the "Aprender IA" roadmap.
// The roadmap is built entirely from existing tables: temas (ordered by `orden`)
// are the stages, v_software_rating ranks the featured software, and
// progreso_roadmap stores per-user completion (RLS: each user only their rows).
// ---------------------------------------------------------------------------

/**
 * Returns all temas ordered by their pedagogical `orden` (the roadmap spine).
 */
export async function getTemasOrdenados(): Promise<Tema[]> {
  const { data, error } = await supabase
    .from('temas')
    .select('*')
    .order('orden', { ascending: true })

  if (error) throw error
  return data ?? []
}

/**
 * Returns the top software for a tema, ranked by average rating, tie-broken
 * alphabetically. v_software_rating carries no tema_id, so the tema's software
 * and the ratings are fetched separately and merged client-side (same approach
 * as estadisticasService.recomendaciones). Falls back to alphabetical order when
 * no ratings exist (cold start).
 *
 * Note: each call re-fetches the full v_software_rating (the view has no tema_id
 * to filter on). Harmless for the current small catalogue; if temas grow large,
 * hoist the ratings fetch out and pass a shared ratingMap instead of N scans.
 */
export async function getTopSoftwarePorTema(
  temaId: string,
  limit = 3,
): Promise<Software[]> {
  const [softwareResult, ratingResult] = await Promise.all([
    supabase.from('software').select('*').eq('tema_id', temaId),
    supabase.from('v_software_rating').select('software_id, promedio'),
  ])

  if (softwareResult.error) throw softwareResult.error
  if (ratingResult.error) throw ratingResult.error

  const ratingMap = new Map<string, number>()
  for (const row of ratingResult.data ?? []) {
    if (row.software_id !== null) ratingMap.set(row.software_id, row.promedio ?? 0)
  }

  return [...(softwareResult.data ?? [])]
    .sort((a, b) => {
      const rA = ratingMap.get(a.id) ?? 0
      const rB = ratingMap.get(b.id) ?? 0
      if (rB !== rA) return rB - rA
      return a.nombre.localeCompare(b.nombre)
    })
    .slice(0, limit)
}

/**
 * Returns the tema_ids the user has marked complete.
 */
export async function getProgreso(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('progreso_roadmap')
    .select('tema_id')
    .eq('user_id', userId)

  if (error) throw error
  return (data ?? []).map((row) => row.tema_id)
}

/**
 * Marks a tema complete for the user. Upsert on the (user_id, tema_id) PK —
 * re-completing relies on the UPDATE RLS policy to succeed instead of being
 * silently rejected.
 */
export async function upsertProgreso(userId: string, temaId: string): Promise<void> {
  const { error } = await supabase
    .from('progreso_roadmap')
    .upsert({ user_id: userId, tema_id: temaId }, { onConflict: 'user_id,tema_id' })

  if (error) throw error
}

/**
 * Unmarks a tema for the user.
 */
export async function deleteProgreso(userId: string, temaId: string): Promise<void> {
  const { error } = await supabase
    .from('progreso_roadmap')
    .delete()
    .eq('user_id', userId)
    .eq('tema_id', temaId)

  if (error) throw error
}

/**
 * Migrates anonymous (localStorage) progress into the table on sign-in.
 * Uses ON CONFLICT DO NOTHING (ignoreDuplicates) so re-login never errors nor
 * overwrites an existing completion timestamp.
 */
export async function migrarProgreso(
  userId: string,
  temaIds: string[],
): Promise<void> {
  if (temaIds.length === 0) return

  const rows = temaIds.map((temaId) => ({ user_id: userId, tema_id: temaId }))
  const { error } = await supabase
    .from('progreso_roadmap')
    .upsert(rows, { onConflict: 'user_id,tema_id', ignoreDuplicates: true })

  if (error) throw error
}
