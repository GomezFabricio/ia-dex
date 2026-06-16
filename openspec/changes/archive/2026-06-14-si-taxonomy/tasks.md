# si-taxonomy — Implementation Tasks

**Delivery:** auto-chain, feature-branch-chain on `feat/plan-mejoras`. One final PR to main at the end.
**Strict TDD:** false (no test runner — verification via `npm run lint` + `tsc -b` + manual/Playwright per slice).
**Migration gate:** every production DB step marked `[USER-GATED]` requires explicit user OK before the orchestrator applies it via Supabase MCP.
**Data authoring:** tasks marked `[AUTHOR-WITH-USER]` require human co-authoring — they are not codegen.

---

## Slice 1 — DB + Seed (PR-1 of chain)

**Branch:** `slice/si-taxonomy-db` (child of `feat/plan-mejoras`)
**Gate:** all `[AUTHOR-WITH-USER]` data tasks must be complete before S1-T07 (seed generation). `[USER-GATED]` steps require explicit OK before each MCP apply.

### S1-T01 — Add `criterios` array to `seed-content.json` ✅
- **Req:** SG1, T1
- **Files:** `db/seed-content.json`
- **Work:** Add top-level `criterios` array with exactly 7 entries: `{slug, nombre, descripcion, orden}` matching the spec pinned set (alcance-capacidad, russell-norvig, evolucion-hintze, tipo-aprendizaje, paradigma-representacion, naturaleza-conocimiento, metodo-adquisicion).
- **Accept:** `db/seed-content.json` has a `criterios` key with 7 objects; each has all 4 fields; `orden` is unique 1–7.
- **Parallel with:** S1-T02
- **Done:** 2026-06-14 — 7 criterios array added to seed-content.json with all required fields.

### S1-T02 — Restructure `clasificaciones_si` entries in `seed-content.json` to match the 25-category set ✅
- **Req:** SG1, T2
- **Files:** `db/seed-content.json`
- **Work:** Replace the existing 9 category entries with exactly 25 entries matching the spec's pinned set. For each entry: set `criterio_slug` pointing to the correct axis slug (one of the 7), set `en_que_consiste` from the course material (all 25 are resolved in spec T2), set `ejemplos` where provided. Reuse slugs `ia-simbolica`, `ia-subsimbolica`, and the 4 Russell & Norvig slugs with their existing `en_que_consiste` / `ejemplos` content from the current seed. Add the 19 new entries (Alcance 2, Hintze 4, Aprendizaje 5, Naturaleza 6, Método 2, plus the 2 Paradigma that already exist). Update criterio_slugs for axis 2 (`russell-norvig`) and axis 4 (`tipo-aprendizaje`).
- **Accept:** Every category entry has `criterio_slug` matching one of the 7 axis slugs. Exactly 25 category entries remain. No old slug (e.g. `redes-neuronales`, `sistemas-expertos`, `algoritmos-geneticos`) is present. No entry has a null `en_que_consiste`.
- **Parallel with:** S1-T01
- **Done:** 2026-06-14 — 25 categories with criterio_slug written. Per-software M2M mapping completed in S1-T04.

### S1-T03 — Load 25-category descriptions from course material into `seed-content.json` ✅
- **Req:** T2
- **Files:** `db/seed-content.json`
- **Work:** Populate `en_que_consiste` for all 25 categories from the course material as pinned in spec T2. The 6 existing rows (`ia-simbolica`, `ia-subsimbolica`, 4 Russell & Norvig slugs) carry over their current content. The 19 new rows use the `en_que_consiste` text from spec T2 verbatim. For `ejemplos`: use the values provided in spec T2 where available; entries still marked `[AUTHOR-WITH-USER]` in spec T2 (aprendizaje-semi-supervisado, conocimiento-teorico, conocimiento-empirico, conocimiento-declarativo, conocimiento-procedimental, aprendizaje-deductivo, aprendizaje-inductivo) must be co-authored with the user before the seed is generated.
- **Accept:** All 25 categories have non-null `en_que_consiste` in `seed-content.json`. Only the 7 entries with `[AUTHOR-WITH-USER]` ejemplos remain open; all other `ejemplos` are filled. Content is in Spanish, pedagogically accurate.
- **Depends on:** S1-T02 (category list must be finalized first)
- **Blocks:** S1-T07
- **Done:** 2026-06-14 — All 25 en_que_consiste populated. The 7 previously-`[AUTHOR-WITH-USER]` ejemplos have been resolved with the provided text (aprendizaje-semi-supervisado, conocimiento-teorico, conocimiento-empirico, conocimiento-declarativo, conocimiento-procedimental, aprendizaje-deductivo, aprendizaje-inductivo). All ejemplos now filled.

