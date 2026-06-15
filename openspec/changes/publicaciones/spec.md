# publicaciones — Specifications

This is a FULL spec (not a delta). `public.publicaciones` is a net-new domain with no prior spec; the
whole table, its RLS, its Storage bucket, the author-display view, the read path, the section
integrations, and the admin write path are introduced here for the first time. There is no existing
behavior to amend — every requirement below is additive.

The single most security-sensitive requirement in this change is **RLS2** (Capability 2): anonymous
and authenticated-non-admin readers MUST NOT see `estado='borrador'` rows, while admins MUST. Every
other content table in the codebase is world-readable (`qual = true`); `publicaciones` deviates, and
that deviation is the line that, if forgotten, leaks drafts to the public.

Process constraint: every production DB migration (Slice 1) MUST receive explicit user approval before
the orchestrator applies it via the Supabase MCP. This is a mandatory gate, not a runtime scenario.

---

# Capability 1: Data Model & Migration

## Purpose

Introduce the one unified table `public.publicaciones` that serves the blog feed, per-tema didactic
content, and per-SI content through FK filtering (not separate tables), plus the net-new `updated_at`
maintenance infrastructure. Migration `db/2026-06-15_011_publicaciones.sql`.

## Requirements

### Requirement: DB1 — publicaciones Table With Locked Columns

The database MUST have a table `public.publicaciones` with exactly these columns and constraints:

- `id uuid NOT NULL DEFAULT gen_random_uuid()` PRIMARY KEY
- `slug text NOT NULL UNIQUE`
- `titulo text NOT NULL`
- `cuerpo text NULL`
- `imagen_url text NULL`
- `video_url text NULL`
- `enlaces jsonb NOT NULL DEFAULT '[]'::jsonb`
- `tema_id uuid NULL REFERENCES public.temas(id) ON DELETE SET NULL`
- `clasificacion_si_id uuid NULL REFERENCES public.clasificaciones_si(id) ON DELETE SET NULL`
- `autor_id uuid NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE SET NULL`
- `estado text NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador','publicado'))`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `updated_at timestamptz NOT NULL DEFAULT now()`

The `estado` representation MUST be Spanish text + CHECK (not a Postgres enum), mirroring
`profiles.role`. The relationship model MUST be nullable single FKs — there MUST NOT be any M2M
junction table for tema or SI in v1. The UNIQUE constraint on `slug` MUST be guarded against
re-application using `pg_constraint`, mirroring migration `db/2026-06-13_007`.

#### Scenario: Table created with all locked columns

- GIVEN migration `011` has been applied
- WHEN the `publicaciones` table schema is inspected
- THEN all 13 columns above exist with the stated types, nullability, and defaults
- AND `estado` has a CHECK constraint allowing only `'borrador'` and `'publicado'`
- AND `slug` carries a UNIQUE constraint

#### Scenario: estado defaults to borrador

- GIVEN a row is inserted without specifying `estado`
- WHEN the row is read back
- THEN `estado` equals `'borrador'`

#### Scenario: Invalid estado rejected

- GIVEN an insert with `estado = 'archivado'`
- WHEN the insert is attempted
- THEN the CHECK constraint rejects it

#### Scenario: FK on delete sets null

- GIVEN a publicacion with a non-null `tema_id` referencing an existing tema
- WHEN that tema is deleted
- THEN the publicacion row survives with `tema_id` set to NULL

### Requirement: DB2 — Indexes For Feed and Filter Queries

The migration MUST create these indexes on `public.publicaciones`:

- `idx_publicaciones_estado` on `(estado)`
- `idx_publicaciones_tema_id` on `(tema_id) WHERE tema_id IS NOT NULL` (partial)
- `idx_publicaciones_clasificacion_si` on `(clasificacion_si_id) WHERE clasificacion_si_id IS NOT NULL` (partial)
- `idx_publicaciones_autor_id` on `(autor_id)`
- `idx_publicaciones_estado_created` on `(estado, created_at DESC)` (blog-feed coverage)

A separate UNIQUE index on `slug` MUST NOT be created — the UNIQUE constraint from DB1 already creates
its index.

#### Scenario: Feed coverage index present

- GIVEN migration `011` has been applied
- WHEN the indexes on `publicaciones` are listed
- THEN `idx_publicaciones_estado_created` exists on `(estado, created_at DESC)`
- AND the two partial FK indexes carry their `WHERE ... IS NOT NULL` predicates
- AND there is no second standalone unique index on `slug` beyond the constraint's own index

