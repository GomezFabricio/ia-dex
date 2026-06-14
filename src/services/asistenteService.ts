import { supabase } from '../lib/supabase'
import type { AsistenteRequest, AsistenteResponse } from '../types/dtos'

// ---------------------------------------------------------------------------
// asistenteService — calls the `asistente` edge function (Gemini-grounded chat).
// 18 s timeout: worst case = 2 models × 8 s Gemini timeout + catalogue fetch.
// Errors propagate to useAsistente's catch path.
// ---------------------------------------------------------------------------

export async function preguntar(req: AsistenteRequest): Promise<AsistenteResponse> {
  const { data, error } = await supabase.functions.invoke<AsistenteResponse>('asistente', {
    body: req,
    timeout: 18000,
  })

  if (error) throw error
  if (!data) throw new Error('Empty response from asistente edge function')

  return data
}
