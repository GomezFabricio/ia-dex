-- Threshold tuning: lower match_threshold default from 0.80 → 0.82
-- Context: gte-small is English-centric; Spanish queries on this corpus cluster in the
-- 0.80–0.92 range for relevant results. The absolute floor for irrelevant queries
-- (e.g. "recetas de cocina italiana") peaked at 0.7985 across all 23 rows.
-- 0.82 sits comfortably above that noise floor while passing all relevant hits.
-- Applied: 2026-06-12

create or replace function public.buscar_hibrido(
  query_text       text,
  query_embedding  vector(384),
  p_tema_id        uuid    default null,
  p_licencia       text    default null,
  p_anio_desde     int     default null,
  p_anio_hasta     int     default null,
  match_threshold  float   default 0.82,
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
