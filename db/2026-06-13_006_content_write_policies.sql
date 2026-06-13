-- ============================================================================
-- 2026-06-13_006_content_write_policies.sql
-- Applied to PRODUCTION via Supabase MCP (migration: content_write_policies_authorship).
--
-- Admin-only write policies on content + authorship column + valoraciones
-- cleanup trigger + eventos FK CASCADE -> SET NULL.
-- Verified before applying: RLS is already ENABLED and a public SELECT policy
-- already exists on software/clasificaciones_si, so the write policies below are
-- purely additive (no write policy existed => all writes were denied).
-- eventos.software_id was ON DELETE CASCADE; changed to SET NULL so deleting a
-- software preserves its (now anonymous) analytics events instead of erasing
-- historical activity. Stats views start FROM software, so a deleted software
-- still disappears from every ranking either way.
-- ============================================================================

-- Clean up advisor warnings from migration 005: anon must not RPC these.
revoke execute on function public.puede_gestionar_contenido() from anon;
revoke execute on function public.handle_new_user() from anon, authenticated;

-- Write policies: admin only (no write policy existed before => writes were denied).
create policy "admin inserta software"   on public.software for insert to authenticated with check (public.puede_gestionar_contenido());
create policy "admin actualiza software" on public.software for update to authenticated using (public.puede_gestionar_contenido()) with check (public.puede_gestionar_contenido());
create policy "admin borra software"     on public.software for delete to authenticated using (public.puede_gestionar_contenido());
create policy "admin inserta clasif"     on public.clasificaciones_si for insert to authenticated with check (public.puede_gestionar_contenido());
create policy "admin actualiza clasif"   on public.clasificaciones_si for update to authenticated using (public.puede_gestionar_contenido()) with check (public.puede_gestionar_contenido());
create policy "admin borra clasif"       on public.clasificaciones_si for delete to authenticated using (public.puede_gestionar_contenido());

-- Authorship: who created each content row. Seed/service inserts (no auth.uid()) => NULL.
alter table public.software           add column if not exists created_by uuid references public.profiles(id) on delete set null default auth.uid();
alter table public.clasificaciones_si add column if not exists created_by uuid references public.profiles(id) on delete set null default auth.uid();

-- Cleanup polymorphic valoraciones when content is deleted (valoraciones has no FK).
create function public.cleanup_valoraciones_on_content_delete()
  returns trigger language plpgsql security definer set search_path = public
as $$
begin
  delete from public.valoraciones where contenido_tipo = tg_argv[0] and contenido_id = old.id;
  return old;
end;
$$;
revoke execute on function public.cleanup_valoraciones_on_content_delete() from anon, authenticated, public;
create trigger limpiar_valoraciones_software before delete on public.software           for each row execute function public.cleanup_valoraciones_on_content_delete('software');
create trigger limpiar_valoraciones_clasif   before delete on public.clasificaciones_si for each row execute function public.cleanup_valoraciones_on_content_delete('clasificacion_si');

-- eventos FK: CASCADE -> SET NULL.
alter table public.eventos drop constraint eventos_software_id_fkey;
alter table public.eventos add constraint eventos_software_id_fkey
  foreign key (software_id) references public.software(id) on delete set null;
