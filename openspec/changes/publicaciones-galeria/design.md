# Design: Publicaciones Galería — An Ordered jsonb Image Array Embedded on the Row

The gallery is a **value object owned 100% by its publication**: `imagenes jsonb` on `public.publicaciones`, an ordered array of public Storage URL strings — the exact shape already proven by `enlaces`. No child table, no `orden` column, no per-image RLS. The architecture is deliberately additive and mirrors live patterns: migration `014` (additive `ADD COLUMN`), `parseEnlaces` (the read-boundary jsonb parser), `subirImagen` (the Storage upload helper), the `enlaces` list-editor handlers in the admin form, and `Modal.tsx` (the accessible `<dialog>` reused as a lightbox). It introduces exactly **three** net-new mechanics the cover path never needed: collision-proof upload keys, a Storage-delete helper that reconstructs an object key from a public URL, and a drag-to-reorder interaction over a `string[]`. Delivered as chained PRs (likely >400 lines) along the hard sequencing below.

## Hard sequencing (the one non-negotiable order)

Nothing below the migration type-checks until `imagenes` exists in the generated `TablesInsert/Update`. The order is a build dependency, not a preference.

```
1. migration 015  [USER-GATED]   ADD COLUMN imagenes jsonb NOT NULL DEFAULT '[]'
        │  apply via Supabase MCP apply_migration AFTER explicit user OK (prod ref othwyesmfpjaykbdwxrh)
        ▼
2. regen types    Supabase MCP generate_typescript_types  ──> src/types/database.types.ts
        │  (npm run gen:types CLI is NOT available here — MCP tool only; generated file, never hand-edited)
        ▼
3. dtos + service   Publicacion combined Omit; parseImagenes; subirImagenGaleria; eliminarImagenGaleria
        ▼
4. admin form       multi-upload + reorder + remove(+delete); imagenes in crear/editar + pre-fill
        ▼
5. public detail    grid + Modal lightbox section, rendered only when imagenes.length > 0
```

Steps 2–5 cannot even compile before step 1 lands the column. Skipping the gate is the HIGH process risk from the proposal.

## Slice boundaries (chained PRs — `chain_strategy` to confirm with user before PR #1)

