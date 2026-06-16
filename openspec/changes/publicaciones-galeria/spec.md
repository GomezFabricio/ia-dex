# publicaciones-galeria — Specifications (Delta)

This is a **DELTA spec**. `public.publicaciones` already exists with a full spec under
`openspec/changes/publicaciones/spec.md`. Every requirement here describes only what changes — new
behavior added on top of the existing publication system. The existing column `imagen_url` (cover),
all existing RLS policies, Storage bucket policies, and the read/write paths described in the
`publicaciones` spec are **unchanged** unless explicitly stated otherwise.

The single most data-safety-sensitive requirement in this change is **GAL2** (collision-proof upload
keys): two gallery files with the same name uploaded to the same publication MUST NOT overwrite each
other in Storage. The old `upsert:true` + raw-filename key is safe for covers (overwrite = replace)
but is data-loss for a gallery. This is not a behavior extension — it is a correctness fix that the
single-cover path never exercised.

Process constraint: migration `015` (`ADD COLUMN imagenes`) MUST receive explicit user approval before
it is applied via the Supabase MCP (`[USER-GATED]`). The type-gen step (`generate_typescript_types`)
MUST run after `015` is applied. Nothing below type-checks before `imagenes` exists in the generated
`TablesInsert/Update`.

---

# Capability GAL1: Database Column

## Purpose

Add the `imagenes` column to `public.publicaciones` as an ordered `jsonb` array of public Storage URL
strings, backward-compatible with all existing rows, without touching `imagen_url` or any existing
RLS/Storage policy.

## Requirements

### Requirement: GAL1-DB — imagenes Column Shape and Defaults

The database MUST have a column `public.publicaciones.imagenes jsonb NOT NULL DEFAULT '[]'::jsonb`.
It MUST be an ordered array of public Storage URL strings — the array index is the display order.
`imagen_url` MUST remain a separate column (the cover) and MUST NOT be folded into `imagenes[0]`.
Migration `db/2026-06-15_015_publicaciones_imagenes.sql` MUST use `ADD COLUMN IF NOT EXISTS`
(idempotent) and MUST include a rollback comment block mirroring the `014` header style.
All existing rows receive `imagenes = '[]'` from the DEFAULT — no backfill SQL is needed or permitted.

#### Scenario: Column exists with correct shape

- GIVEN migration `015` has been applied
- WHEN the `publicaciones` table schema is inspected
- THEN a column `imagenes` of type `jsonb` exists, is NOT NULL, and defaults to `'[]'::jsonb`
- AND `imagen_url` is still a separate `text` column (unchanged)

#### Scenario: Existing rows are backward-compatible

- GIVEN rows inserted before migration `015` was applied
- WHEN those rows are read after the migration
- THEN their `imagenes` value is `[]` (the empty array from the DEFAULT)
- AND their `imagen_url`, `titulo`, `estado`, and all other existing columns are unchanged

#### Scenario: Migration is idempotent

- GIVEN migration `015` has already been applied once
- WHEN the migration DDL is run again (re-apply)
- THEN no error is raised (`ADD COLUMN IF NOT EXISTS` guard)
- AND the column shape is unchanged

---

# Capability GAL2: Read Boundary (`parseImagenes`)

## Purpose

Guarantee that `imagenes` is always exposed as a clean `string[]` to every consumer, regardless of
what is stored in the `jsonb` column. The parser lives inside the single `toPublicacion` mapper —
no component ever re-parses raw jsonb.

## Requirements

### Requirement: GAL2-DTO — Publicacion DTO Exposes imagenes as string[]

`src/types/dtos.ts` MUST update the `Publicacion` type to use a single combined `Omit` that excludes
BOTH `enlaces` AND `imagenes` from `Tables<'publicaciones'>`, then intersects with `{ enlaces: Enlace[]; imagenes: string[] }`:

```ts
export type Publicacion = Omit<Tables<'publicaciones'>, 'enlaces' | 'imagenes'> & {
  enlaces: Enlace[];
  imagenes: string[];
};
```

