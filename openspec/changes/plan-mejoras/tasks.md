# plan-mejoras — Implementation Tasks

**Backend execution order (dependency-driven):** M5 Admin → M1 Seed → M2 Relacionados → M4 Roadmap → M3 Asistente
**UI-VISUAL tasks** are tagged `[blocked-on-design]` and are NOT in the immediate batch.
**Destructive migrations** require: (a) schema dump, (b) SQL review + confirmation, (c) apply, (d) verify.

---

## Track 0 — Debt Fixes (ship first, unblock everything)

### T01 — Pin supabase-js client options
- **Req:** X4
- **Files:** `src/lib/supabase.ts`
- **Work:** Add `auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true }` to `createClient` options.
- **Accept:** Inspecting `src/lib/supabase.ts` shows all three options explicitly set in the `createClient` call.
- **Parallel with:** T02

### T02 — Fix RestablecerPage PASSWORD_RECOVERY guard
- **Req:** X3
- **Files:** `src/pages/RestablecerPage.tsx`, `src/context/AuthContext.tsx`
- **Work:** Subscribe to `onAuthStateChange` inside `RestablecerPage` (or propagate the event via `AuthContext`). Show the password-change form ONLY when the event is `PASSWORD_RECOVERY`. Remove the `session !== null` gate.
- **Accept:** A logged-in user navigating to `/restablecer` via normal session sees no form; a user arriving via recovery email link sees the form.
- **Parallel with:** T01

### T03 — Regenerate types baseline (pre-work)
- **Req:** X2
- **Files:** `src/types/database.types.ts`
- **Work:** Run `npm run gen:types`, commit the regenerated file to capture `adaptive_margin` parameter missing from current types.
- **Accept:** `database.types.ts` reflects the current production schema (including `buscar_hibrido` with `adaptive_margin`).
- **Depends on:** T01, T02 (after debt fixes merged)

---

## Track 1 — M5 Admin Backend (FIRST: profiles and RLS must exist before anything else)

### T04 — pgTAP harness setup
- **Req:** AD5, AD6 (security validation gate)
- **Files:** `db/tests/` (new directory), `db/tests/rls_harness.sql` (new)
- **Work:** Create a minimal pgTAP harness file that can be run via `supabase db test` (or equivalent). Define helper roles: `anon_client` (uses anon key), `auth_user` (non-admin), `admin_user`. Document how to run it in a comment block.
- **Accept:** `supabase db test` executes the harness file without error (even if no assertions yet).
- **Depends on:** T03
- **Parallel with:** nothing (gate for T06)

### T05 — Pre-migration schema dump (destructive migration gate)
- **Req:** X1
- **Files:** `db/schema-dumps/pre-rls-admin.sql` (new)
- **Work:**
  (a) Via Supabase MCP, export the current full schema + RLS state of `software`, `clasificaciones_si`, `eventos`, `valoraciones`.
  (b) Commit the dump to `db/schema-dumps/pre-rls-admin.sql`.
  (c) Document manual rollback procedure as a comment block in the dump file.
- **Accept:** File exists in repo and covers all four tables.
- **Depends on:** T04
- **Parallel with:** nothing (gate for T06)

### T06 — Migration: profiles table + signup trigger + backfill
- **Req:** AD1, AD2, AD3
- **Files:** `db/2026-06-XX_005_admin_profiles.sql` (new)
- **Work:** Single migration file containing:
  - `CREATE TABLE public.profiles (id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE, role text NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')), nombre text, apellido text, created_at timestamptz DEFAULT now());`
  - Trigger function `handle_new_user()` — `SECURITY DEFINER SET search_path = public`, reads `NEW.raw_user_meta_data` for `nombre`/`apellido` (email path) and `given_name`/`family_name` with `full_name` split fallback (OAuth path). Includes `EXCEPTION WHEN others THEN RETURN NEW`.
  - Trigger `on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user()`.
  - Backfill: `INSERT INTO public.profiles (id) SELECT id FROM auth.users ON CONFLICT (id) DO NOTHING;`
- **Accept:**
  - `SELECT count(*) FROM profiles` equals `SELECT count(*) FROM auth.users` after migration.
  - `INSERT INTO profiles (id, role) VALUES (gen_random_uuid(), 'superadmin')` is rejected by CHECK constraint.
  - Trigger does not abort signup when profiles insert fails (EXCEPTION block).
- **Depends on:** T05
- **Sub-steps (destructive — profiles is additive but triggers are critical):**
  - Show SQL to user for review before applying.
  - Apply via Supabase MCP.
  - Verify backfill count.

