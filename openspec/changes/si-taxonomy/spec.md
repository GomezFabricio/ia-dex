# si-taxonomy — Delta Specifications

All capabilities in this change are new domains (no existing spec). Specs are written as FULL specs.
The 25-category set is pinned in full below (requirement T1). The per-software axis mapping (which
catalog tools map to which categories in the junction) is marked `[AUTHOR-WITH-USER]` — that is the
only remaining open-authoring task; all 25 category descriptions are resolved from the course material.

Process constraint: every production DB migration or EF deploy MUST receive explicit user approval
before the orchestrator applies it via the Supabase MCP. This is not a runtime scenario — it is a
mandatory gate before any migration step in Slice 1.

---

# Capability 1: Taxonomy Model (criterios_si + clasificaciones_si)

## Purpose

Introduce the two-level faceted taxonomy: 7 first-class axis entities (`criterios_si`) and 25
categories (`clasificaciones_si`) each linked to exactly one axis via `criterio_id`. Axis 6
("Naturaleza y forma del conocimiento") is a FLAT single axis holding its 6 leaf categories
directly — no `grupo` column is needed. The 2-level model (criterio → categoría) is unchanged.

## Requirements

### Requirement: T1 — criterios_si Table with 7 Axes

The database MUST have a table `criterios_si (id uuid PK, nombre text NOT NULL, slug text UNIQUE NOT
NULL, descripcion text, orden int NOT NULL DEFAULT 0)` seeded with exactly the following 7 rows:

| orden | slug | nombre |
|---|---|---|
| 1 | alcance-capacidad | Alcance y Capacidad |
| 2 | russell-norvig | Modelos de Russell & Norvig |
| 3 | evolucion-hintze | Evolución / Arend Hintze |
| 4 | tipo-aprendizaje | Tipo de Aprendizaje / ML |
| 5 | paradigma-representacion | Paradigma de representación del conocimiento |
| 6 | naturaleza-conocimiento | Naturaleza y forma del conocimiento |
| 7 | metodo-adquisicion | Método de adquisición del conocimiento |

#### Scenario: 7 axes seeded and queryable

- GIVEN the seed for Slice 1 has been applied
- WHEN `SELECT slug FROM criterios_si ORDER BY orden` is executed
- THEN exactly 7 rows are returned in the order above
- AND each row has a non-null `slug`, `nombre`, and `orden`

### Requirement: T2 — clasificaciones_si Gains criterio_id and 25 Pinned Categories

`clasificaciones_si` MUST gain `criterio_id uuid REFERENCES criterios_si(id) ON DELETE RESTRICT`
(nullable during seed, then SET NOT NULL). After reseed, the table MUST contain exactly 25 rows
matching the pinned set below. Each category MUST have a stable `slug`, a non-null `nombre`,
`criterio_id` resolved from the axis slug, and non-null `en_que_consiste`. The `ejemplos` field
is provided where the course material supplies them; remaining `ejemplos` are `[AUTHOR-WITH-USER]`.

**Pinned 25-category set (source of truth — content from course material):**

**Axis 1: Alcance y Capacidad (`alcance-capacidad`)**

| slug | nombre | en_que_consiste | ejemplos |
|---|---|---|---|
| ia-debil-estrecha | IA Débil (o Estrecha) | Diseñada para realizar tareas específicas y limitadas. No posee comprensión general del mundo. Es el tipo de IA utilizado actualmente. | Siri, Alexa, sistemas de reconocimiento de voz, recomendadores de contenido. |
| ia-fuerte-general | IA Fuerte (IAG) | Capaz de realizar cualquier tarea intelectual que pueda realizar un ser humano. Razonamiento general, adaptación y aprendizaje amplio. Actualmente es un concepto teórico. | (concepto teórico — sin ejemplos implementados) |

**Axis 2: Modelos de Russell & Norvig (`russell-norvig`)**