The existing `Enlace` type MUST remain unchanged. The `imagenes` addition MUST be part of the same
combined `Omit` — two separate `Omit` calls for the same base type is an error.

#### Scenario: Build type-checks after DTO update

- GIVEN `database.types.ts` has been regenerated (migration `015` applied, MCP type-gen run)
- AND `dtos.ts` exports `Publicacion` with the combined `Omit`
- WHEN `npx tsc -b` is run
- THEN `Publicacion.imagenes` is typed `string[]` (not `Json`)
- AND `Publicacion.enlaces` is still typed `Enlace[]`
- AND the build exits with code 0

### Requirement: GAL2-SVC — parseImagenes Inside the Single Mapper

`src/services/publicacionesService.ts` MUST add a `parseImagenes` function called from within the
existing `toPublicacion` mapper. The function MUST:

- Accept a raw `unknown` value (the jsonb column from the DB response)
- Return `[]` when the input is NOT an array (`Array.isArray` check fails)
- FILTER each element: keep only non-empty strings (`typeof item === 'string' && item.length > 0`),
  drop everything else — invalid/empty elements are silently removed, valid URLs are kept
- Return the filtered `string[]` (which may be empty if no elements pass)

This validation uses **FILTER semantics** (same as `parseEnlaces`): non-array input returns `[]`;
individual malformed or empty-string elements are dropped rather than causing the whole array to be
rejected. Rationale: graceful degradation for author-curated images — one malformed element must not
hide the entire gallery. No component, hook, or page MUST call `parseImagenes` directly — the DTO
boundary is the mapper only.

#### Scenario: Valid array passes through

- GIVEN the stored `imagenes` jsonb is `["https://cdn.example.com/a.jpg", "https://cdn.example.com/b.jpg"]`
- WHEN `parseImagenes` is called with that value
- THEN it returns `["https://cdn.example.com/a.jpg", "https://cdn.example.com/b.jpg"]`

#### Scenario: Non-array input returns empty array

- GIVEN the stored `imagenes` jsonb is `null` (or a string, or an object)
- WHEN `parseImagenes` is called with that value
- THEN it returns `[]` (no throw)

#### Scenario: Array with a non-string element filters it out

- GIVEN the stored `imagenes` jsonb is `["https://cdn.example.com/a.jpg", 42]`
- WHEN `parseImagenes` is called with that value
- THEN it returns `["https://cdn.example.com/a.jpg"]` (the non-string element is dropped, the valid URL is kept)

#### Scenario: Array with an empty string element filters it out

- GIVEN the stored `imagenes` jsonb is `["https://cdn.example.com/a.jpg", ""]`
- WHEN `parseImagenes` is called with that value
- THEN it returns `["https://cdn.example.com/a.jpg"]` (empty strings are dropped, the valid URL is kept)

---

# Capability GAL3: Storage Helpers (Collision-Proof Upload + Delete)

## Purpose

Extend the service layer with gallery-specific upload and delete helpers. The gallery upload MUST use
collision-proof object keys. The delete helper MUST remove the Storage object when an image is removed
from the array — no orphan blobs on the normal remove path.

## Requirements

### Requirement: GAL3-UPLOAD — Collision-Proof Gallery Upload Keys

A dedicated gallery upload helper (`subirImagenGaleria` or an optional `keyStrategy` parameter on the
existing `subirImagen`) MUST upload each file under the key:

```
${publicacionId}/${crypto.randomUUID()}-${file.name}
```

The `crypto.randomUUID()` prefix MUST be generated per-file, per-upload. `upsert: false` MUST be used
for gallery uploads (a UUID-keyed path is always unique; upsert would silently hide a collision bug).
The function MUST return the public URL via `supabase.storage.from('publicaciones').getPublicUrl(key)`.
The existing `subirImagen` cover-upload behavior (raw filename, `upsert: true`) MUST remain unchanged.