### Requirement: DB3 — updated_at Trigger Infrastructure

The migration MUST create the net-new function `public.set_updated_at()` and a trigger
`publicaciones_set_updated_at BEFORE UPDATE ON public.publicaciones FOR EACH ROW EXECUTE FUNCTION
public.set_updated_at()`. The function MUST set `new.updated_at := now()`. The function MUST be
created with `CREATE OR REPLACE` so re-application is idempotent.

#### Scenario: updated_at bumped on update

- GIVEN an existing publicacion with `updated_at = t0`
- WHEN any column of that row is updated at a later time `t1`
- THEN `updated_at` is rewritten to a value `>= t1` (and `> t0`)

#### Scenario: created_at not changed on update

- GIVEN an existing publicacion with `created_at = c0`
- WHEN the row is updated
- THEN `created_at` still equals `c0`

---

# Capability 2: RLS & Security

## Purpose

Enable Row Level Security on `publicaciones` reusing the existing `puede_gestionar_contenido()`
gatekeeper, with the critical published-only SELECT deviation that keeps drafts private. There is no
`is_admin()` function in this codebase — `puede_gestionar_contenido()` is the only admin gate.

## Requirements

### Requirement: RLS1 — RLS Enabled With Admin-Gated Writes

`public.publicaciones` MUST have Row Level Security ENABLED, with these policies reusing
`public.puede_gestionar_contenido()` (which already exists, verbatim, and MUST NOT be redefined):

- INSERT `"admin inserta publicaciones"` to `authenticated` WITH CHECK `(public.puede_gestionar_contenido())`
- UPDATE `"admin actualiza publicaciones"` to `authenticated` USING `(public.puede_gestionar_contenido())` WITH CHECK `(public.puede_gestionar_contenido())`
- DELETE `"admin borra publicaciones"` to `authenticated` USING `(public.puede_gestionar_contenido())`

Policy names MUST follow the house convention `"admin inserta|actualiza|borra <tabla>"`.

#### Scenario: Non-admin write blocked

- GIVEN a client that is anonymous or an authenticated non-admin
- WHEN it attempts to INSERT, UPDATE, or DELETE a `publicaciones` row
- THEN RLS rejects the operation

#### Scenario: Admin write allowed

- GIVEN an authenticated user whose `profiles.role = 'admin'`
- WHEN it inserts, updates, or deletes a `publicaciones` row
- THEN the operation succeeds

### Requirement: RLS2 — Published-Only Public Read (CRITICAL — Drafts Must Not Leak)

The SELECT policy `"lectura publica publicaciones"` to `anon, authenticated` MUST use
`USING (estado = 'publicado' OR public.puede_gestionar_contenido())`. This is a deliberate deviation
from the `qual = true` SELECT pattern of every other content table. It MUST NOT be created with
`USING (true)`. If this gate is dropped, draft (`borrador`) rows leak to anonymous visitors — this is
the single most security-critical line of the change and MUST be verified by the Slice 1 manual RLS
check. Because this is the first anon-scoped policy in the project to reference `public.puede_gestionar_contenido()`, migration `011` MUST also `GRANT EXECUTE ON FUNCTION public.puede_gestionar_contenido() TO anon`; without this grant Postgres raises a permission-denied error when evaluating the function for anon sessions against draft rows (Postgres does not guarantee OR short-circuit in an RLS qual). The function safely returns false for anon since `auth.uid()` is null.

#### Scenario: Anonymous reader cannot see borradores

- GIVEN one publicacion with `estado='borrador'` and one with `estado='publicado'`
- WHEN an anonymous client (anon key) selects from `publicaciones`
- THEN only the `publicado` row is returned
- AND the `borrador` row is NOT present in the result set

#### Scenario: Authenticated non-admin cannot see borradores

- GIVEN the same two rows and a logged-in user whose `profiles.role <> 'admin'`
- WHEN that user selects from `publicaciones`
- THEN only the `publicado` row is returned
- AND the `borrador` row is absent

#### Scenario: Admin can see borradores

- GIVEN the same two rows and an authenticated admin (`profiles.role = 'admin'`)
- WHEN the admin selects from `publicaciones`
- THEN both the `borrador` and `publicado` rows are returned

---

