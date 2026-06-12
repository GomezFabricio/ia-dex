# Search UI Specification

## Purpose

Frontend behavior for `BuscarPage`: routes user input through the hybrid pipeline, mirrors extracted filters into the UI, allows manual filter refinement, and handles all degradation paths without exposing internal errors.

## Requirements

### Requirement: Filter Auto-Population from Intent

When a hybrid search returns extracted filters, the UI MUST visibly populate the corresponding filter controls with those values.

#### Scenario: Filters extracted from query

- GIVEN the user types "herramientas gratis del 2022" and submits
- WHEN the Edge Function returns extracted filters `{ licencia: "free", anio_desde: 2022 }`
- THEN the licencia and anio_desde filter controls MUST update to reflect those values visibly
- AND the search results displayed correspond to those constraints

#### Scenario: No filters extracted

- GIVEN the query yields no extractable filters
- WHEN results are returned
- THEN filter controls remain in their previous state (not cleared, not altered)

---

### Requirement: Manual Filter Refinement

A user MAY change any filter control after auto-population. Any manual filter change MUST re-run the search with the updated filter as a hard constraint.

#### Scenario: User edits an auto-populated filter

- GIVEN filters were auto-populated from a previous query
- WHEN the user changes the `licencia` filter to "open-source"
- THEN the search re-executes immediately using the new value as a hard constraint
- AND results update accordingly

#### Scenario: User clears a filter

- GIVEN a filter control has a value (auto-populated or user-set)
- WHEN the user clears that filter
- THEN the search re-executes without that constraint

---

### Requirement: Filtered-Listing Mode (Empty Text)

When the text field is empty and one or more filters are active, the UI MUST display a plain filtered listing without invoking the hybrid pipeline.

#### Scenario: Empty text, active filters

- GIVEN the text field is empty or whitespace
- AND at least one filter has a value
- WHEN the page renders results
- THEN the result set MUST match the current filter-only behavior
- AND no loading state for embedding or intent extraction is shown

---

### Requirement: Fallback Transparency

If the hybrid pipeline fails, the UI MUST display `ilike`-based results without surfacing an error to the user.

#### Scenario: Edge Function failure during search

- GIVEN the hybrid pipeline fails
- WHEN the fallback activates
- THEN results from `ilike` are displayed normally
- AND no error banner or empty-state is shown due to the failure

#### Scenario: Fallback with extracted filters unavailable

- GIVEN the Edge Function failed before returning extracted filters
- WHEN the fallback runs
- THEN filter controls are NOT auto-populated (no extraction data available)
- AND the user's raw text is used for `ilike`

---

### Requirement: Loading and Empty States

The UI MUST provide clear feedback during search execution and when no results are found.

#### Scenario: Search in progress

- GIVEN the user has submitted a query
- WHEN the pipeline is executing
- THEN a loading indicator is visible
- AND the previous result set remains visible until new results arrive (no flash to empty)

#### Scenario: No results found

- GIVEN a query returns zero matching rows
- WHEN results render
- THEN an empty-state message is shown
- AND filter controls remain active so the user can refine
