-- 2026-06-14_009_si_taxonomy.sql
-- SI Taxonomy: criterios_si table + M2M junction + function rewrites.
--
-- This is ONE atomic migration. Steps are ordered so no broken DB window exists:
--   Steps 1–5  — additive structural DDL + RLS + policies  (safe, applied first)
--   Step  6    — DATA: seed.sql (run separately via MCP after explicit OK — NOT in this file)
--   Steps 7–10 — destructive/irreversible DDL (SET NOT NULL, DROP COLUMN, function recreates)
--               applied as a single block AFTER the seed gate (S1-T10).
--
-- USER-GATED destructive steps are clearly commented below.
-- APPLY IN 3 GATED OPERATIONS (NOT as one file — step 7 SET NOT NULL depends on the seed):
--   (1) Steps 1–5 structural DDL + RLS  →  (2) db/seed.sql data  →  (3) Steps 7–10 destructive DDL.
-- Each operation runs via MCP only after explicit user OK; never run steps 1–10 in a single shot.
--
-- ROLLBACK (manual, before step 8): remove junction rows, drop software_clasificaciones,
--   drop criterios_si column from clasificaciones_si, drop criterios_si table, restore
--   functions from migrations 004 and 008.
-- After step 8 (DROP COLUMN), rollback requires restoring from a backup.
-- ============================================================================


-- ============================================================================
-- STEP 1: CREATE TABLE criterios_si
-- The 7 classification axes (alcance, russell-norvig, hintze, aprendizaje,
-- paradigma, naturaleza, metodo). Holds human-readable labels for each axis.
-- ============================================================================

create table public.criterios_si (
  id          uuid        not null default gen_random_uuid() primary key,
  nombre      text        not null,
  slug        text        not null unique,
  descripcion text,
  orden       int         not null default 0,
  created_at  timestamptz not null default now(),
  created_by  uuid        references public.profiles(id) on delete set null default auth.uid()
);


-- ============================================================================
-- STEP 2: ALTER clasificaciones_si — add criterio_id (nullable FK for now)
-- Nullable so we can insert the data before enforcing NOT NULL (step 7).
-- ON DELETE RESTRICT: deleting a criterio that still has categories is blocked.
-- ============================================================================

alter table public.clasificaciones_si
  add column criterio_id uuid
  references public.criterios_si(id) on delete restrict;


-- ============================================================================
-- STEP 3: CREATE TABLE software_clasificaciones (M2M junction)
-- Pure join table — no per-axis cap, no unique on (software_id, criterio_id).
-- Both FKs are ON DELETE CASCADE so removing a software or a category auto-cleans
-- the junction (no orphan rows possible).
-- ============================================================================

create table public.software_clasificaciones (
  software_id         uuid not null references public.software(id) on delete cascade,
  clasificacion_si_id uuid not null references public.clasificaciones_si(id) on delete cascade,
  primary key (software_id, clasificacion_si_id)
);


-- ============================================================================
-- STEP 4: ENABLE ROW LEVEL SECURITY on both new tables
-- ============================================================================

alter table public.criterios_si          enable row level security;
alter table public.software_clasificaciones enable row level security;


-- ============================================================================
-- STEP 5: RLS POLICIES — mirror migration 006 pattern (puede_gestionar_contenido)
-- SELECT: open to anon + authenticated (public catalogue data).
-- INSERT/UPDATE/DELETE: admin only via public.puede_gestionar_contenido().
-- ============================================================================

-- criterios_si policies
create policy "public lee criterios"
  on public.criterios_si for select
  to anon, authenticated
  using (true);

create policy "admin inserta criterios"
  on public.criterios_si for insert
  to authenticated
  with check (public.puede_gestionar_contenido());

create policy "admin actualiza criterios"
  on public.criterios_si for update
  to authenticated
  using  (public.puede_gestionar_contenido())
  with check (public.puede_gestionar_contenido());

