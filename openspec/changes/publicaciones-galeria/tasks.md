# publicaciones-galeria — Implementation Tasks

**Delivery:** chained PRs, `chain_strategy = TBD` (confirm `stacked-to-main` vs `feature-branch-chain` with user before PR #1). Each slice is a child PR; PRs land in strict S1→S2→S3→S4 sequence because S2–S4 cannot compile before `imagenes` exists in the generated types.
**Strict TDD:** false (no test runner — verification via `npm run lint` + `npx tsc -b` + manual/Playwright [channel msedge] per slice).
**Migration gate:** `015` is `[USER-GATED]` — present SQL to the user for review and apply via Supabase MCP (`apply_migration`, prod ref `othwyesmfpjaykbdwxrh`) only after explicit OK.
**Type-gen tool:** Supabase MCP `generate_typescript_types` ONLY — `npm run gen:types` CLI is NOT available here. Run after `015` is applied; commit the regenerated `database.types.ts` in Slice 1.
**Sequencing invariant (XT-GAL1):** nothing in S2–S4 type-checks until `imagenes` exists in `TablesInsert/Update`. This is a build dependency, not a preference.

---

## Slice 1 — DB + Types (PR-1 of chain) `[USER-GATED]`

**Scope:** migration `db/2026-06-15_015_publicaciones_imagenes.sql` + regenerated `database.types.ts`.
**Depends on:** nothing (S1 is the root).
**Gate:** `[USER-GATED]` for both migration apply and type-gen. After both complete: `npm run lint` + `npx tsc -b` exit 0; confirm `imagenes` appears in `TablesInsert<'publicaciones'>` in the regenerated file.

### S1-T01 — Write migration `db/2026-06-15_015_publicaciones_imagenes.sql`
- **Req:** GAL1-DB, XT-GAL1
- **Files:** `db/2026-06-15_015_publicaciones_imagenes.sql` (new)
- **Work:** Write a single migration file with the house header banner (matching `014`'s style). Content:
  ```sql
  -- ============================================================================
  -- 2026-06-15_015_publicaciones_imagenes.sql
  -- Add an ORDERED image gallery to publicaciones.
  --
  -- A value object owned 100% by its publication: an ordered jsonb array of
  -- public Storage URL strings (array order = display order). Same shape as
  -- `enlaces`. The cover `imagen_url` stays a SEPARATE column — NOT folded
  -- into imagenes[0].
  --
  -- Additive, NOT NULL with DEFAULT '[]' → existing rows backfill to an empty
  -- gallery automatically. No backfill, no RLS change, no Storage migration.
  --
  -- ROLLBACK (manual): alter table public.publicaciones drop column if exists imagenes;
  -- ============================================================================

  alter table public.publicaciones
    add column if not exists imagenes jsonb not null default '[]'::jsonb;

  comment on column public.publicaciones.imagenes is
    'Ordered gallery: jsonb array of public Storage URL strings (array order = display
     order). The cover imagen_url stays separate.';
  ```
  Ensure `ADD COLUMN IF NOT EXISTS` is used (idempotency guard). Do NOT touch `imagen_url` or any existing RLS/Storage policy.
- **Accept:**
  - File exists at `db/2026-06-15_015_publicaciones_imagenes.sql` with house header + ROLLBACK comment.
  - DDL uses `ADD COLUMN IF NOT EXISTS imagenes jsonb NOT NULL DEFAULT '[]'::jsonb`.
  - `imagen_url` is not referenced or modified anywhere in the file.
  - Running the migration a second time raises no error (idempotent by `IF NOT EXISTS`).
- **Blocks:** S1-T02
- **Done:**

### S1-T02 — `[USER-GATED]` Apply migration `015` via Supabase MCP
- **Req:** GAL1-DB, XT-GAL1
- **Files:** DB only (no code file changed)
- **Work:** Present the SQL of `db/2026-06-15_015_publicaciones_imagenes.sql` to the user for review. On explicit OK, call Supabase MCP `apply_migration` against prod ref `othwyesmfpjaykbdwxrh`. Verify:
  - `\d public.publicaciones` (or equivalent MCP introspection) shows `imagenes jsonb NOT NULL DEFAULT '[]'::jsonb`.
  - `imagen_url` is still a separate `text` column, unchanged.
  - Existing row `imagenes` value is `[]` (DEFAULT applied on old rows).
- **Accept:** Column `imagenes` exists with correct type, NOT NULL, default `'[]'`. All existing rows have `imagenes = '[]'`. `imagen_url` is untouched. Migration is idempotent (re-apply raises no error).
- **Depends on:** S1-T01
- **Blocks:** S1-T03
- **Done:**

### S1-T03 — `[USER-GATED]` Regenerate `database.types.ts` via Supabase MCP and commit
- **Req:** GAL1-DB, XT-GAL1, GAL2-DTO
- **Files:** `src/types/database.types.ts`
- **Work:** After migration `015` is confirmed applied (S1-T02), call Supabase MCP `generate_typescript_types` against prod ref `othwyesmfpjaykbdwxrh`. Overwrite `src/types/database.types.ts` with the output. This is a generated file — NEVER hand-edit it. Commit the regenerated file.
  **NOTE:** This is the only step that makes S2–S4 compile. Do NOT proceed to Slice 2 until this file is committed and `tsc -b` passes.
- **Accept:**
  - `src/types/database.types.ts` contains `imagenes: Json` (or equivalent jsonb type) in `Tables<'publicaciones'>`, `TablesInsert<'publicaciones'>`, and `TablesUpdate<'publicaciones'>`.
  - `imagen_url` is still present in the generated types (unchanged).
  - File is committed in the Slice 1 changeset (not a stray untracked file).
- **Depends on:** S1-T02
- **Blocks:** S1-T04 (verify) and ALL of Slice 2
- **Done:**

### S1-T04 — `[VERIFY Slice 1]` lint + tsc -b + schema check
- **Req:** XT-GAL1, XT-GAL2
- **Files:** all (build check)
- **Work:**
  1. `npm run lint && npx tsc -b` — both must exit 0.
  2. Inspect `src/types/database.types.ts` and confirm `imagenes` is present in `TablesInsert<'publicaciones'>` and `TablesUpdate<'publicaciones'>`.
  3. Confirm `imagen_url` is still in the generated types as a `text`/`string` column.
- **Accept:** Both `lint` and `tsc -b` exit 0. `imagenes` present in Insert/Update types. `imagen_url` unchanged.
- **Depends on:** S1-T03
- **Slice commit:** `feat(db): add imagenes jsonb gallery column to publicaciones (migration 015)`
- **Done:**

---

## Slice 2 — DTO + Service (PR-2 of chain)

**Scope:** `dtos.ts` combined `Omit`; `parseImagenes` inside `toPublicacion`; `subirImagenGaleria`; `eliminarImagenGaleria`.
**Depends on:** Slice 1 merged and `imagenes` in generated types.
**Pre-condition:** `TablesInsert<'publicaciones'>` and `TablesUpdate<'publicaciones'>` include `imagenes` (verified by S1-T04).
**Gate:** `npm run lint` + `npx tsc -b` exit 0. `Publicacion.imagenes` types as `string[]`, not `Json`.

### S2-T01 — Update `Publicacion` DTO in `src/types/dtos.ts` (combined `Omit`)
- **Req:** GAL2-DTO
- **Files:** `src/types/dtos.ts`
- **Work:** Replace the current `Publicacion` type (which omits only `'enlaces'`) with a single combined `Omit` that excludes BOTH `'enlaces'` AND `'imagenes'` from `Tables<'publicaciones'>`, then intersects with the strongly-typed fields:
  ```ts
  export type Publicacion = Omit<Tables<'publicaciones'>, 'enlaces' | 'imagenes'> & {
    enlaces: Enlace[]
    imagenes: string[]
  }
  ```
  This MUST be a single `Omit<…, 'enlaces' | 'imagenes'>` — NOT two chained `Omit` calls. The existing `Enlace` type MUST remain unchanged.
- **Accept:**
  - `Publicacion['imagenes']` is typed `string[]` (not `Json`).
  - `Publicacion['enlaces']` is still typed `Enlace[]`.
  - No second `Omit` call chains over the same base type.
  - `npx tsc -b` on `dtos.ts` passes (after S1-T03).
- **Blocks:** S2-T02
- **Done:** [x]

### S2-T02 — Add `parseImagenes` function to `publicacionesService.ts` (inside `toPublicacion`)
- **Req:** GAL2-SVC
- **Files:** `src/services/publicacionesService.ts`
- **Work:** Add a `parseImagenes(raw: unknown): string[]` function. Logic (FILTER, not all-or-nothing):
  - If `!Array.isArray(raw)`: return `[]`.
  - Otherwise: `return raw.filter((item): item is string => typeof item === 'string' && item.length > 0)`.
  - This is a FILTER (drops non-string/empty elements, keeps valid ones). Non-string or empty-string elements are silently dropped — the valid URLs survive. Non-arrays return `[]`.
  - NOTE: This behavior differs from the spec's GAL2-SVC wording ("rejects the whole array when any single element is malformed") — the design doc and the hard constraint in the task brief both specify FILTER semantics matching `parseEnlaces`. The FILTER implementation is the authoritative contract for this task.
  Call `parseImagenes` inside the existing `toPublicacion` mapper, immediately alongside `parseEnlaces`:
  ```ts
  function toPublicacion(row: PublicacionRow): Publicacion {
    return {
      ...row,
      enlaces: parseEnlaces(row.enlaces),
      imagenes: parseImagenes(row.imagenes),
    }
  }
  ```
  No component, hook, or page may call `parseImagenes` directly — mapper only.
- **Accept:**
  - `parseImagenes(["https://cdn.example.com/a.jpg", "https://cdn.example.com/b.jpg"])` → both URLs returned.
  - `parseImagenes(null)` → `[]`.
  - `parseImagenes("not-an-array")` → `[]`.
  - `parseImagenes(["https://cdn.example.com/a.jpg", 42])` → `["https://cdn.example.com/a.jpg"]` (42 filtered out).
  - `parseImagenes(["https://cdn.example.com/a.jpg", ""])` → `["https://cdn.example.com/a.jpg"]` (empty string filtered out).
  - `toPublicacion` calls `parseImagenes(row.imagenes)` and maps the result to `imagenes`.
  - Function is NOT exported (mapper boundary only).
- **Depends on:** S2-T01
- **Blocks:** S2-T03
- **Done:** [x]

### S2-T03 — Add `subirImagenGaleria` (collision-proof upload) to `publicacionesService.ts`
- **Req:** GAL3-UPLOAD
- **Files:** `src/services/publicacionesService.ts`
- **Work:** Add and export a `subirImagenGaleria(publicacionId: string, file: File): Promise<string>` function. Key details:
  - Object key: `${publicacionId}/${crypto.randomUUID()}-${file.name}` — UUID generated per-file, per-upload.
  - Upload call: `supabase.storage.from('publicaciones').upload(path, file)` — NO `upsert` option (defaults to `false`, which is correct; a UUID-keyed path is always unique so upsert would silently hide a collision bug).
  - Return: `supabase.storage.from('publicaciones').getPublicUrl(path).data.publicUrl`.
  - Throw on upload error.
  The existing `subirImagen` cover-upload function (raw filename, `upsert: true`) MUST remain byte-for-byte unchanged.
- **Accept:**
  - Two calls with the same `file.name` to the same `publicacionId` produce two distinct object keys (UUID prefix differs).
  - Returns a non-empty string starting with `https://`.
  - `subirImagen` (cover) is not modified.
  - `upsert` is NOT passed as `true` (no overwrite semantics on gallery uploads).
- **Depends on:** S2-T01
- **Parallel with:** S2-T02
- **Blocks:** S2-T04
- **Done:** [x]

### S2-T04 — Add `eliminarImagenGaleria` (best-effort storage delete) to `publicacionesService.ts`
- **Req:** GAL3-DELETE, XT-GAL4
- **Files:** `src/services/publicacionesService.ts`
- **Work:** Add and export an `eliminarImagenGaleria(publicUrl: string): Promise<void>` function. Logic:
  ```ts
  const PUBLIC_PREFIX = '/storage/v1/object/public/publicaciones/'

  export async function eliminarImagenGaleria(publicUrl: string): Promise<void> {
    const marker = publicUrl.indexOf(PUBLIC_PREFIX)
    if (marker === -1) return        // not our bucket / malformed URL — skip, do not throw
    const key = publicUrl.slice(marker + PUBLIC_PREFIX.length)
    if (key === '') return
    const { error } = await supabase.storage.from('publicaciones').remove([key])
    if (error) throw error           // real Storage error (network/perms) still surfaces
  }
  ```
  `indexOf` (not `startsWith`) tolerates the full absolute URL form. A non-matching or malformed URL returns silently (best-effort). A genuine Storage error (network, permissions) IS thrown — it is not silently swallowed. No new Storage policy is needed (existing DELETE policy `puede_gestionar_contenido()` already covers this).
- **Accept:**
  - A well-formed gallery public URL causes `supabase.storage.remove([key])` to be called with the reconstructed key.
  - A URL that does not contain `/storage/v1/object/public/publicaciones/` returns without throwing.
  - An empty key after stripping the prefix returns without throwing.
  - A genuine `remove` error (mocked) propagates as a thrown error.
- **Depends on:** S2-T01
- **Parallel with:** S2-T02 and S2-T03
- **Blocks:** S2-T05
- **Done:** [x] — implemented as `deleteImagenStorage(url)` (apply-brief name) with
  `decodeURIComponent` on the key and a try/catch that SWALLOWS Storage errors
  (apply brief: "a failed delete must NEVER break a save"). This deviates from the
  design's "real Storage error still surfaces" — the brief is the operative contract.

### S2-T05 — `[VERIFY Slice 2]` lint + tsc -b + type-shape check
- **Req:** GAL2-DTO, GAL2-SVC, GAL3-UPLOAD, GAL3-DELETE, XT-GAL2
- **Files:** all (build check)
- **Work:**
  1. `npm run lint && npx tsc -b` — both must exit 0.
  2. Confirm `Publicacion['imagenes']` resolves to `string[]` (not `Json`) by inspection or a scratch TS check.
  3. Confirm `subirImagen` (cover) is unchanged by comparing its signature and body.
- **Accept:** Both `lint` and `tsc -b` exit 0. `Publicacion.imagenes` is `string[]`. `subirImagen` unmodified.
- **Depends on:** S2-T02, S2-T03, S2-T04
- **Slice commit:** `feat(publicaciones): add imagenes DTO, parseImagenes, gallery upload/delete helpers`
- **Done:** [x] — `npm run lint` exit 0, `npx tsc -b` exit 0. `subirImagen` (cover) untouched.

---

## Slice 3 — Admin Form (PR-3 of chain)

**Scope:** `PublicacionFormPage.tsx` — `imagenes` state, `uploadingGaleria` flag, multi-file upload loop, native HTML5 DnD + up/down-button reorder, remove-with-storage-delete, `imagenes` in `crear`/`editar` and pre-fill effect.
**Depends on:** Slice 2 merged (`subirImagenGaleria`, `eliminarImagenGaleria`, `Publicacion.imagenes` typed `string[]`).
**Gate:** `npm run lint` + `npx tsc -b` exit 0 + Playwright (channel msedge) manual flow: create → multi-upload → reorder (drag + buttons) → remove → save → edit (pre-fill check).

### S3-T01 — Add `imagenes` state and `uploadingGaleria` flag to `PublicacionFormPage.tsx`
- **Req:** GAL4-UPLOAD, GAL4-PERSIST
- **Files:** `src/pages/admin/PublicacionFormPage.tsx`
- **Work:** Add state alongside existing form state:
  ```ts
  const [imagenes, setImagenes] = useState<string[]>([])
  const [uploadingGaleria, setUploadingGaleria] = useState(false)
  const [galeriaError, setGaleriaError] = useState<string | null>(null)
  ```
  Add `uploadingGaleria` to the submit button's disabled guard alongside existing guards (`submitting`, `uploading`, etc.):
  ```tsx
  disabled={submitting || uploading || uploadingGaleria}
  ```
  Add `setImagenes(pub.imagenes)` to the edit pre-fill effect (the `useEffect` that already calls `setEnlaces(pub.enlaces)` and similar — add it in the same block).
- **Accept:**
  - `imagenes` state initialized as `[]`.
  - `uploadingGaleria` defaults `false`.
  - Submit button disabled when `uploadingGaleria` is `true`.
  - Edit pre-fill effect sets `imagenes` from `pub.imagenes` (existing gallery loads when editing).
  - `tsc -b` passes on this file after changes (may require S2 to be merged first).
- **Blocks:** S3-T02, S3-T03 (parallel after this)
- **Done:** [x] — flag named `uploadingGalleria` and `galleriaError` per apply-brief
  spelling (design used `uploadingGaleria`); pre-fill adds `setImagenes(pub.imagenes)`;
  submit guard is `submitting || uploading || uploadingGalleria`.

### S3-T02 — Add multi-file gallery upload handler (`handleGaleriaChange`)
- **Req:** GAL4-UPLOAD
- **Files:** `src/pages/admin/PublicacionFormPage.tsx`
- **Work:** Add a `handleGaleriaChange` async handler and a corresponding `<input type="file" multiple>` element (separate from the existing single-file cover input):
  ```ts
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
      e.target.value = ''   // allow re-selecting the same files
    }
  }
  ```
  Sequential per-file loop (not `Promise.all`) — partial progress survives a mid-batch failure. Each successfully uploaded URL is appended to `imagenes` state immediately.
  Render the `<input>` and an error display for `galeriaError` in the gallery section of the form.
- **Accept:**
  - Three files selected → three sequential uploads → three URLs appended to `imagenes`.
  - Mid-batch failure → already-uploaded URLs stay in `imagenes`; error message set in `galeriaError`.
  - `uploadingGaleria` is `true` during uploads, `false` after (success or failure).
  - Submit button is disabled while `uploadingGaleria` is `true`.
  - After upload, `e.target.value` is reset (same file can be selected again).
- **Depends on:** S3-T01
- **Parallel with:** S3-T03, S3-T04
- **Done:** [x] — `handleGalleriaChange` sequential loop, `<input type="file" multiple accept="image/*">`.

### S3-T03 — Add `moveImagen` reducer + HTML5 DnD + up/down-button reorder
- **Req:** GAL4-REORDER
- **Files:** `src/pages/admin/PublicacionFormPage.tsx`
- **Work:** Add drag state and the single reorder primitive:
  ```ts
  const [dragIndex, setDragIndex] = useState<number | null>(null)

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
  ```
  Wire each gallery thumbnail with:
  - `draggable`
  - `onDragStart={() => setDragIndex(index)}`
  - `onDragOver={(e) => e.preventDefault()}` (REQUIRED for `onDrop` to fire)
  - `onDrop={() => { if (dragIndex !== null) moveImagen(dragIndex, index); setDragIndex(null) }}`
  - `onDragEnd={() => setDragIndex(null)}`
  - Up/down arrow buttons (touch + keyboard fallback) calling the same `moveImagen`:
    - `<button aria-label="Mover antes" onClick={() => moveImagen(index, index - 1)} disabled={index === 0} />`
    - `<button aria-label="Mover después" onClick={() => moveImagen(index, index + 1)} disabled={index === imagenes.length - 1} />`
  No new library dependency. `dragIndex` carries the source index across the drag interaction (more reliable than `dataTransfer` serialization).
- **Accept:**
  - Dragging thumbnail at position 2 to position 0 updates `imagenes` to `[url-2, url-0, url-1]`.
  - Clicking "Mover antes" on position 1 swaps it with position 0.
  - Up button disabled at index 0; down button disabled at last index.
  - `moveImagen` is the ONLY mutation path for reorder (drag and buttons both call it).
  - No new runtime dependency added to `package.json`.
- **Depends on:** S3-T01
- **Parallel with:** S3-T02, S3-T04
- **Done:** [x] — native HTML5 DnD + ↑/↓ buttons, single `moveImagen(from, to)` primitive, no new dep.

### S3-T04 — Add `removeImagen` handler (array edit + best-effort storage delete)
- **Req:** GAL4-REMOVE, GAL3-DELETE, XT-GAL4
- **Files:** `src/pages/admin/PublicacionFormPage.tsx`
- **Work:** Add a `removeImagen(index: number)` handler that:
  1. Performs an optimistic array edit (removes the URL from `imagenes` state immediately).
  2. Calls `publicacionesService.eliminarImagenGaleria(url)` — best-effort: catch any thrown error without surfacing it as a blocking failure (the array edit already happened; a Storage cleanup failure is a non-fatal orphan).
  ```ts
  async function removeImagen(index: number) {
    const url = imagenes[index]
    setImagenes((prev) => prev.filter((_, i) => i !== index))  // optimistic
    try {
      await publicacionesService.eliminarImagenGaleria(url)
    } catch {
      // Best-effort: Storage delete failure leaves an orphan blob but does not
      // break the form. The array edit (what the user asked for) already happened.
    }
  }
  ```
  Render a remove button per thumbnail that calls `removeImagen(index)`.
- **Accept:**
  - Clicking remove on `url-B` from `[url-A, url-B, url-C]` → `imagenes` becomes `[url-A, url-C]` immediately.
  - `eliminarImagenGaleria` is called with `url-B`.
  - A Storage delete failure does NOT re-add `url-B` to `imagenes` or block the form.
  - Removing the last image sets `imagenes` to `[]`.
- **Depends on:** S3-T01
- **Parallel with:** S3-T02, S3-T03
- **Done:** [x] — `removeImagen(index)` captures the URL, optimistically drops it from
  state, then `void publicacionesService.deleteImagenStorage(url)` (fire-and-forget;
  the helper already swallows errors internally, so no try/catch needed at the call site).

### S3-T05 — Include `imagenes` in `crear` and `editar` service calls
- **Req:** GAL4-PERSIST
- **Files:** `src/pages/admin/PublicacionFormPage.tsx`
- **Work:** In both the create payload (passed to `publicacionesService.crear(...)`) and the edit patch (passed to `publicacionesService.editar(...)`), add `imagenes` as the current `string[]` state value. No filtering or trimming needed at this point — `parseImagenes` already guaranteed clean strings on pre-fill, and removes happened in-form. Example:
  ```ts
  // In the create call:
  await publicacionesService.crear({ …, imagenes })

  // In the edit call:
  await publicacionesService.editar(id, { …, imagenes })
  ```
  PostgREST accepts a JS `string[]` for a `jsonb` column — no signature change needed in the service.
- **Accept:**
  - A create form with two gallery images → inserted row has `imagenes` with both URLs.
  - An edit form where one image was removed → saved row has the updated array.
  - An edit form opened for an existing publication with `imagenes = [url-A, url-B]` shows both thumbnails pre-filled (S3-T01 pre-fill + this task's persist).
- **Depends on:** S3-T01
- **Parallel with:** S3-T02, S3-T03, S3-T04
- **Done:** [x] — `imagenes` added to both the `crear` input and the `editar` patch.

### S3-T06 — `[VERIFY Slice 3]` lint + tsc -b + Playwright (msedge) admin form flow
- **Req:** GAL4-UPLOAD, GAL4-REORDER, GAL4-REMOVE, GAL4-PERSIST, XT-GAL2
- **Files:** all (build + manual)
- **Work:**
  1. `npm run lint && npx tsc -b` — both must exit 0.
  2. Playwright visual checks (channel msedge) on `PublicacionFormPage`:
     - Open the create form → gallery section is present with a `<input type="file" multiple>`.
     - Select 2+ gallery images → uploads complete sequentially → thumbnails appear → submit button re-enabled.
     - Submit button is disabled during upload (`uploadingGaleria = true`).
     - Drag a thumbnail to a different position → order updates visually.
     - Click "Mover antes" / "Mover después" buttons → order updates.
     - Remove a thumbnail → it disappears from the gallery preview.
     - Save the publication → row in DB has `imagenes` with the uploaded URLs in the correct order.
     - Open the edit form for that publication → gallery thumbnails are pre-filled from `pub.imagenes`.
- **Accept:** Both `lint` and `tsc -b` exit 0. All Playwright visual checks pass.
- **Depends on:** S3-T02, S3-T03, S3-T04, S3-T05
- **Slice commit:** `feat(admin): add gallery upload, reorder, and remove to PublicacionFormPage`
- **Done:** [x build] — `npm run lint` exit 0, `npx tsc -b` exit 0. Playwright (msedge) visual checks NOT run (explicitly out of scope for this apply run; defer to verify phase).

---

## Slice 4 — Public Detail: Gallery Grid + Lightbox (PR-4 of chain)

**Scope:** `Modal.tsx` optional `className` prop (additive); `PublicacionDetallePage.tsx` "Galería" section (grid + lightbox), conditional on `imagenes.length > 0`, no `useImageOk` gate.
**Depends on:** Slice 2 merged (`Publicacion.imagenes: string[]` available to the detail page).
**Gate:** `npm run lint` + `npx tsc -b` exit 0 + Playwright (channel msedge) on a publication with ≥3 images and on a publication with `imagenes = []`.

### S4-T01 — Add optional `className` prop to `Modal.tsx` (additive, default unchanged)
- **Req:** GAL5-LIGHTBOX
- **Files:** `src/components/ui/Modal.tsx`
- **Work:** The current `Modal` hardcodes `max-w-sm` on the `<dialog>` element itself. A child wrapper alone cannot override this constraint. Add an optional `className` prop to the `Props` type and apply it to the `<dialog>` element, using Tailwind class merging (e.g. `clsx` or `cn` if available, or a simple template literal) so callers can override the max-width while all other defaults remain:
  ```ts
  type Props = {
    open: boolean
    onClose: () => void
    labelledBy?: string
    className?: string          // additive — caller can override max-w-sm for wide lightbox
    children: React.ReactNode
  }

  // In the JSX:
  <dialog
    ref={ref}
    onClick={handleClick}
    aria-labelledby={labelledBy}
    className={`m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-border bg-surface p-6 text-text shadow-pop${className ? ` ${className}` : ''}`}
  >
  ```
  **Existing consumers that do NOT pass `className` are completely unaffected** (default behavior unchanged — no `className` → no extra class → same visual as today). This is a purely additive, backward-compatible change.
- **Accept:**
  - All existing `Modal` usages across the codebase continue to render identically (no `className` passed = no change).
  - Passing `className="max-w-5xl"` visibly widens the dialog to `max-w-5xl`.
  - `tsc -b` passes.
- **Blocks:** S4-T02
- **Done:** [x] — implemented as optional `maxWidthClassName?: string` (default `'max-w-sm'`)
  per apply-brief, not a generic `className`. Existing consumers (pass nothing) render
  identically. The `<dialog>` className is now a template literal interpolating the prop.

### S4-T02 — Add "Galería" section to `PublicacionDetallePage.tsx` (grid + lightbox)
- **Req:** GAL5-GRID, GAL5-LIGHTBOX, GAL5-NO-GATE, XT-GAL2, XT-GAL3
- **Files:** `src/pages/PublicacionDetallePage.tsx`
- **Work:** Add `activeImg` state and the gallery section immediately after the cover hero block (after the `imagen_url` `<img>` div, before `cuerpo`), gated on `pub.imagenes.length > 0`:
  ```ts
  const [activeImg, setActiveImg] = useState<string | null>(null)
  ```
  Gallery section markup (insert after cover hero, before cuerpo):
  ```tsx
  {pub.imagenes.length > 0 && (
    <section className="reveal flex flex-col gap-3">
      <h2>
        <span className="…accent-bar-classes…" />
        Galería
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {pub.imagenes.map((url) => (
          <button key={url} onClick={() => setActiveImg(url)} className="…">
            <img src={url} alt="" className="w-full aspect-square object-cover" />
          </button>
        ))}
      </div>
      <Modal
        open={activeImg !== null}
        onClose={() => setActiveImg(null)}
        className="max-w-5xl"
      >
        {activeImg && (
          <img src={activeImg} alt="" className="w-full h-auto object-contain" />
        )}
      </Modal>
    </section>
  )}
  ```
  Heading MUST use the same `h2` + accent-bar `span` pattern already used by the Video section in the same page (copy the exact Tailwind classes from the Video heading). Gallery `<img>` tags MUST have `src` set directly to the URL — NO `useImageOk` hook, no liveness gate. Gallery renders only when `imagenes.length > 0`; no empty container or hidden section for publications with no gallery.
- **Accept:**
  - A publication with `imagenes = [url-A, url-B, url-C]` renders a "Galería" section with three thumbnail buttons.
  - Clicking a thumbnail opens `Modal` displaying that image at `max-w-5xl` width.
  - Closing the Modal (Esc, backdrop, or existing close mechanism) sets `activeImg` back to `null` and dismisses the lightbox.
  - A publication with `imagenes = []` renders NO "Galería" section and NO empty container.
  - Gallery `<img>` elements have `src` directly from the URL — no `useImageOk` import or wrapper.
  - `tsc -b` passes.
- **Depends on:** S4-T01
- **Blocks:** S4-T03
- **Done:** [x] — "Galería" section after the cover hero, gated on `pub.imagenes.length > 0`;
  state named `lightboxUrl`/`setLightboxUrl` (per apply-brief, not `activeImg`); Modal passed
  `maxWidthClassName="max-w-5xl"`; thumbnails use `aspect-video object-cover`; no `useImageOk`.
  Heading copies the Video section's `h2` + accent-bar `span`. `useState` hook declared before
  the early returns (Rules of Hooks).

### S4-T03 — `[VERIFY Slice 4]` lint + tsc -b + Playwright (msedge) detail page checks
- **Req:** GAL5-GRID, GAL5-LIGHTBOX, GAL5-NO-GATE, XT-GAL2
- **Files:** all (build + manual)
- **Work:**
  1. `npm run lint && npx tsc -b` — both must exit 0.
  2. Playwright visual checks (channel msedge) on `PublicacionDetallePage`:
     - Navigate to a publication with ≥3 gallery images → "Galería" section visible after the cover hero.
     - Grid layout: 2 columns on mobile, 3 on sm+.
     - Click a thumbnail → lightbox Modal opens with the full image.
     - Lightbox is wider than the content column (`max-w-5xl`).
     - Press Esc or click backdrop → Modal closes, detail page visible.
     - Navigate to a publication with `imagenes = []` → no "Galería" section rendered at all.
     - Verify no `useImageOk` import is present in `PublicacionDetallePage.tsx` (code inspection).
  3. Spot-check all existing `Modal` usages across the app — confirm they still render at the original width (no `className` passed = no regression).
- **Accept:** Both `lint` and `tsc -b` exit 0. All Playwright visual checks pass. No `Modal` regression in existing usages.
- **Depends on:** S4-T02
- **Slice commit:** `feat(publicaciones): add gallery grid and lightbox to PublicacionDetallePage`
- **Done:** [x build] — `npm run lint` exit 0, `npx tsc -b` exit 0. No `useImageOk` import in
  `PublicacionDetallePage.tsx`. Modal change is additive (default `max-w-sm` unchanged) so existing
  consumers are unaffected. Playwright (msedge) visual checks NOT run (out of scope for this apply run).

---

## Dependency Graph

```
SLICE 1 — DB + TYPES [USER-GATED]
S1-T01 (write migration 015) ──> S1-T02 [USER-GATED apply 015] ──> S1-T03 [USER-GATED regen types]
                                                                            │
                                                                     S1-T04 [VERIFY: lint + tsc -b]
                                                                            │
                                        ┌───────────────────────────────── │ ──────────────────────────────────┐
                                        ▼                                                                       ▼

SLICE 2 — DTO + SERVICE  (depends on S1 merged)
S2-T01 (combined Omit in dtos.ts)
    │
    ├──> S2-T02 (parseImagenes in toPublicacion)  ──┐
    ├──> S2-T03 (subirImagenGaleria)               ──┤──> S2-T05 [VERIFY: lint + tsc -b]
    └──> S2-T04 (eliminarImagenGaleria)            ──┘

SLICE 3 — ADMIN FORM  (depends on S2 merged)
S3-T01 (imagenes state + uploadingGaleria flag + pre-fill + disabled guard)
    │
    ├──> S3-T02 (handleGaleriaChange — multi-upload)    ──┐
    ├──> S3-T03 (moveImagen + DnD + up/down buttons)    ──┤──> S3-T06 [VERIFY: lint + tsc -b + Playwright]
    ├──> S3-T04 (removeImagen + eliminarImagenGaleria)  ──┤
    └──> S3-T05 (imagenes in crear + editar payloads)   ──┘

SLICE 4 — PUBLIC DETAIL  (depends on S2 merged; S3 independent)
S4-T01 (Modal.tsx optional className prop)
    └──> S4-T02 (Galería section in PublicacionDetallePage)
              └──> S4-T03 [VERIFY: lint + tsc -b + Playwright]
```

**Parallel opportunities within slices:**
- S1: all tasks sequential (each step blocks the next).
- S2: S2-T02, S2-T03, S2-T04 are parallel after S2-T01.
- S3: S3-T02, S3-T03, S3-T04, S3-T05 are parallel after S3-T01.
- S4: S4-T01 → S4-T02 sequential (Modal prop needed before the lightbox call site).
- S3 and S4 can be worked in parallel once S2 is merged (they touch different files).

---

## Review Workload Forecast

### Slice 1 — DB + Types

| Component | Files | Estimated lines changed |
|---|---|---|
| Migration `015` — `ADD COLUMN imagenes` + header + ROLLBACK comment | `db/2026-06-15_015_publicaciones_imagenes.sql` (new) | ~25–35 |
| `database.types.ts` — regenerated (one new column in Insert/Update/Row types) | generated | ~15–30 |
| **Slice 1 total** | **1 hand-written SQL + 1 generated** | **~40–65 lines** |

**Slice 1 budget verdict:** LOW — the migration is a minimal additive DDL. The generated types diff is small (one column added). Well within 400-line budget.

### Slice 2 — DTO + Service

| Component | Files | Estimated lines changed |
|---|---|---|
| `dtos.ts` — `Publicacion` Omit union extended (one line change) | `src/types/dtos.ts` | ~2–4 |
| `parseImagenes` function + call in `toPublicacion` | `src/services/publicacionesService.ts` | ~15–25 |
| `subirImagenGaleria` function | `src/services/publicacionesService.ts` | ~20–30 |
| `eliminarImagenGaleria` function + `PUBLIC_PREFIX` constant | `src/services/publicacionesService.ts` | ~20–30 |
| **Slice 2 total** | **2 files (both additive)** | **~57–89 lines** |

**Slice 2 budget verdict:** LOW — all additive additions to existing files. Well within 400-line budget.

### Slice 3 — Admin Form

| Component | Files | Estimated lines changed |
|---|---|---|
| `imagenes` state, `uploadingGaleria`, `galeriaError` — 3 new state vars | `PublicacionFormPage.tsx` | ~8–12 |
| Submit guard update + pre-fill effect update | `PublicacionFormPage.tsx` | ~4–6 |
| `handleGaleriaChange` + `<input multiple>` + error display | `PublicacionFormPage.tsx` | ~30–45 |
| `moveImagen` + `dragIndex` state + DnD wiring per thumbnail + up/down buttons | `PublicacionFormPage.tsx` | ~45–70 |
| `removeImagen` + remove button per thumbnail | `PublicacionFormPage.tsx` | ~20–30 |
| `imagenes` in `crear` + `editar` call sites | `PublicacionFormPage.tsx` | ~4–6 |
| Gallery thumbnail grid UI (preview section) | `PublicacionFormPage.tsx` | ~25–40 |
| **Slice 3 total** | **1 file (all additive)** | **~136–209 lines** |

**Slice 3 budget verdict:** MEDIUM — single file, all additive. Within 400-line budget.

### Slice 4 — Public Detail + Modal

| Component | Files | Estimated lines changed |
|---|---|---|
| `Modal.tsx` — optional `className` prop (additive) | `src/components/ui/Modal.tsx` | ~5–8 |
| `activeImg` state + "Galería" section (grid + lightbox) in detail page | `src/pages/PublicacionDetallePage.tsx` | ~35–55 |
| **Slice 4 total** | **2 files (both additive)** | **~40–63 lines** |

**Slice 4 budget verdict:** LOW — minimal additive changes to two existing files. Well within 400-line budget.

### Overall Summary

| Slice | Files touched | Estimated lines changed | Budget verdict |
|---|---|---|---|
| S1 — DB + Types | 2 (1 hand-written, 1 generated) | ~40–65 | LOW |
| S2 — DTO + Service | 2 (both additive) | ~57–89 | LOW |
| S3 — Admin Form | 1 (additive) | ~136–209 | MEDIUM |
| S4 — Public Detail + Modal | 2 (both additive) | ~40–63 | LOW |
| **Total** | **~7 files** | **~273–426 lines** | |

**400-line budget risk:** LOW to MEDIUM for the overall change. No individual slice approaches 400 lines. The total may reach ~400 at the high end but is driven by the admin form (S3), which is a single focused file.
**Chained PRs recommended:** Yes — the hard sequencing invariant (XT-GAL1) forces chained PRs regardless of line count. S1 is the unblocking root; S2–S4 cannot compile before S1 lands. S3 and S4 are independent of each other once S2 is merged.
**Decision needed before apply:**
- `chain_strategy` confirmation (`stacked-to-main` vs `feature-branch-chain`) — NOT YET confirmed; orchestrator will confirm with user before PR #1.
- Migration `015` apply consent — `[USER-GATED]`; explicit user OK required before S1-T02.
- `generate_typescript_types` MCP availability — confirm the Supabase MCP tool is reachable in-session before S1-T03.
- `Modal.tsx` `className` override approach — confirmed necessary by inspection (hardcoded `max-w-sm` on `<dialog>`); S4-T01 implements the additive prop.
