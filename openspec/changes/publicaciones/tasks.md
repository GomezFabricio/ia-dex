# publicaciones — Implementation Tasks

**Delivery:** chained PRs, `chain_strategy = feature-branch-chain` on tracker branch `feat/publicaciones` (off `main`). Each slice is a child PR; PR #1 targets the tracker branch, later child PRs target the immediate previous PR's branch. Only the tracker `feat/publicaciones` merges to `main`.
**Strict TDD:** false (no test runner — verification via `npm run lint` + `npx tsc -b` + manual/Playwright per slice).
**Migration gate:** every production DB step marked `[USER-GATED]` requires explicit user OK before the orchestrator applies it via Supabase MCP (prod ref `othwyesmfpjaykbdwxrh`).
**Data authoring:** tasks marked `[AUTHOR-WITH-USER]` require human co-authoring — they are example/seed content, not codegen.

---

## Slice 1 — DB Foundation (PR-1 of chain) `[USER-GATED]`

**Branch:** `feat/publicaciones` (tracker branch off `main`)
**Gate:** `[USER-GATED]` — present each migration SQL to the user for review; apply via Supabase MCP (`apply_migration`) only after explicit OK. Verify: `npm run lint` + `npx tsc -b` exit 0 (after `gen:types`), plus the **manual RLS check** (anon sees no `borrador`; admin sees all). Migration `012` is isolated from `011` so a Storage-policy owner-perms failure cannot block the table migration.

### S1-T01 — Write migration `db/2026-06-15_011_publicaciones.sql` (table + indexes + trigger + RLS + view)
- **Req:** DB1, DB2, DB3, RLS1, RLS2, AU1
- **Files:** `db/2026-06-15_011_publicaciones.sql` (new)
- **Work:** Write ONE migration file with the house header banner (purpose comment + date + ref), idempotency guards, and a `-- ROLLBACK` section at the bottom. Ordered steps:
  ```
  1.  CREATE TABLE public.publicaciones — exactly the 13 locked columns:
        id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        slug text NOT NULL,                          -- UNIQUE added in step 2 (guarded)
        titulo text NOT NULL,
        cuerpo text NULL,
        imagen_url text NULL,
        video_url text NULL,
        enlaces jsonb NOT NULL DEFAULT '[]'::jsonb,
        tema_id uuid NULL REFERENCES public.temas(id) ON DELETE SET NULL,
        clasificacion_si_id uuid NULL REFERENCES public.clasificaciones_si(id) ON DELETE SET NULL,
        autor_id uuid NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE SET NULL,
        estado text NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador','publicado')),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
  2.  ADD UNIQUE CONSTRAINT on slug guarded by pg_constraint (mirror migration 007 — do NOT
      CREATE UNIQUE INDEX; the constraint creates its own index):
        DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'publicaciones_slug_key')
        THEN ALTER TABLE public.publicaciones ADD CONSTRAINT publicaciones_slug_key UNIQUE (slug); END IF; END $$;
  3.  CREATE INDEX IF NOT EXISTS the 5 indexes (do NOT add a second unique index on slug):
        idx_publicaciones_estado          on (estado),
        idx_publicaciones_tema_id         on (tema_id)             WHERE tema_id IS NOT NULL,
        idx_publicaciones_clasificacion_si on (clasificacion_si_id) WHERE clasificacion_si_id IS NOT NULL,
        idx_publicaciones_autor_id        on (autor_id),
        idx_publicaciones_estado_created  on (estado, created_at DESC)
  4.  CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN new.updated_at := now(); RETURN new; END; $$;
      -- NOTE: public.set_updated_at() is intentionally a GLOBAL, reusable trigger function.
      -- Future tables that need updated_at maintenance should ATTACH this same function
      -- (CREATE TRIGGER ... EXECUTE FUNCTION public.set_updated_at()) rather than redefining
      -- a divergent body under the same name.
      CREATE TRIGGER publicaciones_set_updated_at BEFORE UPDATE ON public.publicaciones
        FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
      (guard the trigger with DROP TRIGGER IF EXISTS first so re-application is idempotent)
  5.  ALTER TABLE public.publicaciones ENABLE ROW LEVEL SECURITY;
  6.  Policies (DROP POLICY IF EXISTS each first for idempotency), reusing public.puede_gestionar_contenido()
      (which already exists — do NOT redefine it):
        SELECT "lectura publica publicaciones"  TO anon, authenticated
          USING (estado = 'publicado' OR public.puede_gestionar_contenido())   -- CRITICAL: NOT USING (true)
        INSERT "admin inserta publicaciones"    TO authenticated
          WITH CHECK (public.puede_gestionar_contenido())
        UPDATE "admin actualiza publicaciones"  TO authenticated
          USING (public.puede_gestionar_contenido()) WITH CHECK (public.puede_gestionar_contenido())
        DELETE "admin borra publicaciones"      TO authenticated
          USING (public.puede_gestionar_contenido())
  7.  CREATE OR REPLACE VIEW public.v_autores_publicos WITH (security_invoker = false) AS
        SELECT p.id, p.nombre, p.apellido FROM public.profiles p
        WHERE EXISTS (SELECT 1 FROM public.publicaciones pub WHERE pub.autor_id = p.id);
      GRANT SELECT ON public.v_autores_publicos TO anon, authenticated;
  8.  GRANT EXECUTE ON FUNCTION public.puede_gestionar_contenido() TO anon;
      -- RLS2's SELECT policy ("lectura publica publicaciones" TO anon, authenticated) is the FIRST
      -- anon-scoped policy in the project to reference this function. Migration 005 granted EXECUTE
      -- only to `authenticated`; anon needs EXECUTE so Postgres can evaluate the OR branch for
      -- draft rows without a permission-denied error. The function returns false for anon (auth.uid()
      -- is null), so it safely filters out all drafts for anonymous visitors.
  -- ROLLBACK: REVOKE EXECUTE ON FUNCTION public.puede_gestionar_contenido() FROM anon;
  --           DROP VIEW v_autores_publicos; DROP TRIGGER + FUNCTION set_updated_at;
  --           DROP POLICY (x4); DROP TABLE publicaciones CASCADE.
  ```
  **CRITICAL — the single most security-sensitive line:** step 6 SELECT is `USING (estado = 'publicado' OR public.puede_gestionar_contenido())`, NOT the `qual = true` of every sibling content table. If copied as `USING (true)`, every draft leaks to anonymous visitors.
  **CRITICAL — the view must be `security_invoker = false`:** the default in newer Postgres is `true`, which would re-trigger `profiles` RLS and blank the author.