### T07 — Migration: puede_gestionar_contenido() function
- **Req:** AD4
- **Files:** `db/2026-06-XX_005_admin_profiles.sql` (same migration as T06, or T06b)
- **Work:** Add to the same migration (or a follow-up if kept separate):
  ```sql
  CREATE FUNCTION public.puede_gestionar_contenido()
    RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  $$;
  ```
- **Accept:**
  - Non-admin user: `SELECT public.puede_gestionar_contenido()` returns `false`.
  - Admin user: returns `true`.
  - User with no profiles row: returns `false` (not an error).
- **Depends on:** T06

### T08 — DESTRUCTIVE Migration: enable RLS + public SELECT policy + write policies + created_by + ALTER eventos FK + valoraciones cleanup trigger
- **Req:** AD5, AD6, AD7, AD8, X1
- **Files:** `db/2026-06-XX_006_rls_enable.sql` (new), `db/schema-dumps/pre-rls-admin.sql` (read-only ref)
- **Sub-steps (DESTRUCTIVE — follow protocol strictly):**
  (a) Confirm T05 schema dump is committed and T07 is applied.
  (b) Show the full SQL below to user and get explicit confirmation before applying:
    ```sql
    -- Enable RLS (default-deny)
    ALTER TABLE software ENABLE ROW LEVEL SECURITY;
    ALTER TABLE clasificaciones_si ENABLE ROW LEVEL SECURITY;

    -- Public SELECT (MUST be in same migration or catalog goes dark)
    CREATE POLICY "public_read_software" ON software
      FOR SELECT TO anon, authenticated USING (true);
    CREATE POLICY "public_read_clasificaciones" ON clasificaciones_si
      FOR SELECT TO anon, authenticated USING (true);

    -- Write policies (admin only)
    CREATE POLICY "admin_insert_software" ON software
      FOR INSERT TO authenticated WITH CHECK (public.puede_gestionar_contenido());
    CREATE POLICY "admin_update_software" ON software
      FOR UPDATE TO authenticated USING (public.puede_gestionar_contenido()) WITH CHECK (public.puede_gestionar_contenido());
    CREATE POLICY "admin_delete_software" ON software
      FOR DELETE TO authenticated USING (public.puede_gestionar_contenido());
    CREATE POLICY "admin_insert_clasificaciones" ON clasificaciones_si
      FOR INSERT TO authenticated WITH CHECK (public.puede_gestionar_contenido());
    CREATE POLICY "admin_update_clasificaciones" ON clasificaciones_si
      FOR UPDATE TO authenticated USING (public.puede_gestionar_contenido()) WITH CHECK (public.puede_gestionar_contenido());
    CREATE POLICY "admin_delete_clasificaciones" ON clasificaciones_si
      FOR DELETE TO authenticated USING (public.puede_gestionar_contenido());

    -- created_by authorship columns
    ALTER TABLE software ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid();
    ALTER TABLE clasificaciones_si ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid();

    -- Fix eventos FK: drop old, add with ON DELETE SET NULL
    ALTER TABLE eventos DROP CONSTRAINT IF EXISTS eventos_software_id_fkey;
    ALTER TABLE eventos ADD CONSTRAINT eventos_software_id_fkey
      FOREIGN KEY (software_id) REFERENCES software(id) ON DELETE SET NULL;

    -- Valoraciones cleanup trigger
    CREATE FUNCTION cleanup_valoraciones_before_delete()
      RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
    BEGIN
      DELETE FROM valoraciones WHERE contenido_id = OLD.id;
      RETURN OLD;
    END $$;
    CREATE TRIGGER cleanup_valoraciones_software
      BEFORE DELETE ON software
      FOR EACH ROW EXECUTE FUNCTION cleanup_valoraciones_before_delete();
    CREATE TRIGGER cleanup_valoraciones_clasificaciones
      BEFORE DELETE ON clasificaciones_si
      FOR EACH ROW EXECUTE FUNCTION cleanup_valoraciones_before_delete();
    ```
  (c) Apply via Supabase MCP.
  (d) Verify immediately: `SELECT count(*) FROM software` returns > 0 using anon key (confirms SELECT policy is active).
  (e) Verify: anon INSERT into software is rejected.
- **Accept:**
  - Anonymous SELECT on `software` returns rows.
  - `buscar_hibrido` called with anon key returns results.
  - Non-admin authenticated INSERT on `software` is rejected by RLS.
  - Admin INSERT succeeds.
  - Deleting a software row NULLs `eventos.software_id` and removes matching `valoraciones`.
- **Depends on:** T07