| slug | nombre | en_que_consiste | ejemplos |
|---|---|---|---|
| sistemas-que-piensan-como-humanos | Sistemas que piensan como humanos | Buscan reproducir los procesos cognitivos humanos. Relacionados con la Ciencia Cognitiva. | (existing seed content) |
| sistemas-que-actuan-como-humanos | Sistemas que actúan como humanos | Intentan comportarse de manera indistinguible de una persona. Referencia clásica: Prueba de Turing. | (existing seed content) |
| sistemas-que-piensan-racionalmente | Sistemas que piensan racionalmente | Utilizan lógica formal para llegar a conclusiones correctas. Se basan en reglas y razonamiento lógico. | (existing seed content) |
| sistemas-que-actuan-racionalmente | Sistemas que actúan racionalmente | Buscan tomar la mejor decisión posible para alcanzar un objetivo. Base de los agentes inteligentes modernos. | (existing seed content) |

**Axis 3: Evolución / Arend Hintze (`evolucion-hintze`)**

| slug | nombre | en_que_consiste | ejemplos |
|---|---|---|---|
| maquinas-reactivas | Máquinas Reactivas | No poseen memoria. Responden únicamente al estado actual del entorno. No aprenden de experiencias pasadas. | Deep Blue. |
| memoria-limitada | Memoria Limitada | Utilizan información reciente para mejorar sus decisiones. Aprenden de experiencias previas. | Vehículos autónomos. |
| teoria-de-la-mente | Teoría de la Mente | Comprenderían emociones, intenciones y necesidades humanas. Aún no existen plenamente. | (concepto teórico) |
| autoconciencia | Autoconciencia | Poseerían conciencia de sí mismas y de su existencia. Concepto teórico. | (concepto teórico) |

**Axis 4: Tipo de Aprendizaje / ML (`tipo-aprendizaje`)**

| slug | nombre | en_que_consiste | ejemplos |
|---|---|---|---|
| aprendizaje-supervisado | Aprendizaje Supervisado | Aprende mediante datos etiquetados. Conoce previamente las respuestas correctas. | Filtros de spam, predicción de precios, diagnóstico asistido. |
| aprendizaje-no-supervisado | Aprendizaje No Supervisado | Trabaja con datos sin etiquetar. Busca patrones y agrupaciones ocultas. | Clustering. |
| aprendizaje-semi-supervisado | Aprendizaje Semi-supervisado | Combina datos etiquetados y no etiquetados. Reduce la necesidad de etiquetar grandes volúmenes. | `[AUTHOR-WITH-USER]` |
| aprendizaje-por-refuerzo | Aprendizaje por Refuerzo | Aprende mediante recompensas y castigos. Busca maximizar una recompensa acumulada. | AlphaGo. |
| deep-learning | Aprendizaje Profundo (Deep Learning) | Subcampo del ML. Redes neuronales profundas con múltiples capas. | Visión por computadora, PLN, reconocimiento de voz. |

**Axis 5: Paradigma de representación del conocimiento (`paradigma-representacion`)**

| slug | nombre | en_que_consiste | ejemplos |
|---|---|---|---|
| ia-simbolica | IA Simbólica | Representa el conocimiento mediante símbolos y reglas explícitas. Lógica, reglas de producción, sistemas expertos. | (existing seed content) |
| ia-subsimbolica | IA Subsimbólica | El conocimiento está implícito en estructuras matemáticas. Redes neuronales, algoritmos evolutivos, métodos estadísticos. | (existing seed content) |

**Axis 6: Naturaleza y forma del conocimiento (`naturaleza-conocimiento`) — FLAT, 6 categories**

Note: sub-dimensions (grado de abstracción, expresabilidad, contenido y objetivo) appear only in each
category's description as pedagogical context — they are NOT DB entities and NO `grupo` column exists.

