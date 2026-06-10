import { supabase } from '../lib/supabase'
import type { TemaForo, MensajeForo, NuevoTemaForo, NuevoMensaje } from '../types/dtos'

/**
 * Returns all temas_foro ordered by created_at desc.
 */
export async function listarTemasForo(): Promise<TemaForo[]> {
  const { data, error } = await supabase
    .from('temas_foro')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

/**
 * Returns a single TemaForo by id, or null when not found.
 */
export async function obtenerTemaForo(id: string): Promise<TemaForo | null> {
  const { data, error } = await supabase
    .from('temas_foro')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return data ?? null
}

/**
 * Returns all mensajes for the given temaForoId, ordered by created_at asc.
 */
export async function listarMensajes(
  temaForoId: string,
): Promise<MensajeForo[]> {
  const { data, error } = await supabase
    .from('mensajes_foro')
    .select('*')
    .eq('tema_foro_id', temaForoId)
    .order('created_at')

  if (error) throw error
  return data ?? []
}

/**
 * Inserts a new tema_foro row.
 * Throws Error('Requiere sesión') when no session exists; RLS additionally
 * enforces authorship at the DB level (SC-04).
 */
export async function crearTemaForo(input: NuevoTemaForo): Promise<TemaForo> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Requiere sesión')

  const { data, error } = await supabase
    .from('temas_foro')
    .insert({
      titulo: input.titulo,
      cuerpo: input.cuerpo ?? null,
      user_id: user.id,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Inserts a new mensajes_foro row.
 * Throws Error('Requiere sesión') when no session exists; RLS additionally
 * enforces authorship at the DB level (SC-04).
 */
export async function crearMensaje(input: NuevoMensaje): Promise<MensajeForo> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Requiere sesión')

  const { data, error } = await supabase
    .from('mensajes_foro')
    .insert({
      tema_foro_id: input.tema_foro_id,
      contenido: input.contenido,
      user_id: user.id,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Deletes a temas_foro row by id.
 * RLS enforces authorship — only the row author can delete (SC-12).
 * CASCADE is confirmed on the DB (mensajes_foro.tema_foro_id → ON DELETE CASCADE),
 * so only the parent row needs to be deleted.
 * Throws Error('Requiere sesión') when no session exists.
 * Throws PostgrestError on error.
 */
export async function eliminarTemaForo(id: string): Promise<void> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Requiere sesión')

  const { error } = await supabase
    .from('temas_foro')
    .delete()
    .eq('id', id)

  if (error) throw error
}

/**
 * Deletes a mensajes_foro row by id.
 * RLS enforces authorship.
 * Throws Error('Requiere sesión') when no session exists.
 * Throws PostgrestError on error.
 */
export async function eliminarMensaje(id: string): Promise<void> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Requiere sesión')

  const { error } = await supabase
    .from('mensajes_foro')
    .delete()
    .eq('id', id)

  if (error) throw error
}
