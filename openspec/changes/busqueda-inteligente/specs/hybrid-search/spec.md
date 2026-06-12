# Hybrid Search Specification

## Purpose

Server-side pipeline that accepts a text query and hard-filter constraints, returns ranked `Software[]` results via semantic + keyword fusion, and degrades gracefully to `ilike` search on failure.

## Requirements

### Requirement: Intent Extraction

The Edge Function MUST accept a raw natural-language string in Spanish and call Gemini Flash-Lite to extract structured filters (`anio_desde`, `anio_hasta`, `licencia`, `tema`) plus a remaining semantic text string.

#### Scenario: Successful extraction

- GIVEN a natural-language query such as "herramientas gratis para generar imagenes del 2022"
- WHEN the Edge Function calls Gemini Flash-Lite for structured extraction
- THEN it returns `{ licencia: "free", tema: "imagen", anio_desde: 2022, texto_semantico: "generar imagenes" }`
- AND the extracted filters are passed as hard WHERE constraints to the RPC

#### Scenario: Extraction failure — graceful degradation

- GIVEN the Gemini API is unavailable or returns a malformed response
- WHEN extraction fails for any reason
- THEN the Edge Function MUST treat the full original query text as the semantic input
- AND MUST NOT surface an error to the caller; the search continues with reduced precision

#### Scenario: No extractable filters

- GIVEN a query that contains no year, license, or topic signals (e.g., "algo para diseño web")
- WHEN extraction runs
- THEN extracted filters are all null/absent
- AND the full query is used as semantic text

---

### Requirement: Hybrid RPC Fusion

The database RPC MUST fuse vector similarity and keyword matching using Reciprocal Rank Fusion (RRF) and apply a similarity threshold to exclude low-relevance results.

#### Scenario: Text query with no filters

- GIVEN a semantic text and no hard filter constraints
- WHEN the RPC runs
- THEN it returns `Software[]` ranked by RRF score descending
- AND rows below the similarity threshold are excluded

#### Scenario: Text query with hard filters

- GIVEN a semantic text and one or more filter constraints (e.g., `licencia = "free"`)
- WHEN the RPC runs
- THEN filter constraints are applied as WHERE clauses before scoring
- AND results are ranked by RRF score among the filtered set

#### Scenario: Empty text with filters only

- GIVEN an empty or whitespace-only text field and one or more active filters
- WHEN the search runs
- THEN it MUST return a plain filtered listing — no embedding call, no RRF scoring
- AND behavior MUST be identical to the current filter-only search

#### Scenario: Empty text with no filters

- GIVEN no text and no filters
- WHEN the search runs
- THEN it returns an unfiltered listing (all rows)
- AND no embedding or RRF call is made

---

### Requirement: Result Shape Compatibility

The pipeline MUST return results in the same `Software[]` shape consumed by existing frontend components.

#### Scenario: Normal result

- GIVEN a successful hybrid search response
- WHEN the frontend receives results
- THEN each item MUST contain all fields expected by current `Software` consumers
- AND no new required fields are added to the consumer interface

---

### Requirement: Row Embeddings Maintenance

Every `software` row MUST have an embedding vector over `nombre + objetivo + descripcion_corta + tema`. New and updated rows MUST have embeddings regenerated automatically.

#### Scenario: New row inserted

- GIVEN a new `software` row is inserted into the database
- WHEN the pg_net trigger fires
- THEN an embedding is generated and stored for that row

#### Scenario: Existing row updated

- GIVEN a `software` row has any of the indexed text fields updated
- WHEN the change is saved
- THEN the embedding is regenerated for that row

#### Scenario: Initial backfill

- GIVEN the migration runs on a database with existing rows lacking embeddings
- WHEN the backfill script executes
- THEN all existing rows receive embeddings
- AND the row count with embeddings equals the total row count

---

### Requirement: Edge Function Fallback

If the Edge Function is unavailable or returns an error, the system MUST fall back to the existing `ilike` search transparently.

#### Scenario: Edge Function down

- GIVEN the Edge Function endpoint returns a network error or HTTP 5xx
- WHEN the frontend service layer catches the error
- THEN it MUST invoke the existing `ilike` search with the raw query text
- AND the user sees results without any error message

#### Scenario: Edge Function timeout

- GIVEN the Edge Function takes longer than the client timeout
- WHEN the timeout fires
- THEN fallback to `ilike` MUST activate
- AND search MUST NOT remain dead (empty results with no indication)
