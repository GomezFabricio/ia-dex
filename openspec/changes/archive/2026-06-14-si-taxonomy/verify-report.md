# si-taxonomy — Verify Report

**Date:** 2026-06-14
**Verdict: PASS-WITH-WARNINGS**
**Zero CRITICALs → change is archive-ready.**

---

## Overall Summary

All 26 tasks across Slices 1–3 are checked. Build is clean. DB counts match the spec exactly. Every spec requirement is covered by the implementation. Two WARNINGs noted (both non-blocking).

---

## 1. Requirement Coverage

| Req | Description | Status | Evidence |
|---|---|---|---|
| T1 | criterios_si table with 7 axes | PASS | DB: 7 rows, order matches spec slugs |
| T2 | clasificaciones_si — criterio_id + 25 categories | PASS | DB: 25 rows, 0 null criterio_id |
| M1 | software_clasificaciones junction (no per-axis cap) | PASS | Table exists, composite PK, no unique on criterio_id |
| M2 | RLS + admin-write policies on both new tables | PASS | relrowsecurity=true on both; policies mirror 006 pattern |
| D1 | Atomic column drop + buscar_hibrido + software_relacionados recreate | PASS | Column gone from `software`; both functions live in pg_proc without clasificacion_si_id |
| D2 | Seed removes clasificacion_si_id from software INSERT | PASS | No reference in software INSERT/UPDATE block of seed.sql |
| TS1 | database.types.ts regenerated | PASS | Contains criterios_si + software_clasificaciones; software Row clean; function returns clean |
| TS2 | CriterioSI + ClasificacionConCriterio DTOs | PASS | Both exported from dtos.ts |
| TS3 | Service + hook surface (5 funcs + 2 hooks) | PASS | All 5 functions + useCriterios + useClasificacionesDeSoftware + useClasificacionesPorSoftwareIds (bonus) present |
| UI1 | ClasificacionesPage groups by axis | PASS | Uses useCriterios + porCriterio Map + section-per-criterio render; counts from junction |
| UI2 | ClasificacionDetallePage criterio breadcrumb | PASS | clasif.criterio?.nombre → clasif.nombre rendered in hero kicker |
| UI3 | SoftwareDetallePage per-axis SI chips | PASS | useClasificacionesDeSoftware + SIChipGroups, groups by criterio.id sorted by criterio.orden |
| UI4 | TemaPage — software once + CollapsibleSIChips | PASS | PosterCard grid, no rails, CollapsibleSIChips with aria-expanded/aria-controls, SIChipGroups |
| SG1 | seed-content.json structure (criterios array + criterio_slug + clasificaciones_slugs) | PASS | 7 criterios, 25 classifications each with criterio_slug, all 7 software entries have clasificaciones_slugs arrays |
| SG2 | No broken DB window | PASS | Steps 7–10 in single migration file; both functions recreated in same transaction block |
| XT1 | Domain language invariant | PASS | All slugs kebab-case Spanish; code identifiers English |
| XT2 | Build integrity at each slice boundary | PASS | npm run lint: exit 0; npx tsc -b: exit 0 (zero errors) |

---

## 2. Task Completion

All 26 tasks checked across 3 slices:

- **Slice 1 (S1-T01 through S1-T12):** ✅ all 12 checked
- **Slice 2 (S2-T01 through S2-T09):** ✅ all 9 checked
- **Slice 3 (S3-T01 through S3-T05):** ✅ all 5 checked

No unchecked tasks found in tasks.md.

---

## 3. Build Health

| Check | Result |
|---|---|
| `npm run lint` | EXIT 0 — clean |
| `npx tsc -b` | EXIT 0 — zero errors |
| TypeScript reference to `clasificacion_si_id` | NONE found in any .tsx/.ts source file |

---

## 4. DB Counts (Supabase project `othwyesmfpjaykbdwxrh`)

| Table / Query | Expected | Actual |
|---|---|---|
| `criterios_si` rows | 7 | **7** |
| `clasificaciones_si` rows | 25 | **25** |
| `clasificaciones_si WHERE criterio_id IS NULL` | 0 | **0** |
| `software` rows | 7 | **7** |
| `software_clasificaciones` rows | 59 | **59** |
| Old slugs (sistemas-expertos, redes-neuronales, algoritmos-geneticos) | 0 | **0** |
| `criterios_si` slugs ORDER BY orden | matches spec T1 | **7 rows, exact match** |
| RLS on criterios_si | true | **true** |
| RLS on software_clasificaciones | true | **true** |
| `software.clasificacion_si_id` column | absent | **absent (0 rows in information_schema)** |
| `buscar_hibrido` in pg_proc | present | **present, no clasificacion_si_id in RETURNS TABLE** |
| `software_relacionados` in pg_proc | present | **present, no clasificacion_si_id in RETURNS TABLE** |

