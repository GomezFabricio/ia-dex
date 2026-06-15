# si-taxonomy — Archive Report

**Archived:** 2026-06-14
**Change:** si-taxonomy
**Branch:** feat/plan-mejoras (local, NOT pushed)
**Verify verdict:** PASS-WITH-WARNINGS (zero CRITICALs; W1 & W2 fixed)
**Status:** Code-complete, committed locally, DB migration applied to PROD, frontend NOT deployed.

---

## 1. What shipped

### Domain model
Redesigned the "SI" (AI systems) classification from a flat 9-item list into a **2-level faceted taxonomy**: 7 axes (criterios) → 25 categories (clasificaciones) → pure M2M tagging of software.

### Database (applied to PROD, ref othwyesmfpjaykbdwxrh)
- **`criterios_si`** (new): the 7 axes — Alcance y capacidad, Modelos de Russell y Norvig, Evolución (Arend Hintze), Tipo de aprendizaje (ML), Paradigma de representación del conocimiento, Naturaleza y forma del conocimiento, Método de adquisición del conocimiento.
- **`clasificaciones_si`** (evolved): +`criterio_id` FK (NOT NULL), 25 categories total (2+4+4+5+2+6+2). Axis 6 "Naturaleza y forma del conocimiento" was flattened into a single axis with its 6 leaf categories (no `grupo` column needed).
- **`software_clasificaciones`** (new): pure M2M junction (PK `software_id`+`clasificacion_si_id`, both FK ON DELETE CASCADE, no per-axis unique). Replaced the single `software.clasificacion_si_id` column.
- **Atomic migration** `db/2026-06-14_009_si_taxonomy.sql`: applied in 3 gated tandas (structural DDL+RLS → seed → destructive finalize). Recreated `buscar_hibrido` and `software_relacionados` without the dropped column.
- **Catalog curated down to 7 tools** (one per tema, user-selected): Gymnasium, Protégé, TensorFlow, OpenCV, OR-Tools, ChatGPT, Whisper. Each M2M-tagged across its axes (59 junction rows total).
- **Index migration** `db/2026-06-14_010_idx_software_clasificaciones.sql`: WRITTEN, NOT applied (pending user OK).

### Data layer
- **DTOs:** `CriterioSI`, `ClasificacionConCriterio`.
- **Services:** `clasificacionesService` — `listarCriterios`, `listarClasificacionesDeSoftware`, `listarClasificacionesPorSoftwareIds` (batch, avoids N+1), criterio join on `listarClasificaciones`/`obtenerClasificacion`; `softwareService.listarPorClasificacion` rewritten to the junction.
- **Hooks:** new `useCriterios`, `useClasificacionesDeSoftware`, `useClasificacionCount`, `useClasificacionesPorSoftwareIds`; `useClasificaciones` retyped to `ClasificacionConCriterio[]`.

### UI (4 pages, cine-neural design preserved)
- **ClasificacionesPage:** 25 categories grouped into 7 sections by axis.
- **ClasificacionDetallePage:** criterio breadcrumb in the hero.
- **SoftwareDetallePage:** SI categories rendered as chips grouped per axis (`SIChipGroups`).
- **TemaPage:** each software shown ONCE in a grid (not one rail per axis — that repeated the tool in every axis); its per-axis chips are **collapsible** (`CollapsibleSIChips`, folded by default, `aria-expanded`/`aria-controls`).

### Adjacent change (separate concern, same branch)
- **Software detail by slug** (`routing/software-by-slug`): route `/software/:id` → `/software/:slug`, `softwareService.obtenerPorSlug`, slug-based links across cards/rankings (a frontend id→slug map covers the ranking views that only expose `software_id`).

---

## 2. Verification

- **Requirement coverage:** 17/17 implemented (T1, T2, M1, M2, D1, D2, TS1–TS3, UI1–UI4, SG1, SG2, XT1, XT2).
- **Tasks:** 26/26 checked (Slice 1: S1-T01..T12 DB+seed; Slice 2: S2-T01..T09 types/services/hooks; Slice 3: S3-T01..T05 UI).
- **Build:** `npm run lint` exit 0, `npx tsc -b` exit 0. Zero `clasificacion_si_id` references remain.
- **DB counts (live):** criterios_si=7, clasificaciones_si=25 (0 null criterio_id), software=7, software_clasificaciones=59.
- **Findings:** 0 CRITICAL. 2 WARNING (both fixed): W1 `useClasificaciones` return type stale → retyped, cast removed; W2 `useClasificacionesPorSoftwareIds` initial `loading` false → true. 1 SUGGESTION (slug routing out of scope, tracked separately).

---

## 3. Commits (feat/plan-mejoras, not pushed)

1. `247baa9` feat(taxonomy): add SI taxonomy schema, indexes, and seed data
2. `e4918b2` feat(taxonomy): add SI taxonomy types, service queries, and data hooks
3. `04bb1c0` feat(taxonomy): build ClasificacionesPage, ClasificacionDetallePage, and TemaPage
4. `9bf9671` feat(routing): resolve software detail pages by slug instead of id
5. `22baf13` docs(sdd): add si-taxonomy openspec artifacts
+ archive commit: `docs(sdd): archive si-taxonomy change`

---

## 4. Final state

- **Code:** committed locally on feat/plan-mejoras; build clean; NOT pushed.
- **Database:** migration 009 **APPLIED to PROD**; index migration 010 **NOT applied**.
- **Frontend:** **NOT deployed** — the prod DB is migrated but the deployed code is not, so the live site (old code) is out of sync until a deploy.

---

## 5. Pending follow-ups

1. **Apply index migration 010** (`idx_software_clasificaciones_clasif`) — additive, user-gated.
2. **Deploy / PR to main** — resync the live frontend with the already-migrated prod DB.
3. **Assistant in Spanish (#36)** — the Gemini assistant widget + `asistente` edge function are already built; pending: set the `GEMINI_API_KEY_ASISTENTE` secret, deploy the edge function, and make it answer in Spanish.
4. **Roadmap (#45)** — build a learning roadmap from the user's Sistemas Inteligentes course material (via a NotebookLM MCP the user will connect).

---

## 6. Archive convention

File-based openspec; no main `specs/` dir existed (no prior shared taxonomy spec). Change folder moved to `openspec/changes/archive/2026-06-14-si-taxonomy/` with all artifacts (explore, proposal, spec, design, tasks, verify-report) + this archive-report. No main-spec merge needed.

---

**si-taxonomy is closed.** Code-complete, verified (PASS-WITH-WARNINGS, zero blockers), committed locally, DB live in prod. Frontend deploy pending.