- **Accept:**
  - File exists at `db/2026-06-15_011_publicaciones.sql` with house header banner + ROLLBACK section.
  - All 13 columns, the slug UNIQUE constraint (guarded by `pg_constraint`), all 5 indexes (no second unique slug index), the `set_updated_at` fn + trigger, RLS enabled, 4 policies, and the `v_autores_publicos` view (`security_invoker = false`, granted to `anon, authenticated`) are present.
  - The SELECT policy reads `estado = 'publicado' OR public.puede_gestionar_contenido()` — verified by eye, NOT `USING (true)`.
  - `puede_gestionar_contenido()` is referenced, never redefined.
  - `GRANT EXECUTE ON FUNCTION public.puede_gestionar_contenido() TO anon` is present (step 8).
  - Confirm anon can SELECT the published feed even when draft rows exist, with NO function-permission error.
- **Blocks:** S1-T03
- **Done:**

### S1-T02 — Write migration `db/2026-06-15_012_storage_publicaciones.sql` (bucket + storage.objects policies)
- **Req:** ST1, ST2
- **Files:** `db/2026-06-15_012_storage_publicaciones.sql` (new)
- **Work:** Write a SEPARATE migration file (isolated from `011` so a `storage`-schema owner-perms failure cannot block the table). House header banner + idempotency + ROLLBACK. Ordered steps:
  ```
  1.  INSERT INTO storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
        VALUES ('publicaciones','publicaciones', true,
                ARRAY['image/png','image/jpeg','image/webp','image/svg+xml'], 5242880)
        ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public,
          allowed_mime_types = EXCLUDED.allowed_mime_types,
          file_size_limit = EXCLUDED.file_size_limit;   -- 5 MB = 5242880 bytes
  2.  storage.objects policies (DROP POLICY IF EXISTS each first), reusing public.puede_gestionar_contenido():
        SELECT "lectura publica imagenes publicaciones"   TO anon, authenticated
          USING (bucket_id = 'publicaciones')
        INSERT "admin sube imagenes publicaciones"        TO authenticated
          WITH CHECK (bucket_id = 'publicaciones' AND public.puede_gestionar_contenido())
        UPDATE "admin actualiza imagenes publicaciones"   TO authenticated
          USING (bucket_id = 'publicaciones' AND public.puede_gestionar_contenido())
          WITH CHECK (bucket_id = 'publicaciones' AND public.puede_gestionar_contenido())
        DELETE "admin borra imagenes publicaciones"       TO authenticated
          USING (bucket_id = 'publicaciones' AND public.puede_gestionar_contenido())
  -- ROLLBACK: DROP the 4 storage.objects policies; DELETE FROM storage.buckets WHERE id = 'publicaciones'.
  ```
  **GROUND-TRUTH GAP:** creating policies on schema `storage` MAY require owner perms the MCP role lacks. If the policy DDL fails at apply (S1-T04), fall back to creating the bucket + policies via the Supabase dashboard and record the equivalent SQL in this file for parity.
- **Accept:**
  - File exists at `db/2026-06-15_012_storage_publicaciones.sql`, separate from `011`, with banner + ROLLBACK.
  - Bucket insert is `public = true`, MIME `image/png,image/jpeg,image/webp,image/svg+xml`, size limit `5242880`.
  - All 4 `storage.objects` policies scoped to `bucket_id = 'publicaciones'`, reusing `puede_gestionar_contenido()` for write policies.
  - Policy names follow the house convention `"lectura publica imagenes publicaciones"` / `"admin sube|actualiza|borra imagenes publicaciones"`.
