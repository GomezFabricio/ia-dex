# plan-mejoras — Delta Specifications

All five capabilities are new domains with no prior spec. Specs are written as FULL specs (not deltas).
Cross-cutting gaps are enumerated after capability groups.

---

# Capability 1: seed-hispano

## Purpose

Adds a `slug` column to `software`, converts the seed pipeline to idempotent upsert-by-slug, expands
the corpus to ~35–40 entries with Spanish-language video content, and makes `match_threshold` RPC-tunable
(removing its hardcoded literal from the `buscar` Edge Function).

## Requirements

### Requirement: S1 — slug Column and Unique Constraint

The `software` table MUST gain a `slug text NOT NULL UNIQUE` column applied in a single migration that
(a) adds the nullable column, (b) backfills every existing row with the same slugification logic used
by `seed-to-sql.mjs`, (c) then adds the UNIQUE constraint and NOT NULL, in that exact order.

#### Scenario: Clean migration with no collisions

- GIVEN 23 existing software rows and a migration script that applies steps a→b→c
- WHEN the migration is applied to production
- THEN every existing row has a non-null, unique `slug` value
- AND `select count(*) from software where slug is null` returns 0
- AND `select count(*) from software` equals the pre-migration count (no rows added or removed)

#### Scenario: Slug collision guard

- GIVEN two candidate software entries that would produce the same slug
- WHEN `seed-to-sql.mjs` generates the SQL
- THEN the script MUST detect the collision and abort with a clear error before producing SQL
- AND the migration MUST NOT be applied until the collision is resolved in `seed-content.json`

#### Scenario: Backfill matches generator output

- GIVEN the migration backfills slugs using function F and the generator also uses function F
- WHEN both are applied to the same `nombre` values
- THEN the slug produced by the migration for each existing row is byte-identical to the slug the
  generator would produce for that same entry in `seed-content.json`

### Requirement: S2 — Upsert by Slug

The `seed-to-sql.mjs` generator MUST emit `INSERT ... ON CONFLICT (slug) DO UPDATE SET ...` for every
software row. The `where not exists (nombre)` guard MUST be removed from generated SQL.

#### Scenario: Idempotent re-seed updates existing content

- GIVEN a software row with `slug = 'chatgpt'` already in the database
- WHEN the seed SQL is applied again with an updated `video_url` for that slug
- THEN the existing row is updated, not duplicated
- AND `select count(*) from software where slug = 'chatgpt'` returns 1

#### Scenario: New slug inserts correctly

- GIVEN a slug that does not yet exist in the database
- WHEN the seed SQL is applied
- THEN a new row is inserted
- AND the seed is idempotent: re-running it produces no additional insert

### Requirement: S3 — match_threshold Externalized

The literal `match_threshold: 0.82` at `supabase/functions/buscar/index.ts:258` MUST be removed.
The value MUST be read from an environment variable `MATCH_THRESHOLD` with fallback to `0.82`, so that
the RPC default in the database becomes effective when the env var is absent and the EF is not redeployed.

#### Scenario: Env var controls threshold without redeploy

- GIVEN `MATCH_THRESHOLD` is set to `0.78` in the Supabase project secrets
- WHEN a semantic search is executed via the `buscar` Edge Function
- THEN `buscar_hibrido` is called with `match_threshold: 0.78`

#### Scenario: Fallback when env var absent

- GIVEN `MATCH_THRESHOLD` is not set
- WHEN a search is executed
- THEN `match_threshold` defaults to `0.82` and search results are returned normally

### Requirement: S4 — Corpus Expansion and Embedding Coverage

After applying the expanded `seed-content.json` (~35–40 entries), `select count(*) from software where
embedding is null` MUST return 0 (the `software_embed_trigger` handles re-embedding asynchronously).

#### Scenario: New rows trigger embedding

