# Publicaciones Galería — A Multi-Image Gallery on Each Publication

Add an ordered, admin-curated **image gallery** to `public.publicaciones`. Today each publication carries exactly **one** cover image (`imagen_url`), one YouTube video, `enlaces`, and a plain-text body. This change introduces a new `imagenes jsonb` column (an ordered array of public Storage URL strings) plus the end-to-end plumbing — migration → regenerated types → DTO → service → admin form → public detail page — so an admin can upload, reorder, and remove multiple images, and the public detail page renders them as a thumbnail **grid + lightbox**. The cover image stays a separate concern. Expected to land as **chained PRs** (likely >400 lines).

## Why

Publications support exactly one image. A tutorial, a build log, or a step-by-step post often needs **several** images — screenshots, diagrams, before/after shots — and there is currently no way to attach them. The cover (`imagen_url`) is the single visual the feed and cards show; everything else has to be crammed into one image or dropped.

The naive answer would be a child table `publicacion_imagenes` (its own migration, its own RLS, a join per read, an `orden` column with bookkeeping). That is over-engineering for what this actually is: a **value object owned 100% by its publication**. There is no independent per-image query, no per-image RLS, no per-image metadata; writes are admin-only and public reads always fetch the whole publication. The right model is a `jsonb` array embedded on the row — exactly the precedent already set by `enlaces`. The difference between "one image" and "many images" should be a **column**, not a new table.

This also forces a correctness fix the single-cover path never needed (see Risks): the existing upload helper keys objects by raw filename with `upsert:true`, which silently overwrites same-named files — fatal for a gallery.

## What changes

### Scope IN (by layer)

**DB**
- NEW column `public.publicaciones.imagenes jsonb NOT NULL DEFAULT '[]'::jsonb` — an **ordered** array of public Storage URL strings. Migration `db/2026-06-15_015_publicaciones_imagenes.sql` (convention `YYYY-MM-DD_NNN_<descriptor>.sql`; last applied local file is `014`). DDL: `ALTER TABLE ... ADD COLUMN IF NOT EXISTS imagenes jsonb NOT NULL DEFAULT '[]'::jsonb;` plus a manual ROLLBACK comment block mirroring `014`'s header style.
- `imagen_url` **stays** as a separate cover column — it is NOT folded into `imagenes[0]`. The feed/cards read only `imagen_url` for the thumbnail; folding it in would force reading the whole gallery just to render a card and would couple cover identity to array position.
- **No backfill** (the ~5 existing rows get `imagenes='[]'` from the DEFAULT — fully backward-compatible), **no RLS change**, **no Storage migration** (bucket `publicaciones` + its INSERT/UPDATE/DELETE policies already allow multiple objects per `{id}/` prefix, gated on `puede_gestionar_contenido()`).
- `[USER-GATED]` Applying `015` to prod (ref `othwyesmfpjaykbdwxrh`) requires the user's **explicit OK**.

**Types**
- Regenerate `src/types/database.types.ts` via the Supabase MCP `generate_typescript_types` **after** the migration is applied. (The `npm run gen:types` CLI is NOT available in this environment — use the MCP tool. Generated file — never hand-edited.)
- `src/types/dtos.ts`: `Publicacion` becomes `Omit<Tables<'publicaciones'>, 'enlaces' | 'imagenes'> & { enlaces: Enlace[]; imagenes: string[] }` (a single combined `Omit`, narrowing both jsonb columns).

**Services**
- `src/services/publicacionesService.ts`: add `parseImagenes` inside the single `toPublicacion` read-boundary mapper, **stricter** than `parseEnlaces` — validate `Array.isArray` and each element `typeof item === 'string' && item.length > 0`; return `[]` on anything malformed.
- Collision-proof gallery upload: gallery objects MUST use keys like `${publicacionId}/${crypto.randomUUID()}-${file.name}`. Extend `subirImagen` with an optional key strategy OR add a dedicated `subirImagenGaleria`.
- Storage-delete helper: on removing a gallery image, reconstruct the object key from its public URL (strip the `/storage/v1/object/public/publicaciones/` prefix) and call `supabase.storage.from('publicaciones').remove([key])`. The DELETE RLS policy already permits this.
- `crear` / `editar` need **NO** signature change — PostgREST accepts a JS `string[]` for a `jsonb` column.

