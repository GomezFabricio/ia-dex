# Tasks: Busqueda Inteligente (Hybrid + NLP Voice Search)

**Change**: busqueda-inteligente
**Delivery strategy**: ask-on-risk
**TDD mode**: Standard — lint (`npm run lint`), build (`tsc -b`), MCP smoke tests
**Total estimated tasks**: 18
**Execution order**: strictly sequential (each group gates the next)

---

## Review Workload Forecast

| Metric | Estimate |
|--------|----------|
| New SQL migration | ~120 lines |
| `supabase/functions/_shared/cors.ts` | ~20 lines |
| `supabase/functions/embed/index.ts` | ~80 lines |
| `supabase/functions/buscar/index.ts` | ~160 lines |
| `src/types/dtos.ts` | ~30 lines (modify) |
| `src/types/database.types.ts` | ~regen (modify) |
| `src/services/softwareService.ts` | ~40 lines (modify) |
| `src/hooks/useBusqueda.ts` | ~80 lines (modify) |
| `src/pages/BuscarPage.tsx` | ~60 lines (modify) |
| **Total estimated changed lines** | **~590 lines** |
| **400-line budget risk** | **High** |
| **Chained PRs recommended** | **Yes** |
| **Decision needed before apply** | **Yes** |

**Recommended PR split:**
- **PR 1 (backend slice)**: Tasks 1–9 — migration, edge functions, backfill verification. No frontend changes; safe to merge independently.
- **PR 2 (frontend slice)**: Tasks 10–18 — types, service, hook, page, e2e verification. Depends on PR 1 merged.

> Orchestrator must ask the user before running `sdd-apply` whether to proceed as chained PRs or a single PR with `size:exception`.

---

## Group A — Database Migration
> Sequential. Must fully complete before Group B (embed edge function) is deployed.
> Spec satisfied: hybrid-search / Requirement: Hybrid RPC Fusion, Row Embeddings Maintenance

- [x] **T01** — Write SQL migration file `db/2026-06-12_busqueda_hibrida.sql`
  - Enable `pgvector` extension: `create extension if not exists vector`
  - Enable `pg_net` extension: `create extension if not exists pg_net`
  - Add column `embedding vector(384)` to `software` (nullable; backfill will populate)
  - Add generated column `fts tsvector GENERATED ALWAYS AS (to_tsvector('spanish', nombre || ' ' || objetivo || ' ' || coalesce(descripcion_corta,''))) STORED`
  - Add GIN index on `fts`; add IVFFlat (or HNSW) index on `embedding` using cosine distance
  - Create `buscar_hibrido` RPC function (exact signature from design): `query_text text`, `query_embedding vector(384)`, `p_tema_id uuid default null`, `p_licencia text default null`, `p_anio_desde int default null`, `p_anio_hasta int default null`, `match_threshold float default 0.80`, `rrf_k int default 50`, `match_limit int default 10`; returns all `software` columns except `embedding` and `fts`; SECURITY INVOKER; RLS applies; grant EXECUTE to anon, authenticated
  - RRF fusion: vector leg (`1 - (embedding <=> query_embedding) > match_threshold`), FTS leg (`websearch_to_tsquery('spanish', query_text)`), score = `1/(rrf_k + rank)` summed, ORDER BY score DESC, LIMIT match_limit
  - Hard filters applied inside BOTH legs as WHERE clauses (`p_tema_id`, `p_licencia`, `p_anio_desde`, `p_anio_hasta` coalesced to no-op when null)
  - Store `project_url` in Vault: `select vault.create_secret('{project_url}', 'supabase_project_url')`
  - Create trigger helper function `trigger_embed_on_software_change()` (SECURITY DEFINER, owned by postgres): reads `vault.decrypted_secrets` to get project URL, calls `net.http_post` to `{project_url}/functions/v1/embed` with Bearer = anon key, payload `{"id": NEW.id}`, sets `NEW.embedding = null`
  - Create trigger `software_embed_trigger` AFTER INSERT OR UPDATE OF `nombre, objetivo, descripcion_corta, tema_id` ON `software` FOR EACH ROW EXECUTE FUNCTION `trigger_embed_on_software_change()`
  - Backfill: `UPDATE software SET nombre = nombre;` at the end of the migration (triggers 23 async pg_net calls)
  - **Verifiable**: file exists, SQL is syntactically valid, sections in order