| slug | nombre | en_que_consiste | ejemplos |
|---|---|---|---|
| conocimiento-teorico | Conocimiento Teórico | Basado en teorías, modelos y generalizaciones. Busca explicar fenómenos. (dimensión: grado de abstracción) | `[AUTHOR-WITH-USER]` |
| conocimiento-empirico | Conocimiento Empírico | Basado en la experiencia directa y la observación. Surge de casos prácticos. (dimensión: grado de abstracción) | `[AUTHOR-WITH-USER]` |
| conocimiento-explicito | Conocimiento Explícito | Fácil de documentar, almacenar y transmitir. (dimensión: expresabilidad) | Manuales, procedimientos, bases de conocimiento. |
| conocimiento-tacito | Conocimiento Tácito | Difícil de expresar formalmente. Basado en experiencia e intuición. (dimensión: expresabilidad) | Reconocer una cara familiar. |
| conocimiento-declarativo | Conocimiento Declarativo | Describe hechos, conceptos o relaciones. Responde qué es verdadero o falso (¿Qué?). (dimensión: contenido y objetivo) | `[AUTHOR-WITH-USER]` |
| conocimiento-procedimental | Conocimiento Procedimental | Describe procesos y métodos. Explica cómo realizar una tarea (¿Cómo?). (dimensión: contenido y objetivo) | `[AUTHOR-WITH-USER]` |

**Axis 7: Método de adquisición del conocimiento (`metodo-adquisicion`)**

| slug | nombre | en_que_consiste | ejemplos |
|---|---|---|---|
| aprendizaje-deductivo | Aprendizaje Deductivo | El conocimiento es transferido directamente por expertos humanos. Característico de los sistemas expertos. Basado en reglas definidas manualmente. | `[AUTHOR-WITH-USER]` |
| aprendizaje-inductivo | Aprendizaje Inductivo | El sistema extrae conocimiento a partir de datos y ejemplos. Característico de Machine Learning, redes neuronales, minería de datos. | `[AUTHOR-WITH-USER]` |

**Category count per axis:** Alcance 2 + Russell&Norvig 4 + Hintze 4 + Aprendizaje 5 + Paradigma 2 + Naturaleza 6 + Método 2 = **25 categories across 7 axes**.

**Slug reuse from existing seed:** `ia-simbolica`, `ia-subsimbolica`, and the 4 Russell & Norvig slugs carry over their current `en_que_consiste` and `ejemplos` from `seed-content.json`. The criterion slug for axis 2 changed from `modelos-russell-norvig` to `russell-norvig` and axis 4 from `tipo-aprendizaje-ml` to `tipo-aprendizaje` — apply these in the seed accordingly.

**Paradigma axis note:** Previously had 4 categories (including Declarativo/Procedimental). Those two moved to Axis 6 (Naturaleza). Paradigma now has exactly 2 categories: `ia-simbolica` and `ia-subsimbolica`.

#### Scenario: Reseed produces exactly 25 categories linked to axes

- GIVEN the Slice 1 seed has been applied (truncate + reseed of clasificaciones_si)
- WHEN `SELECT c.slug, x.slug AS criterio_slug FROM clasificaciones_si c JOIN criterios_si x ON c.criterio_id = x.id ORDER BY x.orden, c.orden` is executed
- THEN exactly 25 rows are returned
- AND each row has a non-null `criterio_id`
- AND no row has a null `en_que_consiste`

#### Scenario: Old slugs absent after reseed

- GIVEN the Slice 1 seed has been applied
- WHEN `SELECT count(*) FROM clasificaciones_si WHERE slug IN ('sistemas-expertos','redes-neuronales','algoritmos-geneticos')` is executed
- THEN count returns 0

#### Scenario: criterio_id enforces NOT NULL after seed

- GIVEN all 25 rows have criterio_id set after the seed step
- WHEN `ALTER TABLE clasificaciones_si ALTER COLUMN criterio_id SET NOT NULL` is applied
- THEN the migration succeeds without constraint violation

---

# Capability 2: M2M Tagging (software_clasificaciones)

## Purpose

Replace the single-FK `software.clasificacion_si_id` with a pure many-to-many junction
`software_clasificaciones`, allowing a software to be tagged with multiple categories across
(and within) axes.

## Requirements

### Requirement: M1 — software_clasificaciones Junction

The database MUST have a table `software_clasificaciones (software_id uuid REFERENCES software(id)
ON DELETE CASCADE, clasificacion_si_id uuid REFERENCES clasificaciones_si(id) ON DELETE CASCADE,
PRIMARY KEY (software_id, clasificacion_si_id))`. There MUST NOT be a unique constraint on
`(software_id, criterio_id)` — multiple categories per axis are allowed by design.

#### Scenario: A software is tagged with multiple categories of the same axis