- GIVEN new software rows are inserted via the upsert seed
- WHEN the `software_embed_trigger` fires for each new/updated row
- THEN every row eventually has a non-null `embedding` vector
- AND `select count(*) from software where embedding is null` returns 0 within the expected async window

---

# Capability 2: relacionados

## Purpose

Adds the `software_relacionados` RPC for semantic similarity lookup, exposes it in the frontend via
a service + hook, and adds chips/breadcrumb UI to `SoftwareDetallePage`.

## Requirements

### Requirement: R1 — software_relacionados RPC

The database MUST have a function `software_relacionados(p_software_id uuid, p_limit int default 5)`
that orders the catalog by cosine distance against the embedding of `p_software_id`, excludes the
queried row itself and rows with null embedding, applies an adaptive similarity cutoff (same margin
pattern as `buscar_hibrido`), is `SECURITY INVOKER`, and returns the same columns as `buscar_hibrido`
(excluding `embedding` and `fts`). The function MUST be granted to `anon` and `authenticated`.

#### Scenario: Returns semantically related software

- GIVEN software "Gemini" has a populated embedding
- WHEN `software_relacionados` is called with Gemini's id and limit=5
- THEN the result excludes Gemini itself
- AND all returned rows have non-null embeddings
- AND results are ordered by ascending cosine distance (most similar first)
- AND result count is at most 5

#### Scenario: Self-exclusion

- GIVEN any software id
- WHEN `software_relacionados` is called with that id
- THEN the returned rows do NOT include the queried software itself

#### Scenario: Adaptive cutoff filters low-similarity results

- GIVEN a corpus where the closest neighbor has similarity 0.55
- WHEN `software_relacionados` is called
- THEN results below the adaptive cutoff are excluded even if `p_limit` has not been reached
- AND the result set MAY be empty if no neighbor exceeds the cutoff

#### Scenario: Anonymous access

- GIVEN an unauthenticated client using the anon key
- WHEN `software_relacionados` is called via supabase-js RPC
- THEN the call succeeds and returns rows (RLS does not block reads)

### Requirement: R2 — Fallback When Embedding Absent

If `software_relacionados` returns an empty result (including when the queried row has no embedding),
the frontend MUST fall back to the existing `useRecomendaciones` hook (same-theme by popularity).

#### Scenario: Empty RPC triggers fallback

- GIVEN a software row with `embedding IS NULL`
- WHEN `SoftwareDetallePage` mounts and calls `useRelacionados`
- THEN the "Relacionados" section renders results from `useRecomendaciones` instead
- AND no error is shown to the user

### Requirement: R3 — Chips and Breadcrumb UI

`SoftwareDetallePage` MUST display:
(a) Clickable theme chip linking to `TemaPage` for the software's `tema_id`.
(b) Clickable classification chip linking to the classification detail page for `clasificacion_si_id`.
(c) Breadcrumb `Catálogo → Tema → Software` replacing the current plain back-link.

Theme and classification names MUST be resolved client-side via `useTemas()` and `useClasificaciones()`
(no new service needed). These are functional UI requirements; visual styling follows existing design system.

#### Scenario: Chips resolve names from hooks

- GIVEN a software with a valid `tema_id` and `clasificacion_si_id`
- WHEN `SoftwareDetallePage` renders
- THEN the theme chip shows the theme name (resolved via `useTemas().find(t => t.id === tema_id)`)
- AND clicking it navigates to `TemaPage` for that theme

#### Scenario: Breadcrumb renders correct hierarchy

- GIVEN a user on `/software/:id`
- WHEN the page renders
- THEN the breadcrumb shows `Catálogo > [Tema Name] > [Software Name]`
- AND each crumb is a navigable link

---

# Capability 3: asistente

## Purpose

Adds a conversational Edge Function `asistente` (page-anchored RAG with widening retrieval, own API key,
rate-limit), browser-side TTS, and a floating Gemini widget mounted globally in `AppLayout`.

