-- ============================================================================
-- 2026-06-16_019_storage_contenido.sql
-- A shared PUBLIC Storage bucket 'contenido' for admin-uploaded software / SI
-- images. Path convention (enforced client-side): {entity}/{id}/{uuid}-{name}
-- e.g. software/{software_id}/..., clasificaciones/{clasificacion_id}/...
--
-- Mirrors the publicaciones bucket (012) with the upsert SELECT-policy lesson
-- (016) baked in from day one:
--   - public bucket -> public read is served by the /object/public/ endpoint,
--     so NO anon SELECT policy is needed (avoids advisor 0025 bucket-listing).
--   - an AUTHENTICATED SELECT policy IS included so any future upsert upload
--     works (the helper uses upsert:false + uuid keys, but this future-proofs it
--     and documents the lesson). Listing is limited to logged-in users only.
-- Writes are admin-gated via public.puede_gestionar_contenido().
--
-- ROLLBACK (manual):
--   drop policy if exists "lectura imagenes contenido autenticado" on storage.objects;
--   drop policy if exists "admin sube imagenes contenido"          on storage.objects;
--   drop policy if exists "admin actualiza imagenes contenido"     on storage.objects;
--   drop policy if exists "admin borra imagenes contenido"         on storage.objects;
--   delete from storage.buckets where id = 'contenido';
-- ============================================================================

insert into storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
values (
  'contenido', 'contenido', true,
  array['image/png','image/jpeg','image/webp','image/svg+xml'], 5242880
)
on conflict (id) do update set
  public             = excluded.public,
  allowed_mime_types = excluded.allowed_mime_types,
  file_size_limit    = excluded.file_size_limit;

-- authenticated SELECT (upsert support; public render uses /object/public/).
drop policy if exists "lectura imagenes contenido autenticado" on storage.objects;
create policy "lectura imagenes contenido autenticado"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'contenido');

drop policy if exists "admin sube imagenes contenido" on storage.objects;
create policy "admin sube imagenes contenido"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'contenido' and public.puede_gestionar_contenido());

drop policy if exists "admin actualiza imagenes contenido" on storage.objects;
create policy "admin actualiza imagenes contenido"
  on storage.objects for update
  to authenticated
  using  (bucket_id = 'contenido' and public.puede_gestionar_contenido())
  with check (bucket_id = 'contenido' and public.puede_gestionar_contenido());

drop policy if exists "admin borra imagenes contenido" on storage.objects;
create policy "admin borra imagenes contenido"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'contenido' and public.puede_gestionar_contenido());