# Capability 3: Storage (Bucket + Policies + Upload Flow)

## Purpose

Introduce the project's first Storage bucket and `storage.objects` policies, authored as SQL in `db/`
(migration `db/2026-06-15_012_storage_publicaciones.sql`), plus the client upload flow for
author-curated images. This is greenfield — zero buckets, zero Storage policies, and zero Storage
code exist today.

## Requirements

### Requirement: ST1 — Public Bucket With Constraints

A Storage bucket named `publicaciones` MUST exist, configured PUBLIC (public-read), with allowed MIME
types `image/png, image/jpeg, image/webp, image/svg+xml` and a 5 MB file-size limit. The stored path
convention MUST be `publicaciones/{publicacion_id}/{filename}`.

Creating policies on schema `storage` MAY require owner permissions the MCP role lacks. If the policy
DDL fails at apply, the bucket and its policies MUST be created via the Supabase dashboard and the
equivalent SQL recorded in migration `012` for parity. Migration `012` MUST be a separate file from
`011` so a Storage failure does not block the table migration.

#### Scenario: Bucket exists and is public

- GIVEN migration `012` (or the dashboard fallback) has been applied
- WHEN the bucket list is inspected
- THEN a bucket `publicaciones` exists
- AND it is marked public
- AND its allowed MIME types and 5 MB size limit are set

### Requirement: ST2 — storage.objects Policies Reuse the Admin Gate

`storage.objects` MUST carry these policies scoped to the `publicaciones` bucket, reusing
`public.puede_gestionar_contenido()`:

- SELECT `"lectura publica imagenes publicaciones"` to `anon, authenticated` USING `(bucket_id = 'publicaciones')`
- INSERT `"admin sube imagenes publicaciones"` to `authenticated` WITH CHECK `(bucket_id = 'publicaciones' AND public.puede_gestionar_contenido())`
- UPDATE `"admin actualiza imagenes publicaciones"` to `authenticated` USING `(bucket_id = 'publicaciones' AND public.puede_gestionar_contenido())` WITH CHECK `(bucket_id = 'publicaciones' AND public.puede_gestionar_contenido())`
- DELETE `"admin borra imagenes publicaciones"` to `authenticated` USING `(bucket_id = 'publicaciones' AND public.puede_gestionar_contenido())`

#### Scenario: Public can read bucket objects

- GIVEN an object stored in the `publicaciones` bucket
- WHEN an anonymous client requests its public URL
- THEN the object is readable

#### Scenario: Non-admin upload blocked

- GIVEN a client that is anonymous or an authenticated non-admin
- WHEN it attempts to upload an object into the `publicaciones` bucket
- THEN the storage policy rejects the upload

### Requirement: ST3 — Client Upload Flow Produces a Public URL

The admin write path MUST upload via `supabase.storage.from('publicaciones').upload(path, file, {upsert: true})`
using a path of the form `publicaciones/{publicacion_id}/{filename}`, then call `getPublicUrl(path)` and
store the resulting public URL in `imagen_url`. Author-uploaded images MUST render directly in an
`<img src>` with `object-cover`, BYPASSING the `useImageOk` 200px gate (images are author-curated,
unlike scraped logos).

#### Scenario: Uploaded image URL stored and rendered

- GIVEN an admin selects an image file in the create/edit form for a publicacion
- WHEN the form is saved
- THEN the file is uploaded to `publicaciones/{id}/{filename}` with `upsert: true`
- AND `imagen_url` is set to the value returned by `getPublicUrl`
- AND the detail page renders the image via `<img src={imagen_url}>` with `object-cover` and no 200px `useImageOk` gate

---

# Capability 4: Author Display via v_autores_publicos

## Purpose

Expose author names to public readers without weakening the self-read-only `profiles` RLS, using a
security-definer view. `profiles` has only nullable `nombre` + `apellido` (no display-name column) and
its RLS is `auth.uid() = id`, so an anonymous `publicaciones → profiles` join would fail and authors
would render blank.

## Requirements

### Requirement: AU1 — Security-Definer View Exposing Author Names

A view `public.v_autores_publicos` MUST be created `WITH (security_invoker = false)` selecting only
`id, nombre, apellido` from `public.profiles` for users who ARE authors of at least one publicacion
(`EXISTS (SELECT 1 FROM public.publicaciones pub WHERE pub.autor_id = p.id)`), and granted
`SELECT` to `anon, authenticated`. The view MUST NOT be created with `security_invoker = true`
(that would re-trigger the `profiles` RLS and blank the author). `profiles` RLS MUST NOT be modified.

