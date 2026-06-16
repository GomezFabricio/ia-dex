-- ============================================================================
-- 2026-06-16_021_publicaciones_orden.sql
-- Manual ordering of per-tema "contenido didáctico" (publicaciones linked to a
-- tema). Adds an explicit `orden` column so an admin can curate the learning
-- sequence instead of relying on created_at desc.
--
-- Read order becomes (orden asc NULLS LAST, created_at desc): curated items
-- first in the admin's chosen order; never-ordered items fall to the end by
-- recency. Mirrors the live RLS/RPC patterns of migrations 005/006/011/020.
--
-- Idempotent: add-column-if-not-exists, index-if-not-exists, create-or-replace
-- RPC. The backfill ONLY touches rows whose orden IS NULL, so re-applying this
-- migration can NEVER clobber a manually curated order.
--
-- ROLLBACK (manual):
--   drop function if exists public.reordenar_material_tema(uuid, uuid[]);
--   drop index if exists public.idx_publicaciones_tema_orden;
--   alter table public.publicaciones drop column if exists orden;
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- STEP 1: the column. Nullable on purpose — existing rows and brand-new posts
-- may carry no explicit position yet; those sort last by recency.
-- ----------------------------------------------------------------------------
alter table public.publicaciones add column if not exists orden integer;

-- ----------------------------------------------------------------------------
-- STEP 2: index serving the per-tema ordered read (tema_id filter + orden sort).
-- Partial on tema_id (only per-tema content is ordered; blog-only posts are not).
-- ----------------------------------------------------------------------------
create index if not exists idx_publicaciones_tema_orden
  on public.publicaciones (tema_id, orden)
  where tema_id is not null;

-- ----------------------------------------------------------------------------
-- STEP 3: one-time backfill — number each tema's PUBLISHED posts 0..n-1 by
-- creation order (oldest first = a sensible default reading sequence). GUARDED by
-- `orden IS NULL` so re-applying the migration never overwrites a curated order.
-- Drafts are EXCLUDED (estado='publicado' only): they keep orden NULL and sort
-- last until curated, so publishing one later cannot collide with the dense
-- 0..n-1 positions the reorder UI assigns over the published subset.
-- ----------------------------------------------------------------------------
update public.publicaciones p
set orden = sub.rn
from (
  select id,
         (row_number() over (partition by tema_id order by created_at) - 1) as rn
  from public.publicaciones
  where tema_id is not null and estado = 'publicado' and orden is null
) sub
where p.id = sub.id and p.orden is null;

-- ----------------------------------------------------------------------------
-- STEP 4: atomic reorder RPC. SECURITY INVOKER (the default) so the caller's RLS
-- ("admin actualiza publicaciones" → public.puede_gestionar_contenido()) governs
-- the UPDATE; the explicit guard only returns a clean 42501 to non-admins before
-- the no-op update would. Sets orden = 0-based position of each id within p_ids,
-- scoped to a single tema. search_path pinned (advisor 0011 hardening).
-- ----------------------------------------------------------------------------
create or replace function public.reordenar_material_tema(
  p_tema_id uuid,
  p_ids uuid[]
) returns void
  language plpgsql
  set search_path = public
as $$
begin
  if not public.puede_gestionar_contenido() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  update public.publicaciones p
  set orden = sub.idx
  from (
    select id, (ord - 1)::integer as idx
    from unnest(p_ids) with ordinality as t(id, ord)
  ) sub
  where p.id = sub.id and p.tema_id = p_tema_id;
end;
$$;

grant execute on function public.reordenar_material_tema(uuid, uuid[]) to authenticated;

commit;