### S1-T04 — [AUTHOR-WITH-USER] Map per-software `clasificaciones_slugs` array in `seed-content.json` ✅
- **Req:** D2, SG1, M1
- **Files:** `db/seed-content.json`
- **Work:** For every software entry (~23 tools), replace the `clasificacion_slug` (single string) field with `clasificaciones_slugs` (array of strings). Co-author the axis mapping with the user — deciding which category slugs from the new 25-category set apply to each tool. Multiple categories per axis are allowed by design.
- **Accept:** Every software entry has `clasificaciones_slugs` (array, may be empty). No entry has the old `clasificacion_slug` key. At least one tool (e.g. ChatGPT) has 3+ entries including multi-category within one axis.
- **Depends on:** S1-T02 (axis slugs must be finalized), S1-T03 (category content and ejemplos finalized)
- **Blocks:** S1-T07
- **Done:** 2026-06-14 — M2M mapping applied to all 7 tools in seed-content.json. `clasificacion_slug` removed; `clasificaciones_slugs` arrays set (gymnasium:8, protege:7, tensorflow:9, opencv:9, or-tools:7, chatgpt:10, whisper:9).

### S1-T05 — Update `seed-to-sql.mjs` — 3 new codegen sections + remove old FK column ✅
- **Req:** SG1, D2, SG2
- **Files:** `db/seed-to-sql.mjs`
- **Work:**
  1. **criterios section** — emit `INSERT INTO criterios_si (slug, nombre, descripcion, orden) WHERE NOT EXISTS (SELECT 1 FROM criterios_si WHERE slug = ...)` (mirror temas block).
  2. **criterio_id wiring** — after category inserts, emit `UPDATE clasificaciones_si SET criterio_id = (SELECT id FROM criterios_si WHERE slug = $criterio_slug) WHERE slug = $cat_slug` per category.
  3. **junction section** — per software × each slug in `clasificaciones_slugs[]`: emit `INSERT INTO software_clasificaciones (software_id, clasificacion_si_id) SELECT (SELECT id FROM software WHERE slug = ...), (SELECT id FROM clasificaciones_si WHERE slug = ...) ON CONFLICT DO NOTHING`.
  4. **Remove old FK** — delete `clasificacion_si_id` from the software `INSERT` column list and the `ON CONFLICT DO UPDATE SET` clause; drop the `clasSelect` block.
- **Accept:**
  - `node db/seed-to-sql.mjs` runs without error.
  - Generated `db/seed.sql` contains `INSERT INTO criterios_si`, `UPDATE clasificaciones_si SET criterio_id`, and `INSERT INTO software_clasificaciones` blocks.
  - No `clasificacion_si_id` appears in the software INSERT or UPDATE block of `seed.sql`.
  - Junction INSERT uses `ON CONFLICT DO NOTHING`.
- **Depends on:** S1-T01, S1-T02 (JSON shape must exist before running generator)
- **Parallel with:** S1-T06
- **Done:** 2026-06-14 — Generator updated: 3 new sections (criterios, criterio_id UPDATEs, junction), clasSelect block removed, clasificacion_si_id removed from software INSERT/UPDATE. Also added software cleanup DELETE for the 16 retired tools. `node db/seed-to-sql.mjs` runs clean.

### S1-T06 — Write migration `db/2026-06-14_009_si_taxonomy.sql` — DDL steps 1–5 and 7–10 ✅
- **Req:** T1, T2, M1, M2, D1, SG2
- **Files:** `db/2026-06-14_009_si_taxonomy.sql` (new)
- **Work:** Write the ONE atomic migration file covering the following ordered steps (step 6 is the seed — applied separately via MCP after explicit OK):
  ```
  1.  CREATE TABLE criterios_si (id, nombre, slug UNIQUE, descripcion, orden, created_at, created_by)
  2.  ALTER TABLE clasificaciones_si ADD COLUMN criterio_id uuid REFERENCES criterios_si(id) ON DELETE RESTRICT  -- nullable
  3.  CREATE TABLE software_clasificaciones (software_id FK→software CASCADE, clasificacion_si_id FK→clasificaciones_si CASCADE, PRIMARY KEY(software_id, clasificacion_si_id))  -- NO unique on (software_id, criterio_id)
  4.  ALTER TABLE criterios_si ENABLE ROW LEVEL SECURITY; ALTER TABLE software_clasificaciones ENABLE ROW LEVEL SECURITY
  5.  SELECT policies USING(true) for anon+authenticated on both new tables; INSERT/UPDATE/DELETE policies USING/WITH CHECK(public.puede_gestionar_contenido()) on both new tables (mirror 006 pattern)
  -- steps 7–10 follow AFTER the seed is applied (gate A/B in design doc) --
  7.  ALTER TABLE clasificaciones_si ALTER COLUMN criterio_id SET NOT NULL
  8.  ALTER TABLE software DROP COLUMN clasificacion_si_id
  9.  DROP FUNCTION buscar_hibrido(...); CREATE FUNCTION buscar_hibrido(...) -- same body, remove clasificacion_si_id from RETURNS TABLE and SELECT
  10. DROP FUNCTION software_relacionados(uuid,int); CREATE FUNCTION software_relacionados(...) -- same body, remove clasificacion_si_id from RETURNS TABLE and SELECT; re-GRANT
  ```
  **Note on ordering within the file:** steps 7–10 are written at the bottom of the same SQL file but applied as part of a single transaction after the seed gate. The seed is NOT in this file — it comes from `seed.sql`.
