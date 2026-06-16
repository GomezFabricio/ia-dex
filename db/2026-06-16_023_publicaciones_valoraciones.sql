-- ============================================================================
-- 2026-06-16_023_publicaciones_valoraciones.sql
-- Extend the existing star-rating system (valoraciones) to publicaciones, and
-- add an aggregate view for a "most valued articles" strip on the blog.
--
-- Reuses the polymorphic `valoraciones` table (puntaje 1-5, unique per
-- user+tipo+id) and the cleanup trigger FUNCTION from migration 006 — NO new
-- rating table, just a new contenido_tipo value ('publicacion').
--
-- Verified remote state (via MCP): valoraciones INSERT/UPDATE/SELECT policies are
-- already tipo-AGNOSTIC own-row ("crear propia val" / "editar propia val" with
-- auth.uid() = user_id; "ver valoraciones" USING true), so voting on a
-- 'publicacion' needs NO new policy — only the contenido_tipo check must widen.
--
-- Idempotent: drop-if-exists the (known-named) check then re-add it; drop-then-
-- create the trigger; create-or-replace the view.
--
-- ROLLBACK (manual):
--   drop view    if exists public.v_publicaciones_rating;
--   drop trigger if exists limpiar_valoraciones_publicacion on public.publicaciones;
--   alter table public.valoraciones drop constraint if exists valoraciones_contenido_tipo_check;
--   alter table public.valoraciones add constraint valoraciones_contenido_tipo_check
--     check (contenido_tipo in ('software','tema','clasificacion_si'));
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- STEP 1: allow 'publicacion' as a valoraciones.contenido_tipo. The existing
-- check is valoraciones_contenido_tipo_check (3 values, verified via MCP); drop
-- it by name and re-add covering all four. Existing rows only use the first
-- three, so the new constraint validates cleanly.
-- ----------------------------------------------------------------------------
alter table public.valoraciones drop constraint if exists valoraciones_contenido_tipo_check;
alter table public.valoraciones
  add constraint valoraciones_contenido_tipo_check
  check (contenido_tipo in ('software', 'tema', 'clasificacion_si', 'publicacion'));

-- ----------------------------------------------------------------------------
-- STEP 2: cleanup-trigger parity — deleting a publicacion removes its ratings
-- (valoraciones has no FK; mirrors migrations 006/017 for software/clasif/tema).
-- Reuses the polymorphic public.cleanup_valoraciones_on_content_delete().
-- ----------------------------------------------------------------------------
drop trigger if exists limpiar_valoraciones_publicacion on public.publicaciones;
create trigger limpiar_valoraciones_publicacion
  before delete on public.publicaciones
  for each row execute function public.cleanup_valoraciones_on_content_delete('publicacion');

-- ----------------------------------------------------------------------------
-- STEP 3: aggregate view for "most valued articles". Mirrors v_software_rating.
-- Only PUBLISHED publicaciones with >= 1 rating appear (INNER join + estado
-- filter). security_invoker = true so the view respects the QUERIER's RLS (it
-- does NOT need to bypass any: valoraciones SELECT is USING(true) and
-- publicaciones already restricts anon to published rows). This also satisfies
-- the Supabase security_definer_view advisor. Exposes only public columns
-- (titulo/slug/promedio/count), so safe to grant to anon.
-- ----------------------------------------------------------------------------
create or replace view public.v_publicaciones_rating
  with (security_invoker = true) as
  select p.id as publicacion_id,
         p.titulo,
         p.slug,
         round(avg(v.puntaje)::numeric, 1) as promedio,
         count(*)                          as cantidad_votos
  from public.publicaciones p
  join public.valoraciones v
    on v.contenido_tipo = 'publicacion' and v.contenido_id = p.id
  where p.estado = 'publicado'
  group by p.id, p.titulo, p.slug;

grant select on public.v_publicaciones_rating to anon, authenticated;

commit;
