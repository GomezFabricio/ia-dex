# Design: Busqueda Inteligente (Hybrid + NLP Voice Search)

## Technical Approach

One SQL migration (pgvector + FTS + hybrid RPC + pg_net trigger + backfill), two Edge Functions (`buscar` public pipeline, `embed` internal embedder), and a thin frontend layer that calls `buscar` with mandatory `ilike` fallback. Filters are hard WHERE constraints; text is soft ranking via RRF over vector + FTS legs.

## Architecture Decisions

### Decision: FTS via tsvector generated column (spanish config)

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `tsvector` generated column, `spanish` config, GIN index | Stemming for Spanish queries; no typo tolerance | **Chosen** |
| `pg_trgm` | Typo/partial tolerance, no stemming, extra extension | Rejected |

**Rationale**: semantic leg (vector) covers fuzziness; FTS leg adds precise Spanish lexical matching with stemming ("generadores" matches "generador"). Typos/partials remain covered by the `ilike` fallback. Column: `fts tsvector GENERATED ALWAYS AS (to_tsvector('spanish', nombre || ' ' || objetivo || ' ' || coalesce(descripcion_corta,''))) STORED`.

### Decision: Hybrid RPC signature

```sql
create function buscar_hibrido(
  query_text text,                 -- for websearch_to_tsquery('spanish', ...)
  query_embedding vector(384),
  p_tema_id uuid default null, p_licencia text default null,
  p_anio_desde int default null, p_anio_hasta int default null,
  match_threshold float default 0.80,  -- cosine similarity, vector leg only
  rrf_k int default 50, match_limit int default 10
) returns table (...all software columns EXCEPT embedding, fts...)
language sql stable security invoker;
grant execute ... to anon, authenticated;
```

- SECURITY INVOKER → RLS applies; anon-executable.
- Hard filters applied inside BOTH legs (vector + FTS) before RRF fusion.
- **Threshold strategy**: with 23 rows, pure top-k returns everything. The vector leg requires `1 - (embedding <=> q) > match_threshold` (gte-small similarities cluster high; 0.80 is a tunable parameter, not a constant). FTS leg self-filters (needs lexical match). RRF: `1/(rrf_k + rank)` summed across legs.
- Returns table excludes `embedding`/`fts` → payload stays lean and `Software[]`-compatible.

### Decision: Two Edge Functions (`buscar` + `embed`), not one with mode param

**Choice**: separate `supabase/functions/embed/` used by trigger + backfill.
**Alternatives**: single function with `mode` param — rejected.
**Rationale**: different auth surfaces (`buscar` = public anon + CORS; `embed` = internal, no CORS, writes via `SUPABASE_SERVICE_ROLE_KEY` env which `buscar` must never hold), different failure budgets, independently deployable.

### Decision: Trigger URL/auth via Vault

**Choice**: store `project_url` in Vault (`vault.create_secret`); trigger function (SECURITY DEFINER, owned by postgres) reads `vault.decrypted_secrets`, calls `net.http_post` to `{project_url}/functions/v1/embed` with the anon key as Bearer.
**Alternatives**: hardcoded URL constant (rejected: leaks env coupling into migration history, painful on project clone); service key in DB settings (rejected: secret-in-plaintext).
**Rationale**: this is the documented Supabase automatic-embeddings pattern; anon key is already public so storing it is low risk; `embed` itself escalates with service role internally.

- Trigger: AFTER INSERT OR UPDATE OF nombre, objetivo, descripcion_corta, tema_id; sets `embedding = null` then fires async pg_net call with `{id}`; `embed` recomputes from `nombre + objetivo + descripcion_corta + tema.nombre` and updates the row.
- **Backfill**: same migration ends with `update software set nombre = nombre;` → 23 async embed calls. Verification step: `select count(*) from software where embedding is null` must reach 0.

### Decision: Gemini intent extraction with tema-name enum

**Choice**: `gemini-2.5-flash-lite` (current Flash-Lite class model; pin exact id at implementation time) with `responseSchema` (structured output): `{anio_desde?, anio_hasta?, licencia?, tema_nombre?, texto_semantico}`. The 7 tema names are injected into the prompt AND as a schema enum; `buscar` maps name→id from a fetched tema list server-side.
**Alternatives**: Gemini returns `tema_id` directly (rejected: UUID hallucination risk); fuzzy-match tema in SQL (rejected: extra RPC, the corpus is 7 rows — prompt enum is deterministic and free).
**Rationale**: enum constrains output; server-side mapping guarantees a valid FK or null.

