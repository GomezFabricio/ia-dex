-- ============================================================================
-- 2026-06-15_011_publicaciones.sql
-- Publicaciones: ONE unified content table (blog + per-tema + per-SI content).
--
-- The blog feed, per-tema didactic content, and per-SI content are the SAME rows
-- read through different FK filters (tema_id / clasificacion_si_id / neither).
-- Mirrors live patterns: migration 005 (RLS + puede_gestionar_contenido()),
-- 006 (enlaces jsonb), 007 (slug UNIQUE guarded by pg_constraint), 009 (atomic content).
--
-- Verified via MCP before applying: profiles has only nombre+apellido (no display
-- name) with self-read-only RLS; puede_gestionar_contenido() exists and has EXECUTE
-- granted ONLY to authenticated (migration 005); storage has zero buckets.
--
-- Idempotent and self-contained: create-if-not-exists / guarded constraint /
-- create-or-replace / drop-then-create for trigger + policies. Re-applying is safe.
--
-- NET-NEW pieces this codebase has never had (flagged for review):
--   * a draft/published lifecycle whose SELECT policy FILTERS drafts (step 6) — the
--     ONE deviation from the qual=true of every sibling content table. The single
--     most security-sensitive line: copying USING (true) would leak every draft.
--   * a security_invoker=false author view (step 7) that survives profiles RLS.
--   * GRANT EXECUTE on puede_gestionar_contenido() TO anon (step 8) — first
--     anon-scoped policy in the project to reference that function.
--   * updated_at + maintaining trigger (steps in 4) — first runtime-edited content.
--
-- ROLLBACK (manual):
--   revoke execute on function public.puede_gestionar_contenido() from anon;
--   drop view if exists public.v_autores_publicos;
--   drop trigger if exists publicaciones_set_updated_at on public.publicaciones;
--   drop function if exists public.set_updated_at();
--   drop policy if exists "lectura publica publicaciones"  on public.publicaciones;
--   drop policy if exists "admin inserta publicaciones"    on public.publicaciones;
--   drop policy if exists "admin actualiza publicaciones"  on public.publicaciones;
--   drop policy if exists "admin borra publicaciones"      on public.publicaciones;
--   drop table if exists public.publicaciones cascade;
-- ============================================================================


-- ----------------------------------------------------------------------------
-- STEP 1: CREATE TABLE — the 13 locked columns.
-- autor_id mirrors software.created_by (-> profiles.id, default auth.uid(),
-- on delete set null). tema_id / clasificacion_si_id are nullable single FKs
-- (on delete set null): a publication outlives its taxonomy link as a plain post.
-- ----------------------------------------------------------------------------
create table if not exists public.publicaciones (
  id                   uuid        not null default gen_random_uuid() primary key,
  slug                 text        not null,                 -- UNIQUE added in step 2 (guarded)
  titulo               text        not null,
  cuerpo               text,                                 -- nullable: a draft may have no body yet
  imagen_url           text,                                 -- public Storage URL (bucket 'publicaciones')
  video_url            text,                                 -- YouTube URL, embedded (not self-hosted)
  enlaces              jsonb       not null default '[]'::jsonb,
  tema_id              uuid        references public.temas(id)              on delete set null,
  clasificacion_si_id  uuid        references public.clasificaciones_si(id) on delete set null,
  autor_id             uuid        default auth.uid() references public.profiles(id) on delete set null,
  estado               text        not null default 'borrador' check (estado in ('borrador','publicado')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);


-- ----------------------------------------------------------------------------
-- STEP 2: slug UNIQUE — guarded by pg_constraint (mirror migration 007).
-- The constraint creates its own index; do NOT add a separate unique index.
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'publicaciones_slug_key') then
    alter table public.publicaciones add constraint publicaciones_slug_key unique (slug);
  end if;
end $$;


-- ----------------------------------------------------------------------------
-- STEP 3: Indexes. Partial indexes on the nullable FKs (most blog posts have both
-- NULL). idx_publicaciones_estado_created covers the feed (where estado='publicado'
-- order by created_at desc).
-- ----------------------------------------------------------------------------
create index if not exists idx_publicaciones_estado            on public.publicaciones (estado);
create index if not exists idx_publicaciones_tema_id           on public.publicaciones (tema_id)             where tema_id is not null;
create index if not exists idx_publicaciones_clasificacion_si  on public.publicaciones (clasificacion_si_id) where clasificacion_si_id is not null;
create index if not exists idx_publicaciones_autor_id          on public.publicaciones (autor_id);
create index if not exists idx_publicaciones_estado_created    on public.publicaciones (estado, created_at desc);