#### Scenario: Anonymous reader resolves a non-blank author name

- GIVEN a published publicacion whose `autor_id` references a profile with `nombre='Ada'`, `apellido='Lovelace'`
- WHEN an anonymous client queries `v_autores_publicos` for that author id
- THEN it returns the row `(id, 'Ada', 'Lovelace')` (not empty, not an RLS error)

#### Scenario: View exposes only authors

- GIVEN a profile that has never authored any publicacion
- WHEN `v_autores_publicos` is queried
- THEN that profile's id is NOT present in the view

### Requirement: AU2 — Author Name Composition With Fallback

The read service MUST compose the author display name as `nombre || ' ' || apellido`, trimming
gracefully, and MUST fall back to the literal `"Equipo ia-dex"` when both `nombre` and `apellido` are
NULL.

#### Scenario: Fallback when name is null

- GIVEN a publicacion authored by a profile with `nombre = NULL` and `apellido = NULL`
- WHEN the read service resolves the author display name
- THEN it returns `"Equipo ia-dex"`

#### Scenario: Composed name when present

- GIVEN an author with `nombre='Ada'`, `apellido='Lovelace'`
- WHEN the read service resolves the author display name
- THEN it returns `"Ada Lovelace"`

---

# Capability 5: Read Path (Service / Hooks / DTOs / Pages / Routes)

## Purpose

Expose the public read surface: DTO narrowing, the read service (feed + single + per-tema +
per-SI), the `useReducer` hooks, the blog pages, routes, and nav — all mirroring existing
patterns (`temasService`/`useTemas`/`useTema`, `clasificacionesService.parseEnlaces`).

## Requirements

### Requirement: SV1 — Publicacion DTO Narrows enlaces

`src/types/dtos.ts` MUST export
`export type Publicacion = Omit<Tables<'publicaciones'>, 'enlaces'> & { enlaces: Enlace[] }`,
reusing the existing `Enlace` type (identical narrowing to `ClasificacionSI`).
`database.types.ts` MUST be regenerated via `npm run gen:types` after the Slice 1 migrations and
committed in the same changeset. `TablesInsert<'publicaciones'>` / `TablesUpdate<'publicaciones'>`
MUST be used by the write service.

#### Scenario: Publicacion.enlaces is typed Enlace[]

- GIVEN `database.types.ts` has been regenerated and `dtos.ts` exports `Publicacion`
- WHEN `tsc -b` is run
- THEN `Publicacion.enlaces` is typed `Enlace[]` (not `Json`)
- AND the build exits with code 0

### Requirement: SV2 — Read Service Surface

`src/services/publicacionesService.ts` MUST be a flat module of async functions (no classes) exporting:

- `listarPublicaciones()` — the blog feed: `estado='publicado'` ordered by `created_at DESC`
- `obtenerPublicacion(slug)` — single by slug, using `.maybeSingle()` so an absent slug returns `null` (not throw), mirroring `temasService.obtenerTema`
- `listarPorTema(temaId)` — `estado='publicado'` filtered by `tema_id`, ordered by `created_at DESC`
- `listarPorClasificacion(clasifId)` — `estado='publicado'` filtered by `clasificacion_si_id`, ordered by `created_at DESC`

`enlaces` MUST be parsed at the read boundary copying `clasificacionesService.parseEnlaces` (returning
`[]` on malformed JSON). The author display name MUST be sourced from `v_autores_publicos`
(per Capability 4), NOT from a direct `profiles` join.

#### Scenario: Feed returns only published, newest first

- GIVEN published and draft rows exist
- WHEN `listarPublicaciones()` resolves
- THEN every item has `estado='publicado'`
- AND items are ordered by `created_at` descending

#### Scenario: Absent slug returns null

- GIVEN no publicacion has slug `'no-existe'`
- WHEN `obtenerPublicacion('no-existe')` is called
- THEN it resolves to `null` (it does NOT throw)

#### Scenario: Malformed enlaces parsed to empty array

- GIVEN a publicacion whose stored `enlaces` is malformed
- WHEN it is read through the service
- THEN its `enlaces` field is `[]` (not an error)

### Requirement: SV3 — Read Hooks (useReducer State Machine)