### T09 — pgTAP RLS tests
- **Req:** AD5, AD6
- **Files:** `db/tests/rls_harness.sql`
- **Work:** Add assertions to the pgTAP harness:
  - `anon` role: SELECT on `software` returns rows (passes).
  - `anon` role: INSERT on `software` is rejected.
  - Authenticated non-admin: INSERT on `software` is rejected.
  - Admin user: INSERT on `software` succeeds.
  - Verify `buscar_hibrido` RPC still returns rows for anon.
- **Accept:** `supabase db test` shows all assertions green.
- **Depends on:** T08

### T10 — Extend AuthContext with role + useIsAdmin hook [x]
- **Req:** AD9 (prerequisite), AD10 (prerequisite)
- **Files:** `src/context/auth-context-value.ts`, `src/context/AuthContext.tsx`, `src/hooks/useIsAdmin.ts` (new), `src/hooks/useAuth.ts`
- **Work:**
  - Add `role: 'user' | 'admin' | null` to `AuthContextValue`.
  - In `AuthContext`, after session resolves, fetch `profiles` row for `user.id` and expose `role`.
  - Create `useIsAdmin()` hook: returns `true` only when `role === 'admin'`.
- **Accept:** An admin user's `useIsAdmin()` returns `true`. A non-admin's returns `false`. Unauthenticated user's returns `false`.
- **Depends on:** T08
- **Parallel with:** nothing (gates all admin UI tasks)

### T11 — Regenerate database.types.ts after admin migrations
- **Req:** X2
- **Files:** `src/types/database.types.ts`
- **Work:** Run `npm run gen:types`, commit. Types must now include `profiles` table, `puede_gestionar_contenido` function, `created_by` columns on `software` and `clasificaciones_si`.
- **Accept:** `database.types.ts` reflects all new schema objects from T06–T08.
- **Depends on:** T09, T10

### T12 — Update email signup form to collect nombre/apellido [x]
- **Req:** AD10
- **Files:** `src/pages/LoginPage.tsx` (signup mode within the existing page — no separate RegistroPage)
- **Work:** Add `nombre` and `apellido` fields to the registration form. Update `supabase.auth.signUp` call to include `options: { data: { nombre, apellido } }`.
- **Accept:** Signing up with `nombre='Ana'`, `apellido='García'` results in a `profiles` row with those values populated.
- **Depends on:** T11

### T13 — Admin write methods in services [blocked-on-design partially, but logic is design-agnostic]
- **Req:** AD9
- **Files:** `src/services/softwareService.ts`, `src/services/clasificacionesService.ts`
- **Work:** Add `crear`, `actualizar`, `eliminar` methods to both services. These call Supabase directly (RLS enforces authorization). `softwareService.crear` must include `slug` generation (aligned with `seed-to-sql.mjs` logic — prerequisite of T17).
- **Accept:** An admin can call `softwareService.crear({...})` and a row appears with `created_by = auth.uid()`. A non-admin call is rejected by Supabase RLS error.
- **Depends on:** T11

### T14 — Admin UI: conditional icons + SoftwareFormModal + ConfirmDeleteModal `[blocked-on-design]`
- **Req:** AD9
- **Files:** `src/components/software/SoftwareCard.tsx`, `src/pages/SoftwareDetallePage.tsx`, `src/pages/ClasificacionesPage.tsx`, `src/pages/ClasificacionDetallePage.tsx`, `src/components/admin/SoftwareFormModal.tsx` (new), `src/components/admin/ConfirmDeleteModal.tsx` (new)
- **Work:**
  - Show edit (pencil) and delete (trash) icons on software cards and detail pages only when `useIsAdmin()` is true.
  - `stopPropagation` on icon clicks to prevent card navigation.
  - `SoftwareFormModal`: single create/edit modal (presence of `id` prop determines mode), reuses `Modal.tsx`.
  - `ConfirmDeleteModal`: shows item name, "Esta acción no se puede deshacer", reuses `Modal.tsx`.
- **Accept:**
  - Non-admin: no icons in DOM.
  - Admin: icons visible; clicking edit opens pre-filled modal without navigation; clicking delete opens confirmation modal.
- **Depends on:** T13

---

## Track 2 — M1 Seed Hispano Backend

### T15 — Migration: add slug column to software (additive — safe to apply directly)
- **Req:** S1, S2
- **Files:** `db/2026-06-XX_007_software_slug.sql` (new)
- **Work:** Three-step migration in strict order:
  ```sql
  -- Step a: add nullable
  ALTER TABLE software ADD COLUMN IF NOT EXISTS slug text;
  -- Step b: backfill using identical slugification logic as seed-to-sql.mjs
  UPDATE software SET slug = lower(regexp_replace(regexp_replace(nombre, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'));
  -- Step c: enforce uniqueness and NOT NULL
  ALTER TABLE software ADD CONSTRAINT software_slug_key UNIQUE (slug);
  ALTER TABLE software ALTER COLUMN slug SET NOT NULL;
  ```
  Show SQL to user before applying. Verify 0 NULL slugs and no collisions before step (c).