| Slice | Scope | Gate |
|---|---|---|
| 1 — DB + types `[USER-GATED]` | migration `db/2026-06-15_015_publicaciones_imagenes.sql` (`ADD COLUMN imagenes` + rollback comment, mirroring `014`'s header) + regen `database.types.ts` via Supabase MCP | apply **after explicit OK**; `npm run lint` + `tsc -b`; confirm `imagenes` present in generated `TablesInsert<'publicaciones'>` |
| 2 — DTO + service | `dtos.ts` combined `Omit`; `publicacionesService.ts` — `parseImagenes` (inside `toPublicacion`), `subirImagenGaleria`, `eliminarImagenGaleria` | `lint` + `tsc -b` |
| 3 — Admin form | `PublicacionFormPage.tsx` — `imagenes` state, `uploadingGaleria` flag, multi-upload loop, reorder handlers, remove-with-storage-delete, `imagenes` in `crear`/`editar` and the pre-fill effect | `lint` + `tsc -b` + Playwright (msedge) create→upload-many→reorder→remove→save |
| 4 — Public detail | `PublicacionDetallePage.tsx` — "Galería" grid + Modal lightbox, rendered only when `imagenes.length > 0` | `lint` + `tsc -b` + Playwright (msedge) on a publication with ≥3 images |

No test runner exists (`strict_tdd: false`); verification per slice is `lint` + `tsc -b` + a Playwright visual check on channel msedge. Code, identifiers, comments, and commits in **English**; domain model (`imagenes`, `imagen_url`, `enlaces`) and user-facing copy ("Galería") stay **Spanish**. Conventional commits, NO Co-Authored-By.

## Decision 1 — Drag-to-reorder: native HTML5 DnD (NO new dependency) ✅ DECIDED

**Choice**: **Native HTML5 drag-and-drop** — `draggable`, `onDragStart`, `onDragOver` (with `preventDefault`), `onDrop` — operating on the `imagenes: string[]` array. **NO new dependency.** Plus a tiny touch/a11y fallback: per-thumbnail **up/down arrow buttons** that call the same `moveImagen(from, to)` reducer, so reorder works without a pointer drag.

**Alternatives**: (a) `@dnd-kit` — better touch UX, keyboard sensor, drop animations, BUT adds a runtime dependency (core + sortable + utilities ≈ several packages) and a sortable-context wiring layer for a screen that admins touch occasionally on desktop; (b) `react-beautiful-dnd` — effectively unmaintained, heavier, and React-18-strict-mode awkward; (c) native DnD with **no** touch fallback — leaves touch users unable to reorder at all.

**Rationale**: The form is **ADMIN-ONLY and DESKTOP-PRIMARY**, the project currently has **NO** dnd library, and the team values clean foundations over speculative dependencies. Native HTML5 DnD covers the desktop primary path with **zero** bundle cost and zero new abstractions to learn. The known weakness of native DnD is touch (`dragstart` is unreliable on touch and there is no built-in keyboard story) — so rather than skip it, we add up/down arrow buttons that reuse the **same** `moveImagen` reducer the drop handler calls. Those buttons are also the keyboard-accessible path (real `<button>`s, focusable, `aria-label`), turning the a11y gap into a non-issue. If touch authoring becomes a real, measured need later, `@dnd-kit` is an additive swap: it would replace the drag wiring but keep the same `moveImagen(from, to)` state operation, so the upgrade is contained. Starting with `@dnd-kit` now is paying a dependency tax for a UX the primary user (desktop admin) does not need.

**Exact state + handler design** (the single source of truth for reorder is one pure index-move):

```ts
// State: the gallery is an ordered string[] of public URLs (array order = display order).
const [imagenes, setImagenes] = useState<string[]>([])
const [dragIndex, setDragIndex] = useState<number | null>(null) // index being dragged

// Pure index move — the ONE reorder primitive. Used by drop AND by up/down buttons.
function moveImagen(from: number, to: number) {
  setImagenes((prev) => {
    if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length) {
      return prev
    }
    const next = [...prev]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    return next
  })
}

// Native HTML5 DnD wiring on each thumbnail:
//   onDragStart={() => setDragIndex(index)}
//   onDragOver={(e) => e.preventDefault()}          // REQUIRED for onDrop to fire
//   onDrop={() => { if (dragIndex !== null) moveImagen(dragIndex, index); setDragIndex(null) }}
//   onDragEnd={() => setDragIndex(null)}
//   draggable
// Touch/keyboard fallback per thumbnail:
//   <button aria-label="Mover antes"   onClick={() => moveImagen(index, index - 1)} disabled={index === 0} />
//   <button aria-label="Mover después" onClick={() => moveImagen(index, index + 1)} disabled={index === imagenes.length - 1} />
```

`dragIndex` is the only extra piece of state; it carries the source index across the drag (more reliable than `dataTransfer` round-tripping a JSON payload, and never serialized into the DOM). All mutation flows through `moveImagen`, so drag and buttons can never diverge.

## Decision 2 — Upload helper: a dedicated `subirImagenGaleria` (NOT an overloaded `subirImagen`)

**Choice**: add a **separate** `subirImagenGaleria(publicacionId, file)` to `publicacionesService.ts`. Leave `subirImagen` (the cover helper) **untouched**.

**Alternatives**: (a) extend `subirImagen` with an optional `keyStrategy`/`collisionProof` param — one function, but it now branches on a flag, the cover path keeps `upsert:true` while the gallery path must NOT, and every caller has to remember the right flag; (b) a single helper that always uses unique keys — would change cover semantics (re-uploading a cover should overwrite, which `upsert:true` + filename key gives intentionally).

**Rationale**: The two helpers have **opposite** correctness requirements. The cover is a *singleton per publication*: `${id}/${file.name}` + `upsert:true` is correct — re-uploading replaces the cover. The gallery is a *set*: same-named files (two `screenshot.png`) MUST coexist, so it needs collision-proof keys and MUST NOT upsert-overwrite. Encoding two opposite contracts behind one parameterized function makes the dangerous default (overwrite) reachable by forgetting a flag — exactly the data-loss the proposal flags as HIGH. Two small, single-responsibility functions are clearer, each self-documenting, and the cover path stays byte-for-byte as it is today.

```ts
/**
 * Uploads ONE gallery image under a COLLISION-PROOF key
 * `{publicacionId}/{uuid}-{file.name}` and returns its public URL.
 *
 * Unlike subirImagen (the cover), this NEVER upserts: a gallery is a SET, so two
 * files with the same name MUST coexist. The uuid prefix guarantees a unique key
 * even for identical filenames. The cover helper subirImagen is unchanged.
 */
export async function subirImagenGaleria(
  publicacionId: string,
  file: File,
): Promise<string> {
  const path = `${publicacionId}/${crypto.randomUUID()}-${file.name}`

  const { error } = await supabase.storage
    .from('publicaciones')
    .upload(path, file) // NO upsert — unique key makes it unnecessary and unsafe

  if (error) throw error

  const { data } = supabase.storage.from('publicaciones').getPublicUrl(path)
  return data.publicUrl
}
```

The cover path is unchanged: `subirImagen` still keys by `${publicacionId}/${file.name}` with `upsert:true`. Cover and gallery objects share the same `${publicacionId}/` prefix in the same bucket but never collide because gallery keys carry a UUID segment a raw filename can never match.

## Decision 3 — Storage-delete helper: reconstruct the key from the public URL, never throw the save

**Choice**: `eliminarImagenGaleria(publicUrl)` strips the fixed prefix `/storage/v1/object/public/publicaciones/` from the stored public URL to recover the object key, then calls `supabase.storage.from('publicaciones').remove([key])`. If the URL does **not** contain that prefix, the helper **returns early without throwing** (it logs nothing fatal) — a malformed/legacy URL must not block the form save or the array edit.

**Alternatives**: (a) store the object key alongside the URL so no parsing is needed — changes the array element shape from `string` to `{url, key}`, breaking the "plain `string[]`, same as the cover" invariant for zero real gain; (b) throw on an unmatched prefix — one bad URL would abort the whole remove/save flow, the opposite of graceful degradation; (c) `remove` by listing the bucket prefix and diffing — extra round-trips and fragile.

**Rationale**: The public URL is the only thing the array stores, and Supabase public URLs have a **stable, documented** shape: `…/storage/v1/object/public/{bucket}/{key}`. Splitting on the bucket-scoped marker is the cheapest reliable reconstruction and keeps the element a plain `string`. Throwing on an unmatched prefix would couple a cosmetic data-quality issue (a URL that doesn't match) to a destructive failure (can't save); since the DELETE on Storage is best-effort cleanup (the array edit is what the user actually asked for), a non-matching URL should just skip the Storage delete and let the array edit proceed. This bounds the blast radius of the one MEDIUM tradeoff (no DB↔Storage referential integrity) to "a possible orphan blob" rather than "a broken save".

```ts
const PUBLIC_PREFIX = '/storage/v1/object/public/publicaciones/'

/**
 * Best-effort delete of a gallery object given its public URL. Reconstructs the
 * object key from the stable Supabase public-URL shape and removes it.
 *
 * Graceful: if the URL doesn't match the expected bucket prefix (legacy/foreign
 * URL), it returns WITHOUT throwing — a cosmetic mismatch must never block the
 * array edit or the form save. Accepts the orphan-blob tradeoff (no DB↔Storage
 * referential integrity is part of the embed model).
 */
export async function eliminarImagenGaleria(publicUrl: string): Promise<void> {
  const marker = publicUrl.indexOf(PUBLIC_PREFIX)
  if (marker === -1) return // not our bucket / malformed — skip, do not throw
  const key = publicUrl.slice(marker + PUBLIC_PREFIX.length)
  if (key === '') return
  const { error } = await supabase.storage.from('publicaciones').remove([key])
  if (error) throw error // a real Storage error (network/perm) still surfaces
}
```

Using `indexOf` (not `startsWith`) tolerates the full absolute URL (`https://<ref>.supabase.co/storage/v1/object/public/publicaciones/<key>`). A genuine Storage error (network, permission) still surfaces — only the "this isn't our URL" case is swallowed.

## Decision 4 — Lightbox: reuse `Modal.tsx`, single-image view, NO carousel (matches Scope OUT)

**Choice**: a responsive Tailwind grid of thumbnails; clicking a thumbnail opens `Modal` showing **that one** full image with a wide `max-w` override (`max-w-5xl`). No prev/next, no carousel, no slide animation in v1. Esc / backdrop / focus-trap are already handled by `Modal`.

**Alternatives**: (a) a full carousel/slider with prev/next inside the lightbox — explicitly **Scope OUT** in the proposal ("no carousel/slider component"); adds index state, keyboard arrow handling, edge wrapping, and a media component the feature doesn't need; (b) a brand-new lightbox primitive — duplicates the accessible `<dialog>` work `Modal` already does (top-layer, focus trap, native Esc, light-dismiss).

**Rationale**: The whole proposal philosophy is **reuse, don't rebuild**. `Modal` is already an accessible `<dialog>` with focus trapping and Esc; the lightbox is literally "Modal, but wider, showing one image." A single-image view satisfies the user need (see an image full-size) at the lowest cost and stays inside the declared scope. Prev/next is a clean additive iteration later (it would add `activeIndex` state to the section and wire arrow keys) — keeping it out of v1 avoids scope creep and keeps the diff reviewable. `Modal`'s base class hardcodes `max-w-sm`, so the lightbox passes the full image as `children` and overrides width via a wrapper; if `max-w-sm` cannot be overridden by a child wrapper (the `<dialog>` itself carries the constraint), Slice 4 makes `Modal` accept an optional `className`/`size` prop (additive, default unchanged) rather than forking the component.

```
GalleryGrid (in PublicacionDetallePage, only when imagenes.length > 0)
  grid grid-cols-2 sm:grid-cols-3 gap-3
    └─ <button onClick={() => setActiveImg(url)}> <img object-cover aspect-square> </button>  (per url)

Lightbox = <Modal open={activeImg !== null} onClose={() => setActiveImg(null)}>
             <wrapper max-w-5xl> <img src={activeImg} class="w-full h-auto object-contain" /> </wrapper>
           </Modal>
  state: const [activeImg, setActiveImg] = useState<string | null>(null)   // single image, no index/carousel
```

## Decision 5 — DTO: one combined `Omit` narrowing BOTH jsonb columns; `parseImagenes` stricter than `parseEnlaces`

**Choice**: `Publicacion` becomes a **single** combined `Omit` over both jsonb columns:

```ts
export type Publicacion = Omit<Tables<'publicaciones'>, 'enlaces' | 'imagenes'> & {
  enlaces: Enlace[]
  imagenes: string[]
}
```

`parseImagenes` lives **inside** `toPublicacion`, the same read boundary as `parseEnlaces`, and uses **the same filter semantics as `parseEnlaces`**: non-array input returns `[]`; individual malformed or empty-string elements are dropped (kept valid). Rationale: graceful degradation for author-curated images — one malformed element must not hide the entire gallery.

**Alternatives**: (a) two chained `Omit`s (`Omit<Omit<…,'enlaces'>,'imagenes'>`) — equivalent but noisier; the union-key form `Omit<…, 'enlaces' | 'imagenes'>` is the idiomatic single narrowing; (b) parse `imagenes` lazily in the detail component — leaks raw jsonb past the read boundary and re-introduces parsing in the UI, breaking the single-mapper rule; (c) reject-wholesale semantics — would hide the entire gallery if a single element is malformed, breaking graceful degradation.

**Rationale**: One combined `Omit` keeps the DTO a single readable line and mirrors the existing `ClasificacionSI` narrowing pattern. Parsing inside `toPublicacion` enforces the **read-boundary discipline** the codebase already follows: every consumer downstream sees a clean `string[]`, no component re-parses jsonb. `parseImagenes` uses the same filter semantics as `parseEnlaces`: invalid or empty-string elements are dropped; the remaining valid URLs are returned. This mirrors `parseEnlaces`' graceful-degradation contract and is the correct choice for author-curated images, where one bad element must not hide the entire gallery.

```ts
/**
 * Parses the raw jsonb imagenes column into string[]. FILTER semantics (same as
 * parseEnlaces): returns [] on null / non-array; drops non-string and empty-string
 * elements, keeps valid URLs. Rationale: graceful degradation — one malformed
 * element must not hide the entire gallery. Lives at the single read boundary
 * (toPublicacion) so no component ever re-parses jsonb.
 */
function parseImagenes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (item): item is string => typeof item === 'string' && item.length > 0,
  )
}

function toPublicacion(row: PublicacionRow): Publicacion {
  return {
    ...row,
    enlaces: parseEnlaces(row.enlaces),
    imagenes: parseImagenes(row.imagenes),
  }
}
```

`crear`/`editar` need **NO** signature change: PostgREST accepts a JS `string[]` for a `jsonb` column, exactly as it accepts `Enlace[]` today.

## Decision 6 — Form state + submit wiring: mirror the `enlaces` editor, add upload + reorder + remove

**Choice**: add an `imagenes: string[]` state and an `uploadingGaleria` boolean. Multi-file `<input type="file" multiple>` loops per file through `subirImagenGaleria`, **appending** each returned URL. Reorder via Decision 1's `moveImagen`. Remove calls `eliminarImagenGaleria(url)` then drops the index from the array. `imagenes` is included in BOTH the `crear` input and the `editar` patch; `setImagenes(pub.imagenes)` is added to the edit pre-fill effect. `uploadingGaleria` joins the submit-button disabled guard.

**Alternatives**: (a) upload all files in one `Promise.all` then append the batch — faster, but a single failure rejects the whole batch and the partial successes are lost from state; (b) remove from the array WITHOUT deleting the Storage object — guarantees orphan blobs on every remove; (c) a separate "save gallery" button distinct from the form submit — fragments the editing model the `enlaces` editor already established (everything saves on the one Guardar).

**Rationale**: The gallery editor is the `enlaces` editor with three extra verbs (upload, reorder, remove-with-delete), so it mirrors that proven shape — same in-form, save-on-submit model, same handler granularity. A **sequential** per-file upload loop (append on each success) means a mid-batch failure still keeps the already-uploaded URLs in state and surfaces a per-file error, which is friendlier than an all-or-nothing `Promise.all`. Remove deletes the Storage object first (best-effort via the graceful helper) then edits the array, so the normal remove path leaves no orphan. `uploadingGaleria` in the disabled set prevents a submit mid-upload that would persist a half-uploaded array.

```ts
const [imagenes, setImagenes] = useState<string[]>([])
const [uploadingGaleria, setUploadingGaleria] = useState(false)
const [galeriaError, setGaleriaError] = useState<string | null>(null)

// Multi-file upload: sequential loop, append on each success (partial progress survives a mid-batch failure).
async function handleGaleriaChange(e: React.ChangeEvent<HTMLInputElement>) {
  const files = e.target.files
  if (!files || files.length === 0) return
  setUploadingGaleria(true)
  setGaleriaError(null)
  try {
    for (const file of Array.from(files)) {
      const url = await publicacionesService.subirImagenGaleria(workingId, file)
      setImagenes((prev) => [...prev, url])
    }
  } catch (err: unknown) {
    setGaleriaError(err instanceof Error ? err.message : 'No se pudo subir una imagen de la galería.')
  } finally {
    setUploadingGaleria(false)
    e.target.value = '' // allow re-selecting the same files
  }
}

// Remove: delete the Storage object (graceful) THEN drop it from the array.
async function removeImagen(index: number) {
  const url = imagenes[index]
  setImagenes((prev) => prev.filter((_, i) => i !== index)) // optimistic array edit
  try {
    await publicacionesService.eliminarImagenGaleria(url)
  } catch {
    // Best-effort cleanup: a Storage delete failure leaves an orphan blob but the
    // array edit (what the user asked for) already happened. Not fatal to the form.
  }
}

// moveImagen(from, to) — exactly Decision 1.
```

Wiring touchpoints:
- Pre-fill effect (~line 102, next to `setEnlaces(pub.enlaces)`): add `setImagenes(pub.imagenes)`.
- `crear` input (~line 200) and `editar` patch (~line 186): add `imagenes` (pass the `string[]` directly — no trimming/filtering needed; `parseImagenes` already guaranteed clean strings, and removes happened in-form).
- Submit disabled guard (~line 486): `disabled={submitting || uploading || uploadingGaleria}`.

## Decision 7 — Detail insertion point: a "Galería" section right after the cover hero block

**Choice**: render the gallery section **immediately after the cover hero block** (after the `imagen_url` `<img>` div, ~line 106) and **before** `cuerpo`. Gate it on `pub.imagenes.length > 0`. Heading uses the existing `h2` + accent-bar `span` pattern (identical to the Video section, ~lines 118–124).

**Alternatives**: (a) after `cuerpo` / between video and enlaces — the gallery is visual context for the post, so it reads more naturally near the top with the cover than buried after the body; (b) inside/merged with the cover block — couples gallery position to cover identity, which the proposal explicitly rejects (cover stays a separate concern); (c) a custom heading — would diverge from the established section-heading pattern for no reason.

**Rationale**: The cover establishes the post's primary visual; the gallery is the supporting set, so placing it right after the cover keeps related imagery together and ahead of the long text body. Reusing the Video section's exact `h2` + gradient accent-bar markup keeps the page visually consistent and is recognition-over-recall for the next reader. Gating on `length > 0` keeps the single-image case clean (the cover already covers it) and means existing rows (`imagenes='[]'` from the DEFAULT) render exactly as today. Gallery `<img>` are direct with `object-cover`, **NO** `useImageOk` gate — consistent with the cover's deliberate decision not to gate author-curated images (the detail page does not import `useImageOk`).

```
article (max-w-820px)
  ├─ cover hero <img imagen_url>            (unchanged, ~98–106)
  ├─ ⟪ NEW ⟫ Galería section                (only when imagenes.length > 0)
  │     <section className="reveal flex flex-col gap-3">
  │       <h2> <span accent-bar/> Galería </h2>          ← same pattern as Video
  │       <div grid grid-cols-2 sm:grid-cols-3 gap-3>    ← thumbnails (Decision 4)
  │       <Modal …> wide single-image lightbox </Modal>
  ├─ cuerpo (whitespace-pre-wrap)           (unchanged, ~109–113)
  ├─ Video section                          (unchanged, ~116–129)
  └─ Enlaces de interés                     (unchanged, ~132–163)
```

## Data flow

```
ADMIN WRITE PATH (Slice 3)
  PublicacionFormPage (controlled inputs + useState)
    │  <input type=file multiple> ──> loop per file
    │       └─> subirImagenGaleria(workingId, file)
    │             upload('{workingId}/{uuid}-{name}', file)   ── NO upsert (unique key)
    │             getPublicUrl() ──> append to imagenes[]      ── [RLS: bucket='publicaciones' AND puede_gestionar_contenido()]
    │  drag / up-down buttons ──> moveImagen(from, to)         ── reorder imagenes[] (array order = display order)
    │  remove ──> eliminarImagenGaleria(url) [best-effort] ──> remove('{key}')   then drop from imagenes[]
    ▼
  publicacionesService.crear/editar({ …, imagenes })          auth.getUser() guard → 'Requiere sesión'
    │  INSERT/UPDATE publicaciones.imagenes (jsonb)            ── [RLS WITH CHECK puede_gestionar_contenido()]
    │  PostgREST accepts string[] for a jsonb column (no signature change)
    ▼
  row.imagenes jsonb

PUBLIC READ PATH (Slice 4)
  PublicacionDetallePage  ◀── usePublicacion(slug)
    ▼
  publicacionesService.obtenerPublicacion (estado='publicado')
    │  from('publicaciones').select('*')  ── [RLS SELECT: estado='publicado' OR admin]
    │  imagenes (jsonb) ──> parseImagenes() ──> string[]  ([] on null/malformed; inside toPublicacion)
    ▼
  imagenes.length > 0 ? render Galería grid + Modal lightbox  :  render nothing (cover covers single-image)
    │  <img object-cover> direct — NO useImageOk gate (author-curated, like the cover)
    │  thumbnail click ──> Modal (max-w-5xl, single image, Esc/backdrop via Modal)

CARD / FEED PATH (UNCHANGED)
  BlogPage / cards read imagen_url ONLY ── no gallery read for a thumbnail (cover identity decoupled)
```

## Migration 015 (mirrors 014's header + manual ROLLBACK style)

```sql
-- ============================================================================
-- 2026-06-15_015_publicaciones_imagenes.sql
-- Add an ORDERED image gallery to publicaciones.
--
-- A value object owned 100% by its publication: an ordered jsonb array of public
-- Storage URL strings (array order = display order). Same shape as `enlaces`.
-- The cover `imagen_url` stays a SEPARATE column — NOT folded into imagenes[0].
--
-- Additive, NOT NULL with DEFAULT '[]' → existing rows backfill to an empty
-- gallery automatically. No backfill, no RLS change, no Storage migration.
--
-- ROLLBACK (manual): alter table public.publicaciones drop column if exists imagenes;
-- ============================================================================

alter table public.publicaciones
  add column if not exists imagenes jsonb not null default '[]'::jsonb;

comment on column public.publicaciones.imagenes is
  'Ordered gallery: jsonb array of public Storage URL strings (array order = display order). The cover imagen_url stays separate.';
```

## Reused without modification

`Modal.tsx` (the lightbox shell), the `enlaces` list-editor handler shape, `parseEnlaces`'s read-boundary pattern, `subirImagen` (the cover helper — byte-for-byte unchanged), `crear`/`editar` write signatures, `puede_gestionar_contenido()` + the existing `publicaciones` bucket and its INSERT/UPDATE/DELETE policies, and the feed/cards (`imagen_url` untouched).

## Open questions

- [ ] **`chain_strategy` confirmation** — chained PRs (slices 1–4); confirm `stacked-to-main` vs `feature-branch-chain` with the user before PR #1.
- [ ] **Migration apply consent** — `015` is `[USER-GATED]`; confirm before slice 1 applies to prod ref `othwyesmfpjaykbdwxrh`.
- [ ] **MCP type-gen availability** — confirm Supabase MCP `generate_typescript_types` works in-session before slice 2 depends on the regenerated types (the `npm run gen:types` CLI is NOT available here).
- [ ] **`Modal` width override** — confirm whether a child `max-w-5xl` wrapper visibly widens the lightbox, or whether `Modal` needs an additive optional `className`/`size` prop (Slice 4 decision; default unchanged either way).
- [x] **Drag-to-reorder** — RESOLVED (Decision 1): native HTML5 DnD + up/down-button fallback, NO new dependency.
- [x] **Upload helper shape, storage-delete, lightbox scope, DTO/parse, form wiring, detail placement** — RESOLVED as Decisions 2–7 above.
```