`src` MUST export these hooks, each a `useReducer` state machine returning
`{ data, loading, error, refetch }`, mirroring `useTemas` / `useTema`:

- `usePublicaciones()` — list feed (no `'pending'` action)
- `usePublicacion(slug)` — single; MUST include a `'pending'` action and include `slug` in its effect deps so navigating between slugs resets stale state
- `usePublicacionesPorTema(temaId)` — list filtered by tema
- `usePublicacionesPorClasificacion(clasifId)` — list filtered by SI category

#### Scenario: usePublicacion resets on slug change

- GIVEN `usePublicacion('a')` has resolved with data for slug `a`
- WHEN the slug prop changes to `b`
- THEN the hook re-enters loading (the prior `a` data does not linger as stale `data`)
- AND it refetches for slug `b`

#### Scenario: refetch re-runs the query

- GIVEN `usePublicaciones()` has resolved
- WHEN `refetch()` is invoked
- THEN the underlying service call runs again and updates `data`

### Requirement: UI1 — BlogPage and PublicacionDetallePage With State Quartet

`BlogPage.tsx` (feed) and `PublicacionDetallePage.tsx` (single by `:slug`) MUST each render the D4
state quartet: loading, error + retry, not-found, and data. `PublicacionDetallePage` MUST treat a
`null` result from `obtenerPublicacion` as the not-found state. `cuerpo` MUST render as plain text with
`whitespace-pre-wrap` (no markdown in v1). `video_url`, when present, MUST render via `VideoEmbed`
+ `toEmbedUrl`. `imagen_url`, when present, MUST render per ST3 (direct `<img>`, `object-cover`,
no `useImageOk` gate). The author name MUST be displayed using the Capability 4 composition.

#### Scenario: Detail page shows not-found for unknown slug

- GIVEN no publicacion has slug `'nope'`
- WHEN the user navigates to `/blog/nope`
- THEN the not-found state is shown (not a crash, not a blank data view)

#### Scenario: Feed lists published publicaciones

- GIVEN three published publicaciones exist
- WHEN the user navigates to `/blog`
- THEN all three are listed newest-first
- AND drafts are absent

#### Scenario: cuerpo renders as plain text

- GIVEN a publicacion whose `cuerpo` contains line breaks
- WHEN the detail page renders
- THEN the body preserves whitespace via `whitespace-pre-wrap`
- AND no markdown is interpreted

### Requirement: UI2 — Routes and Navigation

`src/routes/AppRouter.tsx` MUST add, as flat children under `AppLayout`, the routes
`{ path: 'blog', element: <BlogPage/> }` and `{ path: 'blog/:slug', element: <PublicacionDetallePage/> }`.
`src/components/layout/navLinks.ts` MUST add `{ to: '/blog', label: 'Blog' }`, and
`src/components/layout/navIcons.tsx` MUST add a `/blog` glyph entry in `DEST_ICONS`.

#### Scenario: Blog routes resolve under the app layout

- GIVEN the app is running
- WHEN the user navigates to `/blog` and then to `/blog/:slug`
- THEN both render inside `AppLayout`
- AND the nav shows a "Blog" link with a glyph

---

# Capability 6: Tema / SI Section Integration

## Purpose

Surface per-tema and per-SI publicaciones inside the existing detail pages, reusing one table through
FK-filtered hooks — no model duplication.

## Requirements

### Requirement: UI3 — TemaPage Didactic Content Section

`TemaPage.tsx` MUST add a "Contenido didáctico" `<section>` after the hero, fed by
`usePublicacionesPorTema(tema.data?.id)`, mirroring the existing `useSoftwarePorTema` consumption. The
section MUST render only when there is at least one published publicacion for that tema (no empty
container), and each item MUST link to its `/blog/:slug` detail page.

#### Scenario: Section renders for a tema with content

- GIVEN a tema with at least one published publicacion carrying that `tema_id`
- WHEN the tema page renders
- THEN a "Contenido didáctico" section lists those publicaciones
- AND each entry links to `/blog/:slug`

#### Scenario: Section hidden when no content

- GIVEN a tema with no published publicaciones
- WHEN the tema page renders
- THEN no "Contenido didáctico" section (empty container) is shown

### Requirement: UI4 — ClasificacionDetallePage Content Section

