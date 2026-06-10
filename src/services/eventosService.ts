import { supabase } from '../lib/supabase'
import type { NuevoEvento } from '../types/dtos'
import type { Json } from '../types/database.types'

/**
 * Records an analytics event.
 * Fail-soft: always resolves, never throws (R9.1).
 * user_id is set to the current auth user or null for anonymous events (R9.2).
 * metadata defaults to {} when not provided (R9.3).
 */
export async function registrarEvento(input: NuevoEvento): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { error } = await supabase.from('eventos').insert({
      tipo: input.tipo,
      software_id: input.software_id ?? null,
      metadata: (input.metadata ?? {}) as Json,
      user_id: user?.id ?? null,
    })

    if (error) {
      console.warn('[eventosService] registrarEvento insert failed:', error)
    }
  } catch (err) {
    console.warn('[eventosService] registrarEvento unexpected error:', err)
  }
}