- **Degradation**: Gemini timeout (AbortController, 2000 ms) or error → skip extraction, full `texto` becomes `texto_semantico`, no extracted filters. Total function budget ~4 s: Gemini ≤2 s, gte-small `Supabase.ai.Session('gte-small')` ~50 ms local, RPC <100 ms.

### Decision: CORS `Access-Control-Allow-Origin: *`

**Rationale**: public read-only search behind the public anon key; no cookies/credentials. Avoids maintaining a Vercel-domain allowlist. Handle `OPTIONS` preflight explicitly.

### Decision: Frontend fallback + filter mirroring

- Manual filters sent in the request are HARD: `buscar` skips extraction for any field the client already provided (manual wins over Gemini).
- Empty `texto` + filters → frontend never calls the Edge Function; uses existing `buscar()` path (current behavior, zero regression).
- Any Edge Function error → `useBusqueda` falls back to `softwareService.buscar()` silently (results still render); `error` state only set if the fallback ALSO fails.
- `Software` DTO becomes `Omit<Tables<'software'>, 'embedding' | 'fts'>` after type regen — zero consumer churn (SoftwareList/SoftwareCard untouched).
- `useVoz` unchanged: transcript → same `buscar` pipeline.

## Data Flow

    BuscarPage (texto|voz, filtros) ──→ useBusqueda.buscar()
        texto vacío? ──yes──→ softwareService.buscar (ilike/eq)  [actual]
              │no
              ▼
        softwareService.buscarInteligente ──→ EF buscar
              │ error? ──→ fallback softwareService.buscar       [MANDATORY]
              ▼
        EF buscar: Gemini (intent, 2s cap) → gte-small (embed) → RPC buscar_hibrido
              ▼
        { resultados, filtros_aplicados, intent_usado } ──→ form mirrors filtros

    software INSERT/UPDATE ──trigger──→ pg_net ──→ EF embed ──service role──→ embedding

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `db/2026-06-12_busqueda_hibrida.sql` | Create | vector ext, embedding+fts columns, indexes, RPC, vault secret, trigger fn, backfill (applied via MCP apply_migration) |
| `supabase/functions/_shared/cors.ts` | Create | CORS headers + OPTIONS helper |
| `supabase/functions/buscar/index.ts` | Create | intent → embed → RPC pipeline |
| `supabase/functions/embed/index.ts` | Create | row embedding writer (service role) |
| `src/types/dtos.ts` | Modify | `Software` Omit; `BusquedaInteligenteRequest/Response`, `FiltrosExtraidos` |
| `src/types/database.types.ts` | Modify | regenerate after migration |
| `src/services/softwareService.ts` | Modify | add `buscarInteligente()` (`functions.invoke('buscar')`); keep `buscar()` |
| `src/hooks/useBusqueda.ts` | Modify | hybrid-first + fallback, expose `filtrosAplicados`, `usoFallback` |
| `src/pages/BuscarPage.tsx` | Modify | texto protagonist, mirror `filtros_aplicados` into form, manual edits re-run as hard constraints |

## Interfaces / Contracts

```ts
// EF buscar — request/response
type BusquedaInteligenteRequest = {
  texto: string
  filtros?: { tema_id?: string; licencia?: string; anio_desde?: number; anio_hasta?: number }
}
type BusquedaInteligenteResponse = {
  resultados: Software[]
  filtros_aplicados: { tema_id?: string; licencia?: string; anio_desde?: number; anio_hasta?: number }
  intent_usado: boolean   // false when Gemini was skipped/failed
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | useBusqueda fallback + filter-mirror reducer; buildFiltros merge | Vitest + mocked services |
| Integration | RPC: filters as hard WHERE, threshold excludes noise, RRF order | SQL via MCP execute against seeded rows |
| E2E (manual) | NL query text+voz, kill EF → ilike works, empty texto+filtros unchanged, embeddings count = 23 | Checklist in verify phase |

## Migration / Rollout

Single forward migration; down path: drop trigger, trigger fn, RPC, `embedding`/`fts` columns (extension stays). Deploy order: migration → `embed` → backfill verify → `buscar` → frontend. Frontend is safe at every step (fallback).

## Open Questions

- [ ] gte-small is English-centric; Spanish query/content similarity quality must be validated on the real 23 rows before locking `match_threshold` default (tune via RPC param, no redeploy).
- [ ] Pin exact Flash-Lite model id at implementation time (availability check).