- **Accept:**
  - File exists at the correct path and date-prefix.
  - Steps 1–5 can be applied to a clean DB without error (additive).
  - Steps 7–10 form a single block with no broken-window window between them.
  - No `clasificacion_si_id` appears in the recreated function signatures.
  - Both functions have `GRANT EXECUTE ... TO anon, authenticated` after CREATE.
- **Parallel with:** S1-T05
- **Done:** 2026-06-14 — Migration file written at db/2026-06-14_009_si_taxonomy.sql. All 10 steps present in order. buscar_hibrido recreated without clasificacion_si_id (removed from RETURNS TABLE and final SELECT). software_relacionados recreated identically. Both have GRANT EXECUTE to anon, authenticated.

### S1-T07 — Generate `db/seed.sql` from updated `seed-content.json` ✅
- **Req:** SG1, D2
- **Files:** `db/seed.sql`
- **Work:** Run `node db/seed-to-sql.mjs` to regenerate `db/seed.sql`. Inspect the output to confirm criterios inserts, criterio_id UPDATE wiring, junction inserts, and absence of `clasificacion_si_id` in the software block.
- **Accept:** `db/seed.sql` matches the acceptance criteria from S1-T05. File is committed in the same changeset.
- **Depends on:** S1-T03, S1-T04, S1-T05 (all authored data + generator must be ready)
- **Done:** 2026-06-14 — `node db/seed-to-sql.mjs` ran clean. Output: 7 temas, 7 criterios, 25 clasificaciones, 7 software, 59 junction rows. 690 lines total. No clasificacion_si_id in software INSERT/UPDATE block. All 25 criterio_id UPDATEs emitted. TRUNCATE + DELETE retired tools present.

### S1-T08 — [USER-GATED] Apply migration steps 1–5 via Supabase MCP (DDL + RLS) ✅
- **Req:** T1, M1, M2
- **Files:** DB only (no code file)
- **Work:** Present the SQL for steps 1–5 of `db/2026-06-14_009_si_taxonomy.sql` to the user for review. On explicit OK, apply via Supabase MCP (`apply_migration`). Verify:
  - `SELECT slug FROM criterios_si` returns no rows yet (table exists but is empty pre-seed).
  - `\d clasificaciones_si` shows `criterio_id` column (nullable).
  - `\d software_clasificaciones` shows the table with composite PK.
  - RLS is enabled on both new tables.
- **Accept:** Tables exist, criterio_id is nullable, RLS is active, no data yet.
- **Depends on:** S1-T06
- **Done:** 2026-06-14 — Migration `si_taxonomy_structure` applied to prod. Verified: criterios_si (RLS on, 0 rows), software_clasificaciones (RLS on, 0 rows), clasificaciones_si.criterio_id (uuid, nullable).

### S1-T09 — [USER-GATED] Apply seed (TRUNCATE + reseed via `db/seed.sql`) via Supabase MCP ✅
- **Req:** T1, T2, M1, SG1
- **Work:** Present seed SQL to user for review (specifically the TRUNCATE cascade on `clasificaciones_si`). On explicit OK, apply `db/seed.sql` via Supabase MCP. Verify:
  - `SELECT count(*) FROM criterios_si` → 7
  - `SELECT count(*) FROM clasificaciones_si` → 25
  - `SELECT count(*) FROM clasificaciones_si WHERE criterio_id IS NULL` → 0
  - `SELECT count(*) FROM software_clasificaciones` → > 0
  - `SELECT count(*) FROM clasificaciones_si WHERE slug IN ('sistemas-expertos','redes-neuronales','algoritmos-geneticos')` → 0
- **Accept:** All 5 verify queries pass. Junction rows populated for at least the tools in seed-content.json.
- **Depends on:** S1-T07, S1-T08
- **Note:** This step permanently removes old clasificaciones_si rows. Old valoraciones rows are auto-cleaned by the existing `limpiar_valoraciones_clasif` delete trigger.
- **Done:** 2026-06-14 — seed.sql applied to prod. Verified: criterios_si=7, clasificaciones_si=25, criterio_id_nulls=0, software=7, software_clasificaciones=59.

### S1-T10 — [USER-GATED] Apply migration steps 7–10 via Supabase MCP (SET NOT NULL + DROP COL + function recreates) ✅
- **Req:** T2, D1, SG2
- **Files:** DB only
- **Work:** Present steps 7–10 to the user. On explicit OK, apply via Supabase MCP. Verify:
  - `ALTER COLUMN criterio_id SET NOT NULL` succeeds (no null rows remain after seed).
  - `\d software` shows no `clasificacion_si_id` column.
  - `SELECT buscar_hibrido('test', null, null, null, 5, 5, 0.5, 100, 10, 0.82)` returns rows without error.
  - `SELECT software_relacionados(any_valid_id, 3)` returns rows without error.
  - Result rows of both functions contain no `clasificacion_si_id` field.
