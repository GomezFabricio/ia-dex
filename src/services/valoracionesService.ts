import { supabase } from '../lib/supabase'
import type { Valoracion, NuevaValoracion, ContenidoTipo } from '../types/dtos'

/**
 * Returns the current user's valoracion for the given content, or null.
 * Does NOT require an authenticated session — unauthenticated callers get null.
 * Throws PostgrestError on DB/network error.
 */
export async function miValoracion(
  tipo: ContenidoTipo,
  contenidoId: string,
): Promise<Valoracion | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data, error } = await supabase
    .from('valoraciones')
    .select('*')
    .eq('user_id', user.id)
    .eq('contenido_tipo', tipo)
    .eq('contenido_id', contenidoId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  // Narrow contenido_tipo from string to ContenidoTipo at the service boundary (D2)
  return { ...data, contenido_tipo: data.contenido_tipo as ContenidoTipo }
}

/**
 * Upserts a valoracion for the authenticated user.
 * Throws Error('Requiere sesión') when no session exists (SC-03).
 * Throws PostgrestError on DB error.
 */
export async function guardarValoracion(
  input: NuevaValoracion,
): Promise<Valoracion> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Requiere sesión')

  const { data, error } = await supabase
    .from('valoraciones')
    .upsert(
      {
        contenido_tipo: input.contenido_tipo,
        contenido_id: input.contenido_id,
        puntaje: input.puntaje,
        user_id: user.id,
      },
      { onConflict: 'user_id,contenido_tipo,contenido_id' },
    )
    .select()
    .single()

  if (error) throw error

  // Narrow contenido_tipo at the service boundary (D2)
  return { ...data, contenido_tipo: data.contenido_tipo as ContenidoTipo }
}

/**
 * Computes aggregate rating for a given content item.
 * Returns { promedio: 0, cantidad: 0 } when no votes exist (cold-start safe, SC-09).
 *
 * Note: return shape uses `cantidad` (not `cantidad_votos`) — this is a
 * polymorphic aggregate over all 3 contenido_tipo values. SoftwareRating
 * uses `cantidad_votos` to mirror the view column. Both are documented in dtos.ts.
 */
export async function promedio(
  tipo: ContenidoTipo,
  contenidoId: string,
): Promise<{ promedio: number; cantidad: number }> {
  const { data, error } = await supabase
    .from('valoraciones')
    .select('puntaje')
    .eq('contenido_tipo', tipo)
    .eq('contenido_id', contenidoId)

  if (error) throw error

  const rows = data ?? []
  if (rows.length === 0) return { promedio: 0, cantidad: 0 }

  const sum = rows.reduce((acc, r) => acc + r.puntaje, 0)
  const avg = Math.round((sum / rows.length) * 10) / 10

  return { promedio: avg, cantidad: rows.length }
}