## Requirements

### Requirement: A1 — asistente Edge Function Contract

The `asistente` Edge Function MUST accept POST requests with body
`{ pregunta: string, historial?: { rol: string, texto: string }[], contexto: { ruta: string, tema_id?: string, software_id?: string, clasificacion_id?: string } }`
and MUST return `{ respuesta: string, fuentes: { id: string, nombre: string }[] }`.

The EF MUST:
- Reject `pregunta` exceeding the enforced character cap with HTTP 400.
- Use `GEMINI_API_KEY_ASISTENTE` (not the key used by `buscar`).
- Ground the response in the entity identified by `contexto` (fetched by id) as primary context.
- Embed `pregunta` and call `buscar_hibrido` with `match_limit=5` for widening retrieval.
- Resolve `tema_id` UUIDs to names before including them in the Gemini prompt.
- Include `historial` (capped at 2–3 turns) in the Gemini prompt for pronoun resolution.
- Fall back to sources + fixed message if Gemini fails on both primary and fallback models; MUST NOT
  return HTTP 5xx to the client in this case.
- Apply CORS restricted to known origins (not wildcard).

#### Scenario: Page-anchored response

- GIVEN a request with `software_id` = Gemini's id and `pregunta = "¿Es gratuito?"`
- WHEN the EF processes the request
- THEN the response `respuesta` is grounded in Gemini's ficha (fetched by id)
- AND `fuentes` includes at minimum the Gemini software entry

#### Scenario: Widening retrieval for off-page questions

- GIVEN a request on the Gemini ficha page but `pregunta` asks about "alternatives for image generation"
- WHEN the EF processes the request
- THEN `buscar_hibrido` is called and image-generation tools from the catalog are included in context
- AND `respuesta` references those tools

#### Scenario: Oversized input rejected

- GIVEN `pregunta` exceeding the enforced character cap
- WHEN the EF receives the request
- THEN it returns HTTP 400 before calling Gemini
- AND no Gemini API quota is consumed

#### Scenario: Gemini degradation

- GIVEN both Gemini primary and fallback models are unavailable
- WHEN the EF processes a valid request
- THEN it returns HTTP 200 with `fuentes` populated and `respuesta` set to a fixed fallback message
- AND HTTP 5xx is NOT returned

#### Scenario: Rate limit enforcement

- GIVEN a client that sends requests exceeding the per-IP/session cap within the window
- WHEN the cap is reached
- THEN subsequent requests return HTTP 429
- AND the `buscar` EF is unaffected (separate key, separate counter)

### Requirement: A2 — Separate API Key Isolation

The `asistente` EF MUST use `GEMINI_API_KEY_ASISTENTE`. The `buscar` EF MUST continue using its own
separate key. Quota exhaustion on `asistente` MUST NOT affect `buscar` results.

#### Scenario: Independent quota pools

- GIVEN `GEMINI_API_KEY_ASISTENTE` is exhausted
- WHEN a user performs a catalog search via `buscar`
- THEN search results are returned normally (buscar uses its own key)

### Requirement: A3 — TTS Hook

The frontend MUST expose a `useTTS` hook with `hablar(text: string)`, `detener()`, `soportado: boolean`,
and a `silencio` toggle persisted in `localStorage`. TTS MUST use `speechSynthesis` with an `es-*` voice.
Every assistant response MUST be displayed as text regardless of whether TTS is supported.

#### Scenario: TTS speaks response

- GIVEN `soportado = true` and `silencio = false`
- WHEN `hablar(respuesta)` is called after receiving an assistant response
- THEN `speechSynthesis.speak` is called with an `es-*` voice utterance

#### Scenario: Text always shown

- GIVEN a browser with no `speechSynthesis` support (`soportado = false`)
- WHEN an assistant response arrives
- THEN `respuesta` text is displayed in the UI
- AND no error or empty state is shown

### Requirement: A4 — Floating Gemini Widget