- **Parallel with:** S1-T01
- **Done:**

### S1-T03 — [USER-GATED] Apply migration `011` via Supabase MCP (table + indexes + trigger + RLS + view)
- **Req:** DB1, DB2, DB3, RLS1, RLS2, AU1
- **Files:** DB only (no code file)
- **Work:** Present the SQL of `db/2026-06-15_011_publicaciones.sql` to the user for review. On explicit OK, apply via Supabase MCP (`apply_migration`). Verify:
  - `\d public.publicaciones` shows all 13 columns with correct types/nullability/defaults; `estado` CHECK present; `slug` UNIQUE present.
  - All 5 expected indexes exist (`idx_publicaciones_estado`, two partial FK indexes with `WHERE ... IS NOT NULL`, `idx_publicaciones_autor_id`, `idx_publicaciones_estado_created`); no second standalone unique index on `slug`.
  - Trigger `publicaciones_set_updated_at` and function `public.set_updated_at()` exist in `pg_trigger` / `pg_proc`.
  - RLS is enabled; 4 policies present with the SELECT policy qual = `(estado = 'publicado' OR puede_gestionar_contenido())` (confirm via `pg_policies`, NOT `qual = true`).
  - View `public.v_autores_publicos` exists; inspect `pg_class.reloptions` (e.g. `SELECT reloptions FROM pg_class WHERE relname = 'v_autores_publicos'`) to confirm `security_invoker=false` is present in the options array (NOT `relrowsecurity`, which is a table-level attribute). Authoritative functional gate: an anonymous session querying `v_autores_publicos` returns a non-blank `(id, nombre, apellido)` row without an RLS error; `SELECT` granted to `anon, authenticated`.
- **Accept:** All verify checks pass against prod. Table, indexes, trigger, RLS policies, and view exist as specified.
- **Depends on:** S1-T01
- **Done:**

### S1-T04 — [USER-GATED] Apply migration `012` via Supabase MCP (Storage bucket + policies)
- **Req:** ST1, ST2
- **Files:** DB only (no code file)
- **Work:** Present the SQL of `db/2026-06-15_012_storage_publicaciones.sql` to the user. On explicit OK, apply via Supabase MCP. If the `storage.objects` policy DDL fails on owner perms, fall back to the Supabase dashboard for bucket + policy creation and record the equivalent SQL in `012` for parity (per the ground-truth gap). Verify:
  - `SELECT id, public, allowed_mime_types, file_size_limit FROM storage.buckets WHERE id = 'publicaciones'` → `public = true`, MIME set, `file_size_limit = 5242880`.
  - The 4 `storage.objects` policies exist in `pg_policies` scoped to the `publicaciones` bucket.
- **Accept:** Bucket exists and is public with the MIME + size constraints; the 4 policies exist (via SQL or dashboard fallback with SQL recorded for parity).
- **Depends on:** S1-T02
- **Parallel with:** S1-T03
- **Done:**

### S1-T05 — [USER-GATED] Run `npm run gen:types` and commit regenerated `database.types.ts`
- **Req:** SV1
- **Files:** `src/types/database.types.ts`
- **Work:** Run `npm run gen:types` against prod ref `othwyesmfpjaykbdwxrh` (or, if the CLI is not authenticated in this environment, regenerate via the Supabase MCP `generate_typescript_types` tool). Commit the regenerated file in this slice's changeset.
  **GROUND-TRUTH GAP:** confirm `gen:types` is authenticated against the prod ref before depending on the regenerated file; otherwise the user runs it or the MCP tool is used.
- **Accept:**
  - `database.types.ts` contains `Tables<'publicaciones'>` with the 13 columns and `estado` typed as the `'borrador' | 'publicado'` literal union.
  - The file reflects the `v_autores_publicos` view (if the generator emits views).
  - File committed in the same changeset.
- **Depends on:** S1-T03
- **Done:**

### S1-T06 — [VERIFY Slice 1] manual RLS check + lint + tsc -b
- **Req:** RLS2, XT2
- **Files:** all (build), DB (manual RLS check)
- **Work:**
  1. **Manual RLS check (the security gate):** insert one `borrador` row and one `publicado` row (admin session). Then:
     - anon key SELECT from `publicaciones` → returns ONLY the `publicado` row; the `borrador` row is ABSENT.
     - authenticated non-admin SELECT → returns ONLY the `publicado` row.
     - admin SELECT → returns BOTH rows.
     - anon query of `v_autores_publicos` for the author id → returns a non-blank `(id, nombre, apellido)` row (confirms `security_invoker = false`).
  2. `npm run lint && npx tsc -b` — both exit 0 (the regenerated types must compile).
- **Accept:** All RLS checks pass (anon/non-admin see no `borrador`; admin sees all; anon resolves a non-blank author). Anon can SELECT the published feed even when draft rows exist, with NO function-permission error on `puede_gestionar_contenido()`. Both `lint` and `tsc -b` exit 0.
- **Depends on:** S1-T04, S1-T05
- **Done:**