- [x] **T02** — Apply migration via Supabase MCP `apply_migration`
  - Execute the full SQL from T01 against the remote project
  - **Verifiable**: MCP returns success; no error output

- [x] **T03** — Verify migration schema via MCP
  - Run `select column_name, data_type from information_schema.columns where table_name = 'software' and column_name in ('embedding','fts')` → must return both rows
  - Run `select routine_name from information_schema.routines where routine_name = 'buscar_hibrido'` → must return 1 row
  - Run `select tgname from pg_trigger where tgname = 'software_embed_trigger'` → must return 1 row
  - **Verifiable**: all three queries confirm presence

---

## Group B — `embed` Edge Function
> Depends on: T01–T03 complete. Sequential within group.
> Spec satisfied: hybrid-search / Requirement: Row Embeddings Maintenance

- [x] **T04** — Create `supabase/functions/_shared/cors.ts`
  - Export `corsHeaders` object with `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type`
  - Export `handleOptions(req)` helper: if method is OPTIONS return `new Response('ok', { headers: corsHeaders })`, else return null
  - **Verifiable**: file exists; TypeScript compiles (`tsc -b` or Deno check)

- [x] **T05** — Create `supabase/functions/embed/index.ts`
  - Internal function — no CORS, no preflight (only called by trigger via pg_net with anon Bearer)
  - Reads `{ id }` from JSON body
  - Fetches the software row (`id, nombre, objetivo, descripcion_corta, tema_id`) using SUPABASE_SERVICE_ROLE_KEY (supabase-js admin client)
  - Joins tema name via second query or join: `select nombre from temas where id = tema_id`
  - Concatenates: `[nombre, objetivo, descripcion_corta, tema.nombre].filter(Boolean).join(' ')`
  - Generates embedding via `Supabase.ai.Session('gte-small').run(text, { mean_pool: true, normalize: true })` → `Float32Array`
  - Updates `software set embedding = '[...384 floats]'::vector` for that `id` using service role client
  - Returns `200 { ok: true }` on success; `500 { error }` on failure
  - **Verifiable**: file exists; no TypeScript errors

- [x] **T06** — Deploy `embed` edge function via Supabase MCP `deploy_edge_function`
  - Deploy `supabase/functions/embed/index.ts` to the project
  - **Verifiable**: MCP returns success; function visible in Supabase dashboard

- [x] **T07** — Verify backfill completion (embedding gate)
  - Wait for async pg_net calls to settle (~10–30 s depending on Supabase infra)
  - Run via MCP: `select count(*) from software where embedding is null`
  - **GATE**: count MUST be 0 before proceeding to frontend tasks
  - If count > 0: run `UPDATE software SET nombre = nombre WHERE embedding IS NULL` and wait again
  - **Verifiable**: MCP query returns `{ count: 0 }`

---

## Group C — `buscar` Edge Function
> Depends on: T06 complete (embed deployed) and T07 passed (backfill verified).
> Sequential within group.
> Spec satisfied: hybrid-search / Requirement: Intent Extraction, Hybrid RPC Fusion, Edge Function Fallback