- **Accept:**
  - `SELECT count(*) FROM software WHERE slug IS NULL` returns 0.
  - `SELECT count(*) FROM software` equals pre-migration count.
  - No two rows share the same slug.
- **Depends on:** T08 (RLS must be set up first so seed operations work correctly)

### T16 — Update seed-to-sql.mjs to upsert by slug
- **Req:** S2
- **Files:** `db/seed-to-sql.mjs`
- **Work:**
  - Change all software `INSERT` statements to `INSERT ... ON CONFLICT (slug) DO UPDATE SET ...` (update all non-key fields).
  - Remove the `WHERE NOT EXISTS (nombre)` guard.
  - Add collision detection: before emitting SQL, check all generated slugs are unique; abort with clear error if not.
  - Ensure the slug generation function is identical to the SQL in T15 (same logic, byte-identical output).
- **Accept:**
  - Re-running `node db/seed-to-sql.mjs && <apply seed>` on a database with existing rows updates them, does not duplicate.
  - Two entries with the same slug abort the generator with an error message.
- **Depends on:** T15

### T17 — Curate seed-content.json (corpus expansion)
- **Req:** S1 (slug field required per entry), S4
- **Files:** `db/seed-content.json`
- **Work:** Add/update entries to reach ~35–40 software entries. Criteria:
  - Each entry must have `video_url` pointing to verified Spanish-language content (Dot CSV, Platzi, codigofacilito, NateGentile, university channels, etc.).
  - Embed-check: confirm each YouTube URL has embedding enabled.
  - Coverage: all 7 themes (`temas`) represented.
  - Each entry must include a `slug` field (or the generator derives it — align with T16 implementation).
  - Tools: ChatGPT, Gemini, Copilot, Canva Magic Studio, HeyGen, ElevenLabs, Suno, Perplexity, Leonardo.ai, NotebookLM, Whisper, etc.
- **Accept:** `db/seed-content.json` has ≥ 35 entries, all with `video_url` in Spanish, no slug collisions.
- **Depends on:** T16
- **Note:** Content curation requires user collaboration for quality assurance.

### T18 — Generate seed.sql and apply expanded corpus `[deferred-user-collab]`
- **Req:** S4
- **Files:** `db/seed.sql`
- **Work:** Run `node db/seed-to-sql.mjs` to regenerate `db/seed.sql`. Apply via Supabase MCP. Verify `software_embed_trigger` fires for new/updated rows.
- **Accept:** `SELECT count(*) FROM software WHERE embedding IS NULL` returns 0 within expected async window (check after ~60s).
- **Depends on:** T17
- **Tag:** `[deferred-user-collab]` — wait for T17 content curation to be complete.

### T19 — Externalize match_threshold in buscar Edge Function
- **Req:** S3
- **Files:** `supabase/functions/buscar/index.ts`
- **Work:** Replace the hardcoded `match_threshold: 0.82` literal with `parseFloat(Deno.env.get('MATCH_THRESHOLD') ?? '0.82')`. Set `MATCH_THRESHOLD` as a Supabase project secret (keep 0.82 as initial value).
- **Accept:**
  - Setting `MATCH_THRESHOLD=0.78` in Supabase secrets and redeploying causes `buscar_hibrido` to be called with `match_threshold: 0.78`.
  - When env var is absent, the function defaults to `0.82` and search results are returned normally.
- **Depends on:** T08 (deploy after RLS is stable)
- **Parallel with:** T15

### T20 — Regenerate database.types.ts after slug migration
- **Req:** X2
- **Files:** `src/types/database.types.ts`
- **Work:** Run `npm run gen:types`, commit. Types must reflect `slug` column on `software`.
- **Accept:** `database.types.ts` has `slug: string` on the `software` row type.
- **Depends on:** T15

---

## Track 3 — M2 Relacionados Backend