#### Scenario: Two same-named files produce distinct Storage objects

- GIVEN an admin uploads two files both named `screenshot.png` to the same publication gallery
- WHEN both uploads complete
- THEN the Storage bucket contains two distinct objects (different keys, both with UUID prefixes)
- AND the `imagenes` array contains two distinct URLs (different paths, neither overwrites the other)

#### Scenario: Gallery URL is a valid public URL

- GIVEN a successful gallery upload
- WHEN `getPublicUrl` is called with the resulting key
- THEN the returned URL is a non-empty string starting with `https://`

### Requirement: GAL3-DELETE — Storage Object Removed on Gallery Image Removal

A storage-delete helper MUST:

- Accept a public gallery image URL
- Reconstruct the Storage object key by stripping the Supabase public-URL prefix
  (`/storage/v1/object/public/publicaciones/`) from the full URL
- Call `supabase.storage.from('publicaciones').remove([key])`
- Be called whenever the admin removes an image from the gallery array (before or after the
  `imagenes` array update is persisted — the Storage delete and the array update MUST both complete
  without leaving an orphan in Storage on the normal remove path)

The existing DELETE Storage policy (`puede_gestionar_contenido()`) already allows this — no new
policy is needed.

#### Scenario: Removing a gallery image deletes the Storage object

- GIVEN an admin removes one image from a publication's gallery
- WHEN the remove action completes
- THEN the corresponding Storage object is deleted from the `publicaciones` bucket
- AND the `imagenes` array no longer contains that image's URL

#### Scenario: Removing the last gallery image leaves an empty array

- GIVEN a publication's `imagenes` array has exactly one URL
- WHEN the admin removes that image
- THEN the Storage object is deleted
- AND the `imagenes` field is saved as `[]`
- AND the gallery section does NOT render on the detail page (per GAL5)

---

# Capability GAL4: Admin Form (Upload / Reorder / Remove)

## Purpose

Extend `src/pages/admin/PublicacionFormPage.tsx` with multi-file gallery upload, drag-to-reorder,
and remove-with-storage-delete, while keeping the existing cover upload and all existing form
behavior unchanged.

## Requirements

### Requirement: GAL4-UPLOAD — Multi-File Gallery Upload With Progress Guard

The admin form MUST include an `<input type="file" multiple>` for the gallery (separate from the
existing single-file cover input). On file selection, the form MUST:

- Loop over each selected file and call the collision-proof upload helper (GAL3-UPLOAD)
- Append each returned public URL to the `imagenes` state array
- Set an `uploadingGalleria` boolean flag to `true` for the duration of the upload loop
- Disable the form submit button while `uploadingGalleria` is `true`

The `uploadingGalleria` flag MUST be included in the existing submit-disabled guard (alongside any
other guards such as `uploadingCover` or `saving`).

#### Scenario: Upload in progress disables submit

- GIVEN the admin selects one or more gallery images
- WHEN the upload is in progress (`uploadingGalleria` is true)
- THEN the submit button is disabled

#### Scenario: Completed uploads append to imagenes array

- GIVEN the admin selects three gallery images and the uploads complete
- WHEN `uploadingGalleria` returns to false
- THEN the `imagenes` state array contains the three new public URLs (appended, not replaced)
- AND the submit button is re-enabled

### Requirement: GAL4-REORDER — Drag-to-Reorder Persists Array Order

The gallery preview in the admin form MUST support drag-to-reorder of the `imagenes` array items.
The implementation choice (native HTML5 drag-and-drop vs a library such as `@dnd-kit`) is deferred
to the DESIGN phase. Regardless of implementation:

- The visual order after drag MUST match the `imagenes` array order
- On save, the persisted `imagenes` array MUST reflect the current visual order

#### Scenario: Reorder is reflected in saved data

- GIVEN a publication has `imagenes = [url-A, url-B, url-C]`
- WHEN the admin drags `url-C` to the first position
- THEN the form's `imagenes` state becomes `[url-C, url-A, url-B]`
- AND on save the DB row stores `imagenes = [url-C, url-A, url-B]`