`ClasificacionDetallePage.tsx` MUST add an analogous section after the ejemplos/enlaces column, fed by
`usePublicacionesPorClasificacion(data?.id)`. Like UI3, it MUST render only when there is at least one
published publicacion for that SI category, with each item linking to its `/blog/:slug` detail page.

#### Scenario: SI page lists its publicaciones

- GIVEN an SI category with at least one published publicacion carrying that `clasificacion_si_id`
- WHEN the classification detail page renders
- THEN a content section lists those publicaciones after the ejemplos/enlaces column
- AND each entry links to `/blog/:slug`

#### Scenario: No section when SI category has no content

- GIVEN an SI category with no published publicaciones
- WHEN the classification detail page renders
- THEN no content section (empty container) is shown

---

# Capability 7: Admin Write Path (Guard / Forms / Slug / Upload / Video)

## Purpose

Build the project's first role-gated CRUD area: a `RequireAdmin` route guard, an `/admin/publicaciones`
subtree with list/create/edit/delete forms, the write service (guarded by `auth.getUser()`, with RLS as
the authoritative server-side check), the runtime slug helper with collision retry, the first
`<input type=file>` + Storage upload, and `video_url` validation.

## Requirements

### Requirement: ADM1 — RequireAdmin Route Guard

A `RequireAdmin` route guard MUST gate the `/admin/publicaciones` subtree using `useIsAdmin()` (which
exists today as dead code and is wired in here). The guard is a UI convenience only and is spoofable
client-side; the authoritative enforcement MUST be RLS (`puede_gestionar_contenido()`) server-side.
Non-admin users reaching an admin route MUST be redirected or shown a denied state, never the admin UI.

#### Scenario: Non-admin blocked from admin subtree

- GIVEN a user for whom `useIsAdmin()` is false
- WHEN they navigate to `/admin/publicaciones`
- THEN the admin UI is not rendered (redirect or denied state)

#### Scenario: Admin reaches the subtree

- GIVEN a user for whom `useIsAdmin()` is true
- WHEN they navigate to `/admin/publicaciones`
- THEN the admin list UI is rendered

#### Scenario: RLS blocks a spoofed client

- GIVEN a tampered client that bypasses `useIsAdmin()` and reaches the create form
- WHEN it attempts to write while the session is not an admin
- THEN the server-side RLS policy (`puede_gestionar_contenido()`) rejects the write

### Requirement: ADM2 — Admin CRUD UI

The `/admin/publicaciones` subtree MUST provide list, create, edit, and delete of publicaciones using
controlled inputs + `useState` (no forms library, per the house convention). The form MUST cover
`titulo`, `slug`, `cuerpo`, `imagen_url` (via upload — ADM4), `video_url`, `enlaces`, `tema_id`,
`clasificacion_si_id`, and `estado` (`borrador` / `publicado`). A publicacion can be saved as a draft
(`borrador`) with an empty `cuerpo`.

#### Scenario: Create a draft with empty body

- GIVEN the admin fills `titulo` and leaves `cuerpo` empty, with `estado='borrador'`
- WHEN the form is submitted
- THEN a publicacion is created with `cuerpo` null/empty and `estado='borrador'`
- AND it does NOT appear on the public `/blog` feed

#### Scenario: Edit toggles publish state

- GIVEN an existing `borrador` publicacion
- WHEN the admin edits it to `estado='publicado'` and saves
- THEN it appears on the public `/blog` feed

#### Scenario: Delete removes the publicacion

- GIVEN an existing publicacion
- WHEN the admin deletes it
- THEN it is removed and no longer listed in the admin list or the public feed

### Requirement: SV4 — Guarded Write Service

`src/services/publicacionesService.ts` MUST add write functions `crear`, `editar`, `eliminar`, and
`subirImagen`, each guarded by `auth.getUser()` throwing `'Requiere sesión'` when there is no session
(pattern from `foroService`). These functions use `TablesInsert/TablesUpdate<'publicaciones'>`. The
session guard is a client-side fast-fail; RLS is the authoritative enforcement.

#### Scenario: Write without session throws

- GIVEN there is no authenticated session
- WHEN `crear(...)` is called
- THEN it throws `'Requiere sesión'` before hitting the network

#### Scenario: Authenticated admin write succeeds

- GIVEN an authenticated admin session
- WHEN `crear(...)` is called with valid data
- THEN the row is inserted and returned

### Requirement: SG1 — Runtime Slug Helper With Collision Retry