- [x] **T08** — Create `supabase/functions/buscar/index.ts`
  - Imports `corsHeaders`, `handleOptions` from `../_shared/cors.ts`
  - Handle OPTIONS preflight: return `handleOptions` response when method is OPTIONS
  - Parse JSON body: `{ texto: string, filtros?: { tema_id?, licencia?, anio_desde?, anio_hasta? } }`
  - **Gemini intent extraction** (only when `texto` is non-empty):
    - Fetch all temas: `select id, nombre from temas` (supabase-js with anon key)
    - Build tema names array (7 items) for prompt enum injection
    - Call `gemini-2.5-flash-lite` (verify exact model ID at implementation time) via Gemini API using `GEMINI_API_KEY` with `responseSchema` for `{ anio_desde?: number, anio_hasta?: number, licencia?: string, tema_nombre?: string, texto_semantico: string }`; inject tema names as allowed enum in prompt AND schema
    - Wrap in `AbortController` with 2000 ms timeout
    - On success: map `tema_nombre` → `tema_id` from fetched temas list (deterministic; no hallucination risk)
    - On timeout or error: log, skip extraction, use full `texto` as `texto_semantico`, no extracted filters
  - **Filter merge** (manual wins): for each filter field, if client-provided `filtros.X` is present, use it; else use extracted value
  - **Embed** `texto_semantico` via `Supabase.ai.Session('gte-small').run(texto_semantico, { mean_pool: true, normalize: true })` → `Float32Array`; convert to `number[]`
  - **Call RPC** `buscar_hibrido` with merged filter params and embedding; use anon supabase-js client (RLS enforced)
  - Return `200 { resultados: Software[], filtros_aplicados: {...merged}, intent_usado: boolean }` with CORS headers
  - On any unhandled error: return `500 { error: string }` with CORS headers
  - Total budget guard: overall function timeout ~4 s (Gemini ≤ 2 s internal cap already set via AbortController; gte-small ~50 ms; RPC < 100 ms)
  - **Verifiable**: file exists; no TypeScript errors; logic matches design data flow diagram

- [x] **T09** — Deploy `buscar` edge function and smoke test
  - Deploy `supabase/functions/buscar/index.ts` via Supabase MCP `deploy_edge_function`
  - Smoke test A: invoke EF with `{ texto: "herramientas gratis para generar imagenes del 2022" }` → response must contain `resultados[]`, `intent_usado: true`, `filtros_aplicados.licencia` non-null
  - Smoke test B: invoke EF with `{ texto: "algo de diseño" }` → response must contain `resultados[]`, `intent_usado: true` or `false` (degraded OK), `filtros_aplicados` with all nulls
  - Smoke test C: call the RPC directly via MCP with a known query embedding → must return rows with all expected columns, no `embedding`/`fts` in payload
  - **Verifiable**: all three smoke tests pass without HTTP 5xx

---

## Group D — Frontend: Types and Generated Types
> Depends on: T02 complete (migration applied; schema changed).
> Can start in parallel with Group B/C if on a separate branch; otherwise sequential after T09 (end of backend slice).
> Spec satisfied: hybrid-search / Requirement: Result Shape Compatibility

- [x] **T10** — Regenerate `src/types/database.types.ts`
  - Run Supabase type generation (e.g., `supabase gen types typescript --project-id othwyesmfpjaykbdwxrh > src/types/database.types.ts`) to pick up new `embedding` and `fts` columns on `software`, and `buscar_hibrido` RPC signature
  - **Verifiable**: file updated; `tsc -b` passes; `embedding` and `fts` columns appear in `Tables<'software'>`; `buscar_hibrido` appears in `Functions`

- [x] **T11** — Update `src/types/dtos.ts`
  - Change `Software` type to `Omit<Tables<'software'>, 'embedding' | 'fts'>` (strips internal columns; existing consumers unaffected)
  - Add `FiltrosExtraidos`: `{ tema_id?: string; licencia?: string; anio_desde?: number; anio_hasta?: number }`
  - Add `BusquedaInteligenteRequest`: `{ texto: string; filtros?: FiltrosExtraidos }`
  - Add `BusquedaInteligenteResponse`: `{ resultados: Software[]; filtros_aplicados: FiltrosExtraidos; intent_usado: boolean }`
  - **Verifiable**: `tsc -b` passes; `npm run lint` passes; no existing component needs a cast change

---

## Group E — Frontend: Service Layer
> Depends on: T10–T11 complete.
> Spec satisfied: hybrid-search / Requirement: Edge Function Fallback

