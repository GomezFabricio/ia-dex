-- ============================================================================
-- 2026-06-15_012_storage_publicaciones.sql
-- Storage for publicaciones images: a PUBLIC bucket + storage.objects RLS.
--
-- ISOLATED from migration 011 on purpose: creating policies on schema `storage`
-- MAY require owner perms the MCP role lacks. Keeping it separate means a
-- storage-permission failure cannot block the table migration (011).
--
-- Verified via MCP before applying: storage has zero buckets and zero
-- storage.objects policies — this is greenfield (first Storage use in the project).
--
-- Bucket is PUBLIC (public-read) because published blog images are public content
-- and the app renders imagen_url directly in <img src> (no signed-URL refresh logic
-- exists). Writes are still admin-gated via public.puede_gestionar_contenido().
-- Path convention (enforced client-side): publicaciones/{publicacion_id}/{filename}.
--
-- GROUND-TRUTH GAP: if the storage.objects policy DDL fails on owner perms at apply,
-- fall back to creating the bucket + policies via the Supabase dashboard and keep
-- this file as the SQL-of-record for parity.
--
-- ROLLBACK (manual):
--   drop policy if exists "lectura publica imagenes publicaciones" on storage.objects;
--   drop policy if exists "admin sube imagenes publicaciones"      on storage.objects;
--   drop policy if exists "admin actualiza imagenes publicaciones" on storage.objects;
--   drop policy if exists "admin borra imagenes publicaciones"     on storage.objects;
--   delete from storage.buckets where id = 'publicaciones';
-- ============================================================================


-- ----------------------------------------------------------------------------
-- STEP 1: the bucket. public=true, image MIME allowlist, 5 MB (5242880 bytes).
-- ON CONFLICT keeps re-application idempotent and lets us tune the limits later.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
values (
  'publicaciones', 'publicaciones', true,
  array['image/png','image/jpeg','image/webp','image/svg+xml'], 5242880
)
on conflict (id) do update set
  public             = excluded.public,
  allowed_mime_types = excluded.allowed_mime_types,
  file_size_limit    = excluded.file_size_limit;


-- ----------------------------------------------------------------------------
-- STEP 2: storage.objects policies, scoped to the 'publicaciones' bucket.
-- SELECT open (public read); writes admin-only via puede_gestionar_contenido().
-- ----------------------------------------------------------------------------
drop policy if exists "lectura publica imagenes publicaciones" on storage.objects;
create policy "lectura publica imagenes publicaciones"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'publicaciones');

drop policy if exists "admin sube imagenes publicaciones" on storage.objects;
create policy "admin sube imagenes publicaciones"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'publicaciones' and public.puede_gestionar_contenido());

drop policy if exists "admin actualiza imagenes publicaciones" on storage.objects;
create policy "admin actualiza imagenes publicaciones"
  on storage.objects for update
  to authenticated
  using  (bucket_id = 'publicaciones' and public.puede_gestionar_contenido())
  with check (bucket_id = 'publicaciones' and public.puede_gestionar_contenido());

drop policy if exists "admin borra imagenes publicaciones" on storage.objects;
create policy "admin borra imagenes publicaciones"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'publicaciones' and public.puede_gestionar_contenido());
