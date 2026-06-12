-- Hybrid search migration: pgvector + FTS + hybrid RPC + pg_net trigger + backfill
-- Applied: 2026-06-12

-- ============================================================
-- 1. Extensions
-- ============================================================
create extension if not exists vector;
create extension if not exists pg_net;

-- ============================================================
-- 2. New columns on software
-- ============================================================
alter table public.software
  add column if not exists embedding vector(384),
  add column if not exists fts tsvector
    generated always as (
      to_tsvector(
        'spanish',
        nombre || ' ' || coalesce(objetivo, '') || ' ' || coalesce(descripcion_corta, '')
      )
    ) stored;

-- ============================================================
-- 3. Indexes
-- ============================================================
create index if not exists software_fts_idx
  on public.software using gin(fts);

-- HNSW index for cosine distance (better recall than IVFFlat for this corpus size)
create index if not exists software_embedding_idx
  on public.software using hnsw(embedding vector_cosine_ops);

-- ============================================================
-- 4. Hybrid RPC: buscar_hibrido
-- ============================================================
create or replace function public.buscar_hibrido(
  query_text       text,
  query_embedding  vector(384),
  p_tema_id        uuid    default null,
  p_licencia       text    default null,
  p_anio_desde     int     default null,
  p_anio_hasta     int     default null,
  match_threshold  float   default 0.80,
  rrf_k            int     default 50,
  match_limit      int     default 10
)
returns table (
  id                  uuid,
  tema_id             uuid,
  clasificacion_si_id uuid,
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
  -- Vector leg: cosine similarity above threshold
  vector_results as (
    select
      s.id,
      row_number() over (order by s.embedding <=> query_embedding) as rank
    from public.software s
    where
      (1 - (s.embedding <=> query_embedding)) > match_threshold
      and s.embedding is not null
      and (p_tema_id    is null or s.tema_id          = p_tema_id)
      and (p_licencia   is null or s.licencia         = p_licencia)
      and (p_anio_desde is null or s.anio_lanzamiento >= p_anio_desde)
      and (p_anio_hasta is null or s.anio_lanzamiento <= p_anio_hasta)
  ),
  -- FTS leg: Spanish full-text search
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
    s.clasificacion_si_id,
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
  text, vector, uuid, text, int, int, float, int, int
) to anon, authenticated;

-- ============================================================
-- 5. Vault: store project URL for trigger use
-- ============================================================
-- Store the project URL so the trigger function can read it without
-- hardcoding it in a place visible in pg_proc source.
select vault.create_secret(
  'https://othwyesmfpjaykbdwxrh.supabase.co',
  'supabase_project_url'
);

-- ============================================================
-- 6. Trigger function: call embed edge function via pg_net
-- ============================================================
create or replace function public.trigger_embed_on_software_change()
returns trigger
language plpgsql
security definer
set search_path = public, vault, net
as $$
declare
  v_project_url text;
  v_anon_key    text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90aHd5ZXNtZnBqYXlrYmR3eHJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNzg5ODgsImV4cCI6MjA5NjY1NDk4OH0.nE0sFVgNPBP2TMestyRCsbXaVcJaG8ZBeEdC8FqZRXU';
begin
  -- Null out embedding so stale vectors don't linger
  NEW.embedding := null;

  -- Fetch project URL from Vault
  select decrypted_secret
    into v_project_url
    from vault.decrypted_secrets
   where name = 'supabase_project_url'
   limit 1;

  -- Fallback to hardcoded constant if Vault lookup fails (risk mitigation)
  if v_project_url is null then
    v_project_url := 'https://othwyesmfpjaykbdwxrh.supabase.co';
  end if;

  -- Fire async HTTP POST to embed edge function
  perform net.http_post(
    url     := v_project_url || '/functions/v1/embed',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_anon_key
    ),
    body    := jsonb_build_object('id', NEW.id)
  );

  return NEW;
end;
$$;

-- ============================================================
-- 7. Trigger: fires on relevant column changes
-- ============================================================
drop trigger if exists software_embed_trigger on public.software;

create trigger software_embed_trigger
  after insert or update of nombre, objetivo, descripcion_corta, tema_id
  on public.software
  for each row
  execute function public.trigger_embed_on_software_change();

-- ============================================================
-- 8. Backfill: trigger async embed calls for all existing rows
-- ============================================================
update public.software set nombre = nombre;
