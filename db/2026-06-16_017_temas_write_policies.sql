-- ============================================================================
-- 2026-06-16_017_temas_write_policies.sql
-- Admin-only write policies on temas (mirrors migration 006 for software/SI).
--
-- temas had RLS enabled but ONLY a public SELECT policy, so ALL writes were
-- denied. These policies are purely additive and enable admin inline editing of
-- tema fields (descripcion, video_url) via RLS (public.puede_gestionar_contenido()).
-- INSERT/DELETE are added for parity with software/clasificaciones_si (future
-- admin CRUD); v1 inline edit only exercises UPDATE.
--
-- Also adds a valoraciones cleanup trigger for temas (StarRating tipo='tema'),
-- reusing the polymorphic cleanup function created in migration 006, so deleting
-- a tema does not orphan its ratings — parity with the software/clasif delete path.
--
-- ROLLBACK (manual):
--   drop trigger if exists limpiar_valoraciones_tema on public.temas;
--   drop policy  if exists "admin inserta temas"   on public.temas;
--   drop policy  if exists "admin actualiza temas" on public.temas;
--   drop policy  if exists "admin borra temas"     on public.temas;
-- ============================================================================

create policy "admin inserta temas"   on public.temas for insert to authenticated with check (public.puede_gestionar_contenido());
create policy "admin actualiza temas" on public.temas for update to authenticated using (public.puede_gestionar_contenido()) with check (public.puede_gestionar_contenido());
create policy "admin borra temas"     on public.temas for delete to authenticated using (public.puede_gestionar_contenido());

create trigger limpiar_valoraciones_tema before delete on public.temas
  for each row execute function public.cleanup_valoraciones_on_content_delete('tema');
