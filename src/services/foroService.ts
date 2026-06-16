import { supabase } from '../lib/supabase'
import type {
  TemaForo,
  TemaForoConAutor,
  MensajeForo,
  MensajeForoConAutor,
  NuevoTemaForo,
  NuevoMensaje,
  ForoScope,
  ForoFiltro,
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

// Columns a foro row carries for its (at most one) scope target.
type FilasConScope = {
  software_id: string | null
  tema_id: string | null
  clasificacion_si_id: string | null
}

const uniqIds = (ids: (string | null)[]): string[] => [
  ...new Set(ids.filter((id): id is string => id !== null && id !== '')),
]

/**
 * Resolves the display scope (tipo + nombre + slug) for the given foro rows.
 * A debate is scoped to AT MOST ONE of software / tema / clasificacion_si, so
 * this batches one `.in('id', …)` query per dimension that actually appears,
 * mirroring resolverAutoresForo's id->name map strategy. Rows with no scope
 * target get scope = null (general debate).
 */
async function resolverScopes<T extends FilasConScope>(
  rows: T[],
): Promise<(T & { scope: ForoScope | null })[]> {
  const softwareIds = uniqIds(rows.map((r) => r.software_id))
  const temaIds = uniqIds(rows.map((r) => r.tema_id))
  const clasifIds = uniqIds(rows.map((r) => r.clasificacion_si_id))

  const softwareMap = new Map<string, { nombre: string; slug: string }>()
  const temaMap = new Map<string, { nombre: string; slug: string }>()
  const clasifMap = new Map<string, { nombre: string; slug: string }>()

  if (softwareIds.length > 0) {
    const { data, error } = await supabase
      .from('software')
      .select('id, nombre, slug')
      .in('id', softwareIds)
    if (error) throw error
    for (const e of data ?? []) softwareMap.set(e.id, { nombre: e.nombre, slug: e.slug })
  }
  if (temaIds.length > 0) {
    const { data, error } = await supabase
      .from('temas')
      .select('id, nombre, slug')
      .in('id', temaIds)
    if (error) throw error
    for (const e of data ?? []) temaMap.set(e.id, { nombre: e.nombre, slug: e.slug })
  }
  if (clasifIds.length > 0) {
    const { data, error } = await supabase
      .from('clasificaciones_si')
      .select('id, nombre, slug')
      .in('id', clasifIds)
    if (error) throw error
    for (const e of data ?? []) clasifMap.set(e.id, { nombre: e.nombre, slug: e.slug })
  }

  return rows.map((row) => {
    let scope: ForoScope | null = null
    if (row.software_id !== null) {
      const m = softwareMap.get(row.software_id)
      if (m) scope = { tipo: 'software', id: row.software_id, nombre: m.nombre, slug: m.slug }
    } else if (row.tema_id !== null) {
      const m = temaMap.get(row.tema_id)
      if (m) scope = { tipo: 'tema', id: row.tema_id, nombre: m.nombre, slug: m.slug }
    } else if (row.clasificacion_si_id !== null) {
      const m = clasifMap.get(row.clasificacion_si_id)
      if (m) scope = { tipo: 'clasificacion_si', id: row.clasificacion_si_id, nombre: m.nombre, slug: m.slug }
    }
    return { ...row, scope }
  })
}

/**
 * Resolves a single scope target (nombre + slug) for a filtered foro view's
 * header — independent of whether any debate exists for it yet. Returns null
 * when the referenced entity no longer exists.
 */
export async function obtenerScope(filtro: ForoFiltro): Promise<ForoScope | null> {
  if (filtro.tipo === 'software') {
    const { data, error } = await supabase
      .from('software')
      .select('id, nombre, slug')
      .eq('id', filtro.id)
      .maybeSingle()
    if (error) throw error
    return data ? { tipo: 'software', id: data.id, nombre: data.nombre, slug: data.slug } : null
  }
  if (filtro.tipo === 'tema') {
    const { data, error } = await supabase
      .from('temas')
      .select('id, nombre, slug')
      .eq('id', filtro.id)
      .maybeSingle()
    if (error) throw error
    return data ? { tipo: 'tema', id: data.id, nombre: data.nombre, slug: data.slug } : null
  }
  const { data, error } = await supabase
    .from('clasificaciones_si')
    .select('id, nombre, slug')
    .eq('id', filtro.id)
    .maybeSingle()
  if (error) throw error
  return data ? { tipo: 'clasificacion_si', id: data.id, nombre: data.nombre, slug: data.slug } : null
}

/**
 * Returns temas_foro ordered by created_at desc, each with its resolved author
 * display name (autorNombre) and scope (null for general debates). When `filtro`
 * is given, only debates scoped to that exact entity are returned.
 */
export async function listarTemasForo(
  filtro?: ForoFiltro | null,
): Promise<TemaForoConAutor[]> {
  let query = supabase.from('temas_foro').select('*')

  if (filtro) {
    const columna =
      filtro.tipo === 'software'
        ? 'software_id'
        : filtro.tipo === 'tema'
          ? 'tema_id'
          : 'clasificacion_si_id'
    query = query.eq(columna, filtro.id)
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) throw error
  const conAutor = await resolverAutoresForo<TemaForo>(data ?? [])
  return resolverScopes(conAutor)
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
  if (!conAutor) return null
  const [conScope] = await resolverScopes([conAutor])
  return conScope ?? null
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
      // At most one is non-null (UI enforces it; DB CHECK guards it).
      software_id: input.software_id ?? null,
      tema_id: input.tema_id ?? null,
      clasificacion_si_id: input.clasificacion_si_id ?? null,
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
