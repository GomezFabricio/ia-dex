-- Migration 020 — foro public author names + security-advisor hardening
--
-- Goal A (feature): the foro must show an author's nombre + apellido instead of
--   a raw UUID. The frontend resolves names through the existing public view
--   v_autores_publicos (same mechanism as publicaciones). That view currently
--   lists ONLY publication authors, so a forum-only user would resolve to no
--   name. Broaden it to also cover forum authors (temas_foro / mensajes_foro).
--
-- Goal B (security advisors): pin search_path on two INVOKER functions, and
--   revoke RPC EXECUTE from two internal SECURITY DEFINER functions.
--
-- Note: v_autores_publicos is INTENTIONALLY kept SECURITY DEFINER (the default
-- for views). It exposes only a safe id/nombre/apellido projection; profiles is
-- otherwise self-read-only and carries a sensitive `role` column we do NOT want
-- public. The advisor 0010 (security_definer_view) is accepted/documented here.

begin;

-- A) Broaden the public-authors view to include FORUM authors, not just
--    publication authors. Kept SECURITY DEFINER (view default). CREATE OR
--    REPLACE preserves the existing anon/authenticated SELECT grants. Same
--    columns (id, nombre, apellido) → no generated-types change.
create or replace view public.v_autores_publicos as
  select p.id, p.nombre, p.apellido
  from public.profiles p
  where exists (select 1 from public.publicaciones pub where pub.autor_id = p.id)
     or exists (select 1 from public.temas_foro    t   where t.user_id   = p.id)
     or exists (select 1 from public.mensajes_foro  m   where m.user_id   = p.id);

-- B1) Pin search_path on the two flagged SECURITY INVOKER functions
--     (advisor 0011 function_search_path_mutable). Both operate on objects in
--     the public schema (incl. the `vector` extension, which lives in public).
alter function public.buscar_hibrido(
  query_text text,
  query_embedding vector,
  p_tema_id uuid,
  p_licencia text,
  p_anio_desde integer,
  p_anio_hasta integer,
  match_threshold double precision,
  rrf_k integer,
  match_limit integer,
  adaptive_margin double precision
) set search_path = public;

alter function public.software_relacionados(p_software_id uuid, p_limit integer)
  set search_path = public;

-- B2) These SECURITY DEFINER functions are internal: a trigger function
--     (embedding refresh on software change) and an RLS bootstrap helper.
--     Neither is meant to be called over PostgREST RPC by anon/authenticated
--     (advisors 0028 / 0029). Revoking EXECUTE does NOT stop the trigger from
--     firing — trigger functions run regardless of the caller's privilege.
revoke execute on function public.rls_auto_enable() from anon, authenticated, public;
revoke execute on function public.trigger_embed_on_software_change() from anon, authenticated, public;

commit;