- GIVEN a software "ChatGPT" is seeded in the junction with slugs `aprendizaje-supervisado`,
  `aprendizaje-por-refuerzo`, and `deep-learning` (all under `tipo-aprendizaje`)
- WHEN `SELECT count(*) FROM software_clasificaciones sc JOIN software s ON sc.software_id = s.id
  JOIN clasificaciones_si c ON sc.clasificacion_si_id = c.id WHERE s.slug = 'chatgpt'
  AND c.criterio_id = (SELECT id FROM criterios_si WHERE slug = 'tipo-aprendizaje')` is executed
- THEN count returns 3

#### Scenario: A software is tagged across multiple axes

- GIVEN a modern LLM seeded with: ia-debil-estrecha (Alcance), aprendizaje-supervisado +
  aprendizaje-por-refuerzo + deep-learning (Aprendizaje), ia-subsimbolica (Paradigma)
- WHEN `SELECT count(*) FROM software_clasificaciones WHERE software_id = :id` is executed
- THEN count returns 5 (one per category across three axes)

#### Scenario: Junction is idempotent on reseed

- GIVEN the seed runs `INSERT INTO software_clasificaciones ... ON CONFLICT DO NOTHING`
- WHEN the seed is applied twice
- THEN no duplicate rows exist and no error is raised

### Requirement: M2 — RLS and Admin-Write Policies on Both New Tables

`criterios_si` and `software_clasificaciones` MUST have Row Level Security ENABLED with:
- SELECT policy: `USING (true)` for `anon` and `authenticated`
- INSERT / UPDATE / DELETE policies: `USING / WITH CHECK (public.puede_gestionar_contenido())`
  mirroring the pattern in `db/2026-06-13_006_content_write_policies.sql`

#### Scenario: Anonymous read succeeds on new tables

- GIVEN RLS is enabled with the SELECT `USING (true)` policy
- WHEN an anonymous client reads `criterios_si` or `software_clasificaciones`
- THEN rows are returned (not empty or error)

#### Scenario: Non-admin write blocked

- GIVEN an unauthenticated client (anon key)
- WHEN it attempts to INSERT into `software_clasificaciones`
- THEN the insert is rejected by RLS

---

# Capability 3: Removal of software.clasificacion_si_id

## Purpose

Drop the old single-FK column and atomically repair `buscar_hibrido` and `software_relacionados`
so search remains functional with the updated return shape.

## Requirements

### Requirement: D1 — Atomic Column Drop + Function Recreate

`software.clasificacion_si_id` MUST be dropped. In the SAME migration that drops the column,
`buscar_hibrido` MUST be DROPped and re-CREATEd (removing `clasificacion_si_id` from its
`RETURNS TABLE` and `SELECT`), and `software_relacionados` MUST be DROPped and re-CREATEd
likewise. The `DROP FUNCTION` is required before recreate because the return type changes
(`CREATE OR REPLACE` cannot alter return type). There MUST be no broken DB window between these
operations.

#### Scenario: Search works after column drop

- GIVEN the atomic migration (drop column + recreate both functions) has been applied
- WHEN `buscar_hibrido` is called with a valid query
- THEN results are returned without error
- AND no result row contains a `clasificacion_si_id` field

#### Scenario: software_relacionados works after column drop

- GIVEN the atomic migration has been applied
- WHEN `software_relacionados` is called with a valid software id
- THEN results are returned without error
- AND no result row contains a `clasificacion_si_id` field

#### Scenario: TypeScript build passes after gen:types

- GIVEN the atomic migration has been applied and `npm run gen:types` has been run
- WHEN `tsc -b` is executed
- THEN the build exits with code 0 (no TypeScript errors)
- AND `database.types.ts` does not reference `clasificacion_si_id` in the `software` row shape
  or in the return shapes of `buscar_hibrido` / `software_relacionados`

### Requirement: D2 — Seed Removes clasificacion_si_id from software Inserts

`seed-to-sql.mjs` MUST NOT emit `clasificacion_si_id` in the `software` INSERT or UPDATE
statement. The `clasificacion_slug` field in `seed-content.json` MUST be replaced by
`clasificaciones_slugs` (array) per software entry, driving the M2M junction inserts.