### Requirement: GAL4-REMOVE — Remove Image Also Deletes Storage Object

The admin form MUST provide a remove button per gallery thumbnail. When the admin removes an image:

1. The storage-delete helper (GAL3-DELETE) MUST be called with that image's URL
2. The URL MUST be removed from the `imagenes` state array
3. Both operations MUST complete before the form is re-enabled for saving

#### Scenario: Remove button deletes both array entry and Storage object

- GIVEN the gallery shows three images with URLs `[url-A, url-B, url-C]`
- WHEN the admin clicks the remove button on `url-B`
- THEN the Storage object for `url-B` is deleted
- AND the `imagenes` state becomes `[url-A, url-C]`

### Requirement: GAL4-PERSIST — imagenes Included in Create and Edit Payloads

The `imagenes` state array MUST be passed to both `crear` and `editar` service calls as the
`imagenes` field. The `editar` pre-fill effect MUST include `setImagenes(pub.imagenes)` so the
existing gallery is loaded when the admin opens an existing publication for editing.

#### Scenario: Edit pre-fills existing gallery

- GIVEN a publication stored with `imagenes = [url-A, url-B]`
- WHEN the admin opens the edit form for that publication
- THEN the gallery preview shows `url-A` and `url-B` (pre-filled, not empty)

#### Scenario: Create saves imagenes in the insert payload

- GIVEN the admin uploads two gallery images during creation
- WHEN the create form is submitted
- THEN the inserted row has `imagenes` containing both URLs

---

# Capability GAL5: Public Detail Page (Grid + Lightbox)

## Purpose

Render the gallery on the public detail page (`src/pages/PublicacionDetallePage.tsx`) as a responsive
thumbnail grid with a Modal-as-lightbox click target. The gallery section is conditional: it MUST NOT
render when `imagenes` is empty.

## Requirements

### Requirement: GAL5-GRID — Gallery Section Renders Only When imagenes.length > 0

A "Galería" section MUST be inserted in the article column of `PublicacionDetallePage.tsx`, after the
cover hero block. The section MUST:

- Render only when `imagenes.length > 0` (no empty container or hidden section when the array is empty)
- Use a responsive grid (2–3 columns, Tailwind only — no new CSS component)
- Use the `h2` + accent-bar `span` heading pattern already used by the Video section in the same page

#### Scenario: Gallery section appears for a publication with images

- GIVEN a published publication with `imagenes = [url-A, url-B, url-C]`
- WHEN the user navigates to that publication's detail page
- THEN a "Galería" section is rendered with three thumbnails

#### Scenario: Gallery section absent for a publication with no images

- GIVEN a published publication with `imagenes = []`
- WHEN the user navigates to that publication's detail page
- THEN no "Galería" section or empty container is rendered on the page

### Requirement: GAL5-LIGHTBOX — Thumbnail Click Opens Modal Lightbox

Each gallery thumbnail MUST be clickable. On click, the existing `src/components/ui/Modal.tsx` MUST
be opened with a wide `max-w` override (wider than the content column) to present the full-resolution
image. The implementation MUST reuse `Modal.tsx` — no new modal or dialog component is permitted for
this feature.

#### Scenario: Thumbnail click opens the lightbox

- GIVEN the gallery section is rendered with at least one image
- WHEN the user clicks a thumbnail
- THEN `Modal.tsx` opens displaying that image at a larger size

#### Scenario: Modal can be closed