### T21 — Migration: software_relacionados RPC (additive)
- **Req:** R1
- **Files:** `db/2026-06-XX_008_software_relacionados.sql` (new)
- **Work:**
  ```sql
  CREATE FUNCTION software_relacionados(p_software_id uuid, p_limit int DEFAULT 5)
  RETURNS TABLE (-- same columns as buscar_hibrido minus embedding and fts)
  LANGUAGE sql STABLE SECURITY INVOKER AS $$
    WITH target AS (
      SELECT embedding FROM software WHERE id = p_software_id AND embedding IS NOT NULL
    ),
    ranked AS (
      SELECT s.*, (s.embedding <=> t.embedding) AS distance
      FROM software s, target t
      WHERE s.id <> p_software_id AND s.embedding IS NOT NULL
    ),
    best AS (SELECT MIN(distance) AS best_distance FROM ranked),
    cutoff AS (SELECT best_distance + 0.04 AS threshold FROM best)
    SELECT -- non-embedding columns
    FROM ranked, cutoff
    WHERE distance <= cutoff.threshold
    ORDER BY distance ASC
    LIMIT p_limit
  $$;
  GRANT EXECUTE ON FUNCTION software_relacionados(uuid, int) TO anon, authenticated;
  ```
- **Accept:**
  - Calling `software_relacionados(gemini_id, 5)` returns rows ordered by ascending cosine distance, none with `id = gemini_id`.
  - Anonymous supabase-js `.rpc('software_relacionados', {...})` call returns data (not 403).
  - Calling with a `software_id` that has no embedding returns empty result (not error).
- **Depends on:** T11 (types must be current), T18 (corpus must have embeddings — or test with existing 23 rows)
- **Note:** RPC can be tested against existing 23 rows before T18; T18 expands the test surface.

### T22 — softwareService.relacionados + useRelacionados hook
- **Req:** R1, R2
- **Files:** `src/services/softwareService.ts`, `src/hooks/useRelacionados.ts` (new)
- **Work:**
  - Add `relacionados(id: string, limit?: number)` method to `softwareService` that calls the RPC.
  - Create `useRelacionados(softwareId: string)` hook (same reducer pattern as existing hooks). Returns `{ data, loading, error }`.
  - If RPC returns empty array (no results or no embedding), hook signals fallback state.
- **Accept:**
  - Hook returns data for a software with embedding.
  - Hook returns empty array (no error) for software with no embedding.
- **Depends on:** T21

### T23 — SoftwareDetallePage: related section with fallback `[blocked-on-design]`
- **Req:** R2, R3
- **Files:** `src/pages/SoftwareDetallePage.tsx`
- **Work:**
  - Replace/augment "Recomendaciones" section with "Relacionados" using `useRelacionados`.
  - If `useRelacionados` returns empty, fall back to `useRecomendaciones` (same-theme by popularity).
  - Add clickable theme chip (resolve name via `useTemas().find(t => t.id === tema_id)`) linking to `TemaPage`.
  - Add clickable classification chip (resolve name via `useClasificaciones().find(...)`) linking to classification page.
  - Replace back-link with breadcrumb `Catálogo > [Tema Name] > [Software Name]`, each crumb navigable.
- **Accept:**
  - Software with embedding: "Relacionados" section shows RPC results.
  - Software without embedding: section shows `useRecomendaciones` results, no error displayed.
  - Theme chip shows theme name and navigates to `TemaPage`.
  - Breadcrumb renders correctly with three navigable levels.
- **Depends on:** T22

### T24 — Regenerate database.types.ts after relacionados RPC
- **Req:** X2
- **Files:** `src/types/database.types.ts`
- **Work:** Run `npm run gen:types`, commit. Types must include `software_relacionados` function.
- **Accept:** `database.types.ts` has the `software_relacionados` function signature in the Functions section.
- **Depends on:** T21

---

## Track 4 — M4 Roadmap Backend

### T25 — Migration: progreso_roadmap table with full RLS (additive table, destructive RLS)
- **Req:** P1
- **Files:** `db/2026-06-XX_009_progreso_roadmap.sql` (new)
- **Work:** Show SQL for review before applying:
  ```sql
  CREATE TABLE public.progreso_roadmap (
    user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
    tema_id uuid NOT NULL REFERENCES temas ON DELETE CASCADE,
    completado_at timestamptz DEFAULT now(),
    PRIMARY KEY (user_id, tema_id)
  );
  ALTER TABLE public.progreso_roadmap ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "select_own_progress" ON public.progreso_roadmap
    FOR SELECT USING (auth.uid() = user_id);
  CREATE POLICY "insert_own_progress" ON public.progreso_roadmap
    FOR INSERT WITH CHECK (auth.uid() = user_id);
  CREATE POLICY "update_own_progress" ON public.progreso_roadmap
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  CREATE POLICY "delete_own_progress" ON public.progreso_roadmap
    FOR DELETE USING (auth.uid() = user_id);
  ```