A floating widget with Gemini icon MUST be mounted in `AppLayout` (present on all pages). Clicking it
MUST open a chat panel. The panel MUST include: text input (primary), microphone button (uses `useVoz`
for transcription-to-input, not auto-send), voice toggle (mutes TTS), send button, and `fuentes`
rendered as clickable links. A pre-filled suggested prompt "Resumime esta página" MUST be available.
The widget MUST NOT trigger any action on its own (no auto-summary on open).

At most one `SpeechRecognition` instance MUST be active at a time; the widget microphone and
`BuscarPage` microphone MUST NOT run simultaneously.

#### Scenario: Widget present on all pages

- GIVEN any route in the app
- WHEN the page renders
- THEN the floating Gemini icon widget is visible in `AppLayout`

#### Scenario: Microphone transcribes to input field

- GIVEN the chat panel is open and the user activates the microphone
- WHEN the user speaks
- THEN the recognized text populates the text input field (not auto-sent)
- AND the user can edit the text before sending

#### Scenario: Single SpeechRecognition guard

- GIVEN the Gemini widget microphone is active
- WHEN the user navigates to `BuscarPage` and tries to activate voice search
- THEN the widget microphone is stopped before `BuscarPage`'s microphone starts
- AND only one `SpeechRecognition` instance is active at any time

#### Scenario: Context derived from current route

- GIVEN the user is on `/software/:id` when they open the widget
- WHEN a message is sent
- THEN the EF request includes `contexto.software_id` matching the current route param

---

# Capability 4: roadmap

## Purpose

Adds `/roadmap` page (vertical timeline from catalog data), `progreso_roadmap` table with fully
enumerated RLS (including UPDATE), and localStorage-based anonymous progress migrated to the DB on
`SIGNED_IN` only.

## Requirements

### Requirement: P1 — progreso_roadmap Table with Full RLS

The migration MUST create `progreso_roadmap (user_id uuid REFERENCES auth.users ON DELETE CASCADE,
tema_id uuid REFERENCES temas ON DELETE CASCADE, completado_at timestamptz, PRIMARY KEY (user_id, tema_id))`
with Row Level Security ENABLED and ALL FOUR policies explicitly defined:
- SELECT: `USING (auth.uid() = user_id)`
- INSERT: `WITH CHECK (auth.uid() = user_id)`
- UPDATE: `USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`
- DELETE: `USING (auth.uid() = user_id)`

#### Scenario: User can only read own progress

- GIVEN user A and user B both have rows in `progreso_roadmap`
- WHEN user A queries the table
- THEN only user A's rows are returned

#### Scenario: INSERT with check prevents spoofed user_id

- GIVEN an authenticated user A
- WHEN user A attempts to INSERT a row with `user_id` set to user B's id
- THEN the INSERT is rejected by RLS
- AND no row is created for user B

#### Scenario: UPDATE allowed for own rows

- GIVEN user A has a row `(user_id=A, tema_id=X, completado_at=T1)`
- WHEN user A UPSERTs `(user_id=A, tema_id=X, completado_at=T2)` via `ON CONFLICT DO UPDATE`
- THEN the row is updated to `completado_at=T2`
- AND the operation is NOT silently rejected by missing UPDATE policy

#### Scenario: CASCADE deletes on user removal

- GIVEN user A has 3 rows in `progreso_roadmap`
- WHEN user A is deleted from `auth.users`
- THEN all 3 progress rows are deleted (ON DELETE CASCADE)

### Requirement: P2 — RoadmapPage Content

`RoadmapPage` at `/roadmap` MUST render:
- Etapa 0: `clasificaciones_si` as introduction.
- Etapas 1–7: `temas` ordered by `temas.orden`, each showing name, description, and 2–3 top-rated
  software (from `v_software_rating` JOINed to `software` on `tema_id`, fallback alphabetical).
