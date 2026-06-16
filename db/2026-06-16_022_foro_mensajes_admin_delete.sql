-- ============================================================================
-- 2026-06-16_022_foro_mensajes_admin_delete.sql
-- Let an admin delete ANY forum reply (moderation), not just their own.
--
-- Verified remote state (via MCP): mensajes_foro already has DELETE policy
-- "borrar mensaje" USING (auth.uid() = user_id) (authorship). RLS DELETE policies
-- are PERMISSIVE and combine with OR, so we ADD an admin policy alongside it — a
-- reply becomes deletable when the caller is its author OR an admin. Admin gate
-- via public.puede_gestionar_contenido() (mirrors migrations 006/011/017). The
-- client service eliminarMensaje() is already generic and needs no change.
--
-- ROLLBACK (manual):
--   drop policy if exists "admin borra mensaje foro" on public.mensajes_foro;
-- ============================================================================

begin;

-- RLS is already enabled on mensajes_foro; assert it (idempotent, defensive).
alter table public.mensajes_foro enable row level security;

-- Additive admin DELETE policy. Combined with the existing "borrar mensaje"
-- authorship policy via OR: author OR admin may delete a reply.
drop policy if exists "admin borra mensaje foro" on public.mensajes_foro;
create policy "admin borra mensaje foro"
  on public.mensajes_foro for delete
  to authenticated
  using (public.puede_gestionar_contenido());

commit;