create policy "admin borra criterios"
  on public.criterios_si for delete
  to authenticated
  using (public.puede_gestionar_contenido());

-- software_clasificaciones policies
create policy "public lee software_clasificaciones"
  on public.software_clasificaciones for select
  to anon, authenticated
  using (true);

create policy "admin inserta software_clasificaciones"
  on public.software_clasificaciones for insert
  to authenticated
  with check (public.puede_gestionar_contenido());

create policy "admin actualiza software_clasificaciones"
  on public.software_clasificaciones for update
  to authenticated
  using  (public.puede_gestionar_contenido())
  with check (public.puede_gestionar_contenido());

create policy "admin borra software_clasificaciones"
  on public.software_clasificaciones for delete
  to authenticated
  using (public.puede_gestionar_contenido());


-- ============================================================================
-- GATE A: structure is live, writes are locked to admin.
-- Apply db/seed.sql next (S1-T09) — this populates criterios_si,
-- reseeds clasificaciones_si (TRUNCATE+25), and inserts junction rows.
-- ============================================================================


-- ============================================================================
-- STEP 7: SET NOT NULL on criterio_id — safe only after seed populated every row
-- USER-GATED: apply only after S1-T09 (seed) succeeds and
--   SELECT count(*) FROM clasificaciones_si WHERE criterio_id IS NULL → 0
-- ============================================================================

alter table public.clasificaciones_si
  alter column criterio_id set not null;


-- ============================================================================
-- STEP 8: DROP COLUMN clasificacion_si_id from software
-- USER-GATED: irreversible. Apply only after the junction (software_clasificaciones)
-- is populated and verified (S1-T09 done, S1-T10 ready to proceed).
-- The column is nullable with no enforced FK in recent schema, so drop is clean.
-- ============================================================================

alter table public.software drop column clasificacion_si_id;


-- ============================================================================
-- STEP 9: Recreate buscar_hibrido — remove clasificacion_si_id from return shape
-- DROP first because CREATE OR REPLACE cannot change the return type.
-- Body is verbatim from migration 004 except:
--   - removed "clasificacion_si_id uuid," from returns table(...)  (was line 40)
--   - removed "s.clasificacion_si_id," from the final SELECT       (was line 112)
-- ============================================================================

drop function if exists public.buscar_hibrido(
  text, vector, uuid, text, int, int, float, int, int, float
);

