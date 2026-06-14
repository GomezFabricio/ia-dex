# SI Taxonomy — Faceted Two-Level M2M Taxonomy

Redesign the AI-systems ("SI") classification from a **flat list** into a **two-level faceted taxonomy**: 7 classification *criteria* (axes), each owning its *categories*, with a software tagged across many categories — many even within the same axis. This is a domain-modeling correction, applied end-to-end (DB → seed → types → services → hooks → UI) in one coordinated change, shipped as chained PRs on `feat/plan-mejoras`.

## Why

The current model says a software has **one** SI classification (`software.clasificacion_si_id`, a single nullable FK) chosen from a **flat** list of 9 categories. That flat list is itself wrong: its 9 entries are a *mix of categories pulled from different conceptual axes* (paradigm, learning type, ad-hoc groupings) flattened into one bucket. The course material this catalog teaches is explicitly a **faceted taxonomy**: AI systems are classified along several independent **criteria**, and each criterion has its own set of **categories**.

A single-FK model cannot represent this. Concrete example — a modern LLM (ChatGPT / Claude / Gemini):

- **Alcance y Capacidad** → IA Débil/Estrecha
- **Tipo de Aprendizaje** → Supervisado *and* Por Refuerzo *and* Deep Learning (three categories of the **same** axis at once: self-supervised pretraining + SFT + RLHF)
- **Paradigma y Representación** → IA Subsimbólica (and, for neuro-symbolic systems like AlphaGo/AlphaFold, *also* IA Simbólica)

The flat single-FK model forces us to pick **one** of those and discard the rest — it misrepresents the very subject the catalog exists to teach. We need (1) the axes as first-class entities, (2) categories that know which axis they belong to, and (3) a software-to-category relationship that is **many-to-many with no per-axis uniqueness** (a software can hold several categories within one axis).

## What changes

### Scope IN (by layer)

**DB**
- NEW table `criterios_si` (the 7 axes): `id`, `nombre`, `slug` (unique), `descripcion`, `orden`.
- EVOLVE `clasificaciones_si` (the categories): add `criterio_id` FK → `criterios_si` (nullable during seed, then `NOT NULL`). `orden` already exists — no action.
- NEW junction `software_clasificaciones` (PURE M2M): PK `(software_id, clasificacion_si_id)`, both FKs `ON DELETE CASCADE`. **No** unique on `(software_id, criterio_id)` — multiple categories per axis are allowed by design.
- DROP `software.clasificacion_si_id` (the old single FK; it is nullable, so the drop is unblocked).
- DROP + re-CREATE `buscar_hibrido` and `software_relacionados` — both declare `clasificacion_si_id` in their `returns table(...)` and `SELECT`, so they break the instant the column is dropped.
- RLS policies + admin-write patterns on the two new tables, mirroring `clasificaciones_si`.

**Seed**
- `db/seed-content.json`: add `criterios` array (7 entries); add `criterio_slug` to every category; replace `clasificacion_slug` (singular) with `clasificaciones_slugs` (array) per software; re-author the category set (the 7 axes / 25 categories from the course material) and remap all software across their axes.
- `db/seed-to-sql.mjs`: add criterios codegen, add `clasificaciones_si.criterio_id` update block, add `software_clasificaciones` M2M insert block (`ON CONFLICT DO NOTHING`), remove `clasificacion_si_id` from the software INSERT/UPDATE.
- `clasificaciones_si` is **truncated and reseeded** (the 9 old slugs do not exist in the new taxonomy).

**Types / Services / Hooks**
- Regenerate `database.types.ts` via `npm run gen:types` after each DB migration (generated file — never hand-edited).
- New DTOs in `dtos.ts`: `CriterioSI` (`Tables<'criterios_si'>`), `ClasificacionConCriterio` (`ClasificacionSI & { criterio: CriterioSI }`).
- `clasificacionesService`: join criterio into `listarClasificaciones` / `obtenerClasificacion`; add `listarCriterios`.
- `softwareService`: rewrite `listarPorClasificacion` to query the junction; add `listarClasificacionesDeSoftware(softwareId): ClasificacionConCriterio[]`.
- New hooks: `useCriterios`, `useClasificacionesDeSoftware`.

**UI**
- `ClasificacionesPage`: count tools via the junction; **group tiles by criterio** (one section per axis).
- `ClasificacionDetallePage`: add criterio breadcrumb to the hero (axis → category).
- `SoftwareDetallePage`: render one chip group per axis (additive — there is no SI chip today to replace).
- `TemaPage`: **rewrite** the SI grouping (today it groups by the single `clasificacion_si_id` — a hard compile-time break once that column is gone).

### Scope OUT (explicitly)

- **Assistant edge-function deploy** — separate, pending the user's OK. Not in this change.
- **Admin CRUD (T13 / M5)** — separate later cycle. *Future dependency:* once this taxonomy lands, the future admin software editor MUST support multi-axis category selection (multi-select per axis, writing rows into `software_clasificaciones`). Noted as future impact, not built here.
- **tema M2M** — temas stay single-primary (`software.tema_id` `NOT NULL`) this cycle.
- **Catalog clasif/criterio filter chips** — a nice enhancement, not in scope.