---

## Slice 2 — Public Read Path (PR-2 of chain)

**Branch:** `slice/publicaciones-read` (child of `feat/publicaciones`, targeting PR #1's branch)
**Pre-condition:** Slice 1 merged; `database.types.ts` regenerated (S1-T05 done) with `Tables<'publicaciones'>` available.
**Gate:** `npm run lint` + `npx tsc -b` exit 0 + manual checks on `/blog`, `/blog/:slug`, a tema page, an SI detail page.

### S2-T01 — Add `Publicacion` DTO to `src/types/dtos.ts`
- **Req:** SV1
- **Files:** `src/types/dtos.ts`
- **Work:** Add, mirroring the existing `ClasificacionSI` narrowing (reuse the existing `Enlace` type — do NOT redefine it):
  ```ts
  export type Publicacion = Omit<Tables<'publicaciones'>, 'enlaces'> & { enlaces: Enlace[] }
  ```
- **Accept:** `dtos.ts` exports `Publicacion`; `Publicacion['enlaces']` is typed `Enlace[]` (not `Json`); `tsc -b` on `dtos.ts` alone passes.
- **Done:**

### S2-T02 — Add read functions to `src/services/publicacionesService.ts` (new)
- **Req:** SV2, AU2
- **Files:** `src/services/publicacionesService.ts` (new)
- **Work:** Create a flat module of async functions (no classes), mirroring `temasService` / `clasificacionesService`. Export:
  - `listarPublicaciones()` — `from('publicaciones').select(...).eq('estado','publicado').order('created_at', { ascending: false })` (feed; served by `idx_publicaciones_estado_created`).
  - `obtenerPublicacion(slug)` — single by slug with `.maybeSingle()` → returns `null` for an absent slug (mirror `temasService.obtenerTema`), does NOT throw.
  - `listarPorTema(temaId)` — `eq('estado','publicado').eq('tema_id', temaId).order('created_at', desc)`.
  - `listarPorClasificacion(clasifId)` — `eq('estado','publicado').eq('clasificacion_si_id', clasifId).order('created_at', desc)`.
  - Copy `parseEnlaces` from `clasificacionesService` (returns `[]` on malformed JSON) and apply it at the read boundary to map each row to `Publicacion`.
  - Resolve the author display name by querying/joining `v_autores_publicos` (NOT a direct `profiles` join); compose `nombre || ' ' || apellido` trimmed, falling back to the literal `"Equipo ia-dex"` when both are NULL (per AU2).
- **Accept:**
  - Feed returns only `estado='publicado'` rows, newest first.
  - `obtenerPublicacion('no-existe')` resolves to `null` (no throw).
  - Malformed `enlaces` parses to `[]`.
  - Author name resolves from `v_autores_publicos` with the `"Equipo ia-dex"` fallback when nombre+apellido are NULL.
- **Depends on:** S2-T01
- **Done:**

### S2-T03 — Add read hooks (`usePublicaciones`, `usePublicacion`, `usePublicacionesPorTema`, `usePublicacionesPorClasificacion`)
- **Req:** SV3
- **Files:** `src/hooks/usePublicaciones.ts`, `src/hooks/usePublicacion.ts`, `src/hooks/usePublicacionesPorTema.ts`, `src/hooks/usePublicacionesPorClasificacion.ts` (all new)
- **Work:** Each is a `useReducer` state machine returning `{ data, loading, error, refetch }`, mirroring `useTemas` / `useTema`:
  - `usePublicaciones()` — list feed, no `'pending'` action (mirror `useTemas`).
  - `usePublicacion(slug)` — single; MUST include a `'pending'` action AND include `slug` in the effect deps so navigating between slugs resets stale `data` (mirror `useTema`).
  - `usePublicacionesPorTema(temaId)` — filtered list; skip-variant when `temaId` is undefined (success with empty array, no fetch — mirror `useSoftwarePorTema`).
  - `usePublicacionesPorClasificacion(clasifId)` — filtered list; same skip-variant on undefined.
- **Accept:**
  - `usePublicacion` re-enters loading and refetches when `slug` changes (prior data does not linger).
  - `refetch()` re-runs the underlying service call and updates `data`.
  - The two filtered hooks return an empty array immediately (no fetch) when their id is undefined.
- **Depends on:** S2-T02
- **Done:**

### S2-T04 — Build `BlogPage.tsx` + `PublicacionDetallePage.tsx` (D4 state quartet)
- **Req:** UI1
- **Files:** `src/pages/BlogPage.tsx`, `src/pages/PublicacionDetallePage.tsx` (both new)
- **Work:**
  - `BlogPage` — feed via `usePublicaciones()`; render the D4 state quartet (loading / error+retry / not-found-or-empty / data); list published publicaciones newest-first, each linking to `/blog/:slug`.
  - `PublicacionDetallePage` — single by `:slug` via `usePublicacion(slug)`; D4 quartet; treat a `null` result as the **not-found** state. Render `cuerpo` as plain text with `whitespace-pre-wrap` (NO markdown). When present, render `video_url` via `VideoEmbed` + `toEmbedUrl`; render `imagen_url` directly in `<img src>` with `object-cover`, BYPASSING the `useImageOk` 200px gate (author-curated). Display the author name from the Capability 4 composition.
- **Accept:**
  - `/blog` lists all published, newest-first; drafts absent.
  - `/blog/nope` (unknown slug) shows the not-found state (no crash, no blank data view).
  - `cuerpo` preserves line breaks via `whitespace-pre-wrap`; no markdown interpreted.
  - `imagen_url` renders without the `useImageOk` gate; `video_url` renders via `VideoEmbed`.
- **Depends on:** S2-T03
- **Done:**

### S2-T05 — Wire routes + nav (`AppRouter`, `navLinks`, `navIcons`)
- **Req:** UI2
- **Files:** `src/routes/AppRouter.tsx`, `src/components/layout/navLinks.ts`, `src/components/layout/navIcons.tsx`
- **Work:**
  - `AppRouter.tsx` — add, as flat children under `AppLayout`: `{ path: 'blog', element: <BlogPage/> }` and `{ path: 'blog/:slug', element: <PublicacionDetallePage/> }`.
  - `navLinks.ts` — add `{ to: '/blog', label: 'Blog' }`.
  - `navIcons.tsx` — add a `/blog` glyph entry in `DEST_ICONS`.
- **Accept:** `/blog` and `/blog/:slug` render inside `AppLayout`; the nav shows a "Blog" link with a glyph.
- **Depends on:** S2-T04
- **Done:**

### S2-T06 — Integrate "Contenido didáctico" section in `TemaPage.tsx`
- **Req:** UI3
- **Files:** `src/pages/TemaPage.tsx`
- **Work:** After the hero (~line 105), add a "Contenido didáctico" `<section>` fed by `usePublicacionesPorTema(tema.data?.id)`, mirroring the existing `useSoftwarePorTema` consumption. Render the section ONLY when there is at least one published publicacion for that tema (no empty container); each item links to its `/blog/:slug` detail page.
- **Accept:**
  - A tema with ≥1 published publicacion shows a "Contenido didáctico" section listing those items, each linking to `/blog/:slug`.
  - A tema with no published publicaciones shows no section (no empty container).
  - `tsc -b` passes.
- **Depends on:** S2-T03
- **Parallel with:** S2-T07
- **Done:**

### S2-T07 — Integrate content section in `ClasificacionDetallePage.tsx`
- **Req:** UI4
- **Files:** `src/pages/ClasificacionDetallePage.tsx`
- **Work:** After the ejemplos/enlaces column (~line 170), add an analogous `<section>` fed by `usePublicacionesPorClasificacion(data?.id)`. Render ONLY when there is at least one published publicacion for that SI category (no empty container); each item links to its `/blog/:slug` detail page.
- **Accept:**
  - An SI category with ≥1 published publicacion shows a content section after the ejemplos/enlaces column, each item linking to `/blog/:slug`.
  - An SI category with no published publicaciones shows no section.
  - `tsc -b` passes.
- **Depends on:** S2-T03
- **Parallel with:** S2-T06
- **Done:**

### S2-T08 — [VERIFY Slice 2] lint + tsc -b + manual visual checks
- **Req:** XT2, UI1–UI4
- **Files:** all
- **Work:**
  1. `npm run lint && npx tsc -b` — both exit 0.
  2. Manual navigation:
     - `/blog` → published feed, newest-first, no drafts.
     - `/blog/:slug` → detail with cuerpo (whitespace-pre-wrap), author name, image/video when present.
     - `/blog/<unknown>` → not-found state.
     - a tema with content → "Contenido didáctico" section; a tema without → no section.
     - an SI detail with content → content section; without → no section.
- **Accept:** All manual checks pass; both `lint` and `tsc -b` exit 0.
- **Depends on:** S2-T05, S2-T06, S2-T07
- **Done:**

---

## Slice 3 — Admin Write Path (PR-3 of chain)

**Branch:** `slice/publicaciones-admin` (child of `slice/publicaciones-read`, targeting PR #2's branch)
**Pre-condition:** Slice 2 merged; read service, hooks, pages, routes, and the `Publicacion` DTO are available.
**Gate:** `npm run lint` + `npx tsc -b` exit 0 + manual create→upload→publish→edit→delete flow.

### S3-T01 — Add `src/lib/slug.ts` (runtime slug helper)
- **Req:** SG1
- **Files:** `src/lib/slug.ts` (new)
- **Work:** Net-new `slugify(titulo: string): string` — lowercase → strip accents (NFD normalize + remove diacritics) → replace non-alphanumeric runs with `-` → collapse repeated dashes → trim leading/trailing dashes. No DB trigger; this is the form-side generator.
- **Accept:**
  - `slugify("¿Qué es la IA Débil?")` → `"que-es-la-ia-debil"` (lowercase, accents stripped, dashes collapsed, no leading/trailing dash).
  - Output is kebab-case ASCII alphanumeric + single dashes only.
- **Done:**

### S3-T02 — Add guarded write functions to `publicacionesService.ts` (with collision retry)
- **Req:** SV4, SG1
- **Files:** `src/services/publicacionesService.ts`
- **Work:** Add write functions, each guarded by `auth.getUser()` throwing `'Requiere sesión'` when there is no session (pattern from `foroService`; RLS is the authoritative enforcement):
  - `crear(input: TablesInsert<'publicaciones'>)` — insert + return the row. On a UNIQUE(slug) violation, retry with a numeric suffix (`-2`, `-3`, …) until it succeeds.
  - `editar(id: string, patch: TablesUpdate<'publicaciones'>)` — update by id.
  - `eliminar(id: string)` — delete by id.
  - `subirImagen(publicacionId: string, file: File)` — `supabase.storage.from('publicaciones').upload('${publicacionId}/${filename}', file, { upsert: true })` then `getPublicUrl(path)`; return the public URL (used to set `imagen_url`).
- **Accept:**
  - `crear(...)` without a session throws `'Requiere sesión'` before hitting the network.
  - With an admin session, `crear(...)` inserts and returns the row.
  - A slug collision retries and persists `"ia-debil-2"` (then `"ia-debil-3"` on a further collision).
  - `subirImagen` uploads to `publicaciones/{id}/{filename}` with `upsert: true` and returns the `getPublicUrl` value.
- **Depends on:** S3-T01
- **Done:**

### S3-T03 — Add `RequireAdmin` route guard
- **Req:** ADM1
- **Files:** `src/components/auth/RequireAdmin.tsx` (new, or alongside existing auth components)
- **Work:** Build a `RequireAdmin` route guard wrapping the `/admin/publicaciones` subtree, using `useIsAdmin()` (today dead code — wired in here). Non-admin users reaching an admin route are redirected or shown a denied state, never the admin UI. Document in a code comment that this is a UI convenience only (spoofable client-side); RLS (`puede_gestionar_contenido()`) is the authoritative enforcement.
- **Accept:**
  - A user for whom `useIsAdmin()` is false navigating to `/admin/publicaciones` does NOT see the admin UI (redirect or denied state).
  - A user for whom `useIsAdmin()` is true sees the admin list UI.
- **Depends on:** S2 (read hooks/service available)
- **Done:**

### S3-T04 — Build `/admin/publicaciones` CRUD UI (list/create/edit/delete + file input + video validation)
- **Req:** ADM2, ADM4, ADM5, SG1
- **Files:** `src/pages/admin/PublicacionesAdminPage.tsx` (list) + `src/pages/admin/PublicacionFormPage.tsx` (create/edit) (new), plus the routes under `RequireAdmin` in `AppRouter.tsx`
- **Work:**
  - List view: all publicaciones (admin sees drafts too, via RLS), with create / edit / delete actions wired to the write service.
  - Form (controlled inputs + `useState`, no forms library) covering `titulo`, `slug` (pre-filled from `titulo` via `slugify`, override-able — SG1), `cuerpo` (optional — a draft can save with empty body), `imagen_url` (via the file-input upload — ADM4), `video_url`, `enlaces`, `tema_id`, `clasificacion_si_id`, and `estado` (`borrador` / `publicado`).
  - **First `<input type="file">`** in the app: on file select, call `publicacionesService.subirImagen(...)` and set `imagen_url` to the returned public URL. Path `publicaciones/{publicacion_id}/{filename}`, `upsert: true` (ADM4).
  - **video_url validation:** validate with `toEmbedUrl` (from `lib/youtube.ts`); show an inline error and block save when it returns null (ADM5) — `VideoEmbed` silently renders nothing on a bad URL.
  - Add routes under `RequireAdmin`: `{ path: 'admin/publicaciones' }` (list), `{ path: 'admin/publicaciones/nuevo' }` and `{ path: 'admin/publicaciones/:id/editar' }` (form).
- **Accept:**
  - Create a draft with empty `cuerpo` and `estado='borrador'` → row created, NOT on the public `/blog` feed.
  - Edit a draft to `estado='publicado'` → appears on `/blog`.
  - Delete removes the publicacion from the admin list and the public feed.
  - File select uploads and sets `imagen_url` to the `getPublicUrl` value.
  - A `video_url` for which `toEmbedUrl` returns null shows an inline error and blocks save; a valid YouTube URL saves with no error.
  - Slug pre-fills from `titulo` and is override-able.
- **Depends on:** S3-T02, S3-T03
- **Done:**

### S3-T05 — [VERIFY Slice 3] lint + tsc -b + manual create→publish→edit→delete flow
- **Req:** XT2, ADM1, ADM2, ADM4, ADM5, SV4, SG1
- **Work:**
  1. `npm run lint && npx tsc -b` — both exit 0.
  2. Manual flow:
     - non-admin → `/admin/publicaciones` is blocked (redirect/denied).
     - admin → create draft (empty body) → not on `/blog`.
     - upload an image → `imagen_url` set, renders on detail.
     - enter a bad `video_url` → inline error, save blocked; enter a valid one → saves.
     - publish the draft → appears on `/blog`; edit it → `updated_at` bumps; delete it → gone from list and feed.
     - create two publicaciones whose titles slugify identically → second persists with `-2`.
- **Accept:** All manual flow steps pass; both `lint` and `tsc -b` exit 0.
- **Depends on:** S3-T04
- **Done:**

---

## Slice 4 — Seed Example Content (PR-4 of chain, OPTIONAL) `[AUTHOR-WITH-USER]`

**Branch:** `slice/publicaciones-seed` (child of `slice/publicaciones-admin`, targeting PR #3's branch)
**Pre-condition:** Slice 1 applied (table exists). Optional — the feature functions without it.
**Gate:** `node db/seed-to-sql.mjs` runs without error; reseed via Supabase MCP only after explicit OK `[USER-GATED]`.

### S4-T01 — [AUTHOR-WITH-USER] Add a `publicaciones` array to `db/seed-content.json`
- **Req:** DB1, XT1
- **Files:** `db/seed-content.json`
- **Work:** Co-author with the user a top-level `publicaciones` array of example posts. Each entry: `{ slug, titulo, cuerpo, imagen_url?, video_url?, enlaces?, tema_slug?, clasificacion_slug?, estado }`. Use `tema_slug` / `clasificacion_slug` (resolved to ids at codegen) for FK-linked examples; leave both absent for pure blog posts. `estado` is `'borrador'` or `'publicado'`. Content in Spanish (XT1).
- **Accept:** `seed-content.json` has a `publicaciones` key with ≥1 entry; each has `slug`, `titulo`, and a valid `estado`; FK slugs (when present) reference existing tema/clasificacion slugs.
- **Done:**

### S4-T02 — Add a `publicaciones` codegen section to `db/seed-to-sql.mjs`
- **Req:** DB1, SG1
- **Files:** `db/seed-to-sql.mjs`
- **Work:** Add a codegen section emitting, per publicacion entry: `INSERT INTO publicaciones (slug, titulo, cuerpo, imagen_url, video_url, enlaces, tema_id, clasificacion_si_id, estado)` with `tema_id`/`clasificacion_si_id` resolved via `(SELECT id FROM temas WHERE slug = ...)` / `(SELECT id FROM clasificaciones_si WHERE slug = ...)` subqueries (NULL when the slug is absent), `enlaces` as a `jsonb` literal, and `ON CONFLICT (slug) DO NOTHING` (mirror the existing temas/clasificaciones insert blocks). `autor_id` is left to its `auth.uid()` default / NULL in seed.
- **Accept:**
  - `node db/seed-to-sql.mjs` runs without error.
  - Generated `db/seed.sql` contains an `INSERT INTO publicaciones` block with FK subquery resolution and `ON CONFLICT (slug) DO NOTHING`.
- **Depends on:** S4-T01
- **Done:**

### S4-T03 — [USER-GATED] Regenerate `db/seed.sql` and (optionally) reseed via Supabase MCP
- **Req:** DB1
- **Files:** `db/seed.sql`
- **Work:** Run `node db/seed-to-sql.mjs` to regenerate `db/seed.sql`; inspect the `publicaciones` block. If the user wants the examples live, present the insert SQL and apply via Supabase MCP only after explicit OK.
- **Accept:** `db/seed.sql` contains the `publicaciones` inserts; file committed. If applied: `SELECT count(*) FROM publicaciones` reflects the seeded examples.
- **Depends on:** S4-T02
- **Done:**

---

## Dependency Graph

```
SLICE 1 — DB FOUNDATION [USER-GATED]  (tracker: feat/publicaciones)
S1-T01 (migration 011) ─────────────────┐
S1-T02 (migration 012) ──────────────┐  │
                                     │  ↓
                          S1-T04 ◀───┘  S1-T03 [USER-GATED apply 011]
                          [USER-GATED      │
                           apply 012]      ↓
                              │         S1-T05 [USER-GATED gen:types]
                              └────────────┤
                                           ↓
                                        S1-T06 [VERIFY: manual RLS + lint + tsc -b]

SLICE 2 — PUBLIC READ PATH  (child PR, targets PR #1 branch)
S1-T05 ─────────────────────────────────────────────────┐
                                                         ↓
S2-T01 (Publicacion DTO) → S2-T02 (read service) → S2-T03 (4 hooks)
                                                         │
                                          ┌──────────────┼───────────────┐
                                          ↓              ↓               ↓
                                  S2-T04 (pages)   S2-T06 (TemaPage)  S2-T07 (ClasifDetalle)
                                          ↓
                                  S2-T05 (routes + nav)
                                          │
        S2-T04 + S2-T05 + S2-T06 + S2-T07 → S2-T08 [VERIFY: lint + tsc -b + manual]

SLICE 3 — ADMIN WRITE PATH  (child PR, targets PR #2 branch)
S3-T01 (src/lib/slug.ts) → S3-T02 (write service + collision retry)
S3-T03 (RequireAdmin guard)
        S3-T02 + S3-T03 → S3-T04 (/admin/publicaciones CRUD + file input + video validation)
                                  ↓
                          S3-T05 [VERIFY: lint + tsc -b + manual flow]

SLICE 4 — SEED EXAMPLE CONTENT [AUTHOR-WITH-USER] (optional child PR)
S4-T01 [AUTHOR-WITH-USER] → S4-T02 (seed-to-sql.mjs) → S4-T03 [USER-GATED reseed]
```

---

## Review Workload Forecast

### Slice 1 — DB Foundation

| Component | Files | Estimated lines changed |
|---|---|---|
| Migration `011` — table (13 cols) + slug UNIQUE guard + 5 indexes + `set_updated_at` fn/trigger + 4 RLS policies + `v_autores_publicos` view + ROLLBACK | `db/2026-06-15_011_publicaciones.sql` (new) | ~160–220 |
| Migration `012` — bucket insert + 4 `storage.objects` policies + ROLLBACK | `db/2026-06-15_012_storage_publicaciones.sql` (new) | ~50–80 |
| `database.types.ts` — regenerated (new table + view) | generated | ~40–60 |
| **Slice 1 total** | **2 hand-written SQL + 1 generated** | **~250–360 lines** |

**Slice 1 budget verdict:** AT/NEAR budget — the hand-written SQL (~210–300) plus the generated types diff lands near 400 but the generated `database.types.ts` is a generated artifact and the migration files cannot be split (atomic DDL). Reviewer attention concentrates on the RLS2 SELECT policy and the `security_invoker = false` view. **Within reviewable budget** for the hand-authored portion.

### Slice 2 — Public Read Path

| Component | Files | Estimated lines changed |
|---|---|---|
| `dtos.ts` — 1 DTO | `src/types/dtos.ts` | ~3–5 |
| `publicacionesService.ts` — 4 read fns + `parseEnlaces` + author resolution | new file | ~90–130 |
| 4 read hooks | `usePublicaciones`, `usePublicacion`, `usePublicacionesPorTema`, `usePublicacionesPorClasificacion` (new) | ~120–160 |
| `BlogPage` + `PublicacionDetallePage` — D4 quartet | new files | ~140–200 |
| routes + nav | `AppRouter.tsx`, `navLinks.ts`, `navIcons.tsx` | ~15–25 |
| `TemaPage` + `ClasificacionDetallePage` sections | 2 files (additive) | ~40–70 |
| **Slice 2 total** | **~11 files** | **~408–590 lines** |

**Slice 2 budget verdict:** AT/OVER budget (~408–590). Mostly net-new additive files (each independently reviewable); the new pages carry the bulk. If the diff lands above 400, it is concentrated in clearly-separable new files — acceptable as one PR or sub-splittable (service+hooks vs pages+integration) if the reviewer prefers.

### Slice 3 — Admin Write Path

| Component | Files | Estimated lines changed |
|---|---|---|
| `src/lib/slug.ts` — slugify | new file | ~25–40 |
| `publicacionesService.ts` — 4 write fns + collision retry + upload helper | existing file (additive) | ~90–140 |
| `RequireAdmin` guard | new file | ~25–40 |
| `/admin/publicaciones` CRUD UI — list + form + file input + video validation | 2 new page files + routes | ~330–460 |
| **Slice 3 total** | **~6 files** | **~470–680 lines** |

**Slice 3 budget verdict:** OVER budget (~470–680). The admin CRUD form is the heaviest single artifact (first file input + first full form). Acceptable as one PR given it is net-new, self-contained admin UI; sub-splittable (slug+write-service+guard as one PR, the CRUD UI as a follow-up) if the reviewer wants tighter slices.

### Overall Summary

| Slice | Files | Estimated lines | Budget verdict |
|---|---|---|---|
| Slice 1 — DB Foundation | 3 | ~250–360 | AT/NEAR (SQL atomic + generated types) |
| Slice 2 — Public Read Path | ~11 | ~408–590 | AT/OVER (additive new files) |
| Slice 3 — Admin Write Path | ~6 | ~470–680 | OVER (net-new admin CRUD) |
| Slice 4 — Seed (optional) | 3 | ~60–140 | LOW |
| **Total** | **~23** | **~1188–1770 lines** | |

**400-line budget risk:** HIGH for the overall change; Slice 1 near budget, Slices 2 and 3 at/over budget individually (each net-new and separable).
**Chained PRs recommended:** Yes — `chain_strategy = feature-branch-chain` on tracker `feat/publicaciones`; each slice is a reviewable child PR, only the tracker merges to main.
**Decision needed before apply:** `chain_strategy` confirmation (recommended `feature-branch-chain`) + the Slice 1 prod-apply gate (migrations `011`/`012` are `[USER-GATED]` — explicit user OK required before each MCP apply). Two further ground-truth gaps to confirm at apply: Storage-policy owner perms (migration `012`) and `gen:types` CLI auth against prod ref `othwyesmfpjaykbdwxrh` (S1-T05).