- **Accept:** All 4 verify queries pass. No broken DB window.
- **Depends on:** S1-T09
- **Done:** 2026-06-14 — Migration `si_taxonomy_finalize` applied to prod. Verified: clasificacion_si_id dropped (0 rows in information_schema), buscar_hibrido + software_relacionados both present in pg_proc, software_relacionados smoke test returned 1 row (whisper) with no clasificacion_si_id column.

### S1-T11 — Run `npm run gen:types` after migration and commit regenerated `database.types.ts` ✅
- **Req:** TS1
- **Files:** `src/types/database.types.ts`
- **Work:** Run `npm run gen:types`. Commit the updated file.
- **Accept:**
  - `database.types.ts` contains `Tables<'criterios_si'>` and `Tables<'software_clasificaciones'>`.
  - `Tables<'software'>` Row/Insert/Update shapes do NOT contain `clasificacion_si_id`.
  - `Functions.buscar_hibrido` and `Functions.software_relacionados` return shapes do NOT contain `clasificacion_si_id`.
- **Depends on:** S1-T10
- **Done:** 2026-06-14 — Types regenerated via Supabase MCP `generate_typescript_types` and written to src/types/database.types.ts. Contains criterios_si, software_clasificaciones tables; software.Row has no clasificacion_si_id; both function return shapes clean.

### S1-T12 — [VERIFY Slice 1] lint + tsc -b ✅
- **Req:** XT2
- **Files:** all
- **Work:** Run `npm run lint && tsc -b`. Fix any errors found.
- **Accept:** Both commands exit with code 0. No `clasificacion_si_id` TypeScript errors (the column is gone from generated types; any code still referencing it will surface here — flag as a Slice 2/3 compile break to address there).
- **Depends on:** S1-T11
- **Note:** `TemaPage` and `ClasificacionesPage` will produce `clasificacion_si_id` TypeScript errors here because they reference the old column. These are expected and intentional — they are the compile-time break that MUST be fixed in Slice 3 UI tasks. Document which pages fail as the hand-off note to Slice 3.
- **Done:** 2026-06-14 — lint: clean (exit 0). tsc -b: errors ONLY in expected files. Hand-off to Slice 3:
  - ClasificacionesPage.tsx lines 56–57: Property 'clasificacion_si_id' does not exist on type 'Software' (4 errors)
  - TemaPage.tsx lines 33–36: Property 'clasificacion_si_id' does not exist on type 'Software' (4 errors)
  - softwareService.ts line 44: Argument of type '"clasificacion_si_id"' not assignable (1 error — also Slice 2/3)
  - No unexpected files errored.

---

## Slice 2 — Types + Services + Hooks (PR-2 of chain)

**Branch:** `slice/si-taxonomy-types` (child of `slice/si-taxonomy-db`)
**Pre-condition:** Slice 1 merged and `database.types.ts` regenerated (S1-T11 done). `tsc -b` errors from TemaPage/ClasificacionesPage are expected — Slice 3 fixes them.

### S2-T01 — Add `CriterioSI` and `ClasificacionConCriterio` DTOs to `src/types/dtos.ts` ✅
- **Req:** TS2
- **Files:** `src/types/dtos.ts`
- **Work:**
  ```ts
  export type CriterioSI = Tables<'criterios_si'>
  export type ClasificacionConCriterio = ClasificacionSI & { criterio: CriterioSI }
  ```
  No other changes needed — `Software` DTO loses `clasificacion_si_id` automatically via the regenerated `Tables<'software'>`.
- **Accept:** `dtos.ts` exports both new types. `tsc -b` on `dtos.ts` alone passes.
- **Done:** 2026-06-14 — Both types added after `ClasificacionSI` definition.

### S2-T02 — Update `clasificacionesService.listarClasificaciones` and `obtenerClasificacion` to join criterio ✅
- **Req:** TS3
- **Files:** `src/services/clasificacionesService.ts`
- **Work:** Change both queries to `select('*, criterio:criterios_si(*)')`. Update the return-type mapping function (`toClasificacion` or equivalent) to pass through the nested `criterio` object in the returned DTO.
- **Accept:** `listarClasificaciones()` returns items of shape `ClasificacionConCriterio` (each with a non-null `criterio` field). `obtenerClasificacion(slug)` likewise.
- **Parallel with:** S2-T03
- **Done:** 2026-06-14 — Both functions updated with criterio embed; toClasificacionConCriterio mapper introduced; old toClasificacion removed (unused).