- Per-stage completion checkbox (or equivalent control) gated on authentication.
- Global progress bar "N de 7 etapas completadas" (visible to authenticated users).
- Navigation entry in Sidebar, MobileNav, and `navLinks.ts`.

#### Scenario: Anonymous user sees content but not progress controls

- GIVEN an unauthenticated visitor on `/roadmap`
- WHEN the page renders
- THEN all 7 stages and their software are visible
- AND the progress checkboxes/controls are either hidden or prompt login

#### Scenario: Authenticated user sees progress

- GIVEN user A has completed stages 1 and 3
- WHEN user A visits `/roadmap`
- THEN stages 1 and 3 are marked completed
- AND the global bar shows "2 de 7 etapas completadas"

### Requirement: P3 — localStorage Migration on SIGNED_IN Only

Anonymous progress stored in `localStorage` MUST be migrated to `progreso_roadmap` ONLY when the
`onAuthStateChange` event is `SIGNED_IN` (not on every TOKEN_REFRESHED). Migration MUST use
`ON CONFLICT (user_id, tema_id) DO NOTHING`.

#### Scenario: Migration fires on login, not on refresh

- GIVEN user A has localStorage progress for stages 2 and 4
- WHEN user A signs in (SIGNED_IN event fires)
- THEN stages 2 and 4 are inserted into `progreso_roadmap` for user A
- AND re-running the migration (on next SIGNED_IN) inserts no duplicates

#### Scenario: Token refresh does not re-migrate

- GIVEN user A is already logged in and a TOKEN_REFRESHED event fires
- WHEN `onAuthStateChange` processes the event
- THEN the localStorage migration is NOT triggered again

---

# Capability 5: admin

## Purpose

Adds `profiles` table (role system), blindado signup trigger, backfill of existing users, canonical
`puede_gestionar_contenido()` function (pinned search_path), RLS enablement with explicit public SELECT
policy on `software`/`clasificaciones_si`, write policies, `created_by` authorship column,
`eventos` FK fix, `valoraciones` cleanup trigger, admin UI icons and modals, and `nombre`/`apellido`
fields on profiles collected during both email signup and Google OAuth.

## Requirements

### Requirement: AD1 — profiles Table

The `profiles` table MUST be created as:
`profiles (id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE, role text NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')), nombre text, apellido text, created_at timestamptz DEFAULT now())`.
Using `text + CHECK` (not a Postgres enum) is REQUIRED to allow future role additions via
`ALTER ... DROP/ADD CONSTRAINT` without data migration.

#### Scenario: New user has default role

- GIVEN a new email signup or OAuth login
- WHEN the signup trigger inserts a row into `profiles`
- THEN `role` is `'user'`, `nombre` and `apellido` are populated from signup data or OAuth metadata

#### Scenario: Role constraint rejects invalid values

- GIVEN an attempt to set `role = 'superadmin'` on a profiles row
- WHEN the UPDATE is executed
- THEN the CHECK constraint rejects it

### Requirement: AD2 — Blindado Signup Trigger

The trigger `on auth.users AFTER INSERT` MUST:
- Run `SECURITY DEFINER SET search_path = public`.
- Insert into `public.profiles` (id, nombre, apellido) from `NEW`.
- For Google OAuth: read `nombre` from `NEW.raw_user_meta_data->>'given_name'` (fallback: first word of `full_name`); read `apellido` from `NEW.raw_user_meta_data->>'family_name'` (fallback: remaining words of `full_name`).
- For email signup: read `nombre` and `apellido` from `NEW.raw_user_meta_data` (populated by the client via `signUp({ options: { data: { nombre, apellido } } })`).
- Include `EXCEPTION WHEN others THEN RETURN NEW` so trigger failure NEVER aborts signup.

#### Scenario: Email signup creates profile with nombre/apellido