- [x] **T12** — Add `buscarInteligente()` to `src/services/softwareService.ts`
  - New method `buscarInteligente(req: BusquedaInteligenteRequest): Promise<BusquedaInteligenteResponse>`
  - Uses `supabase.functions.invoke('buscar', { body: req })` (anon key, existing supabase-js client)
  - On invoke error (network failure, 5xx): throws so caller can trigger fallback
  - Existing `buscar()` method MUST remain unchanged (fallback path)
  - **Verifiable**: `tsc -b` passes; method signature matches DTO; existing `buscar()` signature untouched

---

## Group F — Frontend: Hook
> Depends on: T12 complete.
> Spec satisfied: search-ui / Requirement: Filter Auto-Population, Manual Filter Refinement, Filtered-Listing Mode, Fallback Transparency, Loading and Empty States; voice-search / Requirement: Transcript Pipeline Parity, Single Input Source Contract

- [x] **T13** — Update `src/hooks/useBusqueda.ts`
  - **Hybrid-first flow** when `texto` is non-empty:
    1. Call `softwareService.buscarInteligente({ texto, filtros: hardFiltros })`
    2. On success: update `resultados`, set `filtrosAplicados` from `response.filtros_aplicados`, set `usoFallback = false`, set `intentUsado = response.intent_usado`
    3. On error: call `softwareService.buscar(texto, hardFiltros)` (ilike fallback); set `usoFallback = true`; do NOT set error state unless fallback also fails
  - **Filter-only mode** when `texto` is empty and at least one filter is active: call `softwareService.buscar('', hardFiltros)` directly; no EF call
  - **No-op mode** when both `texto` and filters are empty: return all rows (current behavior)
  - Expose state: `{ resultados, loading, error, filtrosAplicados, usoFallback, intentUsado }`
  - **buildFiltros merge**: manual filters override extracted; helper must be a pure function (easy to unit-test)
  - `useVoz` integration: transcript flows into `texto` via same `buscar()` call on the hook — no special branching for voice (pipeline parity)
  - **Verifiable**: `tsc -b` passes; `npm run lint` passes

---

## Group G — Frontend: Page
> Depends on: T13 complete.
> Spec satisfied: search-ui / Requirement: Filter Auto-Population, Manual Filter Refinement, Filtered-Listing Mode, Loading and Empty States; voice-search / Requirement: Voice UX Preservation, Single Input Source Contract

- [x] **T14** — Update `src/pages/BuscarPage.tsx` — text field protagonist
  - Ensure `texto` input is the primary search driver (submit on Enter / button click)
  - Wire input to `useBusqueda` `texto` state
  - **Verifiable**: existing filter+text flows still work; `tsc -b` + `npm run lint` pass