## Approach

### The two-level M2M model

```
criterios_si (axis)         clasificaciones_si (category)        software_clasificaciones (junction)
  id                          id                                   software_id ─────┐ FK→software
  nombre                      criterio_id ──FK→criterios_si        clasificacion_si_id ─┐ FK→clasificaciones_si
  slug (unique)               nombre                               PK (software_id, clasificacion_si_id)
  descripcion                 slug (unique)
  orden                       en_que_consiste / ejemplos / enlaces
                              orden  (already exists)
```

The junction PK is `(software_id, clasificacion_si_id)`, **not** `(software_id, criterio_id)`. That is the whole point: two rows can share a `software_id` and resolve (via `clasificaciones_si.criterio_id`) to the **same** axis with **different** categories — e.g. a software being both *Supervisado* and *Por Refuerzo* under *Tipo de Aprendizaje*. Pure M2M, no per-axis cap.

### Atomic migration strategy (the dependency knot)

The hard constraint is that `buscar_hibrido` and `software_relacionados` both surface `clasificacion_si_id`. Dropping the column without fixing them leaves a broken DB window. The safe order, applied so the column-drop and the function-recreate land **in the same migration** (no broken window):

1. CREATE `criterios_si`.
2. ALTER `clasificaciones_si` ADD `criterio_id` (nullable).
3. CREATE `software_clasificaciones`.
4. RLS + admin-write policies on both new tables.
5. **Seed runs** (criterios → set `clasificaciones_si.criterio_id` → populate junction). *Production seed requires explicit user OK.*
6. ALTER `clasificaciones_si` SET `criterio_id` NOT NULL (only after the seed guarantees every category has an axis).
7. In one atomic migration: DROP `software.clasificacion_si_id`; DROP + re-CREATE `buscar_hibrido` (no `clasificacion_si_id` in returns); DROP + re-CREATE `software_relacionados` (same). `CREATE OR REPLACE` cannot change a function's return type, so an explicit `DROP FUNCTION` is required first — there is already precedent for this in migration `004`.

The `criterio_id`-NOT-NULL gate is a deliberate two-step (add nullable → seed → enforce) so the constraint is never applied before data exists to satisfy it.

### Seed transition: truncate + reseed (RESOLVED)

The 9 current category slugs (`redes-neuronales`, `sistemas-expertos`, `ia-simbolica`, …) largely **do not exist** in the new taxonomy. The existing seed's `WHERE NOT EXISTS (slug)` idempotency guard assumes slugs persist — they won't, so a slug-based upsert cannot migrate the data (old rows would be orphaned, new ones inserted alongside). We therefore **truncate `clasificaciones_si` and reseed** the new category set.

Why this is safe: the slug-based URLs (`/clasificaciones/:slug`) are **UI route params, not foreign-key references** — no DB relationship points at a slug, so changing the row set breaks no FK. Old `valoraciones` rows of `contenido_tipo = 'clasificacion_si'` are cleaned up automatically by the existing `limpiar_valoraciones_clasif` trigger on delete — acceptable, deliberate data loss on a small teaching corpus that is being re-curated anyway. Truncate + reseed is strictly simpler than a slug-rename migration and carries no broken-reference risk.

### TemaPage SI grouping: one rail per criterio axis (RESOLVED)

Today `TemaPage` builds one rail per `clasificacion_si_id`. With the faceted model each software carries categories across multiple axes, so a naive "one rail per category" would explode to ~19 rails for ~7 tools and double-list software. We adopt the explore's recommendation: **one rail per criterio axis that has matching software** (a software appears in a rail if it holds any category of that axis). This mirrors the rest of the taxonomy UI (`ClasificacionesPage` also groups by axis), keeps the rail count bounded by the number of axes, and reads coherently. Rejected alternatives: a single flat unsorted rail (loses the pedagogical structure the redesign exists to surface) and a "pick one canonical axis" display (arbitrary, hides the multi-axis nature). This rewrite also resolves the unavoidable compile-time break when `Software` loses `clasificacion_si_id`.

## Impact

Touched at a high level (the explore holds the line-by-line migration surface):

| Layer | Touched | Nature |
|---|---|---|
| DB tables | `criterios_si` (new), `clasificaciones_si` (+`criterio_id`), `software_clasificaciones` (new), `software` (drop col) | structural |
| DB functions | `buscar_hibrido`, `software_relacionados` | drop + recreate (return-shape change) |
| DB policies | RLS + admin-write on the two new tables | additive (mirror existing) |
| Seed | `db/seed-content.json`, `db/seed-to-sql.mjs` (+ generated `db/seed.sql`) | restructure + load 25-category content from material; per-software mapping `[AUTHOR-WITH-USER]` |
| Types | `database.types.ts` (regenerated), `dtos.ts` (2 new DTOs) | generated + additive |
| Services | `clasificacionesService.ts`, `softwareService.ts` | join + rewrite + new fns |
| Hooks | `useCriterios` (new), `useClasificacionesDeSoftware` (new); existing clasif hooks unchanged in logic | additive |
| UI | `ClasificacionesPage`, `ClasificacionDetallePage`, `SoftwareDetallePage`, `TemaPage` | 2 rewrites + 2 additive |