- GIVEN a user signs up via email with `data: { nombre: 'Ana', apellido: 'García' }`
- WHEN the signup trigger fires
- THEN `profiles` contains a row with `id = new_user.id`, `nombre = 'Ana'`, `apellido = 'García'`

#### Scenario: Google OAuth populates nombre/apellido from metadata

- GIVEN a user signs in via Google OAuth with `given_name = 'Carlos'`, `family_name = 'López'`
- WHEN the signup trigger fires
- THEN `profiles` row has `nombre = 'Carlos'`, `apellido = 'López'`

#### Scenario: Google OAuth fallback splits full_name

- GIVEN a Google OAuth user with `full_name = 'María José Fernández'` and no `given_name`/`family_name`
- WHEN the signup trigger fires
- THEN `nombre = 'María'` and `apellido = 'José Fernández'` (or equivalent split strategy)

#### Scenario: Trigger error does not break signup

- GIVEN the `profiles` insert fails for any reason (e.g. constraint violation)
- WHEN the trigger executes
- THEN the `EXCEPTION WHEN others THEN RETURN NEW` block fires
- AND the user is created in `auth.users` successfully (signup does NOT return HTTP 500)
- AND `select count(*) from auth.users where id = <new_id>` returns 1

### Requirement: AD3 — Backfill Existing Users

The migration MUST include `INSERT INTO public.profiles (id) SELECT id FROM auth.users ON CONFLICT (id) DO NOTHING` to backfill all pre-existing users without overwriting any already-existing profile rows.

#### Scenario: Backfill inserts missing profiles

- GIVEN 5 users in `auth.users` with no corresponding `profiles` rows
- WHEN the backfill statement runs
- THEN `select count(*) from profiles` increases by 5 (or by the count of missing users)
- AND no error is raised

#### Scenario: Backfill is idempotent

- GIVEN the backfill statement is run twice
- WHEN it completes
- THEN no duplicate profiles exist and no error is raised

### Requirement: AD4 — puede_gestionar_contenido() Function

The function `public.puede_gestionar_contenido()` MUST be defined as:
`RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public`
returning `EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')`.
The `SET search_path = public` is REQUIRED (security hardening; consistent with `003_review_fixes.sql` pattern).

#### Scenario: Returns false for non-admin

- GIVEN an authenticated user with `role = 'user'`
- WHEN `SELECT public.puede_gestionar_contenido()` is executed as that user
- THEN the result is `false`

#### Scenario: Returns false for missing profile

- GIVEN an authenticated user with no row in `profiles`
- WHEN `SELECT public.puede_gestionar_contenido()` is executed
- THEN the result is `false` (the EXISTS returns no rows, not an error)

#### Scenario: Returns true for admin

- GIVEN a user with `role = 'admin'` in `profiles`
- WHEN `SELECT public.puede_gestionar_contenido()` is executed as that user
- THEN the result is `true`

### Requirement: AD5 — RLS Enablement with Explicit Public SELECT

In the SAME migration that enables RLS on `software` and `clasificaciones_si`, a SELECT policy MUST
be created for `anon` and `authenticated` with `USING (true)`. This MUST happen in the same atomic
migration — not a subsequent one.

#### Scenario: Anonymous catalog read succeeds after RLS enable

- GIVEN RLS is enabled on `software` AND the SELECT policy `USING (true)` for `anon` is active
- WHEN an anonymous client calls `SELECT * FROM software`
- THEN rows are returned (not empty result set)

#### Scenario: buscar_hibrido RPC unaffected

- GIVEN RLS is enabled on `software`
- WHEN `buscar_hibrido` is called with an anon key
- THEN software results are returned normally

#### Scenario: Public classified reads unaffected

- GIVEN RLS is enabled on `clasificaciones_si` with SELECT `USING (true)` for anon
- WHEN an anonymous client reads `clasificaciones_si`
- THEN rows are returned

### Requirement: AD6 — Write Policies via puede_gestionar_contenido()