- GIVEN the lightbox Modal is open
- WHEN the user closes it (via the Modal's existing close mechanism)
- THEN the Modal is dismissed and the detail page is visible again

### Requirement: GAL5-NO-GATE — Gallery Images Bypass useImageOk

Gallery `<img>` elements MUST render directly from the `imagenes` URL array with `object-cover`.
They MUST NOT be wrapped in or filtered by `useImageOk`. Gallery images are author-curated (uploaded
via the admin form), not scraped logos, so the 200 px liveness gate is inappropriate. This mirrors
the existing behavior of `imagen_url` in the detail page.

#### Scenario: Gallery images render without useImageOk gate

- GIVEN a publication with gallery images
- WHEN the detail page renders the gallery thumbnails
- THEN each `<img>` tag has `src` set directly to the gallery URL
- AND no `useImageOk` hook or 200 px gate wraps the image rendering

---

# Cross-cutting for publicaciones-galeria

### Requirement: XT-GAL1 — Sequencing Invariant

The four implementation slices MUST be applied in strict order:

1. **Slice 1 — DB + types** `[USER-GATED]`: apply migration `015` only after explicit user OK →
   regenerate `src/types/database.types.ts` via the Supabase MCP `generate_typescript_types`.
   Nothing in slices 2–4 type-checks before `imagenes` exists in `TablesInsert/Update`.
2. **Slice 2 — DTO + service**: combined `Omit` in `dtos.ts`; `parseImagenes` in `toPublicacion`;
   `subirImagenGaleria` (collision-proof); storage-delete helper.
3. **Slice 3 — Admin form**: multi-upload, drag-reorder, remove-with-storage-delete,
   `uploadingGalleria` flag, `imagenes` in `crear`/`editar`, pre-fill effect.
4. **Slice 4 — Public detail**: grid section + Modal lightbox, conditional on `imagenes.length > 0`.

`tsc -b` and `npm run lint` MUST pass at the end of each slice (XT-GAL2).

#### Scenario: Type-check fails if slice order is violated

- GIVEN migration `015` has NOT been applied
- WHEN `dtos.ts` references `imagenes` in the `Omit` and `tsc -b` is run
- THEN the build fails (the column does not exist in the generated types yet)

### Requirement: XT-GAL2 — Build Integrity at Each Slice Boundary

At the completion of each PR slice, `npm run lint` AND `npx tsc -b` MUST exit with code 0. There is
no test runner (`strict_tdd: false`); verification is lint + build + manual Playwright visual checks
(channel msedge) on `PublicacionDetallePage` and the admin `PublicacionFormPage`.

#### Scenario: Clean build at each slice boundary

- GIVEN a slice is complete
- WHEN `npm run lint && npx tsc -b` is run
- THEN both exit with code 0

### Requirement: XT-GAL3 — Domain Language Invariant (Inherited, Extended)

All DB column names, Storage key paths, and user-facing UI copy introduced by this change MUST
follow the domain language convention: `imagenes`, `imagen_url`, and "Galería" are Spanish. Code
identifiers, comments, function names (`parseImagenes`, `subirImagenGaleria`), commit messages, and
TypeScript file contents are English.

#### Scenario: Column and UI copy in Spanish, code in English

- GIVEN any artifact produced by this change
- WHEN it is a DB column name (`imagenes`), Storage path prefix, or user-facing heading
- THEN it is in Spanish
- AND WHEN it is a TypeScript identifier or function name, it is in English

### Requirement: XT-GAL4 — No Orphan Blobs on Normal Remove Path

The only accepted orphan scenario for this change is **abandoned pre-submit uploads** (files uploaded
while filling out a create form that is then abandoned without saving). This matches existing cover
behavior and is recorded as known debt — out of scope for this change. On the **explicit remove path**
(admin clicks remove on a gallery image), GAL3-DELETE MUST fire and no Storage orphan is permitted.

#### Scenario: Known debt — abandoned form leaves orphan blob (accepted)

- GIVEN an admin uploads a gallery image during publication creation but navigates away without saving
- WHEN the partial session is over
- THEN the uploaded Storage object remains in the bucket (orphan) — this is accepted known debt,
  not a defect to fix in this change

#### Scenario: Explicit remove path is clean

- GIVEN an admin explicitly removes a gallery image via the remove button
- WHEN the action completes
- THEN no orphan Storage object remains (the delete helper has fired)