- **Accept:**
  - User A cannot read User B's rows.
  - INSERT with `user_id` of another user is rejected.
  - UPSERT (`ON CONFLICT DO UPDATE`) on own row succeeds (UPDATE policy present).
  - Deleting a `auth.users` row cascades and removes all their `progreso_roadmap` rows.
- **Depends on:** T11

### T26 — roadmapService + useRoadmap hook with localStorage migration
- **Req:** P2, P3
- **Files:** `src/services/roadmapService.ts` (new), `src/hooks/useRoadmap.ts` (new)
- **Work:**
  - `roadmapService`: `getTemasOrdenados()`, `getTopSoftwarePorTema(temaId, limit=3)` (JOIN `v_software_rating` ↔ `software` on `tema_id`, fallback alphabetical), `getProgreso(userId)`, `upsertProgreso(userId, temaId)`, `deleteProgreso(userId, temaId)`.
  - `useRoadmap`: combines temas, top software per tema, and progress. For anonymous users, reads/writes `localStorage`. On `SIGNED_IN` event only (not `TOKEN_REFRESHED`), migrates localStorage keys to `progreso_roadmap` using `ON CONFLICT (user_id, tema_id) DO NOTHING`.
- **Accept:**
  - Authenticated user's progress is read from DB.
  - Anonymous user's progress is read from localStorage.
  - Logging in with localStorage progress migrates it to DB; re-login does not duplicate.
  - `TOKEN_REFRESHED` event does NOT trigger migration.
- **Depends on:** T25

### T27 — RoadmapPage + navigation entries `[blocked-on-design]`
- **Req:** P2
- **Files:** `src/pages/RoadmapPage.tsx` (new), `src/routes/AppRouter.tsx`, `src/components/layout/navLinks.ts`, `src/components/layout/Sidebar.tsx`, `src/components/layout/MobileNav.tsx`
- **Work:**
  - `RoadmapPage` at `/roadmap`: vertical timeline with Etapa 0 (clasificaciones SI intro) + Etapas 1–7 (temas by `orden`).
  - Each stage shows: name, description, 2–3 top software from `useRoadmap`.
  - Per-stage completion checkbox visible only to authenticated users; shows login prompt for anonymous.
  - Global progress bar "N de 7 etapas completadas" visible to authenticated users only.
  - Add `/roadmap` to `navLinks.ts`, `Sidebar`, `MobileNav`, and register route in `AppRouter`.
- **Accept:**
  - Anonymous user sees all 7 stages and their software; checkboxes are hidden or prompt login.
  - Authenticated user with 2 stages completed sees "2 de 7 etapas completadas".
  - Navigation entry visible in Sidebar and MobileNav.
- **Depends on:** T26

### T28 — Regenerate database.types.ts after roadmap migration
- **Req:** X2
- **Files:** `src/types/database.types.ts`
- **Work:** Run `npm run gen:types`, commit. Types must include `progreso_roadmap` table.
- **Accept:** `database.types.ts` has `progreso_roadmap` table type with all four columns.
- **Depends on:** T25

---

## Track 5 — M3 Asistente RAG Backend

### T29 — Provision GEMINI_API_KEY_ASISTENTE secret
- **Req:** A1, A2
- **Files:** Supabase project secrets (no file change)
- **Work:** Create a new, separate Gemini API key. Set it as `GEMINI_API_KEY_ASISTENTE` in the Supabase project secrets via the dashboard. Confirm the existing key used by `buscar` remains unchanged.
- **Accept:** `GEMINI_API_KEY_ASISTENTE` exists in Supabase secrets. `buscar` EF still works with its own key.
- **Depends on:** T19 (buscar must be stable before adding a parallel key)
- **Parallel with:** T30

### T30 — Add rate-limit to buscar EF (retrofit)
- **Req:** A1 (CORS + rate-limit referenced for both EFs)
- **Files:** `supabase/functions/buscar/index.ts`, `supabase/functions/_shared/cors.ts`
- **Work:**
  - Update CORS in `_shared/cors.ts` to restrict to known origins (not wildcard).
  - Add per-IP token bucket rate-limit to `buscar` (using Supabase DB counter or Deno KV). Return HTTP 429 when exceeded.
  - Add structured error logging (not just `console.error`).
- **Accept:**
  - Request from unknown origin is rejected by CORS.
  - After exceeding rate cap, `buscar` returns HTTP 429; subsequent valid requests resume after window.
  - `buscar` still returns results normally under normal load.
- **Depends on:** T19
- **Parallel with:** T29