Per-software axis mapping (which categories apply to each of the ~23 tools) is a human
data-authoring task that MUST be co-authored with the user during the Slice 1 seed slice.
The spec marks this mapping as `[AUTHOR-WITH-USER]`.

#### Scenario: Seed SQL contains no clasificacion_si_id column for software

- GIVEN `seed-to-sql.mjs` has been updated
- WHEN the generated `db/seed.sql` is inspected
- THEN no occurrence of `clasificacion_si_id` appears in the software INSERT or UPDATE block

---

# Capability 4: Types, Services, and Hooks

## Purpose

Update the TypeScript layer to reflect the new taxonomy model: regenerate DB types, add new DTOs,
update services to join via the junction, and add two new hooks.

## Requirements

### Requirement: TS1 — database.types.ts Regenerated After Each Migration

`database.types.ts` MUST be regenerated via `npm run gen:types` after each DB migration in
Slice 1 and committed in the same PR changeset (following cross-cutting requirement X2 from
plan-mejoras). After the final migration, the generated file MUST:
- Contain `Tables<'criterios_si'>` and `Tables<'software_clasificaciones'>`
- NOT contain `clasificacion_si_id` in `Tables<'software'>` Row/Insert/Update
- NOT contain `clasificacion_si_id` in `Functions.buscar_hibrido` or
  `Functions.software_relacionados` return shapes

### Requirement: TS2 — New DTOs in dtos.ts

`src/types/dtos.ts` MUST export:
- `CriterioSI` — `Tables<'criterios_si'>`
- `ClasificacionConCriterio` — `ClasificacionSI & { criterio: CriterioSI }`

The `Software` DTO (`Omit<Tables<'software'>, 'embedding' | 'fts'>`) automatically loses
`clasificacion_si_id` after gen:types — no manual edit required.

#### Scenario: ClasificacionConCriterio carries axis context

- GIVEN `useClasificacionesDeSoftware` is called with a valid software id
- WHEN the hook returns data
- THEN each item in the array is of type `ClasificacionConCriterio` with a non-null `criterio` object
- AND `criterio.slug` matches one of the 7 axis slugs

### Requirement: TS3 — Service and Hook Surface

The following functions MUST exist:

**clasificacionesService.ts**
- `listarClasificaciones()` — MUST join criterio: `select('*, criterio:criterios_si(*)')`
- `obtenerClasificacion(slug)` — MUST include criterio join
- `listarCriterios()` — returns all 7 criterios ordered by `orden`

**softwareService.ts**
- `listarPorClasificacion(clasificacionId)` — MUST query via junction (no `software.clasificacion_si_id`)
- `listarClasificacionesDeSoftware(softwareId)` — returns `ClasificacionConCriterio[]` via junction
  joining `clasificaciones_si` and `criterios_si`

**New hooks**
- `useCriterios()` — wraps `listarCriterios()`
- `useClasificacionesDeSoftware(softwareId)` — wraps `listarClasificacionesDeSoftware`

#### Scenario: listarPorClasificacion returns tools tagged via junction

- GIVEN software "ChatGPT" is tagged with `deep-learning` in `software_clasificaciones`
- WHEN `listarPorClasificacion(deepLearningId)` is called
- THEN the returned array includes "ChatGPT"

#### Scenario: listarClasificacionesDeSoftware returns multi-axis result

- GIVEN "ChatGPT" is tagged with ia-debil-estrecha, deep-learning, and ia-subsimbolica
- WHEN `listarClasificacionesDeSoftware(chatgptId)` is called
- THEN the result has 3 items each with a populated `criterio` object
- AND each item's `criterio.slug` is one of the 7 valid axis slugs

---

# Capability 5: UI Behavior

## Purpose

Update the four affected pages to consume the faceted taxonomy: grouped tiles by axis, axis
breadcrumb on detail pages, per-axis chip groups on software detail, and per-axis rails on tema.

## Requirements

### Requirement: UI1 — ClasificacionesPage Groups by Axis

`ClasificacionesPage` MUST render 7 sections (one per criterio ordered by `orden`), each containing
the category tiles that belong to that axis. Tool count per category MUST be sourced from the junction
(not from `software.clasificacion_si_id`). The existing flat tile list MUST be replaced.

