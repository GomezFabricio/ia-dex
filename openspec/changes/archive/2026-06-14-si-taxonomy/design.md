# Design: SI Taxonomy — Atomic Migration + Two-Level M2M

Faceted taxonomy applied end-to-end: `criterios_si` (7 axes) → `clasificaciones_si` (+`criterio_id`, 25 categories) → `software_clasificaciones` (pure M2M, no per-axis cap). One reviewable SQL migration carries the irreversible DDL; types/services/hooks/UI follow as the proposal's 3 slices. Grounded in the live SQL (migrations 004/006/008), the canonical 4-action hook reducer, and the cine-neural tile/chip system already in the codebase. No production migration runs until explicit user OK.

**Axis 6 flattening note:** "Naturaleza y forma del conocimiento" is a FLAT single axis with 6 leaf categories. Sub-dimensions (grado de abstracción, expresabilidad, contenido y objetivo) live only in each category's `en_que_consiste` description as pedagogical context — they are NOT DB entities. No `grupo` column is added to any table; `criterios_si` keeps its original columns: `id`, `nombre`, `slug`, `descripcion`, `orden`, `created_at`, `created_by`.

## Slice boundaries (feature-branch-chain on `feat/plan-mejoras`)

| Slice | Scope | Verify |
|---|---|---|
| 1 — DB + seed | 1 migration file + seed restructure (`seed-content.json`, `seed-to-sql.mjs`) | apply via Supabase MCP after OK; `gen:types` |
| 2 — types/services/hooks | `dtos.ts`, both services, 2 new hooks | `tsc -b`, `lint` |
| 3 — UI | 4 pages (2 rewrites, 2 additive) | `tsc -b`, `lint`, manual |

## Decision 1 — Single atomic migration, ordered

**Choice**: ONE date-prefixed file `db/2026-06-14_009_si_taxonomy.sql`. Structural DDL + RLS + `criterios_si`/`criterio_id` data live in the migration; the **software↔category junction rows come from the regenerated seed** (truncate+reseed), NOT the migration.
**Alternatives**: (a) split DDL across files — reintroduces the broken window the explore flags; (b) put junction rows in the migration — duplicates seed authority, drifts from `seed-content.json`. Both rejected.
**Rationale**: `buscar_hibrido` + `software_relacionados` surface `clasificacion_si_id`; the column-drop and both function-recreates MUST land in the same transaction so no broken DB window exists. Junction data belongs to the seed pipeline (single source of truth, idempotent).

Exact order, each step gating the next:

```
1.  CREATE TABLE criterios_si (id uuid pk default gen_random_uuid(), nombre text not null,
      slug text not null unique, descripcion text, orden int not null default 0,
      created_at timestamptz not null default now(), created_by uuid references profiles(id) on delete set null default auth.uid())
2.  ALTER clasificaciones_si ADD COLUMN criterio_id uuid REFERENCES criterios_si(id) ON DELETE RESTRICT   -- nullable
3.  CREATE TABLE software_clasificaciones (
      software_id uuid not null references software(id) on delete cascade,
      clasificacion_si_id uuid not null references clasificaciones_si(id) on delete cascade,
      primary key (software_id, clasificacion_si_id))      -- NO unique on (software_id, criterio_id)
4.  ALTER both new tables ENABLE ROW LEVEL SECURITY
5.  SELECT-to-anon + admin-write policies on both (replicate 006 with puede_gestionar_contenido())
--- gate A: structure live, writes locked to admin ---
6.  TRUNCATE clasificaciones_si CASCADE; seed: INSERT 7 criterios_si; INSERT 25 new clasificaciones_si;
      UPDATE clasificaciones_si SET criterio_id = (...slug...); INSERT software_clasificaciones   -- from db/seed.sql
--- gate B: every category now has a criterio + junction populated ---
7.  ALTER clasificaciones_si ALTER COLUMN criterio_id SET NOT NULL        -- safe only after step 6
8.  ALTER software DROP COLUMN clasificacion_si_id                        -- nullable col, unblocked
9.  DROP FUNCTION buscar_hibrido(text,vector,uuid,text,int,int,float,int,int,float); CREATE (no clasificacion_si_id)
10. DROP FUNCTION software_relacionados(uuid,int); CREATE (no clasificacion_si_id)
```