create or replace function public.buscar_hibrido(
  query_text       text,
  query_embedding  vector(384),
  p_tema_id        uuid    default null,
  p_licencia       text    default null,
  p_anio_desde     int     default null,
  p_anio_hasta     int     default null,
  match_threshold  float   default 0.82,
  rrf_k            int     default 50,
  match_limit      int     default 10,
  adaptive_margin  float   default 0.04
)
returns table (
  id                  uuid,
  tema_id             uuid,
  nombre              text,
  objetivo            text,
  descripcion_corta   text,
  url_acceso          text,
  licencia            text,
  anio_lanzamiento    integer,
  autor_referencia    text,
  video_url           text,
  imagen_url          text,
  created_at          timestamptz
)
language sql
stable
security invoker
as $$
  with
  -- Vector leg, scored: cosine similarity for every filter-matching row
  vector_scored as (
    select
      s.id,
      1 - (s.embedding <=> query_embedding) as similarity
    from public.software s
    where
      s.embedding is not null
      and (p_tema_id    is null or s.tema_id          = p_tema_id)
      and (p_licencia   is null or s.licencia         = p_licencia)
      and (p_anio_desde is null or s.anio_lanzamiento >= p_anio_desde)
      and (p_anio_hasta is null or s.anio_lanzamiento <= p_anio_hasta)
  ),
  -- Vector leg, cut: absolute floor AND within adaptive_margin of the best hit
  vector_results as (
    select
      id,
      row_number() over (order by similarity desc) as rank
    from (
      select
        id,
        similarity,
        max(similarity) over () as best_similarity
      from vector_scored
    ) scored
    where
      similarity > match_threshold
      and similarity >= best_similarity - adaptive_margin
  ),
  -- FTS leg: Spanish full-text search (unchanged)
  fts_results as (
    select
      s.id,
      row_number() over (order by ts_rank_cd(s.fts, query) desc) as rank
    from public.software s,
         websearch_to_tsquery('spanish', query_text) as query
    where
      s.fts @@ query
      and (p_tema_id    is null or s.tema_id          = p_tema_id)
      and (p_licencia   is null or s.licencia         = p_licencia)
      and (p_anio_desde is null or s.anio_lanzamiento >= p_anio_desde)
      and (p_anio_hasta is null or s.anio_lanzamiento <= p_anio_hasta)
  ),
  -- RRF fusion
  fused as (
    select
      coalesce(v.id, f.id) as id,
      coalesce(1.0 / (rrf_k + v.rank), 0) +
      coalesce(1.0 / (rrf_k + f.rank), 0) as rrf_score
    from vector_results v
    full outer join fts_results f on v.id = f.id
  )
  select
    s.id,
    s.tema_id,
    s.nombre,
    s.objetivo,
    s.descripcion_corta,
    s.url_acceso,
    s.licencia,
    s.anio_lanzamiento,
    s.autor_referencia,
    s.video_url,
    s.imagen_url,
    s.created_at
  from fused
  join public.software s on s.id = fused.id
  order by fused.rrf_score desc
  limit match_limit;
$$;

grant execute on function public.buscar_hibrido(
  text, vector, uuid, text, int, int, float, int, int, float
) to anon, authenticated;


-- ============================================================================
-- STEP 10: Recreate software_relacionados — remove clasificacion_si_id from return shape
-- DROP first for the same return-type reason as step 9.
-- Body is verbatim from migration 008 except:
--   - removed "clasificacion_si_id uuid," from returns table(...)  (was line 26)
--   - removed "clasificacion_si_id," from the final SELECT list    (was line 60)
--   - `scored` uses s.* so the column auto-drops there (no change needed in the CTE)
-- ============================================================================

drop function if exists public.software_relacionados(uuid, int);

create or replace function public.software_relacionados(
  p_software_id uuid,
  p_limit int default 5
)
returns table (
  id uuid,
  slug text,
  tema_id uuid,
  nombre text,
  objetivo text,
  descripcion_corta text,
  url_acceso text,
  licencia text,
  anio_lanzamiento integer,
  autor_referencia text,
  video_url text,
  imagen_url text,
  created_at timestamptz,
  created_by uuid
)
language sql
stable
security invoker
as $$
  with target as (
    select embedding
    from public.software
    where id = p_software_id and embedding is not null
  ),
  scored as (
    select
      s.*,
      1 - (s.embedding <=> t.embedding) as similarity
    from public.software s, target t
    where s.id <> p_software_id and s.embedding is not null
  ),
  cut as (
    select *, max(similarity) over () as best_similarity
    from scored
  )
  select
    id, slug, tema_id, nombre, objetivo, descripcion_corta,
    url_acceso, licencia, anio_lanzamiento, autor_referencia, video_url,
    imagen_url, created_at, created_by
  from cut
  -- Adaptive cutoff: keep neighbours within 0.04 similarity of the best hit.
  -- Self-row is excluded above, so best_similarity reflects genuine neighbours.
  -- No absolute floor (unlike buscar_hibrido's match_threshold): every catalogue
  -- row shares the IA domain, so for a "related items" widget the adaptive margin
  -- alone is the right cut — an arbitrary floor would just hide valid neighbours.
  where similarity >= best_similarity - 0.04
  order by similarity desc
  limit p_limit;
$$;

grant execute on function public.software_relacionados(uuid, int) to anon, authenticated;