INSERT, UPDATE, DELETE policies on `software` and `clasificaciones_si` MUST use
`USING (public.puede_gestionar_contenido())` and `WITH CHECK (public.puede_gestionar_contenido())`.
No client MUST be able to write directly using the anon key.

#### Scenario: Non-admin INSERT rejected

- GIVEN an unauthenticated client (anon key)
- WHEN it attempts `INSERT INTO software (...) VALUES (...)`
- THEN the insert is rejected (RLS denies)
- AND no row is created

#### Scenario: Admin INSERT accepted

- GIVEN an authenticated admin user
- WHEN they insert a new software row via the supabase-js client
- THEN the row is created
- AND the `software_embed_trigger` fires and eventually populates `embedding`

#### Scenario: Admin DELETE accepted; non-admin rejected

- GIVEN an admin and a non-admin authenticated user
- WHEN the admin deletes a software row → succeeds
- AND the non-admin deletes a software row → rejected by RLS

### Requirement: AD7 — created_by Authorship Column

`software` and `clasificaciones_si` MUST gain `created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid()`.
Seed/SQL inserts (not from an authenticated session) leave it NULL. The column is NOT exposed for
client writes beyond the DEFAULT; the client never sends `created_by` explicitly.

#### Scenario: Client insert sets created_by automatically

- GIVEN an admin user creates a software entry via supabase-js
- WHEN the INSERT is executed (no `created_by` field in the payload)
- THEN `created_by` is set to `auth.uid()` via the column default

#### Scenario: Seed inserts leave created_by null

- GIVEN the seed SQL is applied (no authenticated session)
- WHEN seed rows are inserted
- THEN `created_by` is NULL for all seed rows

#### Scenario: Profile deletion nullifies created_by

- GIVEN software rows with `created_by = user_A`
- WHEN user_A's profile is deleted
- THEN `created_by` becomes NULL on those rows (ON DELETE SET NULL)
- AND the software rows are NOT deleted

### Requirement: AD8 — eventos FK and valoraciones Cleanup

The migration MUST:
(a) ALTER `eventos.software_id` FK to `ON DELETE SET NULL` (drop existing FK, add new FK with cascade behavior).
(b) Create a `BEFORE DELETE` trigger on `software` AND `clasificaciones_si`, `SECURITY DEFINER SET search_path = public`, that deletes matching rows in `valoraciones` by `contenido_tipo` + `contenido_id`.

#### Scenario: Deleting software nulls eventos.software_id

- GIVEN a software row S referenced by N rows in `eventos`
- WHEN software S is deleted
- THEN `eventos` rows that referenced S have `software_id = NULL`
- AND no `eventos` rows are deleted

#### Scenario: Deleting software removes its valoraciones

- GIVEN software S has 5 rows in `valoraciones` (contenido_tipo='software', contenido_id=S.id)
- WHEN software S is deleted
- THEN `select count(*) from valoraciones where contenido_id = S.id` returns 0
- AND no orphan valoraciones remain

#### Scenario: Non-admin delete blocked before trigger fires

- GIVEN a non-admin client attempts to delete software
- WHEN the DELETE is executed
- THEN RLS rejects it before the cleanup trigger fires
- AND no valoraciones are deleted

### Requirement: AD9 — Admin UI Controls

Admin users MUST see edit (pencil) and delete (trash) icons on `SoftwareCard`, `SoftwareDetallePage`,
and classification cards/detail pages. Non-admin users MUST NOT see these icons. The icons MUST use
`stopPropagation` to prevent card navigation when clicked.

A single `SoftwareFormModal` (create/edit, determined by presence of an `id` prop) and a
`ConfirmDeleteModal` (showing the item name and "Esta acción no se puede deshacer") MUST be implemented.
These reuse `src/components/ui/Modal.tsx`.

#### Scenario: Admin sees icons

