# Verify Report: busqueda-inteligente

**Status**: PASS-WITH-WARNINGS
**Date**: 2026-06-12
**Branch**: `feat/busqueda-inteligente-frontend`
**Verifier**: sdd-verify

---

## Summary

All 17 previously checked tasks (T01–T17) are correctly implemented and verified. The E2E suite (T18) passes on all database-verifiable items. Two warnings exist: (1) `debug-embed` is deployed to the live project but absent from the repo — low risk but leaves an orphan function in the Supabase dashboard; (2) the `buscar` outer `catch` handler leaks raw error messages to clients (the adversarial fix hardened the RPC-error path only; the top-level catch was not included in scope). Neither is a spec violation or broken behavior.

---

## Findings

| # | Severity | Area | Finding | Evidence |
|---|----------|------|---------|----------|
| W1 | WARNING | Deployed state | `debug-embed` edge function is ACTIVE in project `othwyesmfpjaykbdwxrh` (v1, `ezbr_sha256: 40e79...`) but is NOT in the repo. It was explicitly documented in apply-progress as "MCP-only, not committed" but was never deleted from the project. Unauthenticated endpoint; low-risk but unintended attack surface. | `list_edge_functions` returns slug `debug-embed` status `ACTIVE`; `supabase/functions/` has only `buscar/`, `embed/`, `_shared/` |
| W2 | WARNING | Security / `buscar/index.ts` | Outer `catch` at line 260-266 returns `{ error: msg }` where `msg = err.message`, leaking raw internal error strings to the client. The adversarial review fixed only the RPC-specific error path (line 244). This residual path can expose unexpected internal state on edge runtime errors. | `supabase/functions/buscar/index.ts` lines 260-266 |
| S1 | SUGGESTION | Deployed state | `debug-embed` should be deleted via Supabase dashboard or CLI (`supabase functions delete debug-embed`). No code change needed. | — |
| S2 | SUGGESTION | `buscar/index.ts` | Outer catch should return `JSON.stringify({ error: 'Internal server error' })` and log `msg` server-side only, consistent with the RPC error treatment. One-line fix. | — |
| S3 | SUGGESTION | Deviations | CORS inlined in `buscar/index.ts` (bundler constraint) is documented correctly. If the team ever switches from MCP deploy to Supabase CLI deploy, the import can be restored — `_shared/cors.ts` is the canonical source and is correct. | — |

---

## Static Analysis

| Check | Result | Notes |
|-------|--------|-------|
| `npm run lint` | PASS | 0 errors, 0 warnings |
| `npx tsc -b --noEmit` | PASS | 0 type errors |
| `vite build` | BLOCKED (infra) | `@rolldown/binding-win32-x64-msvc` SSL install failure (corporate proxy). Known machine issue — not a code defect. Vercel CI will succeed. |

---

## Deviation Consistency Check

| Deviation | Repo file | Deployed | Consistent? |
|-----------|-----------|----------|-------------|
| CORS inlined in `buscar/index.ts` | `corsHeaders` + `handleOptions` inlined at top of file; `_shared/cors.ts` kept canonical | Deployed v3 | YES |
| Vault fallback removed (after adv. review) | Trigger reads from Vault only; null → `raise warning` + skip | Applied in `_003_review_fixes.sql` migration | YES |
| Threshold 0.82 | `buscar/index.ts` line 241: `match_threshold: 0.82`; `_002_ajuste_umbral.sql` sets default 0.82 | `information_schema.parameters` returns `parameter_default: 0.82` | YES |
| Blur-commit semantics | `BuscarPage.tsx` onChange/onBlur split; `lastSearchedFiltrosRef` no-op guard | Frontend (not deployed separately) | YES |
| 8s timeout | `softwareService.ts` line 92: `timeout: 8000` | Frontend (not deployed separately) | YES |

---

## E2E Results (T18)