---

## 5. Design Consistency

| Design Decision | Implementation | Status |
|---|---|---|
| D1: Single atomic migration, ordered steps 1–10 | `db/2026-06-14_009_si_taxonomy.sql` with all 10 steps | MATCH |
| D2: Function recreation (DROP + CREATE) | Steps 9–10 in migration | MATCH |
| D3: M2M query patterns (PostgREST embedded selects) | `software_clasificaciones.select('clasificaciones_si(*, criterios_si(*))')` | MATCH |
| D4: DTOs derived from Tables<> | CriterioSI = Tables<'criterios_si'>, ClasificacionConCriterio extends ClasificacionSI | MATCH |
| D5: Service/hook surface | All 5 service functions + 3 hooks (incl. batch hook bonus) | MATCH |
| D6: UI — reuse cine-neural system, no redesign; TemaPage chips-per-card + collapsible | CollapsibleSIChips with aria-expanded/aria-controls, SIChipGroups reused in both TemaPage and SoftwareDetallePage | MATCH |
| D7: Seed generator (seed-to-sql.mjs) | 3 new sections, FK removed from software block, ON CONFLICT DO NOTHING on junction | MATCH |
| Axis 6 flat (no grupo column) | No grupo column in migration or types | MATCH |
| Collapsible UX (UI4 update) | CollapsibleSIChips — useState(false), aria-expanded, aria-controls, id={panelId} | MATCH |

---

## 6. Findings by Severity

### CRITICAL (0)

None.

### WARNING (2)

**W1 — `useClasificaciones` hook type annotation is stale**
- File: `src/hooks/useClasificaciones.ts`
- The hook is typed as returning `ClasificacionSI[]` (line 2, 12, 20) but `clasificacionesService.listarClasificaciones()` now returns `ClasificacionConCriterio[]`. `ClasificacionesPage` works around this with an explicit `as ClasificacionConCriterio[]` cast (line 63). TypeScript accepts this because `ClasificacionConCriterio` extends `ClasificacionSI`, so the assignment is structurally sound — but the hook's public signature misleads callers.
- Non-blocking: tsc passes because the cast is valid; runtime is correct.
- Recommendation: Update `useClasificaciones` to return `ClasificacionConCriterio[]` and remove the cast in `ClasificacionesPage`. Low-effort cleanup, zero risk.

**W2 — `useClasificacionesPorSoftwareIds` initialState has `loading: false` vs other hooks' `loading: true`**
- File: `src/hooks/useClasificacionesPorSoftwareIds.ts` (line 27)
- All other hooks (`useCriterios`, `useClasificaciones`, etc.) initialize with `loading: true`. This hook starts with `loading: false`, which means a consumer could briefly see the empty-Map state before the effect fires, without a loading indicator.
- Non-blocking: TemaPage guards correctly with `(software.loading || junctionMap.loading)` so the skeleton shows while software is still loading, masking the batch hook's gap. At runtime the batch fetch starts immediately after softwareIds are ready.
- Recommendation: Align to `loading: true` for consistency, or document the intentional deviation (skip variant semantics: starts idle, not loading).

### SUGGESTION (1)

**S1 — Adjacent routing change (software-by-slug) is not part of si-taxonomy scope**
- `src/services/softwareService.ts` and `src/pages/SoftwareDetallePage.tsx` implement `obtenerPorSlug` (slug-based routing instead of id-based), noted in engram as `routing/software-by-slug`. This is a separate improvement living alongside the si-taxonomy changes but out of scope for this spec. No action required here.

---

## 7. Scope Note

The `software`-detail-by-slug routing change (`obtenerPorSlug` in `softwareService.ts`, slug param in `SoftwareDetallePage`) is an adjacent improvement recorded separately under `routing/software-by-slug`. It does not affect si-taxonomy verification — it is architecturally clean and does not introduce any regression against the si-taxonomy spec.

---

## Conclusion

**Verdict: PASS-WITH-WARNINGS**

Zero CRITICALs. The change is **archive-ready**. W1 (stale hook type) and W2 (loading initialState) are minor consistency issues recommended as a follow-up cleanup task — neither blocks archiving.