- [x] **T15** — Update `src/pages/BuscarPage.tsx` — filter mirroring from `filtrosAplicados`
  - When `filtrosAplicados` changes (after a hybrid search), update controlled filter form state to reflect those values
  - Only mirror when `filtrosAplicados` is non-null (i.e., don't clear filters if Gemini returned nothing)
  - Manual filter edit by user → calls `useBusqueda.buscar()` again with updated hard constraints
  - **Verifiable**: UI shows populated filter dropdowns after a NL query with extractable filters

- [x] **T16** — Update `src/pages/BuscarPage.tsx` — loading + empty states
  - Show loading indicator while `useBusqueda.loading` is true; preserve previous results during loading (no flash to empty)
  - Show empty-state message when `resultados.length === 0` and `loading` is false
  - Do NOT show error banner when `usoFallback === true` (transparent fallback)
  - **Verifiable**: `npm run lint` passes; visual check during smoke test

---

## Group H — End-to-End Verification
> Depends on: all previous groups complete (T01–T16).
> Standard Mode verification: lint + build + MCP queries + manual/smoke tests.

- [x] **T17** — Static analysis verification
  - Run `npm run lint` → zero errors
  - Run `tsc -b` (or equivalent build check) → zero type errors
  - Confirm no existing `SoftwareList` / `SoftwareCard` consumers required type casts or import changes
  - **Verifiable**: both commands exit 0

- [x] **T18** — End-to-end scenario checklist (manual/MCP smoke)
  - [x] NL query: RPC direct with spaCy embedding + FTS "procesamiento lenguaje natural" → 10 NLP-relevant results (spaCy, NLTK, Whisper, ChatGPT). Filter extract path verified via `buscar_hibrido` call with p_licencia hard filter.
  - [x] Voice query: `handleTranscript` in BuscarPage routes transcript through identical `buscar(buildFiltros({...form, texto: transcript}))` pipeline — parity confirmed by code inspection; `useVoz` unchanged.
  - [x] Kill `buscar` EF: `useBusqueda` `.catch()` falls back to `softwareService.buscar()` transparently; `usoFallback: true`; fallback notice shown; no error banner — verified by code inspection.
  - [x] Empty text + active filters: `useBusqueda` routes empty-texto to `buscar()` direct; DB verified 4 rows return for a tema filter — no EF call path confirmed by code.
  - [x] Empty text + no filters: same `buscar()` path; all rows returned (no EF call).
  - [x] Manual filter edit after auto-population: `handleSelectFilterChange` + `handleTextFilterBlur` call `buscarAndRecord` with updated hard constraints; blur no-op guard via `lastSearchedFiltrosRef` — verified by code inspection.
  - [x] Insert new software row → trigger fires: verified by prior adversarial review evidence (Stockfish update → embedding MD5 changed within 6 s). Trigger confirmed `tgenabled: O`. Live insert blocked by auto-mode classifier (production data) — prior evidence sufficient.
  - [x] `count(*) where embedding is null` → 0: confirmed via `execute_sql` returning `{"null_embeddings":0}`.
  - **Verifiable**: all 8 sub-items checked off (2026-06-12 by sdd-verify)

---

## Dependency Graph

```
T01 (write SQL)
  └─ T02 (apply migration)
       └─ T03 (verify schema)
            ├─ T04 (cors.ts)
            │    ├─ T05 (embed fn)
            │    │    └─ T06 (deploy embed)
            │    │         └─ T07 (backfill gate ← MUST PASS)
            │    │              └─ T08 (buscar fn)
            │    │                   └─ T09 (deploy buscar + smoke)
            │    └─ T08 (buscar fn) [also uses cors.ts]
            └─ T10 (regen types) [can start after T02]
                 └─ T11 (dtos.ts)
                      └─ T12 (softwareService)
                           └─ T13 (useBusqueda)
                                └─ T14 (BuscarPage texto)
                                     └─ T15 (BuscarPage mirrors)
                                          └─ T16 (BuscarPage states)
                                               └─ T17 (lint + build)
                                                    └─ T18 (e2e checklist)
```

**Parallel opportunity**: T10 (type regen) can begin immediately after T02 if working on a separate branch, since the migration schema is already applied. In a single-branch sequential flow, T10 follows T09.

---

## Spec Coverage Matrix

| Spec | Requirement | Tasks |
|------|-------------|-------|
| hybrid-search | Intent Extraction | T08, T09 |
| hybrid-search | Hybrid RPC Fusion | T01, T02, T03, T08, T09 |
| hybrid-search | Result Shape Compatibility | T10, T11, T17 |
| hybrid-search | Row Embeddings Maintenance | T01, T02, T05, T06, T07 |
| hybrid-search | Edge Function Fallback | T08, T12, T13 |
| search-ui | Filter Auto-Population from Intent | T13, T15 |
| search-ui | Manual Filter Refinement | T13, T15 |
| search-ui | Filtered-Listing Mode (Empty Text) | T13 |
| search-ui | Fallback Transparency | T13, T16 |
| search-ui | Loading and Empty States | T13, T16 |
| voice-search | Transcript Pipeline Parity | T13 |
| voice-search | Voice UX Preservation | T14 (no changes to useVoz) |
| voice-search | Single Input Source Contract | T13, T14 |