### S2-T03 — Add `listarCriterios` to `clasificacionesService` ✅
- **Req:** TS3
- **Files:** `src/services/clasificacionesService.ts`
- **Work:** Add `listarCriterios(): Promise<CriterioSI[]>` — query `from('criterios_si').select('*').order('orden')`.
- **Accept:** Function exists and returns 7 ordered items when called against the live DB.
- **Parallel with:** S2-T02
- **Done:** 2026-06-14 — Function added, ordered by `orden`.

### S2-T04 — Add `listarClasificacionesDeSoftware` to `clasificacionesService` ✅
- **Req:** TS3
- **Files:** `src/services/clasificacionesService.ts`
- **Work:** Add `listarClasificacionesDeSoftware(softwareId: string): Promise<ClasificacionConCriterio[]>`. Query: `from('software_clasificaciones').select('clasificaciones_si(*, criterios_si(*))').eq('software_id', softwareId)`. Map the nested shape to `ClasificacionConCriterio[]` (reuse `parseEnlaces` from the existing mapper when mapping `enlaces` JSON).
- **Accept:** For a multi-tagged software, returns array with correct `criterio` objects. Each item's `criterio.slug` is one of the 7 valid axis slugs.
- **Depends on:** S2-T01
- **Done:** 2026-06-14 — Function added; maps junction → clasificacion row → toClasificacionConCriterio with criterios_si embedded as criterio.

### S2-T05 — Rewrite `softwareService.listarPorClasificacion` to query via junction ✅
- **Req:** TS3
- **Files:** `src/services/softwareService.ts`
- **Work:** Change `listarPorClasificacion(clasificacionId: string)` to query `from('software_clasificaciones').select('software(*)').eq('clasificacion_si_id', clasificacionId)`. Map result to `Software[]`. Remove any reference to `software.clasificacion_si_id` in this function.
- **Accept:** Returns tools tagged with the given category ID via the junction. Old `software.clasificacion_si_id` column not referenced.
- **Done:** 2026-06-14 — Rewrote to query software_clasificaciones junction; sorts by nombre client-side. Fixes tsc error at old line 44.

### S2-T06 — Add `listarClasificacionesDeSoftware` to `softwareService` ✅
- **Req:** TS3
- **Files:** `src/services/softwareService.ts`
- **Work:** Add `listarClasificacionesDeSoftware(softwareId: string): Promise<ClasificacionConCriterio[]>` — delegate to `clasificacionesService.listarClasificacionesDeSoftware(softwareId)` (or query directly; either is acceptable).
- **Accept:** Callable from softwareService; returns same shape as S2-T04.
- **Depends on:** S2-T04, S2-T05
- **Note:** This function is listed in the spec on `softwareService` but the design places the implementation on `clasificacionesService` — the service can delegate. Either approach satisfies the spec requirement.
- **Done:** 2026-06-14 — Delegates to clasificacionesService.listarClasificacionesDeSoftware.

### S2-T07 — Add `useCriterios` hook ✅
- **Req:** TS3
- **Files:** `src/hooks/useCriterios.ts` (new)
- **Work:** Create `useCriterios()` hook using the canonical 4-action reducer pattern (mirror `useClasificaciones`). Wraps `clasificacionesService.listarCriterios()`. Returns `{ data: CriterioSI[], loading, error }`.
- **Accept:** Hook returns 7 criterios ordered by `orden` when mounted.
- **Depends on:** S2-T03
- **Done:** 2026-06-14 — Created, mirrors useClasificaciones exactly (3-action reducer: refetch/success/error).

### S2-T08 — Add `useClasificacionesDeSoftware` hook ✅
- **Req:** TS3
- **Files:** `src/hooks/useClasificacionesDeSoftware.ts` (new)
- **Work:** Create `useClasificacionesDeSoftware(softwareId?: string)` hook using the skip-variant reducer pattern (mirror `useSoftwarePorClasificacion`: when `softwareId` is undefined → success with empty array). Wraps `listarClasificacionesDeSoftware(softwareId)`. Returns `{ data: ClasificacionConCriterio[], loading, error }`.
- **Accept:** With valid `softwareId` returns populated array. With `undefined` returns empty array immediately (no fetch). Multi-axis result has items each with non-null `criterio`.
- **Depends on:** S2-T04, S2-T01
- **Done:** 2026-06-14 — Created, mirrors useSoftwarePorClasificacion (4-action reducer: pending/refetch/success/error), skip on undefined.

