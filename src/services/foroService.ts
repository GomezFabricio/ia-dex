import { supabase } from '../lib/supabase'
import type {
  TemaForo,
  TemaForoConAutor,
  MensajeForo,
  MensajeForoConAutor,
  NuevoTemaForo,
  NuevoMensaje,
} from '../types/dtos'

// Spanish fallback for the foro author display when nombre + apellido are both
// empty. Unlike publicaciones (brand byline "Equipo ia-dex"), a forum poster is
// always a person, so the generic "Usuario" reads correctly here.
const AUTOR_FALLBACK = 'Usuario'

/**
 * Resolves author display names for the given foro rows from the public
 * v_autores_publicos VIEW. Mirrors publicacionesService.resolverAutores, but
 * reads the `user_id` author FK (foro has no autor_id / firma byline).
 *
 * Strategy: one explicit second query with `.in('id', userIds)`, then build an
 * id -> display-name map. Display name = (nombre + ' ' + apellido).trim(),
 * falling back to the literal "Usuario" when both are null/empty.
 */
async function resolverAutoresForo<T extends { user_id: string }>(
  rows: T[],
): Promise<(T & { autorNombre: string })[]> {
  const userIds = [
    ...new Set(
      rows
        .map((r) => r.user_id)
        .filter((id): id is string => id !== null && id !== ''),
    ),
  ]

  const nombrePorId = new Map<string, string>()

  if (userIds.length > 0) {
    const { data, error } = await supabase
      .from('v_autores_publicos')
      .select('id, nombre, apellido')
      .in('id', userIds)

    if (error) throw error

    for (const autor of data ?? []) {
      if (autor.id === null) continue
      const compuesto = `${autor.nombre ?? ''} ${autor.apellido ?? ''}`.trim()
      nombrePorId.set(autor.id, compuesto === '' ? AUTOR_FALLBACK : compuesto)
    }
  }

  return rows.map((row) => ({
    ...row,
    autorNombre: nombrePorId.get(row.user_id) ?? AUTOR_FALLBACK,
  }))
}

/**
 * Returns all temas_foro ordered by created_at desc, each with its resolved
 * author display name (autorNombre).
 */
export async function listarTemasForo(): Promise<TemaForoConAutor[]> {
  const { data, error } = await supabase
    .from('temas_foro')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return resolverAutoresForo<TemaForo>(data ?? [])
}

/**
 * Returns a single TemaForo by id (with author name), or null when not found.
 */
export async function obtenerTemaForo(
  id: string,
): Promise<TemaForoConAutor | null> {
  const { data, error } = await supabase
    .from('temas_foro')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  if (data === null) return null
  const [conAutor] = await resolverAutoresForo<TemaForo>([data])
  return conAutor ?? null
}

/**
 * Returns all mensajes for the given temaForoId (with author names), ordered by
 * created_at asc.
 */
export async function listarMensajes(
  temaForoId: string,
): Promise<MensajeForoConAutor[]> {
  const { data, error } = await supabase
    .from('mensajes_foro')
    .select('*')
    .eq('tema_foro_id', temaForoId)
    .order('created_at')

  if (error) throw error
  return resolverAutoresForo<MensajeForo>(data ?? [])
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