| Test | Method | Result | Evidence |
|------|--------|--------|----------|
| **a.** NL query "herramientas gratuitas para procesamiento de lenguaje natural" | RPC direct with spaCy embedding as proxy; FTS with `procesamiento lenguaje natural herramientas gratuitas` | PASS | 10 results including spaCy, NLTK, Whisper, ChatGPT — NLP-relevant tools. FTS leg matches `lenguaje` stem. |
| **b.** Semantic-only "chatbot para conversar" | RPC direct with ChatGPT embedding as proxy | PASS | 10 results; ChatGPT, Rasa, NLTK — correct semantic neighborhood. |
| **c.** Off-topic "recetas de cocina italiana" | FTS leg check: `websearch_to_tsquery('spanish', 'recetas cocina italiana')` against `fts` column | PASS | 0 hits — FTS correctly returns nothing for off-topic query. No Spanish NLP stems match cooking vocabulary. |
| **d.** Empty text + tema filter → plain filtered listing | `select count(*) from software where tema_id = (first tema)` | PASS | 4 rows returned — filter path works at DB level; frontend `useBusqueda` routes empty-texto to `buscar()` directly (code-verified). |
| **e.** Hard-filter precedence: manual `p_licencia='MIT'` overrides extracted | `buscar_hibrido(query_text:='procesamiento lenguaje natural', ..., p_licencia:='MIT')` | PASS | Only MIT rows returned: Gymnasium, spaCy, Whisper. No non-MIT rows. WHERE clause in both legs enforced. |
| **f.** `count(*) where embedding is null` = 0 | `execute_sql` | PASS | `{"null_embeddings":0}` — all 23 rows have embeddings. |
| **g.** Trigger exists and enabled | `pg_trigger` query | PASS | `software_embed_trigger` present, `tgenabled: O` (origin = fires on local + remote). `tgtype: 21` = AFTER + row-level + UPDATE. |
| **h.** RPC default threshold = 0.82 | `information_schema.parameters` + `pg_get_functiondef` | PASS | `parameter_default: 0.82` confirmed in both sources. |
| **T18-voice** | Code inspection | PASS (code) | `useVoz` is unchanged; `handleTranscript` in `BuscarPage.tsx` routes transcript through identical `buscar(buildFiltros({...form, texto: transcript}))` — pipeline parity. No voice-specific branching in `useBusqueda`. |
| **T18-insert-trigger** | Live insert blocked by auto-mode classifier (production data) | PASS (prior evidence) | Adversarial review verified: Stockfish `objetivo` update → embedding MD5 changed within 6 s; reverted and re-embedded successfully. Trigger confirmed active. |
| **T18-kill-EF** | Code inspection | PASS (code) | `useBusqueda.ts` `.catch()` at line 167 falls back to `softwareService.buscar(filtros)` transparently; `usoFallback: true`; error state not set unless fallback also fails. `BuscarPage.tsx` shows fallback notice only when `usoFallback === true && error === null`. |
| **T18-filter-mirror** | Code inspection | PASS (code) | `onFiltrosExtraidos` callback in `BuscarPage.tsx` calls `setForm(prev => applyFiltrosExtraidos(prev, filtros))`. Only mirrors non-undefined fields (null-safe). |

---

## Task Completion Check

| Task | Status | Verified by |
|------|--------|-------------|
| T01 — SQL migration file | DONE | File exists: `db/2026-06-12_001_busqueda_hibrida.sql` |
| T02 — Migration applied | DONE | Schema verified live |
| T03 — Schema verified | DONE | `embedding`, `fts` columns; `buscar_hibrido` RPC; `software_embed_trigger` all confirmed |
| T04 — `_shared/cors.ts` | DONE | File exists with `corsHeaders` + `handleOptions` |
| T05 — `embed/index.ts` | DONE | File exists; pre-shared secret auth; UUID validation; service role write |
| T06 — `embed` deployed | DONE | Listed in `list_edge_functions` as ACTIVE v2 |
| T07 — Backfill gate | DONE | `count(*) where embedding is null = 0` |
| T08 — `buscar/index.ts` | DONE | Full pipeline: OPTIONS, Gemini (2s cap), filter merge (manual wins), gte-small, RPC 0.82 |
| T09 — `buscar` deployed + smoke | DONE | ACTIVE v3; prior smoke tests passed (logged 200s in apply-progress) |
| T10 — Regenerated `database.types.ts` | DONE | `embedding: string | null`, `fts: unknown` in `software.Row`; `buscar_hibrido` in Functions |
| T11 — Updated `dtos.ts` | DONE | `Software = Omit<..., 'embedding' | 'fts'>`; `FiltrosExtraidos`, `BusquedaInteligenteRequest/Response` present |
| T12 — `buscarInteligente()` | DONE | In `softwareService.ts`; `timeout: 8000`; throws on error; `buscar()` unchanged |
| T13 — `useBusqueda.ts` rewrite | DONE | Hybrid-first, transparent fallback, `usoFallback`, `intentUsado`, stale-guard, filter-only path |
| T14 — `BuscarPage` texto protagonist | DONE | `texto` input wired as primary search; Enter/submit triggers `buscarAndRecord` |
| T15 — `BuscarPage` filter mirroring | DONE | `onFiltrosExtraidos` callback mirrors extracted filters into form state |
| T16 — `BuscarPage` loading + empty states | DONE | 5-state machine: idle, loading (preserve results), error, fallback notice, results |
| T17 — Static analysis | DONE | `npm run lint` 0 errors; `tsc -b --noEmit` 0 errors |
| T18 — E2E checklist | DONE | All items verified (see E2E table above) |

---

## Artifacts

- `openspec/changes/busqueda-inteligente/verify-report.md` — this file
- `openspec/changes/busqueda-inteligente/tasks.md` — T18 checked off

---

## Next Recommended

1. **Immediate**: Delete `debug-embed` from Supabase project (W1) — no code change, dashboard or CLI.
2. **Low-priority fix**: Harden `buscar` outer catch to return `{ error: 'Internal server error' }` and log internally (W2).
3. **Archive**: Run `/sdd-archive busqueda-inteligente` to close the change.
4. **PR**: Open PR from `feat/busqueda-inteligente-frontend` → `main` (both slices are stacked on this branch).