#### Scenario: 7 sections rendered with correct category counts

- GIVEN the reseed is applied and ClasificacionesPage loads
- WHEN a user navigates to the classifications page
- THEN 7 labelled sections are visible, each titled with the criterio nombre
- AND each section contains 2–6 category tiles (matching the pinned count per axis)
- AND each tile shows the tool count sourced from the junction

#### Scenario: Page compiles without clasificacion_si_id reference

- GIVEN `Software` type no longer has `clasificacion_si_id`
- WHEN `tsc -b` is run on the project
- THEN ClasificacionesPage compiles without TypeScript errors

### Requirement: UI2 — ClasificacionDetallePage Shows Axis Breadcrumb

`ClasificacionDetallePage` MUST display the criterio axis name as a breadcrumb label in the
hero section (e.g., "Paradigma y Representación → IA Simbólica"). The criterio data MUST be
sourced from `ClasificacionConCriterio.criterio` (not a separate fetch).

#### Scenario: Breadcrumb reflects correct axis

- GIVEN the user navigates to `/clasificaciones/ia-simbolica`
- WHEN the page renders
- THEN the hero section shows "Paradigma de representación del conocimiento" as the parent axis label
- AND "IA Simbólica" as the category title

### Requirement: UI3 — SoftwareDetallePage Shows Per-Axis SI Chips

`SoftwareDetallePage` MUST render one chip group per axis that has at least one category assigned
to the current software. Each group MUST be labelled with the criterio nombre. Each chip within
the group MUST show the category nombre. These chips are NEW — no existing SI chip is replaced.

#### Scenario: Multi-axis chips rendered for a multi-tagged software

- GIVEN "ChatGPT" is tagged with ia-debil-estrecha (Alcance), deep-learning +
  aprendizaje-por-refuerzo (Aprendizaje), and ia-subsimbolica (Paradigma)
- WHEN the user navigates to ChatGPT's detail page
- THEN 3 chip groups are visible (Alcance y Capacidad, Tipo de Aprendizaje / ML, Paradigma de representación del conocimiento)
- AND the Aprendizaje group shows 2 chips

#### Scenario: No chips rendered when software has no junction rows

- GIVEN a software with no entries in `software_clasificaciones`
- WHEN SoftwareDetallePage renders
- THEN no SI chip group section is shown (no empty container)

### Requirement: UI4 — TemaPage Shows Each Software Once with Per-Axis Category Chips (Collapsible)

`TemaPage` MUST render each software in the tema EXACTLY ONCE — displayed in a single card grid,
NOT in per-axis rails (which caused every software to repeat in each axis rail it belonged to,
showing a tool 6–7× per page via M2M). Each card MUST have its SI categories accessible behind a
**collapsible toggle** (`CollapsibleSIChips`): folded by default so the grid stays focused on the
tools; clicking the "Clasificación SI" toggle reveals the per-axis chips grouped per criterio.
The toggle MUST be an accessible `<button>` with `aria-expanded` and `aria-controls` attributes.
`SIChipGroups` remains the inner renderer (same chip classes as `SoftwareDetallePage`). The per-axis
rail grouping logic MUST be removed entirely. The batch hook `useClasificacionesPorSoftwareIds` MUST
be used to fetch categories for all tema software in one query (no N+1). If a software has no
junction entries, it is still shown once (without the toggle).

#### Scenario: Each software appears exactly once

- GIVEN a tema has software tools tagged across multiple axes (M2M junction)
- WHEN TemaPage renders for that tema
- THEN each software card appears exactly ONCE in the grid (not once per axis)
- AND each card has a "Clasificación SI" toggle below it (collapsed by default)
- AND no software is duplicated regardless of how many axes it belongs to

#### Scenario: Classification toggle collapsed by default

- GIVEN TemaPage renders for any tema with classified software
- WHEN the page first loads
- THEN the "Clasificación SI" toggle button is visible with `aria-expanded="false"`
- AND the per-axis chip groups are NOT visible (hidden behind the toggle)
- AND the card grid remains the primary visual focus

#### Scenario: Chips revealed on toggle click

