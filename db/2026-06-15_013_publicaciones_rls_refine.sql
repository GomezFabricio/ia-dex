-- ============================================================================
-- 2026-06-15_013_publicaciones_rls_refine.sql
-- Hardening of the publicaciones RLS per Supabase security advisors (post-011/012).
--
-- (1) Split the publicaciones SELECT policy BY ROLE so the `anon` role never
--     evaluates public.puede_gestionar_contenido():
--       - anon          -> USING (estado = 'publicado')                    (function-free)
--       - authenticated -> USING (estado = 'publicado' OR puede_gestionar_contenido())
--     Behaviour is IDENTICAL to the combined policy (anon sees only published;
--     admins see drafts) but anon no longer needs EXECUTE on the gatekeeper, so we
--     REVOKE it — this removes the /rest/v1/rpc/puede_gestionar_contenido exposure
--     for anon (advisor 0028 anon_security_definer_function_executable) and removes
--     the function-permission edge case migration 011 step 8 was guarding against.
--
-- (2) Drop the public SELECT (listing) policy on storage.objects for the
--     publicaciones bucket. A PUBLIC bucket serves object URLs (getPublicUrl) WITHOUT
--     an object-level SELECT policy; the policy only enabled client-side listing of
--     the whole bucket, which the app never uses (advisor 0025
--     public_bucket_allows_listing). Image rendering via <img src> is unaffected.
--
-- The v_autores_publicos SECURITY DEFINER view (advisor 0010, ERROR) is INTENTIONAL
-- and is NOT changed here: it deliberately exposes only id+nombre+apellido of users
-- who are authors, which is strictly narrower than opening profiles to anon. See
-- design.md Decision 5.
--
-- ROLLBACK (manual):
--   drop policy if exists "lectura publica publicaciones"   on public.publicaciones;
--   drop policy if exists "lectura publicaciones autenticado" on public.publicaciones;
--   create policy "lectura publica publicaciones" on public.publicaciones for select
--     to anon, authenticated
--     using (estado = 'publicado' or public.puede_gestionar_contenido());
--   grant execute on function public.puede_gestionar_contenido() to anon;
--   create policy "lectura publica imagenes publicaciones" on storage.objects for select
--     to anon, authenticated using (bucket_id = 'publicaciones');
-- ============================================================================

-- (1) Role-split SELECT policies on public.publicaciones.
drop policy if exists "lectura publica publicaciones" on public.publicaciones;

create policy "lectura publica publicaciones"
  on public.publicaciones for select
  to anon
  using (estado = 'publicado');

drop policy if exists "lectura publicaciones autenticado" on public.publicaciones;
create policy "lectura publicaciones autenticado"
  on public.publicaciones for select
  to authenticated
  using (estado = 'publicado' or public.puede_gestionar_contenido());

-- anon no longer evaluates the gatekeeper, so the migration-011 grant is no longer needed.
revoke execute on function public.puede_gestionar_contenido() from anon;

-- (2) Drop the bucket-listing SELECT policy; public URL access is unaffected.
drop policy if exists "lectura publica imagenes publicaciones" on storage.objects;