-- ----------------------------------------------------------------------------
-- STEP 4: updated_at maintenance trigger.
-- public.set_updated_at() is intentionally a GLOBAL, reusable trigger function:
-- future tables that need updated_at maintenance should ATTACH this same function
-- (create trigger ... execute function public.set_updated_at()) rather than
-- redefining a divergent body under the same name. search_path pinned for hardening.
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
  returns trigger language plpgsql set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists publicaciones_set_updated_at on public.publicaciones;
create trigger publicaciones_set_updated_at
  before update on public.publicaciones
  for each row execute function public.set_updated_at();


-- ----------------------------------------------------------------------------
-- STEP 5: Enable RLS (the rls_auto_enable event trigger already does this on new
-- public tables; explicit here for clarity / safety — idempotent).
-- ----------------------------------------------------------------------------
alter table public.publicaciones enable row level security;


-- ----------------------------------------------------------------------------
-- STEP 6: RLS policies. Writes admin-only via public.puede_gestionar_contenido()
-- (mirror migration 006). SELECT is the ONE deviation: it filters drafts.
--
-- CRITICAL — the single most security-sensitive line is the SELECT policy:
--   USING (estado = 'publicado' OR public.puede_gestionar_contenido())
-- NOT the qual=true of every sibling content table. Copying USING (true) here
-- would leak every borrador (draft) to anonymous visitors.
-- ----------------------------------------------------------------------------
drop policy if exists "lectura publica publicaciones" on public.publicaciones;
create policy "lectura publica publicaciones"
  on public.publicaciones for select
  to anon, authenticated
  using (estado = 'publicado' or public.puede_gestionar_contenido());

drop policy if exists "admin inserta publicaciones" on public.publicaciones;
create policy "admin inserta publicaciones"
  on public.publicaciones for insert
  to authenticated
  with check (public.puede_gestionar_contenido());

drop policy if exists "admin actualiza publicaciones" on public.publicaciones;
create policy "admin actualiza publicaciones"
  on public.publicaciones for update
  to authenticated
  using  (public.puede_gestionar_contenido())
  with check (public.puede_gestionar_contenido());

drop policy if exists "admin borra publicaciones" on public.publicaciones;
create policy "admin borra publicaciones"
  on public.publicaciones for delete
  to authenticated
  using (public.puede_gestionar_contenido());


-- ----------------------------------------------------------------------------
-- STEP 7: Author display view. profiles has only nombre+apellido (both nullable)
-- and self-read-only RLS, so a public publicaciones->profiles join blanks the
-- author. This security_invoker=false view runs as its owner (bypassing profiles
-- RLS) but exposes ONLY id+nombre+apellido and ONLY for users who ARE authors.
--
-- CRITICAL — security_invoker MUST be false. The default in newer Postgres is
-- true, which would re-trigger profiles RLS and blank the author for anon.
-- ----------------------------------------------------------------------------
create or replace view public.v_autores_publicos
  with (security_invoker = false) as
  select p.id, p.nombre, p.apellido
  from public.profiles p
  where exists (select 1 from public.publicaciones pub where pub.autor_id = p.id);

grant select on public.v_autores_publicos to anon, authenticated;


-- ----------------------------------------------------------------------------
-- STEP 8: GRANT EXECUTE on the gatekeeper to anon.
-- The SELECT policy ("lectura publica publicaciones" TO anon, authenticated) is the
-- FIRST anon-scoped policy in the project to reference puede_gestionar_contenido().
-- Migration 005 granted EXECUTE only to authenticated; Postgres does NOT guarantee
-- OR short-circuit in an RLS qual, so for a draft row an anon session would otherwise
-- raise "permission denied for function". The function returns false for anon
-- (auth.uid() is null), so granting EXECUTE safely filters out all drafts.
-- ----------------------------------------------------------------------------
grant execute on function public.puede_gestionar_contenido() to anon;