- GIVEN the "Clasificación SI" toggle is collapsed
- WHEN the user clicks the toggle button
- THEN `aria-expanded` changes to `true`
- AND the per-axis chip groups appear, grouped by criterio and sorted by criterio.orden

#### Scenario: Chips grouped per axis after expansion

- GIVEN a software tagged with ia-debil-estrecha (Alcance), deep-learning (Aprendizaje), ia-subsimbolica (Paradigma)
- WHEN TemaPage renders that card and the user expands the toggle
- THEN chips are grouped into 3 axis sections (Alcance, Aprendizaje, Paradigma)
- AND each section label shows the criterio nombre
- AND chips are sorted by criterio.orden

#### Scenario: Page compiles after clasificacion_si_id removal

- GIVEN `Software` type no longer has `clasificacion_si_id`
- WHEN `tsc -b` is run
- THEN TemaPage compiles without TypeScript errors
- AND no runtime reference to `sw.clasificacion_si_id` remains in the page

---

# Capability 6: Seed Integrity and Migration Correctness

## Purpose

Ensure the full seed pipeline is structurally correct (criterios + M2M inserts, no old FK),
the per-software mapping is co-authored, and the atomic migration leaves no broken window.

## Requirements

### Requirement: SG1 — seed-content.json Structure Updated

`db/seed-content.json` MUST contain:
- A `criterios` array with exactly 7 entries (slug, nombre, descripcion, orden)
- Each `clasificaciones_si` entry MUST have `criterio_slug` pointing to one of the 7 axis slugs
- Each `software` entry MUST replace `clasificacion_slug` (singular) with `clasificaciones_slugs`
  (array) — the per-software axis mapping is `[AUTHOR-WITH-USER]` and MUST be completed before
  the Slice 1 seed is generated

#### Scenario: Generator emits M2M junction inserts

- GIVEN `seed-to-sql.mjs` has been updated
- WHEN `node db/seed-to-sql.mjs` is run
- THEN the generated `db/seed.sql` contains an `INSERT INTO software_clasificaciones` block
- AND that block uses `ON CONFLICT DO NOTHING`
- AND the block does NOT reference `clasificacion_si_id` on the `software` table

### Requirement: SG2 — No Broken DB Window During Column Drop

The migration that drops `software.clasificacion_si_id` MUST also (in the same transaction):
1. DROP FUNCTION `buscar_hibrido` (explicit drop required — return type changes)
2. Re-CREATE `buscar_hibrido` without `clasificacion_si_id` in returns
3. DROP FUNCTION `software_relacionados`
4. Re-CREATE `software_relacionados` without `clasificacion_si_id` in returns

The column drop and both function recreates MUST land in a single migration file with no
intervening commit point that could leave the DB in an inconsistent state.

#### Scenario: Migration applied atomically

- GIVEN the column-drop migration is applied
- WHEN the migration completes
- THEN `software_relacionados` and `buscar_hibrido` are callable and return results
- AND `\d software` in psql shows no `clasificacion_si_id` column
- AND `npm run lint` passes with no errors

---

# Cross-cutting for si-taxonomy

### Requirement: XT1 — Domain Language Invariant

All DB table names, column names, category `nombre` and `slug` values, and UI copy MUST remain
in Spanish. Code identifiers, commit messages, and TypeScript file contents MUST be in English.
This applies to all layers of this change.

#### Scenario: slug format

- GIVEN any category or axis row
- WHEN `slug` is inspected
- THEN it uses lowercase kebab-case with Spanish words (e.g. `ia-debil-estrecha`, not `weak-ai`)

### Requirement: XT2 — Build Integrity at Each Slice Boundary

At the completion of each PR slice (DB+seed, Types+Services+Hooks, UI), `npm run lint` AND
`tsc -b` MUST exit with code 0. No TypeScript errors referencing `clasificacion_si_id` may exist
after Slice 2 is merged.

#### Scenario: Full build clean after Slice 2

- GIVEN Slices 1 and 2 have been merged
- WHEN `npm run lint && tsc -b` is run
- THEN both exit with code 0
- AND no `clasificacion_si_id` reference remains in TypeScript source files
