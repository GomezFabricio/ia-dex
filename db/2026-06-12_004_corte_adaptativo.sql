-- Adaptive relevance cutoff for buscar_hibrido
--
-- Problem: the absolute match_threshold (0.82) separates AI-software queries from
-- off-topic noise, but cannot discriminate WITHIN the domain — every row in the
-- corpus is AI software, so in-domain similarities cluster. Example observed in
-- production: "software de procesamiento de imagenes" returned 9/23 rows, with an
-- irrelevant tail (Stockfish, SWI-Prolog, OR-Tools) trailing the relevant vision
-- tools (OpenCV, MediaPipe, Tesseract, YOLO).
--
-- Fix: the vector leg now keeps only rows whose similarity is within
-- `adaptive_margin` of the BEST similarity for this query, on top of the absolute
-- floor. The tail collapses while near-top relevant results survive. The FTS leg
-- is unchanged (a lexical match is a strong signal on its own).
--
-- adaptive_margin is a tunable RPC parameter (like match_threshold) so it can be
-- adjusted per-call or re-defaulted without redeploying the Edge Function.
--
-- NOTE: the parameter list changes, so the old function must be dropped first
-- (CREATE OR REPLACE cannot alter a signature).

drop function if exists public.buscar_hibrido(
  text, vector, uuid, text, int, int, float, int, int
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
  text, vector, uuid, text, int, int, float, int, int, float
) to anon, authenticated;
