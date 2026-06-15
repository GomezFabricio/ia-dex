-- ============================================================================
-- 2026-06-16_016_storage_publicaciones_select_upsert.sql
-- Restore a SELECT policy on storage.objects for the 'publicaciones' bucket so
-- that upsert uploads work again.
--
-- ROOT CAUSE: migration 013 dropped the bucket SELECT policy (advisor 0025,
-- public_bucket_allows_listing). That is correct for ANON — public image
-- rendering uses the /object/public/ endpoint, which needs no SELECT policy.
-- BUT cover uploads use upsert:true (subirImagen), and Supabase Storage upsert
-- runs an INSERT ... ON CONFLICT ... RETURNING under the hood, which REQUIRES a
-- SELECT policy for the uploading role. Without it the upload fails with
-- "new row violates row-level security policy". Plain inserts (the gallery,
-- subirImagenGaleria, upsert:false) are unaffected.
--
-- FIX: SELECT scoped to `authenticated` only. The uploader (an admin) can read
-- the row for the upsert RETURNING; anon still cannot list the bucket (advisor
-- 0025 stays satisfied for anon), and public <img src> rendering is unchanged.
--
-- ROLLBACK (manual):
--   drop policy if exists "lectura imagenes publicaciones autenticado" on storage.objects;
-- ============================================================================

drop policy if exists "lectura imagenes publicaciones autenticado" on storage.objects;
create policy "lectura imagenes publicaciones autenticado"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'publicaciones');
