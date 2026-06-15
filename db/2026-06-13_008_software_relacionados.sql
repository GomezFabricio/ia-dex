-- 2026-06-13_008_software_relacionados.sql
-- PR-6 / T21 — Semantic "related software" RPC.
--
-- Ranks the rest of the catalogue by cosine similarity to the given row's
-- embedding, excludes the row itself and rows without an embedding, and keeps
-- only neighbours within an adaptive margin of the best hit (mirrors
-- buscar_hibrido's adaptive_margin default of 0.04). Returns the public Software
-- shape (every column except the internal embedding/fts), so the result maps
-- straight onto the Software DTO.
--
-- security invoker: public read is already granted by the catalogue's
-- SELECT-to-anon RLS policy, so no elevated rights are needed. An empty result
-- (row has no embedding yet, or no neighbour within the margin) is intentional —
-- the client falls back to same-theme recommendations.
--
-- ROLLBACK (manual): drop function public.software_relacionados(uuid, int);

create or replace function public.software_relacionados(
  p_software_id uuid,
  p_limit int default 5
)
returns table (
  id uuid,
  slug text,
  tema_id uuid,
  clasificacion_si_id uuid,
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
    id, slug, tema_id, clasificacion_si_id, nombre, objetivo, descripcion_corta,
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