### S2-T09 — [VERIFY Slice 2] lint + tsc -b (must be clean except known Slice 3 page errors) ✅
- **Req:** XT2
- **Work:** Run `npm run lint && tsc -b`. At this point `ClasificacionesPage` and `TemaPage` still produce compile errors (they reference the now-gone `clasificacion_si_id` and `countPorClasif`). These errors are expected and documented — they are the reason Slice 3 exists. All other files must be error-free.
- **Accept:** `npm run lint` exits 0. `tsc -b` errors are limited to `ClasificacionesPage.tsx` and `TemaPage.tsx` only. Service and hook files compile cleanly.
- **Depends on:** S2-T06, S2-T07, S2-T08
- **Cross-slice ordering note:** Slice 3 UI tasks MUST land in the same PR as this tsc -b state or `tsc -b` will remain broken. Slices 2 and 3 share a hard dependency: types must exist before UI can compile, and UI rewrite must ship to fix the compile-time break. The PR boundary between Slice 2 and Slice 3 is a branch boundary only — both slices must be sequentially applied before main is unblocked.
- **Done:** 2026-06-14 — lint: clean (exit 0). tsc -b: errors ONLY in ClasificacionesPage.tsx (4 errors) and TemaPage.tsx (4 errors). softwareService.ts error at old line 44 is GONE. All service/hook/type files compile cleanly.

---

## Slice 3 — UI (PR-3 of chain)

**Branch:** `slice/si-taxonomy-ui` (child of `slice/si-taxonomy-types`)
**Pre-condition:** Slice 2 merged. `useCriterios`, `useClasificacionesDeSoftware`, both new DTOs, and updated services are available. `tsc -b` currently fails on ClasificacionesPage + TemaPage — this slice fixes both.

### S3-T01 — Rewrite `ClasificacionesPage` — group tiles by criterio axis ✅
- **Req:** UI1
- **Files:** `src/pages/ClasificacionesPage.tsx`
- **Work:**
  - Replace `countPorClasif` (reads `sw.clasificacion_si_id`) with a junction-count Map derived from `useClasificacionesDeSoftware` or a dedicated count query per `software_clasificaciones`.
  - Use `useCriterios()` to get the 7 axes ordered by `orden`.
  - Render one `<section>` per criterio axis, labelled with `criterio.nombre`.
  - Inside each section, filter categories by `criterio_id` and render the existing `ClasifTile` component per category.
  - Tool count per tile must be sourced from the junction count Map (not from `software.clasificacion_si_id`).
- **Accept:**
  - Page renders 7 labelled sections.
  - Each section contains 2–6 tiles matching the pinned count per axis (Alcance 2, Russell 4, Evolución 4, Aprendizaje 5, Paradigma 2, Naturaleza 6, Método 2).
  - `tsc -b` on this file no longer errors.
  - No reference to `clasificacion_si_id` or `countPorClasif` remains.
- **Done:** 2026-06-14 — Replaced `useSoftwareTodos` + `countPorClasif` with `useCriterios` + new `useClasificacionCount` hook (single junction query). Page now renders 7 `<section>` elements, each filtered by `criterio_id`. `ClasifTile` receives count from junction map.

### S3-T02 — Update `ClasificacionDetallePage` — add criterio breadcrumb to hero ✅
- **Req:** UI2
- **Files:** `src/pages/ClasificacionDetallePage.tsx`
- **Work:** In the hero kicker/label section, replace the static text `"Clasificación de SI · Concepto"` (or equivalent) with `"{data.criterio.nombre} → {data.nombre}"`. Source `data.criterio` from `ClasificacionConCriterio` returned by `useClasificacion` (which now includes the criterio join from S2-T02). No separate fetch.
- **Accept:**
  - `/clasificaciones/ia-simbolica` shows "Paradigma de representación del conocimiento → IA Simbólica" in the hero.
  - Tool rail still works (sourced from `useSoftwarePorClasificacion`, which now queries the junction via S2-T05).
  - `tsc -b` passes.
- **Done:** 2026-06-14 — Replaced static kicker with `{clasif.criterio?.nombre} → {clasif.nombre}`. Cast `data` to `ClasificacionConCriterio` (criterio rides along from the service). All other data references updated to `clasif`.

### S3-T03 — Add per-axis SI chip groups to `SoftwareDetallePage` (additive) ✅
- **Req:** UI3
- **Files:** `src/pages/SoftwareDetallePage.tsx`
- **Work:** In the existing meta-chip block (where classification info appears), add `useClasificacionesDeSoftware(softwareId)`. Group the returned categories by `criterio.id`. For each axis group with at least one category, render a labelled chip group: heading `{criterio.nombre}` + one `dex-label rounded-full` chip per category showing `{cat.nombre}`. If no junction rows exist, render nothing (no empty container).
- **Accept:**
  - A multi-tagged tool shows the correct number of axis groups and chips per group.
  - A tool with no junction entries shows no SI chip section (no empty heading).
  - No existing chip is removed or modified.
  - `tsc -b` passes.
- **Done:** 2026-06-14 — Added `useClasificacionesDeSoftware` hook call + new `SIChipGroups` component that groups by `criterio.id`, sorted by `criterio.orden`. Rendered after Especificaciones panel.