`src/lib/slug.ts` MUST be a net-new runtime helper that transforms a `titulo` into a slug: lowercase,
strip accents, replace non-alphanumeric runs with `-`, and collapse repeated dashes. The slug field
MUST be editable in the form, pre-filled from `titulo` but override-able. On a UNIQUE-constraint
violation during write, the write service MUST retry with a numeric suffix (`-2`, `-3`, ...) until it
succeeds.

#### Scenario: Title slugified deterministically

- GIVEN a title `"¿Qué es la IA Débil?"`
- WHEN `slugify` runs
- THEN it returns `"que-es-la-ia-debil"` (lowercase, accents stripped, dashes collapsed, no leading/trailing dash)

#### Scenario: Collision retried with suffix

- GIVEN a publicacion with slug `"ia-debil"` already exists
- WHEN a new publicacion is created whose slug resolves to `"ia-debil"`
- THEN the write retries and persists `"ia-debil-2"` (and `"ia-debil-3"` on a further collision)

#### Scenario: Slug override respected

- GIVEN the admin manually edits the pre-filled slug to a custom value
- WHEN the form is saved with no collision
- THEN the custom slug is persisted unchanged

### Requirement: ADM4 — Image Upload (First File Input)

The create/edit form MUST include the app's first `<input type="file">` and an upload helper that
uploads to the `publicaciones` bucket per ST3, then stores the resulting public URL in `imagen_url`.
The path MUST be `publicaciones/{publicacion_id}/{filename}` with `upsert: true`.

#### Scenario: File selected, uploaded, URL stored

- GIVEN the admin selects an image file in the form
- WHEN the form is saved
- THEN the file is uploaded to `publicaciones/{id}/{filename}` with `upsert: true`
- AND `imagen_url` holds the value returned by `getPublicUrl`

### Requirement: ADM5 — video_url Validation

The admin form MUST validate `video_url` using `toEmbedUrl` (from `lib/youtube.ts`) and show an inline
error when it returns null, BEFORE saving — because `VideoEmbed` silently renders nothing on a bad URL.

#### Scenario: Bad video URL blocked with error

- GIVEN the admin enters a `video_url` for which `toEmbedUrl` returns null
- WHEN they attempt to save
- THEN an inline validation error is shown
- AND the publicacion is NOT saved with that invalid `video_url`

#### Scenario: Valid YouTube URL accepted

- GIVEN the admin enters a YouTube URL for which `toEmbedUrl` returns an embed URL
- WHEN they save
- THEN no video validation error is shown and the value is persisted

---

# Cross-cutting for publicaciones

### Requirement: XT1 — Domain Language Invariant

All DB table/column names, `slug` values, `estado` values (`borrador` / `publicado`), policy names,
and user-facing UI copy MUST be Spanish. Code identifiers, comments, commit messages, and TypeScript
file contents MUST be English. The author fallback literal MUST be the Spanish `"Equipo ia-dex"`.

#### Scenario: Spanish domain, English code

- GIVEN any artifact produced by this change
- WHEN it is a DB name, slug, estado value, policy name, or UI string
- THEN it is in Spanish (e.g. `publicaciones`, `borrador`, `"lectura publica publicaciones"`, `"Contenido didáctico"`)
- AND WHEN it is an identifier, comment, or commit message THEN it is in English

#### Scenario: Slug format

- GIVEN any runtime-generated slug
- WHEN it is inspected
- THEN it is lowercase kebab-case with accents stripped (e.g. `ia-debil`, not `IA Débil`)

### Requirement: XT2 — Build Integrity at Each Slice Boundary

At the completion of each PR slice, `npm run lint` AND `npx tsc -b` (build) MUST exit with code 0.
There is no test runner (`strict_tdd: false`); verification is lint + build + manual / Playwright
visual checks on the affected pages, plus the Slice 1 manual RLS check from RLS2.

#### Scenario: Clean build at each slice boundary

- GIVEN a slice is complete
- WHEN `npm run lint && npx tsc -b` is run
- THEN both exit with code 0

#### Scenario: Slice 1 manual RLS check passes

- GIVEN Slice 1 (migrations `011` + `012` + `gen:types`) is applied
- WHEN the manual RLS check is performed per RLS2
- THEN an anonymous read returns no `borrador` rows
- AND an admin read returns both `borrador` and `publicado` rows