**UI — admin form** (`src/pages/admin/PublicacionFormPage.tsx`)
- Multi-file upload: `<input type="file" multiple>`, loop the upload per file, append each returned public URL to the `imagenes` array.
- Drag-to-reorder the gallery images (array order IS display order).
- Remove an image → also delete the Storage object (via the helper above).
- Mirror the existing `enlaces` list-editor handlers (add/remove) plus the new reorder.
- An `uploadingGalleria` flag added to the disabled/submit-guard set.
- Add `imagenes` to BOTH the `crear` input and the `editar` patch; `setImagenes(pub.imagenes)` in the edit pre-fill effect.

**UI — public detail** (`src/pages/PublicacionDetallePage.tsx`)
- A new "Galería" section rendered **only when `imagenes.length > 0`** (the cover already covers the single-image case), inserted into the article column (best after the cover hero block).
- A responsive **grid** (2–3 columns) of thumbnails + a **lightbox** reusing the existing `src/components/ui/Modal.tsx` with a wide `max-w` override.
- Heading uses the existing `h2` + accent-bar `span` pattern (same as the Video section).
- Gallery `<img>` are direct with `object-cover`, **NO** `useImageOk` gate — the detail page deliberately does not gate author-curated images.

### Scope OUT (explicitly)

- **Per-image metadata** (alt text, captions, credits). Elements are plain string URLs (`string[]`), matching the cover's storage format — NOT `{url, alt, caption}` objects. There is no requirement; modeling objects now is speculative. If metadata becomes a requirement later, revisit with a child table (see tradeoff).
- **Child table `publicacion_imagenes`** — explicitly rejected as over-engineering for a value object (no per-image query/RLS/metadata, admin-only writes, whole-publication reads, tiny scale).
- **A separate `orden` column** — array order is the order; no ordering bookkeeping.
- **Gallery on the cover** — `imagen_url` stays separate; the feed/cards are untouched.
- **Backfill / data migration** — the DEFAULT handles existing rows; nothing to migrate.
- **A carousel / slider component** — v1 is grid + Modal-as-lightbox; no new media component beyond reusing `Modal`.
- **Changes to RLS or the Storage bucket/policies** — the existing bucket and its admin-write/public-read policies already support multiple objects per publication.

## Approach

### One column, ordered URLs (the whole point)

```
public.publicaciones
  imagen_url   text         ── the COVER (feed/cards read only this; unchanged)
  imagenes     jsonb '[]'   ── the GALLERY: ordered array of public Storage URLs
                               array order = display order (admin-curated)
                               element shape = plain string URL (string[])

  Card / feed  = read imagen_url only            (no gallery read for a thumbnail)
  Detail page  = read imagenes; render grid+lightbox when length > 0
  Admin form   = upload (collision-proof keys) → reorder (drag) → remove (+storage delete)
```

The gallery is a value object: it has no identity outside its publication, no independent query, no independent RLS. Embedding it as `jsonb` on the row — the same shape already used by `enlaces` — keeps reads to a single table fetch and keeps cover identity decoupled from the gallery.

### The single most data-sensitive line (correctness fix)

`subirImagen(publicacionId, file)` currently uploads to `${publicacionId}/${file.name}` with `upsert:true`. For one cover that is fine — re-uploading replaces the cover. For a **gallery** it is **data-loss**: two files named the same (e.g. two `screenshot.png`) silently overwrite each other in Storage, and the array ends up with duplicate URLs pointing at one surviving object. Gallery uploads MUST use **collision-proof** keys:

```
`${publicacionId}/${crypto.randomUUID()}-${file.name}`
```

This is the one change that the single-cover path never exercised and that the old gallery sketch missed.

### Read-boundary discipline

`imagenes` is parsed by `parseImagenes` living **inside the single `toPublicacion` mapper** — the same boundary that already parses `enlaces`. It is stricter than `parseEnlaces`: it rejects non-arrays and any non-string / empty-string element, returning `[]` on malformed input. The rest of the app consumes a clean `string[]`; no component re-parses jsonb.

### Reuse, don't rebuild

The detail-page lightbox reuses `src/components/ui/Modal.tsx` (with a wide `max-w` override) — no new modal/dialog primitive. The admin add/remove handlers mirror the existing `enlaces` list-editor. The Storage delete uses the already-granted DELETE policy. The migration is a single additive, backward-compatible `ADD COLUMN`.

## Impact

| Layer | Touched | Nature |
|---|---|---|
| DB columns | `publicaciones.imagenes` (new jsonb) | additive, backward-compatible (DEFAULT) |
| DB RLS / Storage | none | unchanged (existing policies suffice) |
| Types | `database.types.ts` (regenerated), `dtos.ts` (`Publicacion` combined `Omit`) | generated + additive |
| Services | `publicacionesService.ts` — `parseImagenes`, collision-proof upload, storage-delete helper | additive + 1 correctness fix |
| UI form | `PublicacionFormPage.tsx` — multi-upload, drag-reorder, remove-with-delete, `uploadingGalleria` | feature add |
| UI detail | `PublicacionDetallePage.tsx` — grid + Modal lightbox section | feature add (net-new UI) |