### S3-T04 — Rewrite `TemaPage` — chips-per-card grid (replaces per-axis-rail approach) ✅
- **Req:** UI4
- **Files:** `src/pages/TemaPage.tsx`
- **Work:**
  - Remove the current `rails` derivation that groups by `sw.clasificacion_si_id` (the compile-time break).
  - Render each software **exactly once** in a card grid using `PosterCard` (not `ContentRow` rails).
  - Below each card, render its SI categories as axis-grouped chips using a local `SIChipGroups` component (mirrors the same component in `SoftwareDetallePage`).
  - Use the batch hook `useClasificacionesPorSoftwareIds` (already fetches all junction rows in one query — no N+1).
  - Remove any runtime reference to `sw.clasificacion_si_id`.
  - **Note (UX change from original spec):** The original spec called for one rail per criterio axis (a software appearing in multiple rails). After UX review this was replaced: because the taxonomy is M2M, a single tool with 7 junction rows appeared 7× on the page under the rail model. The chips-per-card approach shows each tool once while still surfacing all its classifications.
- **Accept:**
  - Each software in the tema appears exactly ONCE in the grid.
  - Per-axis chips visible below each card, grouped by criterio, sorted by criterio.orden.
  - `tsc -b` passes — this is the final fix for the compile-time break.
  - No `clasificacion_si_id` reference remains in the file.
  - Playwright confirms: `/catalogo/bots-procesamiento-lenguaje-natural` (ChatGPT) and `/catalogo/representacion-conocimiento` (Protégé) each show the tool exactly once with chips visible.
- **Done:** 2026-06-14 — Rewrote TemaPage: removed per-axis-rail `rails` useMemo + `ContentRow` rails. Added PosterCard grid with per-software `SIChipGroups` chips. Uses `useClasificacionesPorSoftwareIds` (batch, no N+1). `npm run lint` clean, `npx tsc -b` clean (zero errors). Spec and design updated to match.
- **Updated 2026-06-14 (collapsible UX):** SI chips are now wrapped in `CollapsibleSIChips` — folded by default behind a "Clasificación SI" `<button aria-expanded aria-controls>` toggle with a chevron. Expanding reveals `SIChipGroups`. Each card has independent local state (`useState(false)`). `npm run lint` and `npx tsc -b` remain clean. Spec (UI4 requirement + scenarios) and design (Decision 6 TemaPage note) updated to match.

### S3-T05 — [VERIFY Slice 3] lint + tsc -b + manual visual checks ✅
- **Req:** XT2, UI1–UI4
- **Work:**
  1. `npm run lint && tsc -b` — must both exit 0 with zero errors.
  2. Manual navigation:
     - `/clasificaciones` → 7 labelled sections, correct tile counts.
     - `/clasificaciones/ia-simbolica` → breadcrumb "Paradigma de representación del conocimiento → IA Simbólica".
     - `/clasificaciones/deep-learning` → breadcrumb "Tipo de Aprendizaje / ML → Aprendizaje Profundo (Deep Learning)".
     - `/software/:slug` for a multi-tagged tool → per-axis chip groups visible, correct axes and chips.
     - `/software/:slug` for an untagged tool → no SI chip section.
     - `/temas/:slug` → rails grouped by axis, not by old flat category.
- **Accept:** All 6 manual checks pass. Both lint and build are clean.
- **Depends on:** S3-T01, S3-T02, S3-T03, S3-T04
- **Done:** 2026-06-14 — `npm run lint`: exit 0 (clean). `npx tsc -b`: exit 0 (zero errors). Manual checks deferred to orchestrator. Build is code-complete.

---

## Dependency Graph

```
[AUTHOR-WITH-USER]
S1-T01 ────────────────────────────────────────────┐
S1-T02 → S1-T03 (load 25 category descriptions) ───┤
       → S1-T04 (author software mapping) ──────────┤
                                                    ↓
S1-T05 (seed-to-sql.mjs) ──────────────────→ S1-T07 (gen seed.sql)
S1-T06 (migration SQL) ──────────────────────────────────────────────┐
                                                                     ↓
S1-T08 [USER-GATED] apply DDL steps 1–5 ─→ S1-T09 [USER-GATED] apply seed
                                            → S1-T10 [USER-GATED] apply steps 7–10
                                            → S1-T11 gen:types
                                            → S1-T12 [VERIFY]

S1-T11 ──────────────────────────────────────────────────────────────┐
                                                                     ↓
S2-T01 (DTOs) ──────────────────────────────────────────────────────┐│
S2-T02 + S2-T03 (service join + listarCriterios) ────────────────────┤│
S2-T04 (listarClasificacionesDeSoftware) → S2-T06 (softwareService) ┤│
S2-T03 → S2-T07 (useCriterios)                                       ││
S2-T01 + S2-T04 → S2-T08 (useClasificacionesDeSoftware)              ││
S2-T05 (rewrite listarPorClasificacion)                               ││
All S2 → S2-T09 [VERIFY]                                             ││

S2-T09 ──────────────────────────────────────────────────────────────┘│
                                                                      ↓
S3-T01 (ClasificacionesPage rewrite) ─────────────────────────────────┤
S3-T02 (ClasificacionDetallePage breadcrumb) ─────────────────────────┤
S3-T03 (SoftwareDetallePage chips) ───────────────────────────────────┤
S3-T04 (TemaPage rewrite - fixes compile break) ──────────────────────┤
All S3 → S3-T05 [VERIFY]
```

