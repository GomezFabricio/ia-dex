import { supabase } from '../lib/supabase'
import type { Enlace, Publicacion, PublicacionConAutor } from '../types/dtos'
import type { Tables } from '../types/database.types'

type PublicacionRow = Tables<'publicaciones'>

// Spanish fallback for author display when nombre + apellido are both empty (AU2).
const AUTOR_FALLBACK = 'Equipo ia-dex'

/**
 * Parses the raw Json enlaces column into Enlace[].
 * Gracefully returns [] on null, non-array, or malformed JSON.
 * (Copied verbatim from clasificacionesService — same read-boundary contract.)
 */
function parseEnlaces(raw: unknown): Enlace[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (item): item is Enlace =>
      item !== null &&
      typeof item === 'object' &&
      typeof (item as Record<string, unknown>).titulo === 'string' &&
      typeof (item as Record<string, unknown>).url === 'string',
  )
}

/**
 * Maps a raw publicaciones row to Publicacion, parsing enlaces along the way.
 */
function toPublicacion(row: PublicacionRow): Publicacion {
  return {
    ...row,
    enlaces: parseEnlaces(row.enlaces),
  }
}

/**
 * Resolves author display names for the given rows from the public
 * v_autores_publicos VIEW (per Capability 4 / Decision 5). We do NOT join
 * profiles directly — profiles RLS is self-read-only and would blank the author
 * for anonymous readers. The view is security-definer (security_invoker = false)
 * so anon can read it.
 *
 * Strategy: one explicit second query with `.in('id', autorIds)` (robust — does
 * not rely on PostgREST view embedding), then build an id -> display-name map.
 * Display name = (nombre + ' ' + apellido).trim(), falling back to the literal
 * "Equipo ia-dex" when both nombre and apellido are null/empty.
 */
async function resolverAutores(
  rows: Publicacion[],
): Promise<PublicacionConAutor[]> {
  const autorIds = [
    ...new Set(
      rows
        .map((r) => r.autor_id)
        .filter((id): id is string => id !== null && id !== ''),
    ),
  ]

  const nombrePorId = new Map<string, string>()

  if (autorIds.length > 0) {
    const { data, error } = await supabase
      .from('v_autores_publicos')
      .select('id, nombre, apellido')
      .in('id', autorIds)

    if (error) throw error

    for (const autor of data ?? []) {
      if (autor.id === null) continue
      const compuesto = `${autor.nombre ?? ''} ${autor.apellido ?? ''}`.trim()
      nombrePorId.set(autor.id, compuesto === '' ? AUTOR_FALLBACK : compuesto)
    }
  }

  return rows.map((row) => ({
    ...row,
    autorNombre:
      (row.autor_id !== null ? nombrePorId.get(row.autor_id) : undefined) ??
      AUTOR_FALLBACK,
  }))
}

/**
 * Returns the blog feed: all published publicaciones, newest first.
 * RLS already hides drafts, but estado is filtered explicitly too.
 * Served by idx_publicaciones_estado_created.
 */
export async function listarPublicaciones(): Promise<PublicacionConAutor[]> {
  const { data, error } = await supabase
    .from('publicaciones')
    .select('*')
    .eq('estado', 'publicado')
    .order('created_at', { ascending: false })

  if (error) throw error
  return resolverAutores((data ?? []).map(toPublicacion))
}

/**
 * Returns a single PublicacionConAutor by slug, or null when not found.
 * Uses .maybeSingle() so an absent slug returns null (mirrors
 * temasService.obtenerTema — does NOT throw on absent).
 * Throws PostgrestError on network/server error.
 */
export async function obtenerPublicacion(
  slug: string,
): Promise<PublicacionConAutor | null> {
  const { data, error } = await supabase
    .from('publicaciones')
    .select('*')
    .eq('estado', 'publicado')
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const [conAutor] = await resolverAutores([toPublicacion(data)])
  return conAutor ?? null
}

/**
 * Returns published publicaciones linked to a tema, newest first.
 */
export async function listarPorTema(
  temaId: string,
): Promise<PublicacionConAutor[]> {
  const { data, error } = await supabase
    .from('publicaciones')
    .select('*')
    .eq('estado', 'publicado')
    .eq('tema_id', temaId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return resolverAutores((data ?? []).map(toPublicacion))
}

/**
 * Returns published publicaciones linked to an SI category, newest first.
 */
export async function listarPorClasificacion(
  clasifId: string,
): Promise<PublicacionConAutor[]> {
  const { data, error } = await supabase
    .from('publicaciones')
    .select('*')
    .eq('estado', 'publicado')
    .eq('clasificacion_si_id', clasifId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return resolverAutores((data ?? []).map(toPublicacion))
}