### T31 — asistente Edge Function
- **Req:** A1, A2
- **Files:** `supabase/functions/asistente/index.ts` (new), `supabase/functions/asistente/` (new dir)
- **Work:**
  - POST endpoint accepting `{ pregunta, historial?, contexto }`.
  - Validate `pregunta` length; reject with HTTP 400 if over cap. No Gemini call made on rejection.
  - Use `GEMINI_API_KEY_ASISTENTE` exclusively (never the buscar key).
  - Grounding: if `contexto` has `software_id`, `tema_id`, or `clasificacion_id`, fetch the entity by id and include as primary context.
  - Widening retrieval: embed `pregunta` via `embed` EF, call `buscar_hibrido` with `match_limit=5`.
  - Resolve `tema_id` UUIDs from retrieval results to names via a `temas` lookup before building Gemini prompt.
  - Include `historial` (cap at 3 turns) in Gemini prompt.
  - Primary model + fallback model (same pattern as `buscar`). If both fail: return HTTP 200 with `fuentes` populated and fixed fallback message. Never return HTTP 5xx.
  - Per-IP/session rate-limit returning HTTP 429.
  - CORS restricted to known origins.
  - Structured logging.
  - Return `{ respuesta: string, fuentes: { id: string, nombre: string }[] }`.
- **Accept:**
  - POST with `software_id=gemini_id` + `pregunta="¿Es gratuito?"` → `respuesta` grounded in Gemini ficha; `fuentes` includes Gemini entry.
  - POST with `pregunta` over char cap → HTTP 400, no Gemini call.
  - Both Gemini models fail → HTTP 200 with fallback message and fuentes; no HTTP 5xx.
  - Rate cap exceeded → HTTP 429; `buscar` is unaffected (separate key, separate counter).
  - Request from unknown origin → CORS rejection.
- **Depends on:** T29, T30

### T32 — asistenteService + dtos
- **Req:** A1, A3, A4
- **Files:** `src/services/asistenteService.ts` (new), `src/types/dtos.ts`
- **Work:**
  - Add DTO types to `dtos.ts`: `AsistentePregunta`, `AsistenteRespuesta`, `AsistenteContexto`, `AsistenteHistorialEntry`.
  - `asistenteService.preguntar(payload: AsistentePregunta)` invokes the `asistente` EF with a 10-second timeout.
- **Accept:** `asistenteService.preguntar({...})` returns `{ respuesta, fuentes }` on success. Times out after 10s if EF hangs.
- **Depends on:** T31

### T33 — useTTS hook
- **Req:** A3
- **Files:** `src/hooks/useTTS.ts` (new)
- **Work:**
  - `soportado`: `typeof speechSynthesis !== 'undefined'`.
  - `hablar(text)`: calls `speechSynthesis.speak(new SpeechSynthesisUtterance(text))` with best available `es-*` voice (selected from `speechSynthesis.getVoices()`).
  - `detener()`: calls `speechSynthesis.cancel()`.
  - `silencio` toggle persisted in `localStorage` key `tts_silencio`. When `silencio=true`, `hablar` is a no-op.
- **Accept:**
  - `soportado=true` and `silencio=false`: `hablar('texto')` calls `speechSynthesis.speak` with an `es-*` voice utterance.
  - `soportado=false`: hook provides `hablar` as a no-op, no error thrown.
  - `silencio` persists across page reloads.
- **Depends on:** T32
- **Parallel with:** T34

### T34 — useAsistente hook
- **Req:** A1, A4
- **Files:** `src/hooks/useAsistente.ts` (new)
- **Work:**
  - State: `historial: AsistenteHistorialEntry[]` (max 3 turns), `loading`, `error`, `fuentes`.
  - `preguntar(pregunta, contexto)`: appends to historial (capped at 3), calls `asistenteService.preguntar`, appends response.
  - `limpiar()`: resets historial.
- **Accept:** After 4 exchanges, `historial` contains only the 3 most recent turns. Context is passed correctly to the service.
- **Depends on:** T32
- **Parallel with:** T33

### T35 — AsistenteWidget component + AppLayout mount `[blocked-on-design]`
- **Req:** A4, X5
- **Files:** `src/components/asistente/AsistenteWidget.tsx` (new), `src/components/layout/AppLayout.tsx`
- **Work:**
  - Floating button with Gemini icon, always visible in `AppLayout`.
  - Click opens chat panel (no auto-action on open).
  - Panel: text input, microphone button (uses `useVoz` — transcribes to input field, NOT auto-send), voice toggle (mutes TTS), send button, `fuentes` as clickable links.
  - Pre-filled suggested prompt "Resumime esta página" in input on first open.
  - Derive `contexto` from current route params (`useLocation`, `useParams`).
  - `aria-live="polite"` on response area.
  - Keyboard accessible: Enter/Space on trigger button opens panel; focus trapped inside (reuses `Modal.tsx` focus-trap).
  - Single `SpeechRecognition` guard: if widget mic is active and user goes to `BuscarPage`, widget mic stops first. Implement via a shared `useVoz` instance or a global speech-recognition singleton ref.
