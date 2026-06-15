# SI Taxonomy — Current State + Migration Surface

Exploration phase for the `si-taxonomy` SDD change. Maps every code and SQL point that must change to implement the agreed two-level faceted taxonomy (criterios_si + clasificaciones_si + software_clasificaciones junction).

## Quick path

1. Read this document to understand the full migration surface before writing any spec or design.
2. Check the risks section — the `clasificacion_si_id` NOT NULL story and the 4 SQL functions returning that column are the blocking concerns.
3. After spec + design are approved, every layer in the Migration Surface section must be touched in order (DB → seed → types → services → hooks → UI).

---

## Current State

### DB — `clasificaciones_si` table

Current columns (confirmed from `db/2026-06-10_not_null_hardening.sql` + `src/types/database.types.ts`):

| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| slug | text | NOT NULL, UNIQUE (inferred from seed upsert pattern) |
| nombre | text | NOT NULL |
| en_que_consiste | text | nullable |
| ejemplos | text | nullable |
| imagen_url | text | nullable |
| enlaces | jsonb | NOT NULL, DEFAULT '[]' |
| orden | int | NOT NULL, DEFAULT 0 |
| created_at | timestamptz | NOT NULL, DEFAULT now() |
| created_by | uuid | nullable, FK → profiles.id ON DELETE SET NULL |

**Missing from the agreed model**: `criterio_id` FK column does not exist yet.

Current seed data in `clasificaciones_si` contains 9 categories that do NOT align with the new 5-axis model. They are a mix of categories from different axes (Paradigma, Tipo de Aprendizaje, and some ad-hoc groupings). The existing rows must be REPLACED — not augmented — by the new taxonomy. The current rows in prod will be left in place until the reseed migration drops them (or the seed upsert approach replaces them by slug; see Risks).

### DB — `software` table

Current relevant columns (from `database.types.ts` lines 195–276):

| Column | Type | Constraints |
|---|---|---|
| tema_id | uuid | NOT NULL, FK → temas.id |
| clasificacion_si_id | uuid | **nullable**, FK → clasificaciones_si.id |
| slug | text | NOT NULL, UNIQUE |
| embedding | vector(384) | nullable |
| fts | tsvector | GENERATED ALWAYS AS … STORED |

**Key risk**: `clasificacion_si_id` is NULLABLE on `software`. This means dropping it later (after M2M is live) is a safe DDL operation with no NOT NULL block. The old column can be dropped once `software_clasificaciones` is in place.

### DB — SQL functions referencing `clasificacion_si_id`

All 4 RPC/view functions return `clasificacion_si_id` as a column in their output:

| Function / Object | File | Line | How it uses the column |
|---|---|---|---|
| `buscar_hibrido` (v1) | `db/2026-06-12_001_busqueda_hibrida.sql` | L50, L107 | Returns `s.clasificacion_si_id` in the SELECT output |
| `buscar_hibrido` (v2 — threshold tuning) | `db/2026-06-12_002_ajuste_umbral.sql` | L22, L79 | Same; function replaced |
| `buscar_hibrido` (v3 — adaptive cutoff, CURRENT LIVE) | `db/2026-06-12_004_corte_adaptativo.sql` | L40, L112 | Same; function replaced |
| `software_relacionados` | `db/2026-06-13_008_software_relacionados.sql` | L26, L60 | Returns `clasificacion_si_id` in SELECT list |

