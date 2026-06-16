import { supabase } from '../lib/supabase'
import type {
  Enlace,
  Publicacion,
  PublicacionConAutor,
  PublicacionRating,
  PublicacionRatingRow,
} from '../types/dtos'
import type { Tables, TablesInsert, TablesUpdate } from '../types/database.types'

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
 * Parses the raw Json imagenes column into string[] (an ordered gallery of public
 * Storage URLs). FILTER semantics: returns [] on null/non-array, then keeps only
 * the non-empty string elements (dropping non-strings and empty strings). Mirrors
 * parseEnlaces' read-boundary contract.
 */
function parseImagenes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (item): item is string => typeof item === 'string' && item.length > 0,
  )
}

/**
 * Maps a raw publicaciones row to Publicacion, parsing enlaces and imagenes along
 * the way (the single read boundary — no component re-parses jsonb).
 */
function toPublicacion(row: PublicacionRow): Publicacion {
  return {
    ...row,
    enlaces: parseEnlaces(row.enlaces),
    imagenes: parseImagenes(row.imagenes),
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

  return rows.map((row) => {
    // Display precedence: firma (byline override) → author profile name → fallback.
    const firma = row.firma?.trim()
    const desdeAutor =
      row.autor_id !== null ? nombrePorId.get(row.autor_id) : undefined
    return {
      ...row,
      autorNombre:
        (firma !== undefined && firma !== '' ? firma : undefined) ??
        desdeAutor ??
        AUTOR_FALLBACK,
    }
  })
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
 * Returns published publicaciones linked to a tema in the admin-curated order:
 * `orden` ascending (NULLS LAST), then created_at descending as a tiebreaker.
 * Curated items lead in the admin's chosen sequence; never-ordered rows fall to
 * the end by recency. Served by idx_publicaciones_tema_orden.
 */
export async function listarPorTema(
  temaId: string,
): Promise<PublicacionConAutor[]> {
  const { data, error } = await supabase
    .from('publicaciones')
    .select('*')
    .eq('estado', 'publicado')
    .eq('tema_id', temaId)
    .order('orden', { ascending: true, nullsFirst: false })
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

/**
 * Coalesces a nullable view row into the non-null PublicacionRating DTO.
 * Rows with null publicacion_id are filtered out before calling this.
 * (Mirrors estadisticasService.toSoftwareRating — same read-boundary contract.)
 */
function toPublicacionRating(row: PublicacionRatingRow): PublicacionRating {
  return {
    publicacion_id: row.publicacion_id ?? '',
    titulo: row.titulo ?? '',
    slug: row.slug ?? '',
    promedio: row.promedio ?? 0,
    cantidad_votos: row.cantidad_votos ?? 0,
  }
}

/**
 * Returns the highest-rated published publicaciones from v_publicaciones_rating,
 * ranked by promedio desc then cantidad_votos desc. The view only exposes
 * published posts with >= 1 rating, so it is empty on cold-start (returns []).
 * (Mirrors estadisticasService.mejorValorados.)
 */
export async function listarMasValoradas(
  limite = 5,
): Promise<PublicacionRating[]> {
  const { data, error } = await supabase
    .from('v_publicaciones_rating')
    .select('*')
    .order('promedio', { ascending: false })
    .order('cantidad_votos', { ascending: false })
    .limit(limite)

  if (error) throw error

  return (data ?? [])
    .filter((row): row is PublicacionRatingRow & { publicacion_id: string } =>
      row.publicacion_id !== null,
    )
    .map(toPublicacionRating)
}

// ---------------------------------------------------------------------------
// Admin reads — NO estado filter. RLS ("lectura publica publicaciones" with
// USING (estado = 'publicado' OR puede_gestionar_contenido())) is what actually
// returns drafts: an admin session sees all rows, a non-admin sees only
// published ones even through these functions. The absence of an `.eq('estado',
// ...)` here is deliberate so the admin list includes borradores. (ADM2)
// ---------------------------------------------------------------------------

/**
 * Admin list: every publicacion the caller is allowed to read (drafts included
 * for an admin via RLS), newest first. Maps to PublicacionConAutor reusing the
 * Slice 2 author resolver.
 */
export async function listarTodasParaAdmin(): Promise<PublicacionConAutor[]> {
  const { data, error } = await supabase
    .from('publicaciones')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return resolverAutores((data ?? []).map(toPublicacion))
}

/**
 * Fetches a single publicacion by id (NOT slug, NO estado filter) for the edit
 * form. Uses .maybeSingle() so an absent/forbidden id returns null instead of
 * throwing (mirrors obtenerPublicacion's not-found contract).
 */
export async function obtenerParaAdmin(id: string): Promise<Publicacion | null> {
  const { data, error } = await supabase
    .from('publicaciones')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return data ? toPublicacion(data) : null
}

// ---------------------------------------------------------------------------
// Admin writes — each guarded FIRST by auth.getUser() throwing 'Requiere
// sesión' when there is no session (pattern from foroService). The guard is
// only a friendly early error; RLS (puede_gestionar_contenido()) is the
// authoritative enforcement — a logged-in non-admin still gets a row-level
// rejection from Postgres. (SV4)
// ---------------------------------------------------------------------------

// Postgres unique_violation — raised when an INSERT collides with the
// publicaciones_slug_key UNIQUE constraint.
const PG_UNIQUE_VIOLATION = '23505'

async function requireUser() {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Requiere sesión')
  return user
}

/**
 * Inserts a publicacion and returns the created row.
 *
 * Slug collision handling (SG1): if the insert hits the UNIQUE(slug) constraint
 * (Postgres code 23505), retry with a numeric suffix appended to the ORIGINAL
 * base slug ('-2', '-3', …) until it inserts. The first attempt uses the slug
 * exactly as supplied; suffixes only kick in on a real collision.
 *
 * Throws 'Requiere sesión' before any network call when unauthenticated.
 */
export async function crear(
  input: TablesInsert<'publicaciones'>,
): Promise<Publicacion> {
  await requireUser()

  const baseSlug = input.slug
  const MAX_ATTEMPTS = 100

  // Bounded retry loop: attempt 1 uses baseSlug; later attempts append -N.
  // The loop only re-runs on a 23505 (unique slug) error; any other error
  // throws immediately. Capped at MAX_ATTEMPTS as a safety net so a pathological
  // server returning 23505 indefinitely can never spin forever.
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const slug = attempt === 1 ? baseSlug : `${baseSlug}-${attempt}`

    const { data, error } = await supabase
      .from('publicaciones')
      .insert({ ...input, slug })
      .select()
      .single()

    if (!error) return toPublicacion(data)
    if (error.code !== PG_UNIQUE_VIOLATION) throw error
  }

  throw new Error(
    `No se pudo generar un slug único para "${baseSlug}" tras ${MAX_ATTEMPTS} intentos`,
  )
}

/**
 * Updates a publicacion by id and returns the updated row.
 * Throws 'Requiere sesión' before any network call when unauthenticated.
 */
export async function editar(
  id: string,
  patch: TablesUpdate<'publicaciones'>,
): Promise<Publicacion> {
  await requireUser()

  const { data, error } = await supabase
    .from('publicaciones')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return toPublicacion(data)
}

/**
 * Deletes a publicacion by id.
 * Throws 'Requiere sesión' before any network call when unauthenticated.
 */
export async function eliminar(id: string): Promise<void> {
  await requireUser()

  const { error } = await supabase.from('publicaciones').delete().eq('id', id)

  if (error) throw error
}

/**
 * Persists the admin-curated order of a tema's contenido didáctico. Delegates
 * to the reordenar_material_tema RPC (atomic, admin-enforced by RLS). `ids`
 * is the full ordered list of publicacion ids for the tema; each row's `orden`
 * is set to its 0-based position. Throws 'Requiere sesión' before any network
 * call when unauthenticated.
 */
export async function reordenarMaterialTema(
  temaId: string,
  ids: string[],
): Promise<void> {
  await requireUser()
  const { error } = await supabase.rpc('reordenar_material_tema', {
    p_tema_id: temaId,
    p_ids: ids,
  })
  if (error) throw error
}

/**
 * Uploads an image to the 'publicaciones' Storage bucket under
 * `{publicacionId}/{file.name}` (upsert: true so re-uploading the same name
 * overwrites) and returns its public URL — the value to store in imagen_url.
 *
 * The {publicacionId}/ path prefix is why the form generates a working id up
 * front for new posts (create-id approach): the image can be uploaded before
 * the row exists. Throws on upload error.
 */
export async function subirImagen(
  publicacionId: string,
  file: File,
): Promise<string> {
  const path = `${publicacionId}/${file.name}`

  const { error } = await supabase.storage
    .from('publicaciones')
    .upload(path, file, { upsert: true })

  if (error) throw error

  const { data } = supabase.storage.from('publicaciones').getPublicUrl(path)
  return data.publicUrl
}

// Bucket-scoped marker inside a Supabase public URL. Everything after it is the
// Storage object key. indexOf (not startsWith) so the full absolute URL form
// (https://<ref>.supabase.co/storage/v1/object/public/publicaciones/<key>) works.
const PUBLIC_PREFIX = '/storage/v1/object/public/publicaciones/'

/**
 * Uploads ONE gallery image to the 'publicaciones' Storage bucket under a
 * COLLISION-PROOF key `{publicacionId}/{uuid}-{file.name}` and returns its public
 * URL — a value to append to the imagenes array.
 *
 * Unlike subirImagen (the cover), this NEVER upserts: a gallery is a SET, so two
 * files with the same name MUST coexist. The uuid prefix guarantees a unique key
 * even for identical filenames, which makes upsert unnecessary and unsafe. The
 * cover helper subirImagen is unchanged. Throws on upload error.
 */
export async function subirImagenGaleria(
  publicacionId: string,
  file: File,
): Promise<string> {
  const path = `${publicacionId}/${crypto.randomUUID()}-${file.name}`

  const { error } = await supabase.storage
    .from('publicaciones')
    .upload(path, file)

  if (error) throw error

  const { data } = supabase.storage.from('publicaciones').getPublicUrl(path)
  return data.publicUrl
}

/**
 * Best-effort delete of a gallery object given its public URL. Reconstructs the
 * Storage object key from the stable Supabase public-URL shape and removes it.
 *
 * Graceful: if the URL doesn't contain the expected bucket prefix (legacy/foreign
 * URL) it returns WITHOUT throwing. Storage API errors (permission/RLS/not-found)
 * are warned but not re-thrown — a failed cleanup must NEVER break a form save
 * (the array edit is what the user actually asked for). Accepts the orphan-blob
 * tradeoff of the embed model.
 */
export async function eliminarImagenGaleria(url: string): Promise<void> {
  const marker = url.indexOf(PUBLIC_PREFIX)
  if (marker === -1) return // not our bucket / malformed — skip, do not throw
  const key = decodeURIComponent(url.slice(marker + PUBLIC_PREFIX.length))
  if (key === '') return
  try {
    const { error } = await supabase.storage.from('publicaciones').remove([key])
    if (error) console.warn('[publicaciones] gallery image storage delete failed', error)
  } catch (err) {
    // Best-effort cleanup: a network-level throw leaves an orphan blob but must
    // never break the save.
    console.warn('[publicaciones] gallery image storage delete threw', err)
  }
}