Why the order: 2 nullable before 6 (constraint can't precede data); 7 after 6 (NOT NULL needs every row filled); 8 after 6 (junction must hold before old FK dies); 9/10 in the SAME migration as 8 (return-shape break is instantaneous). Steps 6–8 are the user-gated, irreversible core.

**Truncate+reseed** (RESOLVED in proposal): old 9 slugs don't exist in the new set; slug-based `WHERE NOT EXISTS` can't migrate them. Slugs are UI route params, not FKs → no broken reference. Old `valoraciones` of `clasificacion_si` auto-clean via the existing `limpiar_valoraciones_clasif` delete trigger. `criterios_si` is NOT rateable → no cleanup trigger needed on it.

## Decision 2 — Function recreation (return-shape only)

`CREATE OR REPLACE` cannot change return type → explicit `DROP FUNCTION` first (precedent: migration 004). Recreate bodies **verbatim** except removing the one column.

- `buscar_hibrido` (from `004`): delete `clasificacion_si_id uuid,` from `returns table(...)` (was line 40) and `s.clasificacion_si_id,` from the final SELECT (was line 112). Re-`grant execute … to anon, authenticated`. Nothing else changes — the column never participated in vector/FTS scoring.
- `software_relacionados` (from `008`): delete `clasificacion_si_id uuid,` from `returns table(...)` (was line 26) and `clasificacion_si_id,` from the final SELECT list (was line 60). `scored` uses `s.*` so it auto-drops there. Re-grant. Nothing else.

Both DROP+CREATE live in steps 9–10 of the same migration as the column drop.

## Decision 3 — M2M query patterns (embedded selects)

PostgREST resolves the junction → category → axis in one round-trip. Canonical embed shape: `software_clasificaciones(clasificaciones_si(*, criterios_si(*)))`.

| Need | Query | Lives in |
|---|---|---|
| Categories of a software | `from('software_clasificaciones').select('clasificaciones_si(*, criterios_si(*))').eq('software_id', id)` → map to `ClasificacionConCriterio[]` | `clasificacionesService.listarClasificacionesDeSoftware(softwareId)` |
| Software in a category | `from('software_clasificaciones').select('software(*)').eq('clasificacion_si_id', clasifId)` → `Software[]` | `softwareService.listarPorClasificacion` (rewrite) |
| Tool count per category | `from('software_clasificaciones').select('clasificacion_si_id')` → reduce to `Map<clasifId,count>` client-side | `ClasificacionesPage` (replaces `countPorClasif`) |
| Categories + axis (index) | `from('clasificaciones_si').select('*, criterio:criterios_si(*)').order('orden')` | `clasificacionesService.listarClasificaciones` / `obtenerClasificacion` |
| All axes | `from('criterios_si').select('*').order('orden')` | `clasificacionesService.listarCriterios` |

`embedding`/`fts` never appear in `software(*)` embeds (PostgREST returns all columns) — keep `Software` as `Omit<...,'embedding'|'fts'>` and cast/strip at the service boundary as today. The `clasificaciones_si(*)` embed returns raw `enlaces` Json → reuse `parseEnlaces` from `clasificacionesService` when mapping to `ClasificacionConCriterio`.

## Decision 4 — DTOs (derived from generated `Tables<>`)

```ts
export type CriterioSI = Tables<'criterios_si'>
// ClasificacionSI already gains criterio_id automatically after gen:types.
export type ClasificacionConCriterio = ClasificacionSI & { criterio: CriterioSI }
// Software loses clasificacion_si_id automatically (Omit over regenerated Tables<'software'>).
// Software-detail axis grouping is a VIEW shape, not a DTO — built in the hook/page:
//   Map<CriterioSI, ClasificacionConCriterio[]> derived from listarClasificacionesDeSoftware.
```

`SoftwareClasificacion = Tables<'software_clasificaciones'>` is internal-only — add only if a writer needs it (not this cycle). Grouping-by-axis is derived data, kept out of `dtos.ts`.

## Decision 5 — Service / hook surface

| Symbol | File | Change |
|---|---|---|
| `listarClasificaciones` | clasificacionesService | add `criterio:criterios_si(*)` to select; map via `toClasificacion` keeping `criterio` |
| `obtenerClasificacion` | clasificacionesService | same join |
| `listarCriterios` | clasificacionesService | NEW — `criterios_si` ordered by `orden` → `CriterioSI[]` (7 rows) |
| `listarClasificacionesDeSoftware(softwareId)` | clasificacionesService | NEW — junction embed → `ClasificacionConCriterio[]` |
| `listarPorClasificacion(clasifId)` | softwareService | REWRITE to junction embed → `Software[]` |
| `useCriterios()` | hooks | NEW — wraps `listarCriterios`, canonical reducer (mirror `useClasificaciones`) |
| `useClasificacionesDeSoftware(softwareId?)` | hooks | NEW — skip-variant reducer (mirror `useSoftwarePorClasificacion`: `undefined → success([])`) |

`useSoftwarePorClasificacion` logic unchanged — only its service query swaps to the junction. `useClasificaciones`/`useClasificacion` unchanged — `criterio` rides along via the DTO.

## Decision 6 — UI (reuse cine-neural system, no redesign)

- **ClasificacionesPage**: replace `countPorClasif` (reads dead `sw.clasificacion_si_id`) with the junction-count Map. Group the existing `ClasifTile` grid into one `<section>` per axis from `useCriterios()`, categories filtered by `criterio_id`. Tile component unchanged.
- **SoftwareDetallePage** (additive): add `useClasificacionesDeSoftware(softwareId)`; in the existing meta-chip block, render one labelled group per axis — `"{criterio.nombre}: {cat.nombre} · {cat.nombre}"` reusing the `dex-label rounded-full` chip classes. No existing chip replaced.
- **ClasificacionDetallePage** (additive): in the hero kicker, swap the static `"Clasificación de SI · Concepto"` for `"{data.criterio.nombre} → {data.nombre}"` breadcrumb. Tool rail already correct once `useSoftwarePorClasificacion` is M2M.
- **TemaPage** (REWRITE — compile-time break + UX fix): `sw.clasificacion_si_id` is gone. The per-axis-rail model was also replaced after UX review: because the taxonomy is M2M, each software appeared in every axis rail it belonged to — a tool with 7 junction rows showed up 7× on the page. New approach: render each software **exactly once** in a card grid. Each card's SI categories are hidden by default behind a `CollapsibleSIChips` toggle ("Clasificación SI" label + chevron `<button aria-expanded aria-controls>`). Clicking reveals `SIChipGroups` (chips grouped per axis, sorted by `criterio.orden`). Collapsed by default keeps the grid focused on the tools; the toggle allows on-demand axis exploration per card. Uses `useClasificacionesPorSoftwareIds` (batch, no N+1). No `ContentRow` rails for this page — the grid-with-collapsible-chips pattern is cleaner and avoids M2M duplication.

## Decision 7 — Seed generator (`seed-to-sql.mjs`)

JSON shape: add `criterios: [{slug,nombre,descripcion,orden}]`; add `criterio_slug` to each category; replace per-software `clasificacion_slug` (string) with `clasificaciones_slugs` (string[]).

Codegen — 3 new sections + 1 edit (keep the `q`/`qJson` helpers and slug guards):

1. **criterios** — `INSERT … WHERE NOT EXISTS (slug)` (mirror temas block).
2. **criterio_id wiring** — per category, `UPDATE clasificaciones_si SET criterio_id = (select id from criterios_si where slug = …) WHERE slug = …` (emit AFTER both insert blocks).
3. **junction** — per software × each `clasificaciones_slugs[]`: `INSERT INTO software_clasificaciones (software_id, clasificacion_si_id) SELECT (select id from software where slug=…), (select id from clasificaciones_si where slug=…) ON CONFLICT DO NOTHING`.
4. **edit** — remove `clasificacion_si_id` from the software INSERT column list and the `ON CONFLICT DO UPDATE SET` clause (was lines 58–65); drop the `clasSelect` block.

The category set (25 across 7 axes, content resolved from course material) is pinned in spec T2; the per-software axis mapping is **human data authoring** done with the user during slice 1. This design only fixes the JSON/codegen shape.

## Data flow

```
seed-content.json ─(seed-to-sql.mjs)→ seed.sql ─(MCP, after OK)→ criterios_si / clasificaciones_si / software_clasificaciones
                                                                          │
gen:types → database.types.ts → dtos.ts (CriterioSI, ClasificacionConCriterio)
                                      │
            services (junction embeds) → hooks (canonical reducers) → pages (axis grouping)
```

## Open questions

- [x] Exact category set + slugs/descripcion/ejemplos — RESOLVED. 7 axes / 25 categories pinned in spec T2 with full content from course material.
- [ ] Per-software axis mapping (`clasificaciones_slugs` per tool) — remains `[AUTHOR-WITH-USER]`, to be co-authored during Slice 1 seed slice.
- [ ] None blocking the architecture.