Reused without modification: `Modal.tsx`, the `enlaces` list-editor handler pattern, `puede_gestionar_contenido()` + the existing `publicaciones` bucket and its RLS, the `crear`/`editar` write signatures, the `parseEnlaces` parsing pattern. `imagen_url` and the feed/cards are untouched.

## Risks and tradeoffs

| Risk / tradeoff | Severity | Mitigation / disposition |
|---|---|---|
| **Filename collision on gallery upload** — `upsert:true` + raw-filename key silently overwrites same-named files → duplicate URLs / lost images | HIGH | Fixed: gallery uploads use `${id}/${crypto.randomUUID()}-${file.name}`. Called out in spec + design + the service task. |
| **Sequencing** — dtos/service/form/detail won't type-check until `imagenes` exists in `TablesInsert/Update` | HIGH (process) | Hard order: apply migration `015` (gated) → regen types via MCP → then code edits. Encoded as the slice order. |
| **No DB↔Storage referential integrity** (jsonb-of-URLs) — orphan risk | MEDIUM (tradeoff) | On remove, the storage-delete helper removes the object → no orphans for the normal remove path. Accepted limitation of the embed model; honestly stated. |
| **Orphaned blobs from abandoned pre-submit uploads** — files uploaded under a working id before `crear` runs, then the form is abandoned | LOW (known debt) | Matches existing cover behavior; out of scope to fix here. Recorded as debt. |
| **No per-image metadata without restructuring** | — (tradeoff) | Plain `string[]` chosen deliberately (no requirement). If alt-text/captions become required, revisit with a child table — would force a follow-up migration. Stated up front. |
| **Read-boundary leak** — a component parsing raw jsonb instead of using `imagenes` | LOW | `parseImagenes` lives only in `toPublicacion`; the DTO exposes `string[]`. Enforced by the single-mapper rule. |
| **Net-new UI** — no carousel/lightbox component exists | LOW | `Modal.tsx` is reused as the lightbox shell with a wide `max-w`; grid is plain Tailwind. No new dependency for the viewer. |
| **Production migration applied without consent** | PROCESS | Migration `015` is `[USER-GATED]`; applied only after explicit user OK, then types regenerated via the Supabase MCP. |

## Sequencing (hard order)

1. **DB + types** `[USER-GATED]` — apply migration `015` (`ADD COLUMN imagenes` + rollback comment) **only after explicit user OK** → regenerate `src/types/database.types.ts` via the Supabase MCP `generate_typescript_types`. Nothing below type-checks before `imagenes` exists in the generated `TablesInsert/Update`.
2. **DTO + service** — `dtos.ts` combined `Omit`; `publicacionesService.ts` `parseImagenes` (in `toPublicacion`), collision-proof gallery upload, storage-delete helper.
3. **Admin form** — `PublicacionFormPage.tsx` multi-upload + drag-reorder + remove-with-storage-delete, `uploadingGalleria` flag, `imagenes` in `crear`/`editar` and the pre-fill effect.
4. **Public detail** — `PublicacionDetallePage.tsx` grid + Modal lightbox, rendered only when `imagenes.length > 0`.

Verification per slice (no test runner — `strict_tdd: false`): `npm run lint` + `tsc -b` (build) + Playwright visual check (channel msedge) on the affected pages. Code, identifiers, comments, UI copy, and commits in **English**; the domain model (`imagenes`, `imagen_url`, `enlaces`) and user-facing copy ("Galería") stay **Spanish**.

Delivery: `chained PRs` (locked `delivery_strategy = chained`) — slices 1–4 are natural PR boundaries; `chain_strategy` to be confirmed with the user before the first PR.

## Open design questions (defer to DESIGN, do not decide here)

- **Drag-to-reorder implementation.** Native HTML5 drag-and-drop (no dependency, janky on touch) vs a small lib such as `@dnd-kit` (adds a dependency, better touch UX). The form is admin-only and desktop-primary; the project currently has **NO** dnd library. The DESIGN phase decides; this proposal only records the fork.

Still open (ground-truth gaps to confirm at apply time):

- **`chain_strategy` confirmation** before the first PR is opened.
- **Migration apply consent** — `015` is `[USER-GATED]`; confirm before slice 1.
- **MCP type-gen availability** — confirm `generate_typescript_types` against ref `othwyesmfpjaykbdwxrh` works in-session before slice 2 depends on the regenerated types.