- **Accept:**
  - Widget visible on every route.
  - Microphone transcribes spoken text to input field; user can edit before sending.
  - Only one `SpeechRecognition` instance active at a time.
  - `aria-live="polite"` present on response area.
  - Panel openable via keyboard alone.
  - Context: on `/software/:id`, EF request includes `contexto.software_id`.
- **Depends on:** T33, T34

---

## Track 6 — Seed Content Curation (User Collaboration)

### T36 — Seed content curation `[deferred-user-collab]`
- **Req:** S4
- **Files:** `db/seed-content.json`
- **Work:** User-led curation of ~35–40 Spanish-language software entries. Requires verification of each YouTube embed URL (embedding enabled, Spanish content). This task is a placeholder — execution is deferred until the user is available to co-create the content list.
- **Accept:** `db/seed-content.json` has ≥ 35 entries, all with working Spanish-language `video_url`, covering all 7 themes, no slug collisions.
- **Depends on:** T16 (upsert-by-slug generator must be in place)
- **Blocks:** T18

---

## Dependency Graph Summary

```
T01 ──┐
T02 ──┴── T03 ── T04 ── T05 ── T06 ── T07 ── T08 ── T09 ── T10 ── T11
                                                              │
                                                      T12, T13, T14 (UI)

T11 ── T25 ── T26 ── T27 (UI) ── T28

T08 ── T15 ── T16 ── T17 ──[T36 deferred]── T18
T08 ── T19
T15 ─────────────────────────────────────────────────── T20

T11 ── T21 ── T22 ── T23 (UI) ── T24

T19 ── T29 ──┐
T19 ── T30 ──┴── T31 ── T32 ──┬── T33 ──┐
                               └── T34 ──┴── T35 (UI)
```

---

## Review Workload Forecast

| Dimension | Estimate |
|---|---|
| Migration files (SQL) | ~6 new files, ~250–300 lines SQL total |
| Edge Functions (new/modified) | `asistente/index.ts` (~200 lines), `buscar/index.ts` (+~40 lines), `_shared/cors.ts` (+~10 lines) |
| New services | `roadmapService.ts` (~80 lines), `asistenteService.ts` (~40 lines), service extensions (~60 lines) |
| New hooks | `useRelacionados`, `useRoadmap`, `useIsAdmin`, `useTTS`, `useAsistente` (~200 lines total) |
| New pages | `RoadmapPage.tsx` (~120 lines) |
| New components | `AsistenteWidget.tsx` (~200 lines), `SoftwareFormModal.tsx` (~150 lines), `ConfirmDeleteModal.tsx` (~60 lines) |
| Modified files | `AuthContext.tsx`, `auth-context-value.ts`, `supabase.ts`, `navLinks.ts`, `AppLayout.tsx`, `SoftwareDetallePage.tsx`, `SoftwareCard.tsx`, `RestablecerPage.tsx`, `seed-to-sql.mjs`, `seed-content.json`, `database.types.ts`, `dtos.ts` |
| **Estimated total changed lines** | **~1,400–1,600** |
| 400-line budget risk | **HIGH — far exceeds single-PR budget** |
| Chained PRs recommended | **Yes** |
| Decision needed before apply | **Yes** |

### Recommended PR Slices

| PR | Tasks | Lines est. | Description |
|---|---|---|---|
| PR-1 | T01, T02, T03 | ~30 | Debt fixes + baseline types |
| PR-2 | T04, T05, T06, T07, T08, T09, T10, T11, T12, T13 | ~350 | Admin backend (profiles, RLS, trigger, types, services) |
| PR-3 | T14 | ~200 | Admin UI (blocked-on-design, may slip) |
| PR-4 | T15, T16, T19, T20 | ~100 | Seed slug migration + threshold externalization |
| PR-5 | T17, T18 | varies | Corpus expansion (deferred until content curation done) |
| PR-6 | T21, T22, T23, T24 | ~200 | Relacionados RPC + hook + UI |
| PR-7 | T25, T26, T27, T28 | ~280 | Roadmap table + service + hook + page |
| PR-8 | T29, T30, T31, T32, T33, T34, T35 | ~550 | Asistente EF + services + hooks + widget |

**Decision needed:** Confirm chained PR strategy (stacked-to-main vs feature-branch-chain) before starting apply.