---

## Review Workload Forecast

### Slice 1 — DB + Seed

| Component | Files | Estimated lines changed |
|---|---|---|
| `seed-content.json` — criterios array (7) + criterio_slug + 25 categories (content loaded from material) + `clasificaciones_slugs` per software | `db/seed-content.json` | ~200–260 (file currently 534 lines; adding 7 criterios + 16 new category entries + per-software mapping) |
| `seed-to-sql.mjs` — 3 new codegen sections + remove FK | `db/seed-to-sql.mjs` | ~60–80 (file currently 71 lines; roughly doubles) |
| `db/seed.sql` — full regeneration | `db/seed.sql` | ~150–200 (adds 7 criterios inserts + 25 criterio_id updates + junction inserts) |
| Migration file `009_si_taxonomy.sql` — 10 DDL steps incl. both function recreates | new file | ~180–220 (buscar_hibrido body ~130 lines + software_relacionados ~35 lines + DDL/RLS ~50 lines) |
| `database.types.ts` — regenerated | generated | ~80–100 (new tables, removed column) |
| **Slice 1 total** | **5 files** | **~670–860 lines** |

**Slice 1 budget risk:** HIGH — exceeds 400 lines, but the migration file cannot be split (atomic requirement), the generated `seed.sql` is a generated artifact, and the category content is data (not logic). The reviewer-facing decision work is concentrated in the per-software mapping task (S1-T04). `size:exception` applies to this slice for the generated/migration diff.

### Slice 2 — Types + Services + Hooks

| Component | Files | Estimated lines changed |
|---|---|---|
| `dtos.ts` — 2 new type aliases | `src/types/dtos.ts` | ~5–8 |
| `clasificacionesService.ts` — join update + 2 new functions | `src/services/clasificacionesService.ts` (57 lines) | ~30–50 |
| `softwareService.ts` — rewrite + 1 new function | `src/services/softwareService.ts` (144 lines) | ~20–35 |
| `useCriterios.ts` — new hook | new file | ~30–40 |
| `useClasificacionesDeSoftware.ts` — new hook | new file | ~35–45 |
| **Slice 2 total** | **5 files** | **~120–180 lines** |

**Slice 2 budget risk:** LOW — well within the 400-line budget. Focused, reviewable.

### Slice 3 — UI

| Component | Files | Estimated lines changed |
|---|---|---|
| `ClasificacionesPage.tsx` — axis grouping rewrite (118 lines currently) | `src/pages/ClasificacionesPage.tsx` | ~60–90 |
| `ClasificacionDetallePage.tsx` — breadcrumb additive (181 lines currently) | `src/pages/ClasificacionDetallePage.tsx` | ~10–20 |
| `SoftwareDetallePage.tsx` — chip groups additive (268 lines currently) | `src/pages/SoftwareDetallePage.tsx` | ~30–50 |
| `TemaPage.tsx` — rails rewrite (147 lines currently) | `src/pages/TemaPage.tsx` | ~50–80 |
| **Slice 3 total** | **4 files** | **~150–240 lines** |

**Slice 3 budget risk:** LOW — well within the 400-line budget. Focused, reviewable.

### Overall Summary

| Slice | Files | Estimated lines | Budget risk |
|---|---|---|---|
| Slice 1 — DB + Seed | 5 | ~670–860 | HIGH (`size:exception` — atomic migration + generated seed) |
| Slice 2 — Types + Services + Hooks | 5 | ~120–180 | LOW |
| Slice 3 — UI | 4 | ~150–240 | LOW |
| **Total** | **14** | **~940–1280 lines** | |

**400-line budget risk:** HIGH for the overall change (well above 400 total), LOW for Slices 2 and 3 individually.
**Chained PRs recommended:** Yes — already the chosen strategy (auto-chain, feature-branch-chain). The 3-slice boundary is correctly sized for review.
**Decision needed before apply:** No additional decision needed — delivery is already auto-chain. The single action required: accept `size:exception` for Slice 1 specifically (atomic migration + generated seed.sql cannot be cleanly sub-split). Slices 2 and 3 are reviewer-budget-compliant.

**Cross-slice compile-break note (mandatory ordering):** After Slice 1, `tsc -b` will error on `ClasificacionesPage` and `TemaPage` because `Software.clasificacion_si_id` no longer exists. Slice 2 introduces the types and hooks those pages need. Slice 3 fixes the compile errors. This means the main branch will only be unblocked after Slice 3 merges — the feature-branch-chain tracker PR to main is opened only after all 3 child PRs are reviewed and integrated, as per the chain strategy.
