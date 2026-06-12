# Proposal: Busqueda Inteligente (Hybrid + NLP Voice Search)

## Intent

Current search is a basic PostgREST `ilike` on `nombre`/`objetivo` with manual filters; voice search is dictation pasted into the text field. Users cannot search by meaning ("herramientas gratis para generar imagenes") and voice adds no intelligence. Goal: hybrid semantic + keyword search with natural-language intent extraction, where voice is just another input into the same pipeline.

## Scope

### In Scope
- Supabase Edge Function `buscar`: Gemini intent extraction (filters from natural language) + `gte-small` embedding (384 dims) + hybrid RPC call
- pgvector migration: enable extension, embedding column on `software`, hybrid search RPC (vector + FTS/trigram, RRF fusion, similarity threshold, hard WHERE filters)
- Row embeddings over `nombre + objetivo + descripcion_corta + tema`: pg_net trigger on change + backfill for the 23 existing rows
- Frontend: `BuscarPage` text field as protagonist; filters auto-populated from extracted intent (visible, editable); manual filter edits re-run search as hard constraints
- Mandatory fallback to current `ilike` search if the Edge Function fails
- Empty text + filters → plain filtered listing (current behavior preserved)

### Out of Scope
- Email verification / password recovery (separate change)
- Search analytics changes beyond what `useBusqueda` already logs
- Multi-language search, pagination, or ranking tuning beyond the threshold

## Capabilities

### New Capabilities
- `hybrid-search`: server-side pipeline — intent extraction, embedding, hybrid RPC (vector + keyword + filters), graceful degradation
- `search-ui`: natural-language search page behavior — filter mirroring, manual refinement, fallback, filtered-listing mode
- `voice-search`: voice transcript routed through the hybrid pipeline (same contract as text)

### Modified Capabilities
- None (no existing specs)

## Approach

Filters = hard constraints (WHERE); text = soft relevance (ranking). Text or voice transcript → Edge Function: (1) Gemini Flash-Lite structured extraction of `anio_desde/anio_hasta`, `licencia`, `tema`; (2) embed remaining semantic text via built-in `gte-small`; (3) one RPC fusing vector similarity + keyword match with RRF, filtered and thresholded. Frontend mirrors extracted filters and falls back to `ilike` on any failure.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `supabase/functions/buscar/` | New | Edge Function pipeline |
| `db/` (new SQL migration) | New | pgvector, embedding column, RPC, pg_net trigger, backfill |
| `src/services/softwareService.ts` | Modified | Call Edge Function; keep `buscar()` as fallback |
| `src/hooks/useBusqueda.ts` | Modified | Hybrid flow, intent-filter state, fallback path |
| `src/pages/BuscarPage.tsx` | Modified | UI restyle, filter mirroring |
| `src/hooks/useVoz.ts` | Modified | Route transcript into hybrid pipeline |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Gemini extraction fails/quota | Med | Skip extraction; treat full text as semantic query |
| Edge Function down/slow | Med | Mandatory frontend fallback to `ilike` |
| 23 rows → everything "matches" | High | Similarity threshold in RPC |
| Trigger/backfill misses rows | Low | Backfill script + trigger in same migration; verify counts |

## Rollback Plan

Frontend already falls back to `ilike`; revert frontend commits to restore current search. DB: drop trigger, RPC, and embedding column via down migration; pgvector extension can remain. Edge Function: delete deployment.

## Dependencies

- `GEMINI_API_KEY` Edge Function secret (already loaded)
- pgvector 0.8.0 available on project `othwyesmfpjaykbdwxrh` (not yet installed)

## Success Criteria

- [ ] Natural-language query (text or voice) returns relevant results with filters auto-extracted and visible in the UI
- [ ] Manual filter edits act as hard constraints and re-run the search
- [ ] All 23 rows have embeddings; new/updated rows re-embed automatically
- [ ] Killing the Edge Function still yields working `ilike` search (no dead search)
- [ ] Empty text + filters behaves exactly as today