- GIVEN an authenticated admin user on the catalog page
- WHEN `SoftwareCard` renders
- THEN edit and delete icons are visible

#### Scenario: Non-admin sees no icons

- GIVEN an authenticated non-admin user
- WHEN `SoftwareCard` renders
- THEN no edit or delete icons are rendered in the DOM

#### Scenario: Edit icon opens modal without navigation

- GIVEN an admin clicks the edit icon on a SoftwareCard
- WHEN the click event fires
- THEN `stopPropagation` prevents card navigation
- AND `SoftwareFormModal` opens pre-filled with the software's data

### Requirement: AD10 — Email Signup Form Collects nombre and apellido

The email registration form MUST include `nombre` and `apellido` fields. The `signUp` call MUST pass
`options: { data: { nombre, apellido } }` so the signup trigger can copy them to `profiles`.

#### Scenario: Form submits nombre/apellido in metadata

- GIVEN a user fills in `nombre = 'Laura'`, `apellido = 'Méndez'`, email, and password
- WHEN the signup form is submitted
- THEN `supabase.auth.signUp` is called with `options.data = { nombre: 'Laura', apellido: 'Méndez' }`
- AND the resulting profile row has `nombre = 'Laura'`, `apellido = 'Méndez'`

---

# Cross-cutting Requirements

## Requirements

### Requirement: X1 — RLS Safety: Pre-migration Schema Dump

Before any migration that enables RLS or alters FK cascade behavior, a schema dump + RLS state dump
MUST be committed to the repo. A manual rollback procedure MUST be documented for each destructive migration.

#### Scenario: Pre-migration dump exists

- GIVEN a migration that enables RLS on `software`
- WHEN the migration is prepared
- THEN a committed schema dump file reflecting pre-migration state exists in the repo

### Requirement: X2 — database.types.ts Regeneration

After every migration that adds tables, columns, RPCs, or changes function signatures, `database.types.ts`
MUST be regenerated via `npm run gen:types` and committed in the same PR/changeset.

#### Scenario: Types kept in sync

- GIVEN a migration adds `progreso_roadmap` table and `software_relacionados` RPC
- WHEN types are regenerated
- THEN `database.types.ts` reflects both the new table and the new function

### Requirement: X3 — RestablecerPage Password Recovery Guard

`RestablecerPage` MUST only render the password-change form when the `onAuthStateChange` event is
`PASSWORD_RECOVERY`. It MUST NOT render the form for `SESSION` or other events.

#### Scenario: Logged-in user navigating to /restablecer sees no form

- GIVEN a user with an active normal session navigates to `/restablecer`
- WHEN the page renders
- THEN the password-change form is NOT shown

#### Scenario: Recovery link activates form

- GIVEN a user clicked a password recovery link and the PASSWORD_RECOVERY event fired
- WHEN /restablecer renders
- THEN the form is shown and the user can change their password

### Requirement: X4 — supabase-js Client Options Pinned

`src/lib/supabase.ts` MUST explicitly set `auth.flowType = 'pkce'`, `auth.detectSessionInUrl = true`,
and `auth.persistSession = true` in the `createClient` call to prevent silent breakage on supabase-js
major version upgrades.

#### Scenario: Options pinned in createClient

- GIVEN `src/lib/supabase.ts` is read
- WHEN the `createClient` call is inspected
- THEN `auth.flowType`, `auth.detectSessionInUrl`, and `auth.persistSession` are explicitly set

### Requirement: X5 — Accessibility: Assistant Widget

The assistant widget chat panel MUST include `aria-live="polite"` on the response area. The widget
MUST be keyboard-navigable (open via Enter/Space on the trigger button). Focus MUST be trapped inside
the modal when open (reuses `Modal.tsx` focus-trap behavior).

#### Scenario: Response announced to screen readers

- GIVEN an assistant response arrives
- WHEN the response area updates
- THEN the `aria-live="polite"` region announces the new content to assistive technology
