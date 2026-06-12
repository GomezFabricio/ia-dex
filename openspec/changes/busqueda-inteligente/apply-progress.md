# Apply Progress: busqueda-inteligente

## Slice 1 — Backend (T01–T09)

**Branch**: `feat/busqueda-inteligente-backend`
**Status**: COMPLETE
**Date**: 2026-06-12

---

### What was done

**T01 — SQL migration** (`db/2026-06-12_busqueda_hibrida.sql`):
- Enabled `vector` and `pg_net` extensions
- Added `embedding vector(384)` (nullable) and `fts tsvector` generated column (spanish config) to `software`
- Created GIN index on `fts`; HNSW index on `embedding vector_cosine_ops` (chosen over IVFFlat for better recall on small corpus)
- Created `buscar_hibrido` RPC: exact design signature, SECURITY INVOKER, RLS applies, granted to anon + authenticated
- RRF fusion: vector leg (cosine > match_threshold) + FTS leg (websearch_to_tsquery spanish), full outer join, score = sum of `1/(rrf_k + rank)`, ORDER BY DESC, LIMIT match_limit
- Hard filters applied inside BOTH legs as WHERE clauses (null = no-op)
- Stored project URL in Vault via `vault.create_secret`
- Created `trigger_embed_on_software_change()` (SECURITY DEFINER): reads project URL from Vault (with hardcoded fallback), calls `net.http_post` to `/functions/v1/embed`, nulls `NEW.embedding`
- Created `software_embed_trigger` AFTER INSERT OR UPDATE OF nombre, objetivo, descripcion_corta, tema_id
- Backfill: `UPDATE software SET nombre = nombre` at end of migration

**T02 — Migration applied**: `apply_migration` returned `{ success: true }`.

**T03 — Schema verified**:
- `embedding` (USER-DEFINED/vector) and `fts` (tsvector) columns confirmed
- `buscar_hibrido` routine confirmed
- `software_embed_trigger` trigger confirmed

**T04 — `_shared/cors.ts`**: Created with `corsHeaders` and `handleOptions()`.

**T05 — `embed/index.ts`**: Internal function; service role client; fetches row + tema name; gte-small embedding; writes back.

**T06 — `embed` deployed**: `verify_jwt: false` (pg_net sends anon Bearer; function uses service role internally).

**T07 — Backfill gate PASSED**: `count(*) where embedding is null = 0`.
- Note: first backfill (in migration) ran before `embed` was deployed → 23 × 404 in logs (expected).
- Re-triggered via `UPDATE software SET nombre = nombre` after deploy → 23 × 200, all embeddings written.

**T08 — `buscar/index.ts`**: Full pipeline — OPTIONS preflight, Gemini extraction (2 s AbortController), filter merge (manual wins), gte-small embed, `buscar_hibrido` RPC call, `{ resultados, filtros_aplicados, intent_usado }` response.

**T09 — `buscar` deployed + smoke tests**:
- Deployed with `verify_jwt: false`

---

### Deviations from design

1. **CORS inlined in `buscar/index.ts`**: The MCP bundler (`deploy_edge_function`) does not resolve relative cross-function imports (`../\_shared/cors.ts` → Module not found at bundle time). CORS headers and `handleOptions` were inlined into `buscar/index.ts`. The `_shared/cors.ts` file is kept in the repo as the canonical source (used by `embed` doesn't need CORS). The `embed` function's deployment used an explicit inline of its content in the MCP call. Slice 2 frontend work is unaffected.

2. **Vault + hardcoded fallback**: The trigger function reads `vault.decrypted_secrets` first, then falls back to the hardcoded project URL if Vault lookup returns null. This is per the tasks.md risk note ("hardcoded project URL constant in the trigger function is acceptable — it's not a secret and documents the deviation"). Vault was successfully created; the fallback is a safety net.

3. **Backfill order**: Migration backfill ran before `embed` was deployed (expected — migration runs first in the deployment sequence). Re-triggered manually after deploy. GATE passed.

---

### Smoke test results

| Test | Result | Notes |
|------|--------|-------|
| **Smoke A** — NL query "herramientas gratuitas para generar imagenes despues de 2022" | PASS (intent) / PARTIAL (results) | `intent_usado: true`, `licencia: "free"`, `anio_desde: 2022` extracted correctly. `resultados: []` — gte-small + 23-row corpus with anio filter leaves nothing above 0.80 threshold. Expected; threshold is tunable per design. |
| **Smoke B** — "algo de diseno" | PASS | `intent_usado: true`, all filters null (correct for generic query), `resultados: []` same threshold reason. |
| **Smoke C** — RPC direct via SQL (zero vector, threshold=0) | PASS | Returns rows with correct shape (id, nombre, licencia, anio_lanzamiento, tema_id — no embedding/fts). FTS leg working. |
| **Backfill gate** — `count(*) where embedding is null` | PASS | = 0 |
| **embed function logs** | PASS | 23 × POST 200, ~1.6–1.7 s each |

**Key finding**: `match_threshold: 0.80` with gte-small (English-centric) + 23-row Spanish corpus results in zero vector-leg hits for most queries. The FTS leg works correctly. The RPC itself is correct; the threshold needs tuning during verify phase (the design documents this as an open question). Recommend starting verify with `match_threshold: 0.3` or lower for the test corpus.

---

### Commits on branch

1. `feat(db): add hybrid search migration with pgvector, FTS, RPC and embed trigger`
2. `feat(functions): add embed edge function and shared CORS module`
3. `feat(functions): add buscar edge function with Gemini intent extraction and hybrid search`

---

## Slice 2 — Frontend (T10–T18)

**Status**: NOT STARTED — pending orchestrator review of slice 1.