Unaffected (verified in explore): `v_software_rating`, `v_software_populares`, `CatalogoPage`, `software_embed_trigger` (watches `tema_id`, not clasificacion), `puede_gestionar_contenido`, `handle_new_user`. Search ranking is untouched — `clasificacion_si_id` only appeared in the functions' return shape, never in the vector/FTS scoring.

**Future impact (out of scope, but a hard downstream dependency):** the future admin software editor (T13/M5) must do multi-axis category selection writing into `software_clasificaciones`.

## Risks and mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| `buscar_hibrido` + `software_relacionados` break the moment `software.clasificacion_si_id` is dropped | HIGH | Drop-column + drop/recreate-both-functions land in **one atomic migration** — no broken window. Explicit `DROP FUNCTION` before recreate (return type changes). |
| Old 9 category slugs vanish; slug-upsert can't migrate | HIGH | **Truncate + reseed** `clasificaciones_si`. Slugs are UI routes, not FKs → no broken references. Old ratings auto-cleaned by the delete trigger. |
| `TemaPage` + `ClasificacionesPage` reference `sw.clasificacion_si_id` → TypeScript compile error once the column is gone | MEDIUM | Both rewrites land **in the same PR** as the type regeneration. Compile-time catch, not a runtime surprise. |
| `clasificaciones_si.criterio_id` must be `NOT NULL` but can't be before seed | MEDIUM | Two-step: add nullable → seed → `SET NOT NULL`. |
| Reseed re-fires `software_embed_trigger` on updated rows | INFO | Expected and desirable (content may change); costs some Edge Function embedding calls during reseed. No action. |
| Production migration / EF deploy applied without the user's consent | PROCESS | **Every** production DB migration runs only after **explicit user OK**; the orchestrator applies via the Supabase MCP only once approved. |

## Delivery

Branch `feat/plan-mejoras`, **feature-branch-chain**, delivery **auto-chain** → this change ships as **chained PRs**; only the tracker branch merges to main, and **one** PR to main is opened at the very end. Suggested natural slice boundaries (each its own PR, child PRs target the previous PR's branch):

1. **DB + seed** — migrations (new tables, junction, RLS, the atomic drop-col + function recreate) and the restructured/re-authored seed. *Each production migration in this slice needs explicit user OK before it runs.*
2. **Types + services + hooks** — `gen:types`, the 2 new DTOs, `clasificacionesService` / `softwareService` changes, `useCriterios` / `useClasificacionesDeSoftware`.
3. **UI** — `ClasificacionesPage` + `TemaPage` rewrites, `ClasificacionDetallePage` breadcrumb, `SoftwareDetallePage` chips.

Slices 2 and 3 are the smaller, lower-risk halves; slice 1 carries the irreversible DB work and the user-approval gates. Verification per slice (no test runner — `strict_tdd: false`): `npm run lint` + `tsc -b` (build) + manual/Playwright visual checks on the affected pages. Code, UI copy, and commits in **English**; the domain model (table, column, and UI-copy names) stays **Spanish**.

## Open decisions

Both UI/seed decisions the explore flagged are **resolved above** (TemaPage → per-axis rails; seed → truncate + reseed) — no open blockers there.

- **Category count / exact category set — RESOLVED.** The final taxonomy is **7 axes / 25 categories** (Alcance 2, Russell & Norvig 4, Evolución 4, Aprendizaje 5, Paradigma 2, Naturaleza 6, Método 2). All 25 `en_que_consiste` descriptions are resolved from course material and pinned in spec T2 — no open authoring on category content. The **per-software axis mapping** (`clasificaciones_slugs` array per software entry) remains the only `[AUTHOR-WITH-USER]` task, to be co-authored during the Slice 1 seed slice.

- **Axis 6 structure — RESOLVED.** "Naturaleza y forma del conocimiento" is a **single flat axis** holding 6 leaf categories directly. Sub-dimensions (grado de abstracción, expresabilidad, contenido y objetivo) appear only as pedagogical context inside each category's `en_que_consiste` description — they are NOT DB entities. No `grupo` column is added to `criterios_si` or `clasificaciones_si`. The 2-level model (`criterio → categoría`) is unchanged.

- **Paradigma axis — RESOLVED.** Paradigma drops from 4 to 2 categories: `ia-simbolica` and `ia-subsimbolica`. `conocimiento-declarativo` and `conocimiento-procedimental` moved to Axis 6 (Naturaleza). The `paradigma-representacion` slug is retained but the nombre is updated to "Paradigma de representación del conocimiento".
