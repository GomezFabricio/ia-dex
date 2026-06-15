import { supabase } from './supabase'

// The public Storage bucket that backs inline-edited content images (software /
// clasificaciones). Created by migration 019 (public, MIME-restricted, 5 MB cap,
// admin-gated writes via puede_gestionar_contenido()).
const BUCKET = 'contenido'

// Bucket-scoped marker inside a Supabase public URL. Everything after it is the
// Storage object key. indexOf (not startsWith) so the full absolute URL form
// (https://<ref>.supabase.co/storage/v1/object/public/contenido/<key>) works.
const PUBLIC_PREFIX = `/storage/v1/object/public/${BUCKET}/`

// Entity prefix that namespaces the object key inside the bucket. Matches the
// migration's path convention {entity}/{id}/{uuid}-{name}.
export type ContenidoPrefix = 'software' | 'clasificaciones'

/**
 * Uploads ONE content image to the public 'contenido' Storage bucket under a
 * COLLISION-PROOF key `{prefix}/{id}/{uuid}-{file.name}` and returns its public
 * URL — the value to store in the entity's imagen_url column.
 *
 * upsert is left at its default (false): the uuid prefix guarantees a unique key
 * even for identical filenames, so two same-named uploads NEVER overwrite each
 * other (set semantics). Throws on upload error so the caller can surface it.
 */
export async function subirImagenContenido(
  prefix: ContenidoPrefix,
  id: string,
  file: File,
): Promise<string> {
  const path = `${prefix}/${id}/${crypto.randomUUID()}-${file.name}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: false })

  if (error) throw error

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

/**
 * Best-effort delete of a content object given its public URL. Reconstructs the
 * Storage object key from the stable Supabase public-URL shape and removes it.
 *
 * Graceful: if the URL doesn't contain the expected bucket prefix (legacy/foreign
 * URL) it returns WITHOUT throwing. Storage.remove does NOT throw on API-level
 * errors (RLS denial / not-found) — it returns { error } — so we inspect that
 * object and warn instead of re-throwing. The surrounding try/catch only guards
 * network-level throws. Either way a failed cleanup leaves an orphan blob but
 * must NEVER break a form save.
 */
export async function eliminarImagenContenido(url: string): Promise<void> {
  const marker = url.indexOf(PUBLIC_PREFIX)
  if (marker === -1) return // not our bucket / malformed — skip, do not throw
  const key = decodeURIComponent(url.slice(marker + PUBLIC_PREFIX.length))
  if (key === '') return
  try {
    const { error } = await supabase.storage.from(BUCKET).remove([key])
    if (error) console.warn('[contenido] image storage delete failed', error)
  } catch (err) {
    // Best-effort cleanup: a network-level throw leaves an orphan blob but must
    // never break the save.
    console.warn('[contenido] image storage delete threw', err)
  }
}