These functions return the `Software` row shape. After migration, `clasificacion_si_id` is gone from `software`. The functions must be updated to remove that column from their `returns table(...)` signature and their `SELECT` output. Since `buscar_hibrido` changes its signature, it must be DROPped first (there is already precedent for this: migration 004 drops 001's signature with `drop function if exists`).

### DB — RLS policies on `clasificaciones_si`

From `db/2026-06-13_006_content_write_policies.sql` lines 24–26:
- `admin inserta clasif` — INSERT
- `admin actualiza clasif` — UPDATE
- `admin borra clasif` — DELETE

These reference the table by name. They remain valid after adding `criterio_id` to the table (additive schema change). The new `criterios_si` table will need equivalent policies.

### DB — Trigger on `clasificaciones_si`

From `db/2026-06-13_006_content_write_policies.sql` line 43:
```sql
create trigger limpiar_valoraciones_clasif
  before delete on public.clasificaciones_si
  for each row execute function public.cleanup_valoraciones_on_content_delete('clasificacion_si');
```
This trigger cleans up `valoraciones` (polymorphic) when a `clasificacion_si` row is deleted. Remains valid. No change needed.

### DB — `software_embed_trigger`

From `db/2026-06-12_001_busqueda_hibrida.sql` line 186:
```sql
create trigger software_embed_trigger
  after insert or update of nombre, objetivo, descripcion_corta, tema_id
  on public.software
```
Does NOT include `clasificacion_si_id` in the `update of` column list — so adding/removing that column does not fire the embed trigger. The trigger watches `tema_id` (not clasificacion). Safe; no change needed.

### DB — Views

`v_software_rating` and `v_software_populares` are simple aggregates over `software` + `valoraciones` + `eventos`. Neither one selects `clasificacion_si_id`. Confirmed from `database.types.ts` lines 356–374 (view Row shapes contain only `software_id`, `nombre`, `promedio`/`cantidad_votos`/`vistas`). No change needed.

### DB — `puede_gestionar_contenido`, `handle_new_user`

Neither function references `clasificaciones_si` or `clasificacion_si_id`. No change needed.

---

### Types — `src/types/database.types.ts`

Three places reference `clasificacion_si_id` or `clasificaciones_si`:

| Location | Lines | What it is |
|---|---|---|
| `Tables<'clasificaciones_si'>` Row/Insert/Update | 17–63 | Entire table shape — must gain `criterio_id` |
| `Tables<'software'>` Row/Insert/Update | 195–276 | `clasificacion_si_id: string \| null` — must be removed |
| `Functions.buscar_hibrido` Returns | 389–403 | `clasificacion_si_id: string` in return shape — must be removed |
| `Functions.software_relacionados` Returns | 407–426 | `clasificacion_si_id: string` in return shape — must be removed |
| `software_clasificacion_si_id_fkey` Relationship | 253–261 | FK metadata — will disappear after `npm run gen:types` |

**New types that will be generated**: `Tables<'criterios_si'>` and `Tables<'software_clasificaciones'>` will appear after the DB migration is applied and `npm run gen:types` is run.

**Generation command**: `npm run gen:types` (writes `src/types/database.types.ts`). This file is ALWAYS generated — do not edit manually, update via the gen command after each DB migration.

### Types — `src/types/dtos.ts`

| Symbol | Lines | Dependency |
|---|---|---|
| `ContenidoTipo` | 7 | Includes `'clasificacion_si'` — this string type is used by valoraciones; no change needed (clasificacion_si rows still exist as rating targets) |
| `Software` | 27 | `Omit<Tables<'software'>, 'embedding' \| 'fts'>` — will automatically lose `clasificacion_si_id` after gen:types |
| `ClasificacionSI` | 31–33 | `Omit<Tables<'clasificaciones_si'>, 'enlaces'>` — will automatically gain `criterio_id` after gen:types |

**New DTOs needed** in `dtos.ts`:
- `CriterioSI` — `Tables<'criterios_si'>`
- `SoftwareClasificacion` — `Tables<'software_clasificaciones'>` (junction row, likely only needed internally)
- `ClasificacionConCriterio` — `ClasificacionSI & { criterio: CriterioSI }` (for the UI to show axis context on a category)

---

### Services — `src/services/`

#### `clasificacionesService.ts`

| Function | Lines | Change needed |
|---|---|---|
| `listarClasificaciones()` | 32–39 | Currently `select('*')` — will auto-pick up `criterio_id` after gen:types. Needs an optional join/embed to return criterio data: `select('*, criterio:criterios_si(*)')` |
| `obtenerClasificacion(slug)` | 45–57 | Same — needs criterio join |

New functions needed:
- `listarClasificacionesPorCriterio(criterioId)` — for the ClasificacionesPage axis grouping
- `listarCriterios()` — returns all 5 criterios ordered by `orden`
- `obtenerCriterio(slug)` — single criterio by slug (for potential future CriterioDetallePage)

#### `softwareService.ts`

| Function | Lines | Change needed |
|---|---|---|
| `listarPorClasificacion(clasificacionId)` | 40–49 | Currently queries `software.clasificacion_si_id`. After M2M, must JOIN through `software_clasificaciones`: `from('software_clasificaciones').select('software(*)').eq('clasificacion_si_id', clasificacionId)` |
| `listarPorTema(temaId)` | 12–21 | Returns `Software[]` which currently includes `clasificacion_si_id`. After gen:types this column disappears; callers that group by clasif must now query the junction. See TemaPage impact below. |
| `listarTodos()` | 27–35 | Same — `clasificacion_si_id` gone from shape. |
| `buscarInteligente()` | 115–127 | Return type is `BusquedaInteligenteResponse.resultados: Software[]`. Since `Software` DTO is derived from gen:types, this auto-updates. No logic change needed. |
| `relacionados()` | 136–144 | Calls `software_relacionados` RPC. The RPC's return type in database.types.ts will lose `clasificacion_si_id` after gen:types. No logic change needed. |

**New function needed**: `listarClasificacionesDeSoftware(softwareId): Promise<ClasificacionConCriterio[]>` — queries `software_clasificaciones` joining `clasificaciones_si` and `criterios_si`. Used by SoftwareDetallePage to render the multi-axis SI chips.

---

### Hooks — `src/hooks/`

| Hook | File | Current behavior | Change needed |
|---|---|---|---|
| `useClasificaciones` | `src/hooks/useClasificaciones.ts` | Calls `listarClasificaciones()`, returns `ClasificacionSI[]` | Returns will include `criterio_id` automatically; callers may need the full criterio object, so the service change (join criterio) must propagate here |
| `useClasificacion` | `src/hooks/useClasificacion.ts` | Calls `obtenerClasificacion(slug)` | Same — criterio join propagates |
| `useSoftwarePorClasificacion` | `src/hooks/useSoftwarePorClasificacion.ts` | Calls `listarPorClasificacion(clasificacionId)` filtering by `software.clasificacion_si_id` | Must change to M2M query |

**New hooks needed**:
- `useCriterios()` — lists all 5 criterios (for ClasificacionesPage grouped view)
- `useClasificacionesDeSoftware(softwareId)` — per-software M2M classification list (for SoftwareDetallePage chips)

---

### UI pages — `src/pages/`

#### `ClasificacionesPage.tsx`

Current behavior (lines 53–61): counts tools per clasificacion by scanning `software.clasificacion_si_id` from `useSoftwareTodos()`. Groups nothing — renders a flat tile list.

**Required changes**:
- Tool count per clasif: must query junction (`software_clasificaciones`) or count via the M2M hook
- Display: group the tile list by criterio axis (5 sections, each with 2–4 category tiles)
- The existing `countPorClasif` Map keyed on `clasificacion_si_id` will break when that column disappears from `Software`

#### `ClasificacionDetallePage.tsx`

Current behavior (lines 24, 169): uses `useSoftwarePorClasificacion(data?.id)` which queries `software.clasificacion_si_id`. Also shows no criterio context.

**Required changes**:
- `useSoftwarePorClasificacion` changes to M2M query — page behavior stays the same but the data source changes
- Add criterio axis display in the hero (e.g., breadcrumb: "Paradigma y Representación → IA Simbólica")

#### `SoftwareDetallePage.tsx`

Current behavior: NO SI chip rendered at all. The page renders licencia/año/autor meta chips but `clasificacion_si_id` is never displayed to the user in this page.

**Required changes**:
- Add a new hook `useClasificacionesDeSoftware(softwareId)` call
- Render one chip group per axis: "Alcance: IA Débil", "Aprendizaje: Deep Learning + Por Refuerzo", etc.
- These are NEW chips — no existing chip to replace, just additive

#### `TemaPage.tsx`

Current behavior (lines 29–48): groups the tema's software into rails by `sw.clasificacion_si_id`. Each rail title is the clasificacion's `nombre`. A "Otras herramientas" rail catches nulls.

**Required change — DECISION NEEDED**: With 5 axes, each software now has multiple classifications across multiple axes. The current grouping (one rail per clasif) would create up to 20 rails for 7 tools. Options:
1. Group by CRITERIO (one rail per axis) — each rail shows software tagged with any category of that axis
2. Drop the clasificacion grouping in TemaPage — show all tools in a single unsorted rail
3. Group by primary clasif (pick one axis as "canonical display" for TemaPage context)

Option 1 is the cleanest for this UI. This is the only genuine open question.

The implementation: `software.clasificacion_si_id` disappears from the `Software` shape, so the current `sw.clasificacion_si_id` grouping WILL BREAK at compile time. The page must be rewritten to query the junction.

#### `CatalogoPage.tsx`

Current behavior: groups by `tema` only, never by clasif. The `useSoftwareTodos()` data populates a flat grid or tema-per-rail view. No `clasificacion_si_id` access in the current page logic.

**Required changes**: none for the catalog page itself. The sticky toolbar currently shows tema chips — no clasif filter chip exists yet. Adding a clasif/criterio filter layer is a nice enhancement but is NOT part of this change scope.

---

### Seed pipeline — `db/seed-content.json` + `db/seed-to-sql.mjs`

#### Current structure of `seed-content.json`

```json
{
  "temas": [...],          // 7 temas
  "clasificaciones_si": [  // 9 categories — flat, no criterio reference
    { "slug": "ia-simbolica", "nombre": "IA Simbólica", ... },
    ...
  ],
  "software": [            // 23 tools, each with "clasificacion_slug" (singular)
    { "slug": "stockfish", "tema_slug": "...", "clasificacion_slug": "sistemas-que-actuan-racionalmente", ... }
  ]
}
```

#### Current `seed-to-sql.mjs` logic (lines 44–67)

For `clasificaciones_si`: inserts with `WHERE NOT EXISTS (slug)` — idempotent, not upserted.

For `software`: ON CONFLICT (slug) DO UPDATE — upserts all fields including `clasificacion_si_id` resolved via `(select id from public.clasificaciones_si where slug = ...)`.

#### Required structural changes

1. **Add `criterios` array** to `seed-content.json` (5 entries: id=slug, nombre, descripcion, orden).
2. **Add `criterio_slug` field** to each `clasificaciones_si` entry to resolve `criterio_id` FK.
3. **Change `clasificacion_slug` → `clasificaciones_slugs` array** in each `software` entry (M2M: one software can reference N categories).
4. **Add new SQL section to `seed-to-sql.mjs`**:
   - Generate `INSERT INTO criterios_si` (WHERE NOT EXISTS by slug)
   - Generate `UPDATE clasificaciones_si SET criterio_id = (select id ... where slug = ...)` after criterios are seeded
   - Generate `INSERT INTO software_clasificaciones` (M2M junction inserts, keyed by software slug + clasificacion slug) — these should be idempotent (ON CONFLICT DO NOTHING)
5. **Remove** the `clasificacion_si_id` column from the `software` INSERT and UPDATE in `seed-to-sql.mjs` (lines 58–65).

**Data concern**: The 9 current categories in seed-content.json do not map 1:1 to the 20 categories in the new taxonomy. The seed data must be fully replaced. All 23 current software rows have a `clasificacion_slug` that points to the old flat taxonomy. These must be remapped to the new M2M model. This is a manual data authoring task (deciding which axes apply to each tool) — not a code generation task.

---

### Search impact — `buscar_hibrido` + embeddings

The hybrid search (`buscar_hibrido`) does NOT filter or rank by `clasificacion_si_id`. The vector leg uses cosine distance on `software.embedding` and the FTS leg uses `software.fts` (a generated tsvector of nombre+objetivo+descripcion_corta). Neither leg touches SI classification at all.

However, `clasificacion_si_id` appears in the function's `returns table(...)` declaration and in the final `SELECT s.clasificacion_si_id`. After removing the column from `software`, the function signature MUST change.

**Migration steps for search**:
1. `drop function public.buscar_hibrido(...)` (must DROP because the signature changes — `CREATE OR REPLACE` cannot alter the return type)
2. Re-create without `clasificacion_si_id` in the return table
3. Same for `software_relacionados` — but since it returns `id, slug, tema_id, nombre, ...` explicitly, just remove `clasificacion_si_id` from the list

The embed trigger `software_embed_trigger` watches `nombre, objetivo, descripcion_corta, tema_id` — does NOT watch `clasificacion_si_id`. No change needed to the trigger.

---

## Model Validation

The agreed model holds. No adjustments needed at the structural level. Specific findings:

| Model element | Code reality | Verdict |
|---|---|---|
| NEW `criterios_si` table | Does not exist | Correct — must be created |
| EVOLVE `clasificaciones_si` + `criterio_id` FK | Column missing | Correct — must be added |
| ADD `orden` to `clasificaciones_si` | **Already exists** (NOT NULL DEFAULT 0, added in `2026-06-10_not_null_hardening.sql`) | No action needed for `orden` |
| NEW junction `software_clasificaciones` | Does not exist | Correct — must be created |
| PURE M2M (no unique on software_id+criterio_id) | No junction at all yet | Correct — the new junction PK is `(software_id, clasificacion_si_id)` not `(software_id, criterio_id)` |
| DROP `software.clasificacion_si_id` | Column is nullable | Safe to drop (no NOT NULL blocker) |
| `temas` stay single-primary | `software.tema_id` is NOT NULL FK | Correct — no change |

One minor refinement on the junction PK: the agreed model says PK = `(software_id, clasificacion_si_id)`. This correctly allows a software to be in multiple categories of the same axis (two different `clasificacion_si_id` values under the same `criterio_id`). This is the right design — confirmed.

---

## Migration Surface (ordered by execution layer)

### Layer 1 — DB (SQL migrations, must be applied in order)

1. **New migration**: CREATE TABLE `criterios_si` (id uuid PK, nombre text NOT NULL, slug text UNIQUE NOT NULL, descripcion text, orden int NOT NULL DEFAULT 0)
2. **New migration**: ALTER TABLE `clasificaciones_si` ADD COLUMN `criterio_id` uuid REFERENCES criterios_si(id) ON DELETE RESTRICT — nullable first, set NOT NULL after seed
3. **New migration**: CREATE TABLE `software_clasificaciones` (software_id uuid REFERENCES software(id) ON DELETE CASCADE, clasificacion_si_id uuid REFERENCES clasificaciones_si(id) ON DELETE CASCADE, PRIMARY KEY (software_id, clasificacion_si_id))
4. **New migration**: RLS policies on `criterios_si` (select-to-anon, admin-write) + RLS on `software_clasificaciones` (select-to-anon, admin-write)
5. **New migration**: Admin write cleanup trigger on `criterios_si` (valoraciones cleanup — if criterios become rateable; if not, skip)
6. **Seed applied**: populate `criterios_si` + update `clasificaciones_si.criterio_id` + populate `software_clasificaciones` (see Seed layer)
7. **New migration**: ALTER TABLE `clasificaciones_si` ALTER COLUMN `criterio_id` SET NOT NULL (after seed confirms all rows have a criterio)
8. **New migration**: DROP COLUMN `software.clasificacion_si_id` — after junction data is verified
9. **New migration**: DROP FUNCTION + re-CREATE `buscar_hibrido` without `clasificacion_si_id` in returns
10. **New migration**: DROP FUNCTION + re-CREATE `software_relacionados` without `clasificacion_si_id` in returns

### Layer 2 — Seed (`db/seed-content.json` + `db/seed-to-sql.mjs`)

11. Add `criterios` array with 5 entries to `seed-content.json`
12. Add `criterio_slug` to each of the (new) `clasificaciones_si` entries (20 categories)
13. Replace `clasificacion_slug` (singular) with `clasificaciones_slugs` (array) in each software entry
14. Add `criterios` codegen block to `seed-to-sql.mjs`
15. Add `clasificaciones_si.criterio_id` update block to `seed-to-sql.mjs`
16. Add `software_clasificaciones` M2M insert block to `seed-to-sql.mjs` (ON CONFLICT DO NOTHING)
17. Remove `clasificacion_si_id` from the software INSERT/UPDATE in `seed-to-sql.mjs` (lines 58–65)

### Layer 3 — Types (`src/types/`)

18. Run `npm run gen:types` after each DB migration to regenerate `database.types.ts`
19. Add `CriterioSI` DTO to `dtos.ts` (`Tables<'criterios_si'>`)
20. Add `ClasificacionConCriterio` DTO: `ClasificacionSI & { criterio: CriterioSI }`
21. Remove no-longer-needed `clasificacion_si_id` references from manual DTO definitions (auto-handled by gen:types for `Software`)

### Layer 4 — Services (`src/services/`)

22. `clasificacionesService.ts`: update `listarClasificaciones()` to join criterio (`select('*, criterio:criterios_si(*)')`)
23. `clasificacionesService.ts`: update `obtenerClasificacion(slug)` similarly
24. `clasificacionesService.ts`: add `listarCriterios()` function
25. `clasificacionesService.ts`: add `obtenerCriterio(slug)` function
26. `softwareService.ts`: rewrite `listarPorClasificacion(clasificacionId)` to query junction
27. `softwareService.ts`: add `listarClasificacionesDeSoftware(softwareId)` returning `ClasificacionConCriterio[]`

### Layer 5 — Hooks (`src/hooks/`)

28. `useClasificaciones.ts`: no logic change; return type automatically gains `criterio` via new DTO
29. `useClasificacion.ts`: no logic change; same
30. `useSoftwarePorClasificacion.ts`: no logic change; underlying service query changes
31. Add `useCriterios.ts` hook
32. Add `useClasificacionesDeSoftware.ts` hook

### Layer 6 — UI pages (`src/pages/`)

33. `ClasificacionesPage.tsx`: rewrite `countPorClasif` to count via junction; group tiles by criterio axis (5 sections)
34. `ClasificacionDetallePage.tsx`: add criterio breadcrumb to hero; M2M tool list is automatic via hook
35. `SoftwareDetallePage.tsx`: add `useClasificacionesDeSoftware` call; render axis-labeled chips in the meta section
36. `TemaPage.tsx`: replace `sw.clasificacion_si_id` grouping with criterio-based grouping via junction query

---

## Risks and Dependencies

| Risk | Severity | Mitigation |
|---|---|---|
| `buscar_hibrido` + `software_relacionados` return `clasificacion_si_id` — dropping the column breaks these functions at the DB level | HIGH | Functions must be DROPped and re-CREATEd before or simultaneously with `DROP COLUMN`. Sequence: drop col → recreate functions. Apply as a single migration to prevent a broken window. |
| Seed data replacement: the 9 existing flat categories vs 20 new categories — old slugs (e.g. `redes-neuronales`, `sistemas-expertos`) don't exist in the new taxonomy | HIGH | The new seed must use `DELETE FROM clasificaciones_si WHERE slug IN (old slugs)` before inserting the 20 new ones, OR use a migration that truncates and reseeds. The `WHERE NOT EXISTS` idempotency guard in the current seed assumes slugs persist — they won't. New slugs must be authored. Clarify in spec: truncate + full reseed vs. slug-rename migration. |
| `clasificaciones_si.criterio_id` must be NOT NULL but can't be set until criterios exist and all rows are updated | MEDIUM | Use a 2-step migration: add nullable first, seed, then set NOT NULL. The migration file ordering already accounts for this. |
| `TemaPage.tsx` grouping by `clasificacion_si_id` will BREAK at compile time (TypeScript error) when `Software` loses that column | MEDIUM | This is a compile-time catch, not a runtime surprise. The fix is straightforward but requires a UI design decision on axis grouping (see Open Questions #1). |
| `ClasificacionesPage.tsx` `countPorClasif` reads `sw.clasificacion_si_id` from `useSoftwareTodos()` — same compile-time break | MEDIUM | Must be rewritten to use the M2M junction for counts. |
| Rating / valoraciones: `contenido_tipo = 'clasificacion_si'` records are tied to `clasificaciones_si.id` values. If old rows are deleted and new rows inserted with new UUIDs, existing ratings become orphaned | LOW | The `cleanup_valoraciones_on_content_delete` trigger fires on DELETE — so old ratings are cleaned up automatically. New rows start fresh. Acceptable data loss since this is a small corpus reseed. |
| The `software_embed_trigger` fires on `UPDATE OF nombre, objetivo, descripcion_corta, tema_id`. If the reseed UPDATEs software rows, the embed trigger fires and re-requests embeddings. This is EXPECTED behavior (and desirable since content may change). | INFO | No action needed; costs some Edge Function calls during reseed. |

---

## Open Questions

1. **TemaPage axis grouping**: with 5 axes, how should the tema detail page group its software? Options: (a) one rail per criterio axis that has matching software, (b) flat unsorted rail — no grouping, (c) group by primary category (pick one axis as "display" axis). This is a UI/UX decision, not a model decision. Recommend option (a) for coherence with the rest of the taxonomy UI.

2. **Seed transition strategy**: full truncate + reseed of `clasificaciones_si` (cleanest, breaks old URLs by ID) vs. slug-rename migration (preserves IDs, more migration complexity). Since `clasificaciones_si` rows are referenced by valoraciones (but those are cleaned up by the trigger on delete), a full truncate + reseed is simpler. Slug-based URLs (`/clasificaciones/:slug`) are unaffected by ID changes. **Recommend truncate + reseed**.

---

## Relevant Files

| File | Relevance |
|---|---|
| `db/seed.sql` | Generated output — touch via seed-to-sql.mjs only |
| `db/seed-content.json` | Primary seed data — must be restructured (criterios + M2M) |
| `db/seed-to-sql.mjs` | Seed generator — must be extended for 3 new sections |
| `db/2026-06-12_004_corte_adaptativo.sql` | LIVE `buscar_hibrido` — must be superseded to remove `clasificacion_si_id` from return type |
| `db/2026-06-13_008_software_relacionados.sql` | `software_relacionados` — must be superseded similarly |
| `db/2026-06-13_006_content_write_policies.sql` | Admin RLS patterns — new tables must follow same pattern |
| `src/types/database.types.ts` | Generated — do not edit; re-run `npm run gen:types` |
| `src/types/dtos.ts` | Add `CriterioSI`, `ClasificacionConCriterio` DTOs |
| `src/services/clasificacionesService.ts` | Add criterio join + new functions |
| `src/services/softwareService.ts` | Rewrite `listarPorClasificacion`, add `listarClasificacionesDeSoftware` |
| `src/hooks/useSoftwarePorClasificacion.ts` | No logic change; gets M2M data via service |
| `src/hooks/useClasificaciones.ts` | No logic change |
| `src/pages/ClasificacionesPage.tsx` | Rewrite count logic + grouping by criterio |
| `src/pages/ClasificacionDetallePage.tsx` | Add criterio breadcrumb |
| `src/pages/SoftwareDetallePage.tsx` | Add multi-axis SI chips |
| `src/pages/TemaPage.tsx` | Rewrite classification grouping (compile-time break) |
